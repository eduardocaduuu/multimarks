// Brand identifiers
export type BrandId = 'boticario' | 'eudora' | 'auamigos' | 'oui' | 'qdb';

export interface Brand {
  id: BrandId;
  name: string;
  shortName: string;
  color: string;
  required: boolean;
  order: number;
}

export const BRANDS: Record<BrandId, Brand> = {
  boticario: {
    id: 'boticario',
    name: 'O Boticário',
    shortName: 'Boticário',
    color: 'boticario',
    required: true,
    order: 1,
  },
  eudora: {
    id: 'eudora',
    name: 'Eudora',
    shortName: 'Eudora',
    color: 'eudora',
    required: false,
    order: 2,
  },
  auamigos: {
    id: 'auamigos',
    name: 'Au Amigos',
    shortName: 'Au Amigos',
    color: 'auamigos',
    required: false,
    order: 3,
  },
  oui: {
    id: 'oui',
    name: 'O.U.I',
    shortName: 'O.U.I',
    color: 'oui',
    required: false,
    order: 4,
  },
  qdb: {
    id: 'qdb',
    name: 'Quem Disse, Berenice?',
    shortName: 'QDB?',
    color: 'qdb',
    required: false,
    order: 5,
  },
};

export const BRAND_ORDER: BrandId[] = ['boticario', 'eudora', 'auamigos', 'oui', 'qdb'];

// Transaction types
export type TransactionType = 'Venda' | 'Brinde' | 'Doação';

// Delivery types
export type DeliveryType = 'Entrega/Frete' | 'Retirada' | 'Outro';

// Raw row from spreadsheet (before normalization)
export interface RawRow {
  [key: string]: string | number | undefined;
}

// Status de faturamento
export type BillingStatus = 'Faturado' | 'Pendente' | 'Cancelado' | 'Desconhecido';

// Normalized item from spreadsheet
export interface Item {
  setor: string;
  nomeRevendedora: string;
  nomeRevendedoraOriginal: string;
  nomeRevendedoraNormalized: string; // For comparison (lowercase, trimmed)
  cicloCaptacao: string;
  codigoProduto: string;
  nomeProduto: string;
  tipo: TransactionType;
  tipoOriginal: string;
  quantidadeItens: number;
  valorPraticado: number; // In cents
  meioCaptacao: string;
  tipoEntrega: DeliveryType;
  tipoEntregaOriginal: string;
  brand: BrandId;
  // Campos opcionais de faturamento (quando disponíveis)
  statusFaturamento?: BillingStatus;
  statusFaturamentoOriginal?: string;
  cicloFaturamento?: string;
  dataFaturamento?: string;
  isFaturado?: boolean; // Calculado: true se status indica faturamento confirmado
}

// Aggregated metrics for a customer per brand
export interface CustomerBrandMetrics {
  brand: BrandId;
  items: Item[];
  // Only from Tipo=Venda
  totalItensVenda: number;
  totalValorVenda: number; // In cents
  ticketMedioPorItem: number; // In cents
  // Unique values for filtering
  ciclos: Set<string>;
  setores: Set<string>;
  meiosCaptacao: Set<string>;
  tiposEntrega: Set<DeliveryType>;
}

// Aggregated customer data
export interface Customer {
  nomeRevendedora: string; // Original display name
  nomeRevendedoraNormalized: string; // For comparison
  brands: Map<BrandId, CustomerBrandMetrics>;
  brandCount: number;
  // Aggregated totals (only Venda)
  totalValorVendaAllBrands: number;
  totalItensVendaAllBrands: number;
  // Unique values across all brands for filtering
  allCiclos: Set<string>;
  allSetores: Set<string>;
  allMeiosCaptacao: Set<string>;
  allTiposEntrega: Set<DeliveryType>;
}

// Upload state for a brand
export interface BrandUploadState {
  brand: Brand;
  file: File | null;
  fileName: string | null;
  status: 'empty' | 'loading' | 'loaded' | 'error';
  error: string | null;
  rowCount: number;
}

