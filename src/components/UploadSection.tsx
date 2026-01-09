import {
  BrandId,
  BrandUploadState,
  BRAND_ORDER,
} from '@/types';
import { UploadCard } from './UploadCard';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, ArrowRight } from 'lucide-react';

interface UploadSectionProps {
  uploadStates: Map<BrandId, BrandUploadState>;
  onFileSelect: (brandId: BrandId, file: File | null) => void;
  onProcess: () => void;
  canProcess: boolean;
  isProcessing: boolean;
  globalError: string | null;
}

export function UploadSection({
  uploadStates,
  onFileSelect,
  onProcess,
  canProcess,
  isProcessing,
  globalError,
}: UploadSectionProps) {
  const loadedCount = Array.from(uploadStates.values()).filter(
    s => s.status === 'loaded'
  ).length;

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
      </div>

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
