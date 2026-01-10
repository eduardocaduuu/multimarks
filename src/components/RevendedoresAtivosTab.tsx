import { useState, useMemo } from 'react';
import { ActiveRevendedorJoined, BrandId, BRANDS, BRAND_ORDER } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportActiveRevendedoresCSV, exportCrossbuyersAtivosCSV } from '@/lib/export';
import { AlertCircle, Search, Filter, X, Download, FileText, ChevronDown } from 'lucide-react';

interface RevendedoresAtivosTabProps {
  activeRevendedores: ActiveRevendedorJoined[];
  selectedCiclo: string | null;
  onRevendedorClick: (active: ActiveRevendedorJoined) => void;
}

export function RevendedoresAtivosTab({
  activeRevendedores,
  selectedCiclo,
  onRevendedorClick,
}: RevendedoresAtivosTabProps) {
  const [searchName, setSearchName] = useState('');
  const [searchSetor, setSearchSetor] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<Set<BrandId>>(new Set());
  const [showOnlyCrossbuyers, setShowOnlyCrossbuyers] = useState(false);
  const [showOnlyBaseBoticario, setShowOnlyBaseBoticario] = useState(false);
  const [showInconsistencies, setShowInconsistencies] = useState(false);

  // Note: availableSetores could be used for a dropdown filter in the future

  // Filter active revendedores
  const filteredRevendedores = useMemo(() => {
    return activeRevendedores.filter((active) => {
      // Search by name
      if (searchName) {
        const searchLower = searchName.toLowerCase();
        if (
          !active.nomeRevendedora.toLowerCase().includes(searchLower) &&
          !active.codigoRevendedoraOriginal.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Search by setor
      if (searchSetor) {
        const searchLower = searchSetor.toLowerCase();
        if (!active.setor.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Filter by brands
      if (selectedBrands.size > 0) {
        const activeBrands = new Set(active.brands.keys());
        for (const brand of selectedBrands) {
          if (!activeBrands.has(brand)) {
            return false;
          }
        }
      }

      // Filter by crossbuyer
      if (showOnlyCrossbuyers && !active.isCrossbuyer) {
        return false;
      }

      // Filter by base oBoticário
      if (showOnlyBaseBoticario && !active.existsInBoticario) {
        return false;
      }

      // Filter by inconsistencies
      if (showInconsistencies && active.inconsistencies.length === 0) {
        return false;
      }

      return true;
    });
  }, [
    activeRevendedores,
    searchName,
    searchSetor,
    selectedBrands,
    showOnlyCrossbuyers,
    showOnlyBaseBoticario,
    showInconsistencies,
  ]);

  const handleBrandToggle = (brandId: BrandId) => {
    const newSelected = new Set(selectedBrands);
    if (newSelected.has(brandId)) {
      newSelected.delete(brandId);
    } else {
      newSelected.add(brandId);
    }
    setSelectedBrands(newSelected);
  };

  const clearFilters = () => {
    setSearchName('');
    setSearchSetor('');
    setSelectedBrands(new Set());
    setShowOnlyCrossbuyers(false);
    setShowOnlyBaseBoticario(false);
    setShowInconsistencies(false);
  };

  const hasActiveFilters =
    searchName ||
    searchSetor ||
    selectedBrands.size > 0 ||
    showOnlyCrossbuyers ||
    showOnlyBaseBoticario ||
    showInconsistencies;

  return (
    <div>
      {/* Header info */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-muted-foreground">
            Lista completa dos revendedores ativos
            {selectedCiclo && (
              <span className="font-medium text-foreground"> • Ciclo: {selectedCiclo}</span>
            )}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Total: {activeRevendedores.filter(a => a.hasPurchasesInCiclo).length.toLocaleString('pt-BR')} ativos com vendas •{' '}
            {activeRevendedores.filter(a => a.hasPurchasesInCiclo && a.existsInBoticario).length.toLocaleString('pt-BR')} base oBoticário •{' '}
            {activeRevendedores.filter(a => a.isCrossbuyer).length.toLocaleString('pt-BR')} crossbuyers
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportActiveRevendedoresCSV(activeRevendedores)}>
              <FileText className="w-4 h-4 mr-2" />
              Revendedores Ativos (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                exportCrossbuyersAtivosCSV(
                  filteredRevendedores.length > 0 ? filteredRevendedores : activeRevendedores
                )
              }
            >
              <FileText className="w-4 h-4 mr-2" />
              Crossbuyers Ativos (CSV)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Search className="w-4 h-4" />
                Buscar por nome/código
              </label>
              <Input
                placeholder="Digite o nome ou código do revendedor..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar por setor</label>
              <Input
                placeholder="Digite o setor..."
                value={searchSetor}
                onChange={(e) => setSearchSetor(e.target.value)}
              />
            </div>
          </div>

          {/* Brand filters */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Filtrar por marca</label>
            <div className="flex flex-wrap gap-3">
              {BRAND_ORDER.map((brandId) => (
                <div key={brandId} className="flex items-center space-x-2">
                  <Checkbox
                    id={`brand-${brandId}`}
                    checked={selectedBrands.has(brandId)}
                    onCheckedChange={() => handleBrandToggle(brandId)}
                  />
                  <label
                    htmlFor={`brand-${brandId}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {BRANDS[brandId].shortName}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Boolean filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="only-crossbuyers"
                checked={showOnlyCrossbuyers}
                onCheckedChange={(checked) => setShowOnlyCrossbuyers(checked === true)}
              />
              <label
                htmlFor="only-crossbuyers"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Apenas Crossbuyers
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="only-base-boticario"
                checked={showOnlyBaseBoticario}
                onCheckedChange={(checked) => setShowOnlyBaseBoticario(checked === true)}
              />
              <label
                htmlFor="only-base-boticario"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Apenas Base oBoticário
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-inconsistencies"
                checked={showInconsistencies}
                onCheckedChange={(checked) => setShowInconsistencies(checked === true)}
              />
              <label
                htmlFor="show-inconsistencies"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Com Inconsistências
              </label>
            </div>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <div>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredRevendedores.length.toLocaleString('pt-BR')} de{' '}
          {activeRevendedores.length.toLocaleString('pt-BR')} revendedores ativos
          {activeRevendedores.length > 0 && (
            <span className="font-medium text-foreground ml-1">
              ({((filteredRevendedores.length / activeRevendedores.length) * 100).toFixed(1)}%)
            </span>
          )}
        </p>
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRevendedores.map((active) => (
          <Card
            key={active.codigoRevendedora}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => onRevendedorClick(active)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base mb-1">{active.nomeRevendedora}</CardTitle>
                  {active.codigoRevendedoraOriginal && (
                    <p className="text-xs text-muted-foreground">
                      Código: {active.codigoRevendedoraOriginal}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Setor: {active.setor}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {active.existsInBoticario && (
                  <Badge variant="default" className="bg-boticario">
                    Base oBoticário
                  </Badge>
                )}
                {active.isCrossbuyer && (
                  <Badge variant="default" className="bg-emerald-500">
                    Crossbuyer ({active.brandCount} marcas)
                  </Badge>
                )}
                {!active.hasPurchasesInCiclo && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Sem vendas no ciclo
                  </Badge>
                )}
                {active.inconsistencies.length > 0 && (
                  <Badge variant="destructive">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {active.inconsistencies.length} inconsistência(s)
                  </Badge>
                )}
              </div>

              {/* Brand list */}
              {active.brands.size > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Marcas:</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(active.brands.keys()).map((brandId) => (
                      <Badge key={brandId} variant="outline" className="text-xs">
                        {BRANDS[brandId].shortName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Total:</span>
                  <span className="font-medium">{formatCurrency(active.totalValorVendaAllBrands)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Itens Total:</span>
                  <span className="font-medium">
                    {active.totalItensVendaAllBrands.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Inconsistencies preview */}
              {active.inconsistencies.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-destructive font-medium mb-1">Inconsistências:</p>
                  <ul className="text-xs text-destructive/80 space-y-1">
                    {active.inconsistencies.slice(0, 2).map((inc, idx) => (
                      <li key={idx}>• {inc}</li>
                    ))}
                    {active.inconsistencies.length > 2 && (
                      <li className="text-muted-foreground">
                        +{active.inconsistencies.length - 2} mais...
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRevendedores.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">Nenhum revendedor ativo encontrado</p>
          <p className="text-sm">Tente ajustar os filtros</p>
        </div>
      )}
    </div>
  );
}
