import { BrandId } from './index';

// ===== RANKING FILE TYPES =====

// Ranking spreadsheet row (aggregated by sector from external report)
export interface RankingSectorRow {
  setor: string;
  setorNormalized: string;
  quantidadeItens: number;
  quantidadeRevendedor: number;
  valorPraticado: number; // In cents
}

// Parsed ranking data
export interface RankingData {
  sectors: Map<string, RankingSectorRow>;
  totalRevendedores: number;
  totalItens: number;
  totalValor: number; // In cents
}

// Upload state for ranking file
export interface RankingUploadState {
  file: File | null;
  fileName: string | null;
  status: 'empty' | 'loading' | 'loaded' | 'error';
  error: string | null;
  rowCount: number;
}

// Column mapping for ranking spreadsheet
export interface RankingColumnMapping {
  setor: string | null;
  quantidadeItens: string | null;
  quantidadeRevendedor: string | null;
  valorPraticado: string | null;
}

// Parsing result for ranking file
export interface RankingParseResult {
  success: boolean;
  data: RankingData | null;
  errors: string[];
  warnings: string[];
  rowCount: number;
}

// ===== SECTOR ACTIVITY TYPES =====

// Active revendedor in a ciclo (calculated from detailed brand data)
export interface ActiveRevendedor {
  nome: string;
  nomeNormalized: string;
  setor: string;
  setorNormalized: string;
  itens: number;
  valor: number; // In cents
  brands: Set<BrandId>;
}

// Sector activity comparison row (calculated vs ranking)
export interface SectorActivityRow {
  setor: string;
  setorNormalized: string;
  // Calculated from detailed brand data
  revendedoresAtivosCalc: number;
  itensCalc: number;
  valorCalc: number; // In cents
  // From ranking spreadsheet
  revendedoresRanking: number;
  itensRanking: number;
  valorRanking: number; // In cents
  // Diffs (calc - ranking)
  revendedoresDiff: number;
  itensDiff: number;
  valorDiff: number; // In cents
  // Coverage percentage (calc / ranking * 100)
  revendedoresCobertura: number;
  itensCobertura: number;
  valorCobertura: number;
  // Status flags
  hasRanking: boolean; // Exists in ranking file
  hasDetail: boolean; // Exists in detailed data
  // Active revendedores for drill-down
  activeRevendedores: ActiveRevendedor[];
}

// Totals for sector activity
export interface SectorActivityTotals {
  revendedoresAtivosCalc: number;
  itensCalc: number;
  valorCalc: number; // In cents
  revendedoresRanking: number;
  itensRanking: number;
  valorRanking: number; // In cents
  revendedoresDiff: number;
  itensDiff: number;
  valorDiff: number; // In cents
  revendedoresCobertura: number;
  itensCobertura: number;
  valorCobertura: number;
  setoresCount: number;
  setoresComDiff: number;
}

// Sector activity result
export interface SectorActivityResult {
  success: boolean;
  rows: SectorActivityRow[];
  totals: SectorActivityTotals;
  errors: string[];
  selectedCiclo: string;
  selectedBrands: BrandId[];
}

// Sort options for sector activity table
export type SectorActivitySortField =
  | 'setor'
  | 'revendedoresCalc'
  | 'revendedoresRanking'
  | 'revendedoresDiff'
  | 'itensCalc'
  | 'itensRanking'
  | 'itensDiff'
  | 'valorCalc'
  | 'valorRanking'
  | 'valorDiff'
  | 'cobertura';

export interface SectorActivitySortState {
  field: SectorActivitySortField;
  direction: 'asc' | 'desc';
}

// Filter state for sector activity
export interface SectorActivityFilterState {
  searchSetor: string;
  showOnlyWithDiff: boolean;
  showOnlyMissingRanking: boolean;
  showOnlyMissingDetail: boolean;
}
