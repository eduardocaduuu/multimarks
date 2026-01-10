import * as XLSX from 'xlsx';
import type { RawRow } from '@/types';
import {
  normalizeString,
  normalizeNameForDisplay,
  removeAccents,
  similarityRatio,
  parseMoneyToCents,
  parseQuantity,
} from './utils';

// ===== TYPES =====

export interface GeralColumnMapping {
  gerencia: string | null;
  setor: string | null;
  codigoRevendedora: string | null;
  nomeRevendedora: string | null;
  cicloFaturamento: string | null;
  tipo: string | null;
  quantidadeItens: string | null;
  valorPraticado: string | null;
}

export interface GeralTransactionRow {
  gerencia: string;
  setor: string;
  codigoRevendedora: string;
  codigoRevendedoraOriginal: string;
  nomeRevendedora: string;
  nomeRevendedoraNormalized: string;
  cicloFaturamento: string;
  tipo: string; // "Venda", "Brinde", "Doação", etc.
  quantidadeItens: number;
  valorPraticado: number; // em centavos
}

export interface GeralParseResult {
  success: boolean;
  transactions: GeralTransactionRow[];
  errors: string[];
  warnings: string[];
  rowCount: number;
  availableCiclos: string[];
  diagnostico?: {
    totalLinhas: number;
    linhasValidas: number;
    excluidosPorCodigoVazio: number;
    excluidosPorNomeVazio: number;
  };
}

// Revendedor ativo derivado das transações
export interface RevendedorAtivo {
  codigoRevendedora: string;
  codigoRevendedoraOriginal: string;
  nomeRevendedora: string;
  nomeRevendedoraNormalized: string;
  setor: string;
  gerencia: string;
  cicloFaturamento: string;
  // Métricas agregadas das transações Tipo=Venda no ciclo
  totalItens: number;
  totalValor: number; // em centavos
  transactionCount: number;
}

// ===== COLUMN DETECTION =====

const GERAL_EXPECTED_COLUMNS = {
  gerencia: ['gerencia', 'gerência', 'ger'],
  setor: ['setor', 'setor revendedora', 'setorrevendedora'],
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
  cicloFaturamento: [
    'ciclofaturamento',
    'ciclo faturamento',
    'ciclo_faturamento',
    'ciclofat',
    'ciclo',
  ],
  tipo: ['tipo', 'tipovenda', 'tipo venda', 'tipo_venda'],
  quantidadeItens: [
    'quantidadeitens',
    'quantidade itens',
    'quantidade',
    'qtd',
    'qtde',
    'itens',
    'quantidade_itens',
  ],
  valorPraticado: [
    'valorpraticado',
    'valor praticado',
    'valor',
    'vlr',
    'valor_praticado',
    'valortotal',
    'valor total',
  ],
};

const GERAL_REQUIRED_COLUMNS = ['codigoRevendedora', 'nomeRevendedora', 'setor', 'cicloFaturamento', 'tipo'];
const GERAL_OPTIONAL_COLUMNS = ['gerencia', 'quantidadeItens', 'valorPraticado'];

const GERAL_COLUMN_DISPLAY_NAMES: Record<keyof GeralColumnMapping, string> = {
  gerencia: 'Gerência',
  setor: 'Setor',
  codigoRevendedora: 'CodigoRevendedora',
  nomeRevendedora: 'NomeRevendedora',
  cicloFaturamento: 'CicloFaturamento',
  tipo: 'Tipo',
  quantidadeItens: 'QuantidadeItens',
  valorPraticado: 'ValorPraticado',
};

function normalizeHeader(header: string): string {
  return removeAccents(normalizeString(header)).replace(/[^a-z0-9\s]/g, '').trim();
}

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

  // Third pass: fuzzy match
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

