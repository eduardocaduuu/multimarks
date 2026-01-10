import { ColumnMapping } from '@/types';
import { normalizeString, removeAccents, similarityRatio } from './utils';

// Expected column names (normalized)
const EXPECTED_COLUMNS = {
  setor: ['setor'],
  nomeRevendedora: ['nomerevendedora', 'nome revendedora', 'revendedora', 'nome'],
  cicloCaptacao: ['ciclocaptacao', 'ciclo captacao', 'ciclo', 'ciclo_captacao'],
  codigoProduto: ['codigoproduto', 'codigo produto', 'codigo', 'sku', 'codigo_produto', 'cod produto'],
  nomeProduto: ['nomeproduto', 'nome produto', 'produto', 'nome_produto', 'descricao'],
  tipo: ['tipo', 'tipo transacao', 'tipo_transacao', 'tipotransacao'],
  quantidadeItens: ['quantidadeitens', 'quantidade itens', 'quantidade', 'qtd', 'qtd itens', 'quantidade_itens'],
  valorPraticado: ['valorpraticado', 'valor praticado', 'valor', 'preco', 'valor_praticado', 'valortotal', 'valor total'],
  meioCaptacao: ['meiocaptacao', 'meio captacao', 'meio', 'meio_captacao', 'canal'],
  tipoEntrega: ['tipoentrega', 'tipo entrega', 'entrega', 'tipo_entrega', 'modalidade entrega'],
  // Colunas opcionais de faturamento
  statusFaturamento: [
    'statusfaturamento', 'status faturamento', 'status_faturamento',
    'statuspedido', 'status pedido', 'status_pedido', 'status',
    'situacao', 'situacaopedido', 'situacao pedido',
    'faturado', 'faturamento'
  ],
  cicloFaturamento: [
    'ciclofaturamento', 'ciclo faturamento', 'ciclo_faturamento',
    'ciclofat', 'ciclo fat', 'ciclo_fat'
  ],
  dataFaturamento: [
    'datafaturamento', 'data faturamento', 'data_faturamento',
    'dtfaturamento', 'dt faturamento', 'dt_faturamento',
    'datanf', 'data nf', 'data_nf',
    'dataemissao', 'data emissao', 'data_emissao'
  ],
};

// Required columns that must be present
const REQUIRED_COLUMNS = [
  'nomeRevendedora',
  'tipo',
  'quantidadeItens',
  'valorPraticado',
];

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

// Colunas de faturamento (todas opcionais)
const BILLING_COLUMNS = ['statusFaturamento', 'cicloFaturamento', 'dataFaturamento'];

/**
 * Map spreadsheet headers to expected columns
 */
export function mapColumns(headers: string[]): {
  mapping: ColumnMapping;
  missingRequired: string[];
  warnings: string[];
  billingColumnsDetected: string[];
} {
  const mapping: ColumnMapping = {
    setor: null,
    nomeRevendedora: null,
    cicloCaptacao: null,
    codigoProduto: null,
    nomeProduto: null,
    tipo: null,
    quantidadeItens: null,
    valorPraticado: null,
    meioCaptacao: null,
    tipoEntrega: null,
    statusFaturamento: null,
    cicloFaturamento: null,
    dataFaturamento: null,
  };

  const usedHeaders = new Set<string>();
  const warnings: string[] = [];
  const billingColumnsDetected: string[] = [];

  // Map each expected column
  for (const [key, variants] of Object.entries(EXPECTED_COLUMNS)) {
    const match = findBestMatch(headers, variants, usedHeaders);
    if (match) {
      mapping[key as keyof ColumnMapping] = match;
      usedHeaders.add(match);

      // Track billing columns
      if (BILLING_COLUMNS.includes(key)) {
        billingColumnsDetected.push(key);
      }
    }
  }

  // Check for missing required columns
  const missingRequired: string[] = [];
  for (const col of REQUIRED_COLUMNS) {
    if (!mapping[col as keyof ColumnMapping]) {
      missingRequired.push(col);
    }
  }

  // Add warnings for optional missing columns (exclude billing columns from warning)
  const optionalMissing = Object.keys(EXPECTED_COLUMNS).filter(
    col => !REQUIRED_COLUMNS.includes(col) &&
           !BILLING_COLUMNS.includes(col) &&
           !mapping[col as keyof ColumnMapping]
  );

  if (optionalMissing.length > 0) {
    warnings.push(`Colunas opcionais não encontradas: ${optionalMissing.join(', ')}`);
  }

  return { mapping, missingRequired, warnings, billingColumnsDetected };
}

/**
 * Get user-friendly column name
 */
export function getColumnDisplayName(key: keyof ColumnMapping): string {
  const displayNames: Record<keyof ColumnMapping, string> = {
    setor: 'Setor',
    nomeRevendedora: 'NomeRevendedora',
    cicloCaptacao: 'CicloCaptacao',
    codigoProduto: 'CodigoProduto',
    nomeProduto: 'NomeProduto',
    tipo: 'Tipo',
    quantidadeItens: 'QuantidadeItens',
    valorPraticado: 'ValorPraticado',
    meioCaptacao: 'Meio Captacao',
    tipoEntrega: 'Tipo Entrega',
    statusFaturamento: 'Status Faturamento',
    cicloFaturamento: 'Ciclo Faturamento',
    dataFaturamento: 'Data Faturamento',
  };
  return displayNames[key] || key;
}
