import { Customer, BRANDS, BRAND_ORDER, BrandId, CustomerBrandMetrics } from '@/types';
import { formatCurrency } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  ShoppingBag,
  DollarSign,
  Receipt,
  Package,
} from 'lucide-react';

interface CustomerDetailDialogProps {
  customer: Customer | null;
  onClose: () => void;
}

export function CustomerDetailDialog({
  customer,
  onClose,
}: CustomerDetailDialogProps) {
  if (!customer) return null;

  const customerBrands = BRAND_ORDER.filter(brandId =>
    customer.brands.has(brandId)
  );

  const getBrandColorClass = (brandId: BrandId): string => {
    const colors: Record<BrandId, string> = {
      boticario: 'bg-boticario',
      eudora: 'bg-eudora',
      auamigos: 'bg-auamigos',
      oui: 'bg-oui',
      qdb: 'bg-qdb',
    };
    return colors[brandId];
  };

  const getBrandBadgeClass = (brandId: BrandId): string => {
    const colors: Record<BrandId, string> = {
      boticario: 'bg-boticario/20 text-boticario border-boticario/30',
      eudora: 'bg-eudora/20 text-eudora border-eudora/30',
      auamigos: 'bg-auamigos/20 text-auamigos border-auamigos/30',
      oui: 'bg-oui/20 text-oui border-oui/30',
      qdb: 'bg-qdb/20 text-qdb border-qdb/30',
    };
    return colors[brandId];
  };

  const renderBrandMetrics = (brandId: BrandId, metrics: CustomerBrandMetrics) => {
    const ticketMedio = metrics.totalItensVenda > 0
      ? metrics.totalValorVenda / metrics.totalItensVenda
      : 0;

    return (
      <Card key={brandId} className="overflow-hidden">
        <div className={`h-1 ${getBrandColorClass(brandId)}`} />
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-foreground">
              {BRANDS[brandId].name}
            </h4>
            <Badge variant="outline" className={getBrandBadgeClass(brandId)}>
              {metrics.items.length} transacoes
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-xs">Valor Total</span>
              </div>
              <p className="font-semibold text-foreground">
                {formatCurrency(metrics.totalValorVenda)}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Package className="w-3.5 h-3.5" />
                <span className="text-xs">Itens</span>
              </div>
              <p className="font-semibold text-foreground">
                {metrics.totalItensVenda.toLocaleString('pt-BR')}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Receipt className="w-3.5 h-3.5" />
                <span className="text-xs">Ticket Medio</span>
              </div>
              <p className="font-semibold text-foreground">
                {formatCurrency(ticketMedio)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTransactionsTable = (_brandId: BrandId, metrics: CustomerBrandMetrics) => {
    const vendaItems = metrics.items.filter(item => item.tipo === 'Venda');

    if (vendaItems.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma venda registrada para esta marca.
        </p>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 text-muted-foreground font-medium">Produto</th>
              <th className="text-left p-2 text-muted-foreground font-medium">Setor</th>
              <th className="text-center p-2 text-muted-foreground font-medium">Qtd</th>
              <th className="text-right p-2 text-muted-foreground font-medium">Valor</th>
              <th className="text-left p-2 text-muted-foreground font-medium">Entrega</th>
            </tr>
          </thead>
          <tbody>
            {vendaItems.slice(0, 50).map((item, index) => (
              <tr
                key={`${item.codigoProduto}-${index}`}
                className="border-b border-border last:border-0"
              >
                <td className="p-2">
                  <div className="text-foreground">{item.nomeProduto || '-'}</div>
                  {item.codigoProduto && (
                    <div className="text-xs text-muted-foreground">
                      Cod: {item.codigoProduto}
                    </div>
                  )}
                </td>
                <td className="p-2 text-muted-foreground">{item.setor || '-'}</td>
                <td className="p-2 text-center text-foreground">{item.quantidadeItens}</td>
                <td className="p-2 text-right text-foreground">
                  {formatCurrency(item.valorPraticado)}
                </td>
                <td className="p-2 text-muted-foreground">{item.tipoEntrega}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {vendaItems.length > 50 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Mostrando 50 de {vendaItems.length} transacoes
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={customer !== null} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-boticario to-emerald-400 flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {customer.nomeRevendedora.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-xl">{customer.nomeRevendedora}</span>
              <div className="flex items-center gap-2 mt-1">
                {customerBrands.map(brandId => (
                  <Badge
                    key={brandId}
                    variant="outline"
                    className={`text-xs ${getBrandBadgeClass(brandId)}`}
                  >
                    {BRANDS[brandId].shortName}
                  </Badge>
                ))}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Cliente presente em {customer.brandCount} marcas com valor total de{' '}
            {formatCurrency(customer.totalValorVendaAllBrands)}
          </DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="bg-muted/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Marcas</p>
                <p className="text-xl font-bold text-foreground">{customer.brandCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(customer.totalValorVendaAllBrands)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Itens</p>
                <p className="text-xl font-bold text-foreground">
                  {customer.totalItensVendaAllBrands.toLocaleString('pt-BR')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Brand details tabs */}
        <Tabs defaultValue={customerBrands[0]} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {customerBrands.map(brandId => (
              <TabsTrigger
                key={brandId}
                value={brandId}
                className="flex-1 min-w-[80px] text-xs data-[state=active]:bg-background"
              >
                {BRANDS[brandId].shortName}
              </TabsTrigger>
            ))}
          </TabsList>

          {customerBrands.map(brandId => {
            const metrics = customer.brands.get(brandId)!;
            return (
              <TabsContent key={brandId} value={brandId} className="mt-4">
                {renderBrandMetrics(brandId, metrics)}

                <div className="mt-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">
                    Transacoes de Venda
                  </h4>
                  <div className="bg-muted/30 rounded-lg border border-border">
                    {renderTransactionsTable(brandId, metrics)}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