// Filter state
export interface FilterState {
  searchName: string;
  selectedBrands: Set<BrandId>;
  selectedCiclos: Set<string>;
  selectedSetores: Set<string>;
  selectedMeiosCaptacao: Set<string>;
  selectedTiposEntrega: Set<DeliveryType>;
  minBrands: number;
}

// Sort options
export type SortField = 'brandCount' | 'totalValor' | 'totalItens' | 'nome';
export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

// Dashboard stats
export interface DashboardStats {
  totalBaseCustomers: number; // Total in oBoticário
  crossBuyerCount: number; // Customers in 2+ brands
  brandDistribution: Record<number, number>; // Count of customers by brand count (2, 3, 4, 5)
  brandOverlap: Record<BrandId, number>; // Count of customers per brand (excluding boticario in display)
  topOverlapBrand: BrandId | null; // Brand with highest overlap with Boticário
  setorDistribution: Record<string, number>; // Count of cross-buyers by setor
}

// Column mapping result
export interface ColumnMapping {
  setor: string | null;
  nomeRevendedora: string | null;
  cicloCaptacao: string | null;
  codigoProduto: string | null;
  nomeProduto: string | null;
  tipo: string | null;
  quantidadeItens: string | null;
  valorPraticado: string | null;
  meioCaptacao: string | null;
  tipoEntrega: string | null;
  // Colunas opcionais de faturamento
  statusFaturamento: string | null;
  cicloFaturamento: string | null;
  dataFaturamento: string | null;
}

// Parsing result
export interface ParseResult {
  success: boolean;
  items: Item[];
  errors: string[];
  warnings: string[];
  rowCount: number;
  // Informações sobre colunas de faturamento detectadas
  hasBillingColumns: boolean;
  billingColumnsDetected: string[]; // Nomes das colunas de faturamento encontradas
}

// Processing result
export interface ProcessingResult {
  success: boolean;
  customers: Customer[];
  crossBuyers: Customer[];
  stats: DashboardStats;
  errors: string[];
  // Filter options from data
  availableCiclos: string[];
  availableSetores: string[];
  availableMeiosCaptacao: string[];
  availableTiposEntrega: DeliveryType[];
  // Active revendedores data (optional - only if active file is uploaded)
  activeRevendedoresData?: {
    activeRevendedores: ActiveRevendedorJoined[];
    sectorStats: SectorActiveStats[];
    selectedCiclo: string | null; // Selected ciclo for filtering
    availableCiclosFromActive: string[]; // Ciclos available in active file

    // Métricas de Venda Registrada
    totalRegistrados: number;
    totalRegistradosBaseBoticario: number;
    totalCrossbuyersRegistrados: number;

    // Métricas de Faturamento (quando disponível)
    totalFaturados: number;
    totalFaturadosBaseBoticario: number;
    totalCrossbuyersFaturados: number;

    // Flag indicando se dados de faturamento estão disponíveis
    hasBillingData: boolean;

    // REGRA: totalAtivos = TODOS da planilha Geral (não depende de ter compra)
    totalAtivos: number;

    // Aliases para compatibilidade
    totalAtivosBaseBoticario: number; // = totalRegistradosBaseBoticario
    totalCrossbuyersAtivos: number; // = totalCrossbuyersRegistrados

    inconsistencies: string[]; // Global inconsistencies
    diagnosticoJoin?: JoinDiagnostico; // Diagnóstico de exclusões no join
  };
}

// ===== ACTIVE REVENDEDORES FILE TYPES =====

// Active revendedor from the single active revendedores spreadsheet
export interface ActiveRevendedorData {
  codigoRevendedora: string; // Normalized as string (key)
  codigoRevendedoraOriginal: string; // Original value
  nomeRevendedora: string; // Display name
  nomeRevendedoraNormalized: string; // For comparison (lowercase, trimmed, no accents)
  setor: string;
  cicloCaptacao: string | null; // Optional - may not exist in the file
}

// Active revendedor after joining with brand purchases
export interface ActiveRevendedorJoined {
  // From active file
  codigoRevendedora: string;
  codigoRevendedoraOriginal: string;
  nomeRevendedora: string;
  nomeRevendedoraNormalized: string;
  setor: string; // From active file (authoritative)
  cicloCaptacao: string | null;