function mapGeralColumns(headers: string[]): {
  mapping: GeralColumnMapping;
  missingRequired: string[];
  warnings: string[];
} {
  const mapping: GeralColumnMapping = {
    gerencia: null,
    setor: null,
    codigoRevendedora: null,
    nomeRevendedora: null,
    cicloFaturamento: null,
    tipo: null,
    quantidadeItens: null,
    valorPraticado: null,
  };

  const usedHeaders = new Set<string>();
  const warnings: string[] = [];

  for (const [key, variants] of Object.entries(GERAL_EXPECTED_COLUMNS)) {
    const match = findBestMatch(headers, variants, usedHeaders);
    if (match) {
      mapping[key as keyof GeralColumnMapping] = match;
      usedHeaders.add(match);
    }
  }

  const missingRequired: string[] = [];
  for (const col of GERAL_REQUIRED_COLUMNS) {
    if (!mapping[col as keyof GeralColumnMapping]) {
      missingRequired.push(col);
    }
  }

  const optionalMissing = GERAL_OPTIONAL_COLUMNS.filter(
    col => !mapping[col as keyof GeralColumnMapping]
  );
  if (optionalMissing.length > 0) {
    const missingNames = optionalMissing.map(
      col => GERAL_COLUMN_DISPLAY_NAMES[col as keyof GeralColumnMapping]
    );
    warnings.push(`Colunas opcionais não encontradas: ${missingNames.join(', ')}`);
  }

  return { mapping, missingRequired, warnings };
}

// ===== NORMALIZATION =====

/**
 * Normaliza CodigoRevendedora: string, trim, remove ".0"
 */
function normalizeCodigoRevendedora(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  let str = value.toString().trim();
  // Remove .0 suffix (common in Excel number->string conversion)
  if (str.endsWith('.0')) {
    str = str.slice(0, -2);
  }
  return str;
}

/**
 * Normaliza Tipo para categorias padrão
 */
function normalizeTipo(value: string | undefined | null): string {
  if (!value) return 'Outro';
  const lower = value.toString().toLowerCase().trim();

  if (lower.includes('venda')) return 'Venda';
  if (lower.includes('brinde')) return 'Brinde';
  if (lower.includes('doacao') || lower.includes('doação')) return 'Doação';

  return 'Outro';
}

// ===== MAIN PARSER =====

export async function parseGeralFile(file: File): Promise<GeralParseResult> {
  const result: GeralParseResult = {
    success: false,
    transactions: [],
    errors: [],
    warnings: [],
    rowCount: 0,
    availableCiclos: [],
  };

  try {
    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      result.errors.push(`Arquivo vazio ou sem planilhas: ${file.name}`);
      return result;
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData: RawRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (jsonData.length === 0) {
      result.errors.push(`Planilha Geral vazia: ${file.name}`);
      return result;
    }

    result.rowCount = jsonData.length;

    const headers = Object.keys(jsonData[0]);
    const { mapping, missingRequired, warnings: mappingWarnings } = mapGeralColumns(headers);
    result.warnings.push(...mappingWarnings);

    if (missingRequired.length > 0) {
      const missingNames = missingRequired.map(
        col => GERAL_COLUMN_DISPLAY_NAMES[col as keyof GeralColumnMapping]
      );
      result.errors.push(
        `Colunas obrigatórias faltando na planilha Geral: ${missingNames.join(', ')}`
      );
      return result;
    }

    console.log('[GERAL] Mapeamento de colunas:', mapping);

    // Diagnóstico
    let excluidosPorCodigoVazio = 0;
    let excluidosPorNomeVazio = 0;
    const ciclosSet = new Set<string>();

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2;

      try {
        const getValue = (key: keyof GeralColumnMapping): string => {
          const colName = mapping[key];
          if (!colName) return '';
          const value = row[colName];
          return value?.toString() ?? '';
        };

        const codigoOriginal = normalizeCodigoRevendedora(getValue('codigoRevendedora'));
        if (!codigoOriginal) {
          excluidosPorCodigoVazio++;
          continue;
        }

        const nomeOriginal = normalizeNameForDisplay(getValue('nomeRevendedora'));
        if (!nomeOriginal) {
          excluidosPorNomeVazio++;
          continue;
        }

        const cicloFaturamento = getValue('cicloFaturamento').trim();
        if (cicloFaturamento) {
          ciclosSet.add(cicloFaturamento);
        }

        const transaction: GeralTransactionRow = {
          gerencia: getValue('gerencia').trim() || 'Não informado',
          setor: getValue('setor').trim() || 'Não informado',
          codigoRevendedora: normalizeString(codigoOriginal),
          codigoRevendedoraOriginal: codigoOriginal,
          nomeRevendedora: nomeOriginal,
          nomeRevendedoraNormalized: removeAccents(normalizeString(nomeOriginal)),
          cicloFaturamento,
          tipo: normalizeTipo(getValue('tipo')),
          quantidadeItens: parseQuantity(getValue('quantidadeItens')),
          valorPraticado: parseMoneyToCents(getValue('valorPraticado')),
        };

        result.transactions.push(transaction);
      } catch (err) {
        result.warnings.push(`Linha ${rowNum}: Erro ao processar - ${err}`);
      }
    }

    result.availableCiclos = Array.from(ciclosSet).sort();
    result.diagnostico = {
      totalLinhas: jsonData.length,
      linhasValidas: result.transactions.length,
      excluidosPorCodigoVazio,
      excluidosPorNomeVazio,
    };

    console.log(`[GERAL] Total de transações: ${result.transactions.length}`);
    console.log(`[GERAL] Ciclos disponíveis: ${result.availableCiclos.join(', ')}`);

    if (result.transactions.length === 0) {
      result.errors.push('Nenhuma transação válida encontrada na planilha Geral');
      return result;
    }

    result.success = true;
  } catch (err) {
    result.errors.push(`Erro ao ler planilha Geral ${file.name}: ${err}`);
  }

  return result;
}

