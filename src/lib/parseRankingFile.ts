import * as XLSX from 'xlsx';
import type {
  RawRow,
  RankingColumnMapping,
  RankingParseResult,
  RankingSectorRow,
} from '@/types';
import {
  normalizeString,
  removeAccents,
  similarityRatio,
  parseMoneyToCents,
  parseQuantity,
} from './utils';

// Expected column names for ranking file (normalized)
const RANKING_EXPECTED_COLUMNS = {
  setor: ['setor'],
  quantidadeItens: [
    'quantidadeitens',
    'quantidade itens',
    'qtd itens',
    'itens',
    'quantidade_itens',
    'qtditens',
  ],
  quantidadeRevendedor: [
    'quantidaderevendedor',
    'quantidade revendedor',
    'qtd revendedor',
    'revendedores',
    'qtd rev',
    'quantidade_revendedor',
    'qtdrevendedor',
    'qtd revendedores',
  ],
  valorPraticado: [
    'valorpraticado',
    'valor praticado',
    'valor',
    'valor total',
    'valor_praticado',
    'valortotal',
    'faturamento',
  ],
};

// All columns are required for ranking file
const RANKING_REQUIRED_COLUMNS = [
  'setor',
  'quantidadeItens',
  'quantidadeRevendedor',
  'valorPraticado',
];

// Display names for error messages
const RANKING_COLUMN_DISPLAY_NAMES: Record<keyof RankingColumnMapping, string> = {
  setor: 'Setor',
  quantidadeItens: 'QuantidadeItens',
  quantidadeRevendedor: 'QuantidadeRevendedor',
  valorPraticado: 'ValorPraticado',
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
 * Map ranking spreadsheet headers to expected columns
 */
function mapRankingColumns(headers: string[]): {
  mapping: RankingColumnMapping;
  missingRequired: string[];
  warnings: string[];
} {
  const mapping: RankingColumnMapping = {
    setor: null,
    quantidadeItens: null,
    quantidadeRevendedor: null,
    valorPraticado: null,
  };

  const usedHeaders = new Set<string>();
  const warnings: string[] = [];

  // Map each expected column
  for (const [key, variants] of Object.entries(RANKING_EXPECTED_COLUMNS)) {
    const match = findBestMatch(headers, variants, usedHeaders);
    if (match) {
      mapping[key as keyof RankingColumnMapping] = match;
      usedHeaders.add(match);
    }
  }

  // Check for missing required columns
  const missingRequired: string[] = [];
  for (const col of RANKING_REQUIRED_COLUMNS) {
    if (!mapping[col as keyof RankingColumnMapping]) {
      missingRequired.push(col);
    }
  }

  return { mapping, missingRequired, warnings };
}

/**
 * Parse a ranking file (xlsx or csv) and extract sector data
 */
export async function parseRankingFile(file: File): Promise<RankingParseResult> {
  const result: RankingParseResult = {
    success: false,
    data: null,
    errors: [],
    warnings: [],
    rowCount: 0,
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
      result.errors.push(`Planilha de ranking vazia: ${file.name}`);
      return result;
    }

    result.rowCount = jsonData.length;

    // Get headers from the first row's keys
    const headers = Object.keys(jsonData[0]);

    // Map columns
    const { mapping, missingRequired, warnings: mappingWarnings } = mapRankingColumns(headers);

    result.warnings.push(...mappingWarnings);

    if (missingRequired.length > 0) {
      const missingNames = missingRequired.map(
        col => RANKING_COLUMN_DISPLAY_NAMES[col as keyof RankingColumnMapping]
      );
      result.errors.push(
        `Colunas obrigatórias faltando no arquivo de ranking: ${missingNames.join(', ')}`
      );
      return result;
    }

    // Build sector data map
    const sectors = new Map<string, RankingSectorRow>();
    let totalRevendedores = 0;
    let totalItens = 0;
    let totalValor = 0;

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2; // +2 because Excel is 1-indexed and has header row

      try {
        const getValue = (key: keyof RankingColumnMapping): string => {
          const colName = mapping[key];
          if (!colName) return '';
          const value = row[colName];
          return value?.toString() ?? '';
        };

        const setorRaw = getValue('setor').trim();
        if (!setorRaw) {
          result.warnings.push(`Linha ${rowNum}: Setor vazio, linha ignorada`);
          continue;
        }

        const setorNormalized = normalizeString(setorRaw);
        const quantidadeItens = parseQuantity(getValue('quantidadeItens'));
        const quantidadeRevendedor = parseQuantity(getValue('quantidadeRevendedor'));
        const valorPraticado = parseMoneyToCents(getValue('valorPraticado'));

        // Check if sector already exists (merge if so)
        const existing = sectors.get(setorNormalized);
        if (existing) {
          existing.quantidadeItens += quantidadeItens;
          existing.quantidadeRevendedor += quantidadeRevendedor;
          existing.valorPraticado += valorPraticado;
        } else {
          sectors.set(setorNormalized, {
            setor: setorRaw,
            setorNormalized,
            quantidadeItens,
            quantidadeRevendedor,
            valorPraticado,
          });
        }

        totalRevendedores += quantidadeRevendedor;
        totalItens += quantidadeItens;
        totalValor += valorPraticado;
      } catch (err) {
        result.warnings.push(`Linha ${rowNum}: Erro ao processar - ${err}`);
      }
    }

    if (sectors.size === 0) {
      result.errors.push(`Nenhum setor válido encontrado no arquivo de ranking`);
      return result;
    }

    result.data = {
      sectors,
      totalRevendedores,
      totalItens,
      totalValor,
    };

    result.success = true;
  } catch (err) {
    result.errors.push(`Erro ao ler arquivo de ranking ${file.name}: ${err}`);
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
