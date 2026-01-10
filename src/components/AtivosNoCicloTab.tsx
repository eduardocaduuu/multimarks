import { useState, useMemo } from 'react';
import { SectorActiveStats, ActiveRevendedorJoined, BRANDS, BRAND_ORDER, JoinDiagnostico } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportAtivosPorSetorCSV } from '@/lib/export';
import { Building2, Users, TrendingUp, AlertCircle, Download, FileText, ChevronDown, Info, ChevronRight } from 'lucide-react';

interface AtivosNoCicloTabProps {
  sectorStats: SectorActiveStats[];
  selectedCiclo: string | null;
  onRevendedorClick: (active: ActiveRevendedorJoined) => void;
  diagnosticoJoin?: JoinDiagnostico;
  diagnosticoParsing?: {
    totalLinhas: number;
    excluidosPorCodigoVazio: number;
    excluidosPorNomeVazio: number;
    excluidosPorCodigoDuplicado: number;
    registrosValidos: number;
  };
  hasBillingData?: boolean;
}

export function AtivosNoCicloTab({
  sectorStats,
  selectedCiclo,
  onRevendedorClick,
  diagnosticoJoin,
  diagnosticoParsing,
  hasBillingData = false,
}: AtivosNoCicloTabProps) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [searchSetor, setSearchSetor] = useState('');

  // Sort sectors by total ativos (desc)
  const sortedSectors = useMemo(() => {
    return [...sectorStats].sort((a, b) => b.totalAtivos - a.totalAtivos);
  }, [sectorStats]);

  // Filter sectors by search
  const filteredSectors = useMemo(() => {
    if (!searchSetor) return sortedSectors;
    const searchLower = searchSetor.toLowerCase();
    return sortedSectors.filter(s => s.setor.toLowerCase().includes(searchLower));
  }, [sortedSectors, searchSetor]);

  const selectedSectorStats = selectedSector
    ? sectorStats.find(s => s.setor === selectedSector)
    : null;

  const selectedSectorRevendedores = selectedSectorStats?.activeRevendedores || [];
  const [showDiagnostico, setShowDiagnostico] = useState(false);

  // Calcular se há exclusões
  const temExclusoes = diagnosticoParsing && (
    diagnosticoParsing.excluidosPorCodigoVazio > 0 ||
    diagnosticoParsing.excluidosPorNomeVazio > 0 ||
    diagnosticoParsing.excluidosPorCodigoDuplicado > 0
  ) || diagnosticoJoin && (
    diagnosticoJoin.excluidosPorCicloDiferente > 0 ||
    diagnosticoJoin.excluidosPorCicloNulo > 0
  );

  return (
    <div>
      {/* Header info */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-start gap-2">
          <p className="text-muted-foreground">
            Revendedores com Venda Registrada
            {selectedCiclo && (
              <span className="font-medium text-foreground"> • Ciclo: {selectedCiclo}</span>
            )}
          </p>
          <div className="group relative">
            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
            <div className="invisible group-hover:visible absolute left-0 top-6 z-50 w-80 p-3 bg-popover text-popover-foreground rounded-md shadow-lg border text-xs">
              <p className="font-medium mb-1">Venda Registrada vs Faturamento</p>
              <p className="mb-2">
                Esta aba mostra revendedores com <strong>vendas registradas</strong> (captação/pedidos).
                O painel oficial pode usar métricas de <strong>faturamento</strong> (pedidos efetivamente
                emitidos/entregues), o que pode gerar pequenas divergências.
              </p>
              {hasBillingData ? (
                <p className="text-emerald-600">✓ Dados de faturamento disponíveis nesta análise.</p>
              ) : (
                <p className="text-amber-600">
                  ⚠ Dados de faturamento não detectados nas planilhas.
                  Para análise de faturamento, inclua colunas como "Status Faturamento" ou "Faturado".
                </p>
              )}
            </div>
          </div>
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
            <DropdownMenuItem onClick={() => exportAtivosPorSetorCSV(sectorStats)}>
              <FileText className="w-4 h-4 mr-2" />
              Ativos por Setor (CSV)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Diagnóstico de exclusões */}
      {(diagnosticoParsing || diagnosticoJoin) && (
        <Card className={`mb-4 ${temExclusoes ? 'border-amber-300 bg-amber-50/50' : ''}`}>
          <CardHeader
            className="cursor-pointer hover:bg-muted/50 transition-colors py-3"
            onClick={() => setShowDiagnostico(!showDiagnostico)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className={`w-4 h-4 ${temExclusoes ? 'text-amber-600' : 'text-muted-foreground'}`} />
                <CardTitle className="text-sm font-medium">
                  Diagnóstico de Processamento
                  {temExclusoes && (
                    <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                      Registros excluídos
                    </Badge>
                  )}
                </CardTitle>
              </div>
              <ChevronRight className={`w-4 h-4 transition-transform ${showDiagnostico ? 'rotate-90' : ''}`} />
            </div>
          </CardHeader>
          {showDiagnostico && (
            <CardContent className="pt-0 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Parsing */}
                {diagnosticoParsing && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Leitura da Planilha</h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total de linhas:</span>
                        <span className="font-mono">{diagnosticoParsing.totalLinhas}</span>
                      </div>
                      {diagnosticoParsing.excluidosPorCodigoVazio > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>Código vazio:</span>
                          <span className="font-mono">-{diagnosticoParsing.excluidosPorCodigoVazio}</span>
                        </div>
                      )}
                      {diagnosticoParsing.excluidosPorNomeVazio > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>Nome vazio:</span>
                          <span className="font-mono">-{diagnosticoParsing.excluidosPorNomeVazio}</span>
                        </div>
                      )}
                      {diagnosticoParsing.excluidosPorCodigoDuplicado > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>Código duplicado:</span>
                          <span className="font-mono">-{diagnosticoParsing.excluidosPorCodigoDuplicado}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium border-t pt-1">
                        <span>Registros válidos:</span>
                        <span className="font-mono">{diagnosticoParsing.registrosValidos}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Join/Filtro */}
                {diagnosticoJoin && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Filtro por Ciclo</h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total recebidos:</span>
                        <span className="font-mono">{diagnosticoJoin.totalRecebidos}</span>
                      </div>
                      {diagnosticoJoin.excluidosPorCicloNulo > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>Sem ciclo definido:</span>
                          <span className="font-mono">-{diagnosticoJoin.excluidosPorCicloNulo}</span>
                        </div>
                      )}
                      {diagnosticoJoin.excluidosPorCicloDiferente > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>Ciclo diferente:</span>
                          <span className="font-mono">-{diagnosticoJoin.excluidosPorCicloDiferente}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium border-t pt-1">
                        <span>Registros processados:</span>
                        <span className="font-mono">{diagnosticoJoin.registrosProcessados}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por setor..."
          value={searchSetor}
          onChange={(e) => setSearchSetor(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Summary stats */}
      <div className={`grid grid-cols-1 gap-4 mb-6 ${hasBillingData ? 'md:grid-cols-6' : 'md:grid-cols-4'}`}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Setores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{sectorStats.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Venda Registrada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {sectorStats.reduce((sum, s) => sum + s.totalRegistrados, 0).toLocaleString('pt-BR')}
              </span>
            </div>
          </CardContent>
        </Card>

        {hasBillingData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Faturados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span className="text-2xl font-bold">
                  {sectorStats.reduce((sum, s) => sum + s.totalFaturados, 0).toLocaleString('pt-BR')}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {hasBillingData && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-700">
                Gap (Reg. - Fat.)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span className="text-2xl font-bold text-amber-700">
                  {sectorStats.reduce((sum, s) => sum + s.gapRegistradoFaturado, 0).toLocaleString('pt-BR')}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Base oBoticário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-boticario" />
              <span className="text-2xl font-bold">
                {sectorStats.reduce((sum, s) => sum + s.registradosBaseBoticario, 0).toLocaleString('pt-BR')}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Crossbuyers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span className="text-2xl font-bold">
                {sectorStats.reduce((sum, s) => sum + s.crossbuyersRegistrados, 0).toLocaleString('pt-BR')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sectors table */}
      <Card>
        <CardHeader>
          <CardTitle>Revendedores por Setor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-sm">Setor</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">Registrados</th>
                  {hasBillingData && (
                    <th className="text-right py-3 px-4 font-medium text-sm">Faturados</th>
                  )}
                  {hasBillingData && (
                    <th className="text-right py-3 px-4 font-medium text-sm text-amber-700">Gap</th>
                  )}
                  <th className="text-right py-3 px-4 font-medium text-sm">Base oBoticário</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">Crossbuyers</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">% CB</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">Valor Total</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">Itens</th>
                  <th className="text-center py-3 px-4 font-medium text-sm">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredSectors.map((sector) => (
                  <tr
                    key={sector.setor}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium">{sector.setor}</td>
                    <td className="py-3 px-4 text-right">
                      {sector.totalRegistrados.toLocaleString('pt-BR')}
                    </td>
                    {hasBillingData && (
                      <td className="py-3 px-4 text-right text-emerald-600">
                        {sector.totalFaturados.toLocaleString('pt-BR')}
                      </td>
                    )}
                    {hasBillingData && (
                      <td className="py-3 px-4 text-right">
                        <span className={sector.gapRegistradoFaturado > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                          {sector.gapRegistradoFaturado > 0 ? '+' : ''}{sector.gapRegistradoFaturado.toLocaleString('pt-BR')}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4 text-right">
                      <span className={sector.registradosBaseBoticario === 0 ? 'text-muted-foreground' : ''}>
                        {sector.registradosBaseBoticario.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Badge
                        variant={sector.crossbuyersRegistrados > 0 ? 'default' : 'secondary'}
                        className={sector.crossbuyersRegistrados > 0 ? 'bg-emerald-500' : ''}
                      >
                        {sector.crossbuyersRegistrados.toLocaleString('pt-BR')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {sector.percentCrossbuyerRegistrados.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(
                        Object.values(sector.valorPorMarca).reduce((sum, v) => sum + v, 0)
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {Object.values(sector.itensPorMarca).reduce((sum, v) => sum + v, 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSector(sector.setor)}
                      >
                        Ver Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredSectors.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum setor encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sector details dialog */}
      <Dialog open={selectedSector !== null} onOpenChange={(open) => !open && setSelectedSector(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Setor: {selectedSector}</DialogTitle>
            <DialogDescription>
              {selectedSectorStats && (
                <>
                  {selectedSectorStats.totalRegistrados} com venda registrada •{' '}
                  {hasBillingData && <>{selectedSectorStats.totalFaturados} faturados • </>}
                  {selectedSectorStats.registradosBaseBoticario} base oBoticário •{' '}
                  {selectedSectorStats.crossbuyersRegistrados} crossbuyers ({selectedSectorStats.percentCrossbuyerRegistrados.toFixed(1)}%)
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedSectorStats && (
            <div className="mt-4 space-y-4">
              {/* Brand breakdown */}
              <div>
                <h4 className="font-medium mb-2">Valor/Itens por Marca</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {BRAND_ORDER.map((brandId) => {
                    const valor = selectedSectorStats.valorPorMarca[brandId] || 0;
                    const itens = selectedSectorStats.itensPorMarca[brandId] || 0;
                    return (
                      <Card key={brandId} className="p-3">
                        <div className="text-xs text-muted-foreground mb-1">
                          {BRANDS[brandId].shortName}
                        </div>
                        <div className="font-medium text-sm">{formatCurrency(valor)}</div>
                        <div className="text-xs text-muted-foreground">
                          {itens.toLocaleString('pt-BR')} itens
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Revendedores list */}
              <div>
                <h4 className="font-medium mb-2">Revendedores com Venda Registrada</h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {selectedSectorRevendedores.map((active) => (
                    <Card
                      key={active.codigoRevendedora}
                      className="p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        onRevendedorClick(active);
                        setSelectedSector(null);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{active.nomeRevendedora}</span>
                            {active.codigoRevendedoraOriginal && (
                              <span className="text-xs text-muted-foreground">
                                ({active.codigoRevendedoraOriginal})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {active.existsInBoticario && (
                              <Badge variant="default" className="bg-boticario">
                                Base oBoticário
                              </Badge>
                            )}
                            {active.isCrossbuyerRegistrado && (
                              <Badge variant="default" className="bg-emerald-500">
                                Crossbuyer ({active.brandCount} marcas)
                              </Badge>
                            )}
                            {active.hasVendaFaturada && (
                              <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                                Faturado
                              </Badge>
                            )}
                            {!active.hasVendaRegistrada && (
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
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatCurrency(active.totalValorVendaAllBrands)} •{' '}
                            {active.totalItensVendaAllBrands.toLocaleString('pt-BR')} itens
                          </div>
                          {/* Mostrar inconsistências */}
                          {active.inconsistencies.length > 0 && (
                            <div className="mt-2 p-2 bg-destructive/10 rounded-md border border-destructive/20">
                              <p className="text-xs font-medium text-destructive mb-1">Inconsistências:</p>
                              <ul className="text-xs text-destructive/80 space-y-0.5">
                                {active.inconsistencies.map((inc, idx) => (
                                  <li key={idx}>• {inc}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
