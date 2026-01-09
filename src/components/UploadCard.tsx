import { useCallback, useState, useRef } from 'react';
import { BrandUploadState } from '@/types';
import { cn } from '@/lib/utils';
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadCardProps {
  state: BrandUploadState;
  onFileSelect: (file: File | null) => void;
  index: number;
}

const brandGradients: Record<string, string> = {
  boticario: 'from-boticario to-emerald-400',
  eudora: 'from-eudora to-purple-400',
  auamigos: 'from-auamigos to-amber-400',
  oui: 'from-oui to-pink-400',
  qdb: 'from-qdb to-cyan-400',
};

const brandBorders: Record<string, string> = {
  boticario: 'border-boticario/30 hover:border-boticario/50',
  eudora: 'border-eudora/30 hover:border-eudora/50',
  auamigos: 'border-auamigos/30 hover:border-auamigos/50',
  oui: 'border-oui/30 hover:border-oui/50',
  qdb: 'border-qdb/30 hover:border-qdb/50',
};

export function UploadCard({ state, onFileSelect, index }: UploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && isValidFile(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [onFileSelect]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFileSelect(null);
    },
    [onFileSelect]
  );

  const isValidFile = (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );
    return hasValidType || hasValidExtension;
  };

  const brandId = state.brand.id;
  const gradient = brandGradients[brandId] || brandGradients.boticario;
  const borderClass = brandBorders[brandId] || brandBorders.boticario;

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer group',
        borderClass,
        isDragging && 'border-solid border-primary bg-primary/5',
        state.status === 'loaded' && 'border-solid bg-card',
        state.status === 'error' && 'border-solid border-destructive/50 bg-destructive/5'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={state.status !== 'loading' ? handleClick : undefined}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className={cn('p-4 rounded-t-lg bg-gradient-to-r', gradient)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center">
              {index}
            </span>
            <span className="font-semibold text-white">{state.brand.name}</span>
          </div>
          {state.brand.required && (
            <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
              Obrigatoria
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {state.status === 'empty' && (
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

        {state.status === 'loading' && (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Processando arquivo...</p>
          </div>
        )}

        {state.status === 'loaded' && (
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-boticario/10 flex items-center justify-center mb-3">
              <CheckCircle className="w-6 h-6 text-boticario" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                {state.fileName}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {state.rowCount.toLocaleString('pt-BR')} registros
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemove}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-3 h-3 mr-1" />
              Remover
            </Button>
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm font-medium text-destructive mb-1">
              Erro ao processar
            </p>
            <p className="text-xs text-destructive/80 mb-3 line-clamp-2">
              {state.error}
            </p>
            <Button variant="outline" size="sm" onClick={handleClick}>
              Tentar novamente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
