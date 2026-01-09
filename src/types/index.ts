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
}

// Parsing result
export interface ParseResult {
  success: boolean;
  items: Item[];
  errors: string[];
  warnings: string[];
  rowCount: number;
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
}
