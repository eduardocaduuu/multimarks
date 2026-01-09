import { DashboardStats } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

interface SectorDistributionProps {
  stats: DashboardStats;
}

export function SectorDistribution({ stats }: SectorDistributionProps) {
  const { setorDistribution, crossBuyerCount } = stats;

  // Sort sectors by count (descending)
  const sortedSetores = Object.entries(setorDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Top 10 setores

  if (sortedSetores.length === 0) {
    return null;
  }

  // Find max count for bar width calculation
  const maxCount = sortedSetores[0]?.[1] || 1;

  return (
    <Card className="bg-gradient-to-br from-card to-muted/50 mb-6">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
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

        <div className="space-y-3">
          {sortedSetores.map(([setor, count]) => {
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

        {Object.keys(setorDistribution).length > 10 && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Mostrando top 10 de {Object.keys(setorDistribution).length} setores
          </p>
        )}
      </CardContent>
    </Card>
  );
}