  // From brand purchases (filtered by selected ciclo)
  brands: Map<BrandId, CustomerBrandMetrics>;
  brandCount: number;

  // Aggregated metrics (only Venda type)
  totalValorVendaAllBrands: number; // In cents
  totalItensVendaAllBrands: number;

  // Flags - Venda Registrada
  existsInBoticario: boolean; // Existe no oBoticário
  hasVendaRegistrada: boolean; // Tem venda registrada no ciclo (qualquer marca)
  isCrossbuyerRegistrado: boolean; // Crossbuyer entre vendas registradas

  // Flags - Faturamento (quando disponível)
  hasVendaFaturada: boolean; // Tem venda faturada no ciclo
  isCrossbuyerFaturado: boolean; // Crossbuyer entre vendas faturadas

  // Aliases para compatibilidade
  hasPurchasesInCiclo: boolean; // = hasVendaRegistrada
  isCrossbuyer: boolean; // = isCrossbuyerRegistrado

  // Inconsistencies
  inconsistencies: string[]; // e.g., "Setor divergente", "Sem compras no ciclo"
}

// Sector statistics for active revendedores
export interface SectorActiveStats {
  setor: string;

  // REGRA: totalAtivos = TODOS da planilha Geral neste setor (não depende de ter compra)
  totalAtivos: number;

  // Métricas de compras nas planilhas de marca
  totalRegistrados: number; // Ativos com compras registradas
  registradosBaseBoticario: number; // Que existem no oBoticário
  crossbuyersRegistrados: number; // Multimarcas (2+ marcas)
  percentCrossbuyerRegistrados: number; // % sobre totalAtivos

  // Métricas de FATURAMENTO (quando disponível)
  totalFaturados: number; // Ativos com venda faturada no ciclo
  faturadosBaseBoticario: number;
  crossbuyersFaturados: number;
  percentCrossbuyerFaturados: number;

  // Gap Analysis
  gapRegistradoFaturado: number; // totalRegistrados - totalFaturados

  // Aliases para compatibilidade
  ativosBaseBoticario: number; // = registradosBaseBoticario
  crossbuyers: number; // = crossbuyersRegistrados
  percentCrossbuyer: number; // = percentCrossbuyerRegistrados

  // Value and items by brand (de vendas registradas)
  valorPorMarca: Record<BrandId, number>; // In cents
  itensPorMarca: Record<BrandId, number>;

  // List of active revendedores in this sector
  activeRevendedores: ActiveRevendedorJoined[];
}

// Upload state for active revendedores file
export interface ActiveRevendedoresUploadState {
  file: File | null;
  fileName: string | null;
  status: 'empty' | 'loading' | 'loaded' | 'error';
  error: string | null;
  rowCount: number;
  hasCicloColumn: boolean; // Whether the file has ciclo column
}

// Column mapping for active revendedores spreadsheet
export interface ActiveRevendedoresColumnMapping {
  codigoRevendedora: string | null;
  nomeRevendedora: string | null;
  setor: string | null;
  cicloCaptacao: string | null;
}

// Parsing result for active revendedores file
export interface ActiveRevendedoresParseResult {
  success: boolean;
  activeRevendedores: ActiveRevendedorData[];
  errors: string[];
  warnings: string[];
  rowCount: number;
  hasCicloColumn: boolean;
  // Diagnóstico de exclusões no parsing
  diagnostico?: {
    totalLinhas: number;
    excluidosPorCodigoVazio: number;
    excluidosPorNomeVazio: number;
    excluidosPorCodigoDuplicado: number;
    registrosValidos: number;
  };
}

// Diagnóstico de exclusões no join
export interface JoinDiagnostico {
  totalRecebidos: number;
  excluidosPorCicloDiferente: number;
  excluidosPorCicloNulo: number;
  registrosProcessados: number;
  porSetor: Map<string, { total: number; excluidosPorCiclo: number }>;
}

// Re-export sector activity types
export * from './sectorActivity';
