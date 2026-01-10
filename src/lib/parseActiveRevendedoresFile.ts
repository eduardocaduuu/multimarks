import * as XLSX from 'xlsx';
import type {
  RawRow,
  ActiveRevendedoresColumnMapping,
  ActiveRevendedoresParseResult,
} from '@/types';
import {
  normalizeString,
  normalizeNameForDisplay,
  removeAccents,
  similarityRatio,
} from './utils';

// Expected column names for active revendedores file (normalized)
const ACTIVE_EXPECTED_COLUMNS = {
  codigoRevendedora: [
    'codigorevendedora',
    'codigo revendedora',
    'codigo',
    'cod',
    'codigo_revendedora',
    'codrevendedora',
    'cod revendedora',
  ],
  nomeRevendedora: [
    'nomerevendedora',
    'nome revendedora',
    'revendedora',
    'nome',
    'nome_revendedora',
  ],
  setor: ['setor'],
  cicloCaptacao: [
    'ciclocaptacao',
    'ciclo captacao',
    'ciclo',
    'ciclo_captacao',
    'ciclocapt',
  ],
};

// Required columns
const ACTIVE_REQUIRED_COLUMNS = ['codigoRevendedora', 'nomeRevendedora', 'setor'];

// Ciclo is optional
const ACTIVE_OPTIONAL_COLUMNS = ['cicloCaptacao'];

// Display names for error messages
const ACTIVE_COLUMN_DISPLAY_NAMES: Record<keyof ActiveRevendedoresColumnMapping, string> = {
  codigoRevendedora: 'CodigoRevendedora',
  nomeRevendedora: 'NomeRevendedora',
  setor: 'Setor',
  cicloCaptacao: 'CicloCaptacao',
};

/**
 * Normalize a header for comparison
 */
function normalizeHeader(header: string): string {
  return removeAccents(normalizeString(header)).replace(/[^a-z0-9\s]/g, '').trim();
}

/**
 * Find the best matching column from headers for an expected column
 */
function findBestMatch(
  headers: string[],
  expectedVariants: string[],
  usedHeaders: Set<string>
): string | null {
  const normalizedHeaders = headers.map(h => ({
    original: h,
    normalized: normalizeHeader(h),
  }));

  // First pass: exact matches
  for (const variant of expectedVariants) {
    for (const header of normalizedHeaders) {
      if (usedHeaders.has(header.original)) continue;
      if (header.normalized === variant) {
        return header.original;
      }
    }
  }

  // Second pass: contains match
  for (const variant of expectedVariants) {
    for (const header of normalizedHeaders) {
      if (usedHeaders.has(header.original)) continue;
      if (header.normalized.includes(variant) || variant.includes(header.normalized)) {
        return header.original;
      }
    }
  }

  // Third pass: fuzzy match with high threshold
  for (const variant of expectedVariants) {
    for (const header of normalizedHeaders) {
      if (usedHeaders.has(header.original)) continue;
      const similarity = similarityRatio(header.normalized, variant);
      if (similarity >= 0.8) {
        return header.original;
      }
    }
  }

  return null;
}

/**
 * Map active revendedores spreadsheet headers to expected columns
 */
function mapActiveColumns(headers: string[]): {
  mapping: ActiveRevendedoresColumnMapping;
  missingRequired: string[];
  warnings: string[];
} {
  const mapping: ActiveRevendedoresColumnMapping = {
    codigoRevendedora: null,
    nomeRevendedora: null,
    setor: null,
    cicloCaptacao: null,
  };

  const usedHeaders = new Set<string>();
  const warnings: string[] = [];

  // Map each expected column
  for (const [key, variants] of Object.entries(ACTIVE_EXPECTED_COLUMNS)) {
    const match = findBestMatch(headers, variants, usedHeaders);
    if (match) {
      mapping[key as keyof ActiveRevendedoresColumnMapping] = match;
      usedHeaders.add(match);
    }
  }

  // Check for missing required columns
  const missingRequired: string[] = [];
  for (const col of ACTIVE_REQUIRED_COLUMNS) {
    if (!mapping[col as keyof ActiveRevendedoresColumnMapping]) {
      missingRequired.push(col);
    }
  }

  // Add warnings for optional missing columns
  const optionalMissing = ACTIVE_OPTIONAL_COLUMNS.filter(
    col => !mapping[col as keyof ActiveRevendedoresColumnMapping]
  );

  if (optionalMissing.length > 0) {
    const missingNames = optionalMissing.map(
      col => ACTIVE_COLUMN_DISPLAY_NAMES[col as keyof ActiveRevendedoresColumnMapping]
    );
    warnings.push(`Coluna opcional não encontrada: ${missingNames.join(', ')}`);
  }

  return { mapping, missingRequired, warnings };
}

/**
 * Normalize codigoRevendedora to string (handle numbers)
 */
function normalizeCodigoRevendedora(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  // Convert to string and trim
  return value.toString().trim();
}

/**
 * Parse a active revendedores file (xlsx or csv) and extract active revendedores
 */
