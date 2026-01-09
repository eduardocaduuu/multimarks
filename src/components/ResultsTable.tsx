import { Customer, SortState, SortField, BRANDS, BRAND_ORDER, BrandId } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, ArrowUp, ArrowDown, User } from 'lucide-react';

interface ResultsTableProps {
  customers: Customer[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onCustomerClick: (customer: Customer) => void;
}

export function ResultsTable({
  customers,
  sort,
  onSortChange,
  onCustomerClick,
}: ResultsTableProps) {
  const handleSort = (field: SortField) => {
    if (sort.field === field) {
      onSortChange({
        field,
        direction: sort.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onSortChange({ field, direction: 'desc' });
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sort.field !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    }
    return sort.direction === 'asc' ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  const getBrandColor = (brandId: BrandId): string => {
    const colors: Record<BrandId, string> = {
      boticario: 'bg-boticario/20 text-boticario border-boticario/30',
      eudora: 'bg-eudora/20 text-eudora border-eudora/30',
      auamigos: 'bg-auamigos/20 text-auamigos border-auamigos/30',
      oui: 'bg-oui/20 text-oui border-oui/30',
      qdb: 'bg-qdb/20 text-qdb border-qdb/30',
    };
    return colors[brandId];
  };

  if (customers.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Nenhum cliente encontrado
        </h3>
        <p className="text-sm text-muted-foreground">
          Tente ajustar os filtros para ver mais resultados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-4">
                <button
                  onClick={() => handleSort('nome')}
                  className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Nome
                  <SortIcon field="nome" />
                </button>
              </th>
              <th className="text-left p-4">
                <button
                  onClick={() => handleSort('brandCount')}
                  className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Marcas
                  <SortIcon field="brandCount" />
                </button>
              </th>
              <th className="text-right p-4">
                <button
                  onClick={() => handleSort('totalValor')}
                  className="flex items-center justify-end text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  Valor Total
                  <SortIcon field="totalValor" />
                </button>
              </th>
              <th className="text-right p-4">
                <button
                  onClick={() => handleSort('totalItens')}
                  className="flex items-center justify-end text-sm font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  Itens
                  <SortIcon field="totalItens" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, index) => {
              const customerBrands = BRAND_ORDER.filter(brandId =>
                customer.brands.has(brandId)
              );

              return (
                <tr
                  key={customer.nomeRevendedoraNormalized + index}
                  onClick={() => onCustomerClick(customer)}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="p-4">
                    <div className="font-medium text-foreground">
                      {customer.nomeRevendedora}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {customerBrands.map(brandId => (
                        <Badge
                          key={brandId}
                          variant="outline"
                          className={`text-xs ${getBrandColor(brandId)}`}
                        >
                          {BRANDS[brandId].shortName}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-medium text-foreground">
                      {formatCurrency(customer.totalValorVendaAllBrands)}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-muted-foreground">
                      {customer.totalItensVendaAllBrands.toLocaleString('pt-BR')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination info */}
      <div className="border-t border-border p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground text-center">
          Exibindo {customers.length.toLocaleString('pt-BR')} clientes
        </p>
      </div>
    </div>
  );
}
