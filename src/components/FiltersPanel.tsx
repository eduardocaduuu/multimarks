import { useCallback } from 'react';
import { FilterState, BrandId, DeliveryType, BRANDS, BRAND_ORDER } from '@/types';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter } from 'lucide-react';

interface FiltersPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableCiclos: string[];
  availableSetores: string[];
  availableMeiosCaptacao: string[];
  availableTiposEntrega: DeliveryType[];
}

export function FiltersPanel({
  filters,
  onFiltersChange,
  availableCiclos,
  availableSetores,
  availableMeiosCaptacao,
  availableTiposEntrega,
}: FiltersPanelProps) {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ ...filters, searchName: e.target.value });
    },
    [filters, onFiltersChange]
  );

  const handleBrandToggle = useCallback(
    (brandId: BrandId) => {
      const newBrands = new Set(filters.selectedBrands);
      if (newBrands.has(brandId)) {
        newBrands.delete(brandId);
      } else {
        newBrands.add(brandId);
      }
      onFiltersChange({ ...filters, selectedBrands: newBrands });
    },
    [filters, onFiltersChange]
  );

  const handleMinBrandsChange = useCallback(
    (value: string) => {
      onFiltersChange({ ...filters, minBrands: parseInt(value, 10) });
    },
    [filters, onFiltersChange]
  );

  const handleCicloChange = useCallback(
    (value: string) => {
      const newCiclos = new Set(filters.selectedCiclos);
      if (value === 'all') {
        newCiclos.clear();
      } else {
        newCiclos.clear();
        newCiclos.add(value);
      }
      onFiltersChange({ ...filters, selectedCiclos: newCiclos });
    },
    [filters, onFiltersChange]
  );

  const handleSetorChange = useCallback(
    (value: string) => {
      const newSetores = new Set(filters.selectedSetores);
      if (value === 'all') {
        newSetores.clear();
      } else {
        newSetores.clear();
        newSetores.add(value);
      }
      onFiltersChange({ ...filters, selectedSetores: newSetores });
    },
    [filters, onFiltersChange]
  );

  const handleMeioCaptacaoChange = useCallback(
    (value: string) => {
      const newMeios = new Set(filters.selectedMeiosCaptacao);
      if (value === 'all') {
        newMeios.clear();
      } else {
        newMeios.clear();
        newMeios.add(value);
      }
      onFiltersChange({ ...filters, selectedMeiosCaptacao: newMeios });
    },
    [filters, onFiltersChange]
  );

  const handleTipoEntregaChange = useCallback(
    (value: string) => {
      const newTipos = new Set<DeliveryType>();
      if (value !== 'all') {
        newTipos.add(value as DeliveryType);
      }
      onFiltersChange({ ...filters, selectedTiposEntrega: newTipos });
    },
    [filters, onFiltersChange]
  );

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      searchName: '',
      selectedBrands: new Set<BrandId>(),
      selectedCiclos: new Set<string>(),
      selectedSetores: new Set<string>(),
      selectedMeiosCaptacao: new Set<string>(),
      selectedTiposEntrega: new Set<DeliveryType>(),
      minBrands: 2,
    });
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.searchName ||
    filters.selectedBrands.size > 0 ||
    filters.selectedCiclos.size > 0 ||
    filters.selectedSetores.size > 0 ||
    filters.selectedMeiosCaptacao.size > 0 ||
    filters.selectedTiposEntrega.size > 0 ||
    filters.minBrands > 2;

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filtros</span>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="ml-auto text-xs h-7"
          >
            <X className="w-3 h-3 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search by name */}
        <div className="lg:col-span-2">
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Buscar por nome
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Digite o nome da revendedora..."
              value={filters.searchName}
              onChange={handleSearchChange}
              className="pl-9"
            />
          </div>
        </div>

        {/* Min brands */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Minimo de marcas
          </label>
          <Select value={filters.minBrands.toString()} onValueChange={handleMinBrandsChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2+ marcas</SelectItem>
              <SelectItem value="3">3+ marcas</SelectItem>
              <SelectItem value="4">4+ marcas</SelectItem>
              <SelectItem value="5">5 marcas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Ciclo */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Ciclo Captacao
          </label>
          <Select
            value={filters.selectedCiclos.size > 0 ? Array.from(filters.selectedCiclos)[0] : 'all'}
            onValueChange={handleCicloChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os ciclos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os ciclos</SelectItem>
              {availableCiclos.slice(0, 50).map(ciclo => (
                <SelectItem key={ciclo} value={ciclo}>
                  {ciclo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Setor */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Setor
          </label>
          <Select
            value={filters.selectedSetores.size > 0 ? Array.from(filters.selectedSetores)[0] : 'all'}
            onValueChange={handleSetorChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os setores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {availableSetores.slice(0, 50).map(setor => (
                <SelectItem key={setor} value={setor}>
                  {setor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Meio Captacao */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Meio Captacao
          </label>
          <Select
            value={
              filters.selectedMeiosCaptacao.size > 0
                ? Array.from(filters.selectedMeiosCaptacao)[0]
                : 'all'
            }
            onValueChange={handleMeioCaptacaoChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os meios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meios</SelectItem>
              {availableMeiosCaptacao.slice(0, 50).map(meio => (
                <SelectItem key={meio} value={meio}>
                  {meio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tipo Entrega */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            Tipo Entrega
          </label>
          <Select
            value={
              filters.selectedTiposEntrega.size > 0
                ? Array.from(filters.selectedTiposEntrega)[0]
                : 'all'
            }
            onValueChange={handleTipoEntregaChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {availableTiposEntrega.map(tipo => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Brand filters */}
      <div className="mt-4 pt-4 border-t border-border">
        <label className="text-xs text-muted-foreground mb-2 block">
          Filtrar por marcas (deve ter TODAS as selecionadas)
        </label>
        <div className="flex flex-wrap gap-3">
          {BRAND_ORDER.map(brandId => (
            <label
              key={brandId}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <Checkbox
                checked={filters.selectedBrands.has(brandId)}
                onCheckedChange={() => handleBrandToggle(brandId)}
              />
              <span
                className={`text-sm transition-colors ${
                  filters.selectedBrands.has(brandId)
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground group-hover:text-foreground'
                }`}
              >
                {BRANDS[brandId].shortName}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