export async function parseActiveRevendedoresFile(
  file: File
): Promise<ActiveRevendedoresParseResult> {
  const result: ActiveRevendedoresParseResult = {
    success: false,
    activeRevendedores: [],
    errors: [],
    warnings: [],
    rowCount: 0,
    hasCicloColumn: false,
  };

  try {
    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      result.errors.push(`Arquivo vazio ou sem planilhas: ${file.name}`);
      return result;
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData: RawRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (jsonData.length === 0) {
      result.errors.push(`Planilha de revendedores ativos vazia: ${file.name}`);
      return result;
    }

    result.rowCount = jsonData.length;

    // Get headers from the first row's keys
    const headers = Object.keys(jsonData[0]);

    // Map columns
    const columnMappingResult = mapActiveColumns(headers);
    const mapping = columnMappingResult.mapping;
    const missingRequired = columnMappingResult.missingRequired;
    const mappingWarnings = columnMappingResult.warnings;

    result.warnings.push(...mappingWarnings);

    // Check if ciclo column exists
    result.hasCicloColumn = mapping.cicloCaptacao !== null;

    if (missingRequired.length > 0) {
      const missingNames = missingRequired.map(
        col => ACTIVE_COLUMN_DISPLAY_NAMES[col as keyof ActiveRevendedoresColumnMapping]
      );
      result.errors.push(
        `Colunas obrigatórias faltando no arquivo de revendedores ativos: ${missingNames.join(', ')}`
      );
      return result;
    }

    // Track unique codigoRevendedora and nomeRevendedora
    const seenCodigos = new Set<string>();
    const seenNomes = new Map<string, string>(); // normalized -> original codigo

    // Diagnóstico de exclusões
    let excluidosPorCodigoVazio = 0;
    let excluidosPorNomeVazio = 0;
    let excluidosPorCodigoDuplicado = 0;

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2; // +2 because Excel is 1-indexed and has header row

      try {
        const getValue = (key: keyof ActiveRevendedoresColumnMapping): string => {
          const colName = mapping[key];
          if (!colName) return '';
          const value = row[colName];
          return value?.toString() ?? '';
        };

        const codigoOriginal = normalizeCodigoRevendedora(
          getValue('codigoRevendedora')
        );
        if (!codigoOriginal) {
          result.warnings.push(`Linha ${rowNum}: CodigoRevendedora vazio, linha ignorada`);
          excluidosPorCodigoVazio++;
          continue;
        }

        const nomeOriginal = normalizeNameForDisplay(getValue('nomeRevendedora'));
        if (!nomeOriginal) {
          result.warnings.push(`Linha ${rowNum}: NomeRevendedora vazio, linha ignorada`);
          excluidosPorNomeVazio++;
          continue;
        }

        const setor = getValue('setor').trim() || 'Não informado';
        const cicloRaw = getValue('cicloCaptacao').trim();
        const ciclo = cicloRaw || null;

        // Normalize codigo as string for comparison
        const codigoNormalized = normalizeString(codigoOriginal);
        const nomeNormalized = removeAccents(normalizeString(nomeOriginal));

        // Check for duplicate codigo
        if (seenCodigos.has(codigoNormalized)) {
          result.warnings.push(
            `Linha ${rowNum}: CodigoRevendedora duplicado "${codigoOriginal}", linha ignorada`
          );
          excluidosPorCodigoDuplicado++;
          continue;
        }

        // Check for duplicate nome (different codigo)
        const existingCodigo = seenNomes.get(nomeNormalized);
        if (existingCodigo && existingCodigo !== codigoNormalized) {
          result.warnings.push(
            `Linha ${rowNum}: NomeRevendedora "${nomeOriginal}" já existe com código diferente "${existingCodigo}" vs "${codigoOriginal}"`
          );
        }

        seenCodigos.add(codigoNormalized);
        if (!seenNomes.has(nomeNormalized)) {
          seenNomes.set(nomeNormalized, codigoNormalized);
        }

        result.activeRevendedores.push({
          codigoRevendedora: codigoNormalized,
          codigoRevendedoraOriginal: codigoOriginal,
          nomeRevendedora: nomeOriginal,
          nomeRevendedoraNormalized: nomeNormalized,
          setor,
          cicloCaptacao: ciclo,
        });
      } catch (err) {
        result.warnings.push(`Linha ${rowNum}: Erro ao processar - ${err}`);
      }
    }

    // Adicionar diagnóstico
    result.diagnostico = {
      totalLinhas: jsonData.length,
      excluidosPorCodigoVazio,
      excluidosPorNomeVazio,
      excluidosPorCodigoDuplicado,
      registrosValidos: result.activeRevendedores.length,
    };

    if (result.activeRevendedores.length === 0) {
      result.errors.push(`Nenhum revendedor ativo válido encontrado no arquivo`);
      return result;
    }

    result.success = true;
  } catch (err) {
    result.errors.push(`Erro ao ler arquivo de revendedores ativos ${file.name}: ${err}`);
  }

  return result;
}

/**
 * Read file as ArrayBuffer
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      if (e.target?.result instanceof ArrayBuffer) {
        resolve(e.target.result);
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
