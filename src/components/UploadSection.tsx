import {
  BrandId,
  BrandUploadState,
  BRAND_ORDER,
  ActiveRevendedoresUploadState,
} from '@/types';
import { UploadCard } from './UploadCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2, ArrowRight, AlertTriangle, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface UploadSectionProps {
  uploadStates: Map<BrandId, BrandUploadState>;
  onFileSelect: (brandId: BrandId, file: File | null) => void;
  onProcess: () => void;
  canProcess: boolean;
  isProcessing: boolean;
  globalError: string | null;
  activeRevendedoresState: ActiveRevendedoresUploadState;
  onActiveRevendedoresSelect: (file: File | null) => void;
  selectedCiclo: string | null;
  onCicloChange: (ciclo: string | null) => void;
  availableCiclos: string[];
}

export function UploadSection({
  uploadStates,
  onFileSelect,
  onProcess,
  canProcess,
  isProcessing,
  globalError,
  activeRevendedoresState,
  onActiveRevendedoresSelect,
  selectedCiclo,
  onCicloChange,
  availableCiclos,
}: UploadSectionProps) {
  const loadedCount = Array.from(uploadStates.values()).filter(
    s => s.status === 'loaded'
  ).length;
  
  // Helper to create upload card for active revendedores
  const handleActiveRevendedoresClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        onActiveRevendedoresSelect(file);
      }
    };
    input.click();
  };
  
  const handleRemoveActiveRevendedores = () => {
    onActiveRevendedoresSelect(null);
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Title section */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">
          <span className="bg-gradient-to-r from-boticario to-emerald-400 bg-clip-text text-transparent">
            Upload das Planilhas
          </span>
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Carregue as planilhas de cada marca para identificar os cross-buyers.
          A planilha do O Boticario e obrigatoria - ela define a base de clientes para comparacao.
        </p>
      </div>

      {/* Upload cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {BRAND_ORDER.map((brandId, index) => {
          const state = uploadStates.get(brandId)!;
          return (
            <UploadCard
              key={brandId}
              state={state}
              onFileSelect={(file) => onFileSelect(brandId, file)}
              index={index + 1}
            />
          );
        })}
        
        {/* Active Revendedores Upload Card (6th card) */}
        <Card
          className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer group ${
            activeRevendedoresState.status === 'loaded'
              ? 'border-solid bg-card border-emerald-500/30'
              : activeRevendedoresState.status === 'error'
              ? 'border-solid border-destructive/50 bg-destructive/5'
              : 'border-emerald-500/30 hover:border-emerald-500/50'
          }`}
          onClick={
            activeRevendedoresState.status !== 'loading'
              ? handleActiveRevendedoresClick
              : undefined
          }
        >
          <CardHeader className="p-4 rounded-t-lg bg-gradient-to-r from-emerald-500 to-cyan-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center">
                  6
                </span>
                <span className="font-semibold text-white">Revendedores Ativos</span>
              </div>
              <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                Base Única
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {activeRevendedoresState.status === 'empty' && (
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 group-hover:bg-muted/80 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Arraste ou clique para enviar
                </p>
                <p className="text-xs text-muted-foreground">
                  XLSX, XLS ou CSV
                </p>
              </div>
            )}

            {activeRevendedoresState.status === 'loading' && (
              <div className="flex flex-col items-center text-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">Processando arquivo...</p>
              </div>
            )}

            {activeRevendedoresState.status === 'loaded' && (
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                    {activeRevendedoresState.fileName}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {activeRevendedoresState.rowCount.toLocaleString('pt-BR')} registros
                </p>
                {!activeRevendedoresState.hasCicloColumn && (
                  <p className="text-xs text-amber-500 mb-2">
                    Sem coluna de ciclo
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveActiveRevendedores();
                  }}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  Remover
                </Button>
              </div>
            )}

            {activeRevendedoresState.status === 'error' && (
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <p className="text-sm font-medium text-destructive mb-1">
                  Erro ao processar
                </p>
                <p className="text-xs text-destructive/80 mb-3 line-clamp-2">
                  {activeRevendedoresState.error}
                </p>
                <Button variant="outline" size="sm" onClick={handleActiveRevendedoresClick}>
                  Tentar novamente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Ciclo Selection */}
      {activeRevendedoresState.status === 'loaded' && availableCiclos.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Seleção de Ciclo</CardTitle>
            <CardDescription>
              Selecione o ciclo para filtrar os revendedores ativos e compras
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Select
                value={selectedCiclo || '__all__'}
                onValueChange={(value) => onCicloChange(value === '__all__' ? null : value)}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Selecione um ciclo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os ciclos</SelectItem>
                  {availableCiclos.map((ciclo) => (
                    <SelectItem key={ciclo} value={ciclo}>
                      {ciclo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {!activeRevendedoresState.hasCicloColumn && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">
                    Base de ativos sem ciclo — resultados podem incluir revendedores fora do período
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error message */}
      {globalError && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Erro no processamento</p>
            <p className="text-sm text-destructive/80">{globalError}</p>
          </div>
        </div>
      )}

      {/* Process button section */}
      <div className="flex flex-col items-center gap-4">
        <div className="text-sm text-muted-foreground">
          {loadedCount === 0 ? (
            <span>Nenhuma planilha carregada</span>
          ) : loadedCount === 1 ? (
            <span>1 planilha carregada</span>
          ) : (
            <span>{loadedCount} planilhas carregadas</span>
          )}
        </div>

        <Button
          size="lg"
          onClick={onProcess}
          disabled={!canProcess || isProcessing}
          className="min-w-[200px] bg-gradient-to-r from-boticario to-emerald-500 hover:from-boticario-dark hover:to-emerald-600 text-white font-semibold"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              Processar
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>

        {!canProcess && (
          <p className="text-sm text-amber-500">
            Carregue a planilha do O Boticario para continuar
          </p>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-12 p-6 rounded-xl bg-card border border-border">
        <h3 className="font-semibold mb-4 text-foreground">Como funciona</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-boticario/20 text-boticario text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
            <span>Carregue a planilha do <strong className="text-foreground">O Boticario</strong> (obrigatoria) - ela define quais clientes serao analisados.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-boticario/20 text-boticario text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
            <span>Carregue as outras planilhas (opcionais) para identificar quais clientes compraram em multiplas marcas.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-boticario/20 text-boticario text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
            <span>Clique em "Processar" para gerar o relatorio de cross-buyers.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-boticario/20 text-boticario text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
            <span>Todos os dados sao processados localmente no seu navegador - nada e enviado para servidores.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