/**
 * Deriva revendedores ativos a partir das transações
 * REGRA: Ativo = Tipo="Venda" + CicloFaturamento = ciclo selecionado + deduplicação por código
 */
export function deriveAtivosFromTransactions(
  transactions: GeralTransactionRow[],
  selectedCiclo: string
): {
  ativos: RevendedorAtivo[];
  diagnostico: {
    totalTransacoes: number;
    transacoesNoCiclo: number;
    transacoesVendaNoCiclo: number;
    revendedoresUnicos: number;
  };
} {
  // Filtrar: CicloFaturamento = ciclo selecionado E Tipo = "Venda"
  const filtered = transactions.filter(
    t => t.cicloFaturamento === selectedCiclo && t.tipo === 'Venda'
  );

  console.log(`[ATIVOS] Ciclo selecionado: ${selectedCiclo}`);
  console.log(`[ATIVOS] Transações no ciclo com Tipo=Venda: ${filtered.length}`);

  // Agrupar por CodigoRevendedora (deduplicação)
  const revendedorMap = new Map<string, RevendedorAtivo>();

  for (const t of filtered) {
    const existing = revendedorMap.get(t.codigoRevendedora);

    if (existing) {
      // Agregar métricas
      existing.totalItens += t.quantidadeItens;
      existing.totalValor += t.valorPraticado;
      existing.transactionCount++;
    } else {
      revendedorMap.set(t.codigoRevendedora, {
        codigoRevendedora: t.codigoRevendedora,
        codigoRevendedoraOriginal: t.codigoRevendedoraOriginal,
        nomeRevendedora: t.nomeRevendedora,
        nomeRevendedoraNormalized: t.nomeRevendedoraNormalized,
        setor: t.setor,
        gerencia: t.gerencia,
        cicloFaturamento: t.cicloFaturamento,
        totalItens: t.quantidadeItens,
        totalValor: t.valorPraticado,
        transactionCount: 1,
      });
    }
  }

  const ativos = Array.from(revendedorMap.values());

  // Diagnóstico
  const transacoesNoCiclo = transactions.filter(t => t.cicloFaturamento === selectedCiclo).length;

  console.log(`[ATIVOS] Revendedores únicos (ativos): ${ativos.length}`);

  return {
    ativos,
    diagnostico: {
      totalTransacoes: transactions.length,
      transacoesNoCiclo,
      transacoesVendaNoCiclo: filtered.length,
      revendedoresUnicos: ativos.length,
    },
  };
}

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
