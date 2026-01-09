import { useState, useMemo, useCallback } from 'react';
import {
  ProcessingResult,
  Customer,
  FilterState,
  SortState,
  BrandId,
  DeliveryType,
} from '@/types';
import {
  exportCrossBuyersSummaryCSV,
  exportDetailedItemsCSV,
  exportCrossBuyersXLSX,
} from '@/lib/export';
import { StatCards } from './StatCards';
import { SectorDistribution } from './SectorDistribution';
import { FiltersPanel } from './FiltersPanel';
import { ResultsTable } from './ResultsTable';
import { CustomerDetailDialog } from './CustomerDetailDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';

interface ResultsDashboardProps {
  result: ProcessingResult;
  onBack: () => void;
}

export function ResultsDashboard({ result, onBack: _onBack }: ResultsDashboardProps) {
  const [filters, setFilters] = useState<FilterState>({
    searchName: '',
    selectedBrands: new Set<BrandId>(),
    selectedCiclos: new Set<string>(),
    selectedSetores: new Set<string>(),
    selectedMeiosCaptacao: new Set<string>(),
    selectedTiposEntrega: new Set<DeliveryType>(),
    minBrands: 2,
  });

  const [sort, setSort] = useState<SortState>({
    field: 'brandCount',
    direction: 'desc',
  });

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Filter customers - ensure all have O Boticário (safety check)
  const filteredCustomers = useMemo(() => {
    return result.crossBuyers.filter(customer => {
      // CRITICAL: Must have O Boticário to be a valid cross-buyer
      if (!customer.brands.has('boticario')) {
        return false;
      }
      // Search by name
      if (filters.searchName) {
        const searchLower = filters.searchName.toLowerCase();
        if (!customer.nomeRevendedoraNormalized.includes(searchLower)) {
          return false;
        }
      }

      // Filter by brands
      if (filters.selectedBrands.size > 0) {
        const customerBrands = new Set(customer.brands.keys());
        for (const brand of filters.selectedBrands) {
          if (!customerBrands.has(brand)) {
            return false;
          }
        }
      }

      // Filter by min brands
      if (customer.brandCount < filters.minBrands) {
        return false;
      }

      // Filter by ciclo
      if (filters.selectedCiclos.size > 0) {
        const hasCiclo = Array.from(filters.selectedCiclos).some(ciclo =>
          customer.allCiclos.has(ciclo)
        );
        if (!hasCiclo) return false;
      }

      // Filter by setor
      if (filters.selectedSetores.size > 0) {
        const hasSetor = Array.from(filters.selectedSetores).some(setor =>
          customer.allSetores.has(setor)
        );
        if (!hasSetor) return false;
      }

      // Filter by meio captacao
      if (filters.selectedMeiosCaptacao.size > 0) {
        const hasMeio = Array.from(filters.selectedMeiosCaptacao).some(meio =>
          customer.allMeiosCaptacao.has(meio)
        );
        if (!hasMeio) return false;
      }

      // Filter by tipo entrega
      if (filters.selectedTiposEntrega.size > 0) {
        const hasTipo = Array.from(filters.selectedTiposEntrega).some(tipo =>
          customer.allTiposEntrega.has(tipo)
        );
        if (!hasTipo) return false;
      }

      return true;
    });
  }, [result.crossBuyers, filters]);

  // Sort customers
  const sortedCustomers = useMemo(() => {
    const sorted = [...filteredCustomers];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case 'brandCount':
          comparison = a.brandCount - b.brandCount;
          break;
        case 'totalValor':
          comparison = a.totalValorVendaAllBrands - b.totalValorVendaAllBrands;
          break;
        case 'totalItens':
          comparison = a.totalItensVendaAllBrands - b.totalItensVendaAllBrands;
          break;
        case 'nome':
          comparison = a.nomeRevendedora.localeCompare(b.nomeRevendedora);
          break;
      }

      return sort.direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredCustomers, sort]);

  const handleExportSummaryCSV = useCallback(() => {
    exportCrossBuyersSummaryCSV(sortedCustomers);
  }, [sortedCustomers]);

  const handleExportDetailedCSV = useCallback(() => {
    exportDetailedItemsCSV(sortedCustomers);
  }, [sortedCustomers]);

  const handleExportXLSX = useCallback(() => {
    exportCrossBuyersXLSX(sortedCustomers);
  }, [sortedCustomers]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-boticario to-emerald-400 bg-clip-text text-transparent">
              Analise de Cross-Buyers
            </span>
          </h2>
          <p className="text-muted-foreground text-sm">
            {result.stats.crossBuyerCount.toLocaleString('pt-BR')} clientes compraram em 2 ou mais marcas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Exportar
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportSummaryCSV}>
                <FileText className="w-4 h-4 mr-2" />
                Resumo (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportDetailedCSV}>
                <FileText className="w-4 h-4 mr-2" />
                Detalhado (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXLSX}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Relatorio Completo (XLSX)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats cards */}
      <StatCards stats={result.stats} />

      {/* Sector distribution */}
      <SectorDistribution stats={result.stats} />

      {/* Filters */}
      <FiltersPanel
        filters={filters}
        onFiltersChange={setFilters}
        availableCiclos={result.availableCiclos}
        availableSetores={result.availableSetores}
        availableMeiosCaptacao={result.availableMeiosCaptacao}
        availableTiposEntrega={result.availableTiposEntrega}
      />

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Mostrando {sortedCustomers.length.toLocaleString('pt-BR')} de{' '}
          {result.crossBuyers.length.toLocaleString('pt-BR')} cross-buyers
        </p>
      </div>

      {/* Results table */}
      <ResultsTable
        customers={sortedCustomers}
        sort={sort}
        onSortChange={setSort}
        onCustomerClick={setSelectedCustomer}
      />

      {/* Customer detail dialog */}
      <CustomerDetailDialog
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />
    </div>
  );
}
