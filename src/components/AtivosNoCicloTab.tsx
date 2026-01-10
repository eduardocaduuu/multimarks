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
}

export function AtivosNoCicloTab({
  sectorStats,
  selectedCiclo,
  onRevendedorClick,
  diagnosticoJoin,
  diagnosticoParsing,
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
        <p className="text-muted-foreground">
          Visualização por setor dos revendedores ativos
          {selectedCiclo && (
            <span className="font-medium text-foreground"> • Ciclo: {selectedCiclo}</span>
          )}
        </p>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
              Total de Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {sectorStats.reduce((sum, s) => sum + s.totalAtivos, 0).toLocaleString('pt-BR')}
              </span>
            </div>
          </CardContent>
        </Card>

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
                {sectorStats.reduce((sum, s) => sum + s.ativosBaseBoticario, 0).toLocaleString('pt-BR')}
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
                {sectorStats.reduce((sum, s) => sum + s.crossbuyers, 0).toLocaleString('pt-BR')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sectors table */}
      <Card>
        <CardHeader>
          <CardTitle>Ativos por Setor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-sm">Setor</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">Total Ativos</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">Base oBoticário</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">Crossbuyers</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">% Crossbuyer</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">Valor Total</th>
                  <th className="text-right py-3 px-4 font-medium text-sm">Itens Total</th>
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
                      {sector.totalAtivos.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={sector.ativosBaseBoticario === 0 ? 'text-muted-foreground' : ''}>
                        {sector.ativosBaseBoticario.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Badge
                        variant={sector.crossbuyers > 0 ? 'default' : 'secondary'}
                        className={sector.crossbuyers > 0 ? 'bg-emerald-500' : ''}
                      >
                        {sector.crossbuyers.toLocaleString('pt-BR')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {sector.percentCrossbuyer.toFixed(1)}%
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
                  {selectedSectorStats.totalAtivos} revendedores ativos •{' '}
                  {selectedSectorStats.ativosBaseBoticario} base oBoticário •{' '}
                  {selectedSectorStats.crossbuyers} crossbuyers ({selectedSectorStats.percentCrossbuyer.toFixed(1)}%)
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
                <h4 className="font-medium mb-2">Revendedores Ativos</h4>
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
                            {active.existsInBoticario ? (
                              <Badge variant="default" className="bg-boticario">
                                Base oBoticário
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Sem oBoticário
                              </Badge>
                            )}
                            {active.isCrossbuyer && (
                              <Badge variant="default" className="bg-emerald-500">
                                Crossbuyer ({active.brandCount} marcas)
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
