import { Users, FileText, DollarSign, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LqsMetrics } from '@/hooks/useLqsData';

type BucketType = 'leads' | 'quoted' | 'sold';

interface LqsOverviewDashboardProps {
  metrics: LqsMetrics | undefined;
  loading?: boolean;
  onBucketClick: (bucket: BucketType) => void;
  showRevenue?: boolean;
}

interface BucketCardProps {
  title: string;
  count: number;
  secondaryLabel: string;
  secondaryValue: string;
  variant: 'blue' | 'amber' | 'green';
  loading?: boolean;
  onClick: () => void;
}

function BucketCard({ title, count, secondaryLabel, secondaryValue, variant, loading, onClick }: BucketCardProps) {
  const variantStyles = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
      badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300',
      badge: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
    },
  };

  const styles = variantStyles[variant];

  return (
    <Card 
      className={cn(
        'border-2 transition-all hover:shadow-lg cursor-pointer group',
        styles.bg
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <h3 className={cn('text-lg font-semibold uppercase tracking-wide', styles.text)}>
            {title}
          </h3>
          
          {loading ? (
            <>
              <Skeleton className="h-14 w-24 mx-auto" />
              <Skeleton className="h-6 w-32 mx-auto" />
            </>
          ) : (
            <>
              <p className={cn('text-5xl font-bold', styles.text)}>
                {count.toLocaleString()}
              </p>
              
              <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm', styles.badge)}>
                <span className="font-medium">{secondaryValue}</span>
                <span className="text-muted-foreground">{secondaryLabel}</span>
              </div>
            </>
          )}

          <Button 
            variant="ghost" 
            size="sm" 
            className={cn('mt-2 group-hover:translate-x-1 transition-transform', styles.text)}
          >
            View {title}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function LqsOverviewDashboard({ metrics, loading, onBucketClick, showRevenue = true }: LqsOverviewDashboardProps) {
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatCurrency = (cents: number) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(dollars);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <BucketCard
        title="Open Leads"
        count={metrics?.leadsCount ?? 0}
        secondaryLabel="quoted"
        secondaryValue={formatPercent(metrics?.leadsToQuotedRate ?? 0)}
        variant="blue"
        loading={loading}
        onClick={() => onBucketClick('leads')}
      />
      
      <BucketCard
        title="Quoted Households"
        count={metrics?.quotedCount ?? 0}
        secondaryLabel="closed"
        secondaryValue={formatPercent(metrics?.quotedToSoldRate ?? 0)}
        variant="amber"
        loading={loading}
        onClick={() => onBucketClick('quoted')}
      />
      
      <BucketCard
        title="Sold Households"
        count={metrics?.soldCount ?? 0}
        secondaryLabel={showRevenue ? 'premium' : 'sold'}
        secondaryValue={showRevenue ? formatCurrency(metrics?.totalPremiumSoldCents ?? 0) : `${metrics?.soldCount ?? 0}`}
        variant="green"
        loading={loading}
        onClick={() => onBucketClick('sold')}
      />
    </div>
  );
}
