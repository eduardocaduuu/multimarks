import { useState } from 'react';
import { DashboardStats } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';

interface SectorDistributionProps {
  stats: DashboardStats;
}

const INITIAL_VISIBLE = 5;

export function SectorDistribution({ stats }: SectorDistributionProps) {
  const [showAll, setShowAll] = useState(false);
  const { setorDistribution, crossBuyerCount } = stats;

  // Sort sectors by count (descending)
  const allSetores = Object.entries(setorDistribution)
    .sort(([, a], [, b]) => b - a);

  if (allSetores.length === 0) {
    return null;
  }

  const visibleSetores = showAll ? allSetores : allSetores.slice(0, INITIAL_VISIBLE);
  const hasMore = allSetores.length > INITIAL_VISIBLE;

  // Find max count for bar width calculation
  const maxCount = allSetores[0]?.[1] || 1;

  return (
    <Card className="bg-gradient-to-br from-card to-muted/50 mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Cross-Buyers por Setor</h3>
              <p className="text-xs text-muted-foreground">
                Distribuicao dos {crossBuyerCount.toLocaleString('pt-BR')} cross-buyers
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {allSetores.length} setores
          </span>
        </div>

        <div className="space-y-3">
          {visibleSetores.map(([setor, count]) => {
            const percentage = crossBuyerCount > 0
              ? ((count / crossBuyerCount) * 100).toFixed(1)
              : '0';
            const barWidth = (count / maxCount) * 100;

            return (
              <div key={setor} className="group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground truncate max-w-[60%]">
                    {setor}
                  </span>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {count.toLocaleString('pt-BR')}
                    </span>
                    <span className="font-semibold text-indigo-500 min-w-[50px] text-right">
                      {percentage}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {hasMore && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-muted-foreground hover:text-foreground"
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Ver todos ({allSetores.length - INITIAL_VISIBLE} mais)
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
