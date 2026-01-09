import { useState, useCallback } from 'react';
import {
  BrandId,
  BrandUploadState,
  Item,
  ProcessingResult,
  BRANDS,
  BRAND_ORDER,
} from '@/types';
import { parseFile } from '@/lib/parseFile';
import { processAllBrands } from '@/lib/aggregate';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UploadSection } from '@/components/UploadSection';
import { ResultsDashboard } from '@/components/ResultsDashboard';

type AppView = 'upload' | 'results';

function App() {
  const [view, setView] = useState<AppView>('upload');
  const [uploadStates, setUploadStates] = useState<Map<BrandId, BrandUploadState>>(() => {
    const initial = new Map<BrandId, BrandUploadState>();
    for (const brandId of BRAND_ORDER) {
      initial.set(brandId, {
        brand: BRANDS[brandId],
        file: null,
        fileName: null,
        status: 'empty',
        error: null,
        rowCount: 0,
      });
    }
    return initial;
  });
  const [brandItems, setBrandItems] = useState<Map<BrandId, Item[]>>(new Map());
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (brandId: BrandId, file: File | null) => {
    if (!file) {
      // Remove file
      setUploadStates(prev => {
        const newStates = new Map(prev);
        newStates.set(brandId, {
          ...prev.get(brandId)!,
          file: null,
          fileName: null,
          status: 'empty',
          error: null,
          rowCount: 0,
        });
        return newStates;
      });
      setBrandItems(prev => {
        const newItems = new Map(prev);
        newItems.delete(brandId);
        return newItems;
      });
      return;
    }

    // Set loading state
    setUploadStates(prev => {
      const newStates = new Map(prev);
      newStates.set(brandId, {
        ...prev.get(brandId)!,
        file,
        fileName: file.name,
        status: 'loading',
        error: null,
        rowCount: 0,
      });
      return newStates;
    });

    try {
      const result = await parseFile(file, brandId);

      if (result.success) {
        setUploadStates(prev => {
          const newStates = new Map(prev);
          newStates.set(brandId, {
            ...prev.get(brandId)!,
            status: 'loaded',
            error: null,
            rowCount: result.items.length,
          });
          return newStates;
        });
        setBrandItems(prev => {
          const newItems = new Map(prev);
          newItems.set(brandId, result.items);
          return newItems;
        });
      } else {
        setUploadStates(prev => {
          const newStates = new Map(prev);
          newStates.set(brandId, {
            ...prev.get(brandId)!,
            status: 'error',
            error: result.errors.join('; '),
            rowCount: 0,
          });
          return newStates;
        });
      }
    } catch (err) {
      setUploadStates(prev => {
        const newStates = new Map(prev);
        newStates.set(brandId, {
          ...prev.get(brandId)!,
          status: 'error',
          error: `Erro ao processar arquivo: ${err}`,
          rowCount: 0,
        });
        return newStates;
      });
    }
  }, []);

  const handleProcess = useCallback(async () => {
    setIsProcessing(true);
    setGlobalError(null);

    try {
      const result = processAllBrands(brandItems);

      if (result.success) {
        setProcessingResult(result);
        setView('results');
      } else {
        setGlobalError(result.errors.join('; '));
      }
    } catch (err) {
      setGlobalError(`Erro no processamento: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  }, [brandItems]);

  const handleBackToUpload = useCallback(() => {
    setView('upload');
  }, []);

  const canProcess = uploadStates.get('boticario')?.status === 'loaded';

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg brand-gradient-boticario flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Multimarcas</h1>
                  <p className="text-xs text-muted-foreground">Analise de Cross-Buyers</p>
                </div>
              </div>
              {view === 'results' && (
                <button
                  onClick={handleBackToUpload}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Voltar para Upload
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="container mx-auto px-4 py-8">
          {view === 'upload' ? (
            <UploadSection
              uploadStates={uploadStates}
              onFileSelect={handleFileSelect}
              onProcess={handleProcess}
              canProcess={canProcess}
              isProcessing={isProcessing}
              globalError={globalError}
            />
          ) : (
            processingResult && (
              <ResultsDashboard
                result={processingResult}
                onBack={handleBackToUpload}
              />
            )
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border mt-auto py-6">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>Processamento 100% local - seus dados nunca saem do navegador</p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

export default App;
