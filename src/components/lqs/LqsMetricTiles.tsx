import { FileText, UserCheck, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LqsMetrics } from '@/hooks/useLqsData';

interface LqsMetricTilesProps {
  metrics: LqsMetrics | undefined;
  loading?: boolean;
  onTileClick?: (tab: string) => void;
}

interface MetricTileProps {
  title: string;
  value: number | undefined;
  icon: React.ReactNode;
  variant?: 'default' | 'blue' | 'green' | 'orange';
  loading?: boolean;
  pulse?: boolean;
  onClick?: () => void;
}

function MetricTile({ title, value, icon, variant = 'default', loading, pulse, onClick }: MetricTileProps) {
  const variantStyles = {
    default: 'text-foreground',
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    orange: 'text-orange-600 dark:text-orange-400',
  };

  const bgStyles = {
    default: 'bg-muted/50',
    blue: 'bg-blue-50 dark:bg-blue-950/30',
    green: 'bg-green-50 dark:bg-green-950/30',
    orange: 'bg-orange-50 dark:bg-orange-950/30',
  };

  return (
    <Card 
      className={cn(
        'transition-all hover:shadow-md', 
        bgStyles[variant],
        onClick && 'cursor-pointer hover:ring-2 hover:ring-primary/50'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className={cn('text-2xl font-bold mt-1', variantStyles[variant])}>
                {value?.toLocaleString() ?? 0}
              </p>
            )}
          </div>
          <div className={cn(
            'p-2 rounded-full',
            bgStyles[variant],
            pulse && value && value > 0 && 'animate-pulse'
          )}>
            <div className={variantStyles[variant]}>
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LqsMetricTiles({ metrics, loading, onTileClick }: LqsMetricTilesProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricTile
        title="All Quotes"
        value={metrics?.totalQuotes}
        icon={<FileText className="h-5 w-5" />}
        loading={loading}
        onClick={() => onTileClick?.('all')}
      />
      <MetricTile
        title="Self-Generated"
        value={metrics?.selfGenerated}
        icon={<UserCheck className="h-5 w-5" />}
        variant="blue"
        loading={loading}
        onClick={() => onTileClick?.('self-generated')}
      />
      <MetricTile
        title="Sold"
        value={metrics?.sold}
        icon={<CheckCircle className="h-5 w-5" />}
        variant="green"
        loading={loading}
        onClick={() => onTileClick?.('sold')}
      />
      <MetricTile
        title="Needs Attention"
        value={metrics?.needsAttention}
        icon={<AlertCircle className="h-5 w-5" />}
        variant="orange"
        loading={loading}
        pulse={true}
        onClick={() => onTileClick?.('needs-attention')}
      />
    </div>
  );
}
