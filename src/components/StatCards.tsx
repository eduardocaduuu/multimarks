import { DashboardStats, BRANDS } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, BarChart3, Trophy } from 'lucide-react';

interface StatCardsProps {
  stats: DashboardStats;
}

export function StatCards({ stats }: StatCardsProps) {
  const crossBuyerPercentage =
    stats.totalBaseCustomers > 0
      ? ((stats.crossBuyerCount / stats.totalBaseCustomers) * 100).toFixed(1)
      : '0';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total base customers */}
      <Card className="bg-gradient-to-br from-card to-muted/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Base de Clientes</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalBaseCustomers.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Clientes no O Boticario
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-boticario/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-boticario" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cross-buyers count */}
      <Card className="bg-gradient-to-br from-card to-muted/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Cross-Buyers</p>
              <p className="text-2xl font-bold text-foreground">
                {stats.crossBuyerCount.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {crossBuyerPercentage}% da base
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Distribution by brand count */}
      <Card className="bg-gradient-to-br from-card to-muted/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Distribuicao</p>
              <div className="flex items-baseline gap-2">
                {[2, 3, 4, 5].map(count => {
                  const value = stats.brandDistribution[count as 2 | 3 | 4 | 5] || 0;
                  return (
                    <div key={count} className="text-center">
                      <span className="text-lg font-bold text-foreground">{value}</span>
                      <span className="text-xs text-muted-foreground block">{count}m</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top overlap brand */}
      <Card className="bg-gradient-to-br from-card to-muted/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Maior Overlap</p>
              {stats.topOverlapBrand ? (
                <>
                  <p className="text-lg font-bold text-foreground">
                    {BRANDS[stats.topOverlapBrand].shortName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.brandOverlap[stats.topOverlapBrand].toLocaleString('pt-BR')} clientes
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">N/A</p>
              )}
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
