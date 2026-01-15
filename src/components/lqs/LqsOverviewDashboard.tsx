import { LqsBucket } from './LqsBucket';
import { LqsWaterFlow } from './LqsWaterFlow';
import { LqsMetrics } from '@/hooks/useLqsData';

type BucketType = 'leads' | 'quoted' | 'sold';

interface LqsOverviewDashboardProps {
  metrics: LqsMetrics | undefined;
  loading?: boolean;
  onBucketClick: (bucket: BucketType) => void;
  showRevenue?: boolean;
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
    <div className="w-full">
      {/* Desktop Layout - Horizontal with water flow between buckets */}
      <div className="hidden md:flex items-center justify-center gap-0">
        {/* Leads Bucket */}
        <div className="flex-1 max-w-[280px]">
          <LqsBucket
            variant="blue"
            title="Leads"
            count={metrics?.leadsCount ?? 0}
            secondaryLabel="quoted"
            secondaryValue={formatPercent(metrics?.leadsToQuotedRate ?? 0)}
            loading={loading}
            onClick={() => onBucketClick('leads')}
          />
        </div>

        {/* Water flow: Leads → Quoted */}
        <div className="flex-shrink-0 w-[80px] -mx-2">
          <LqsWaterFlow
            fromVariant="blue"
            toVariant="amber"
            direction="horizontal"
          />
        </div>

        {/* Quoted Bucket */}
        <div className="flex-1 max-w-[280px]">
          <LqsBucket
            variant="amber"
            title="Quoted"
            count={metrics?.quotedCount ?? 0}
            secondaryLabel="closed"
            secondaryValue={formatPercent(metrics?.quotedToSoldRate ?? 0)}
            loading={loading}
            onClick={() => onBucketClick('quoted')}
          />
        </div>

        {/* Water flow: Quoted → Sold */}
        <div className="flex-shrink-0 w-[80px] -mx-2">
          <LqsWaterFlow
            fromVariant="amber"
            toVariant="green"
            direction="horizontal"
          />
        </div>

        {/* Sold Bucket */}
        <div className="flex-1 max-w-[280px]">
          <LqsBucket
            variant="green"
            title="Sold"
            count={metrics?.soldCount ?? 0}
            secondaryLabel={showRevenue ? 'premium' : 'sold'}
            secondaryValue={showRevenue ? formatCurrency(metrics?.totalPremiumSoldCents ?? 0) : `${metrics?.soldCount ?? 0}`}
            loading={loading}
            onClick={() => onBucketClick('sold')}
          />
        </div>
      </div>

      {/* Mobile Layout - Vertical with water flow between buckets */}
      <div className="flex md:hidden flex-col items-center gap-0">
        {/* Leads Bucket */}
        <div className="w-full max-w-[240px]">
          <LqsBucket
            variant="blue"
            title="Leads"
            count={metrics?.leadsCount ?? 0}
            secondaryLabel="quoted"
            secondaryValue={formatPercent(metrics?.leadsToQuotedRate ?? 0)}
            loading={loading}
            onClick={() => onBucketClick('leads')}
          />
        </div>

        {/* Water flow: Leads → Quoted */}
        <div className="h-[50px] -my-2">
          <LqsWaterFlow
            fromVariant="blue"
            toVariant="amber"
            direction="vertical"
          />
        </div>

        {/* Quoted Bucket */}
        <div className="w-full max-w-[240px]">
          <LqsBucket
            variant="amber"
            title="Quoted"
            count={metrics?.quotedCount ?? 0}
            secondaryLabel="closed"
            secondaryValue={formatPercent(metrics?.quotedToSoldRate ?? 0)}
            loading={loading}
            onClick={() => onBucketClick('quoted')}
          />
        </div>

        {/* Water flow: Quoted → Sold */}
        <div className="h-[50px] -my-2">
          <LqsWaterFlow
            fromVariant="amber"
            toVariant="green"
            direction="vertical"
          />
        </div>

        {/* Sold Bucket */}
        <div className="w-full max-w-[240px]">
          <LqsBucket
            variant="green"
            title="Sold"
            count={metrics?.soldCount ?? 0}
            secondaryLabel={showRevenue ? 'premium' : 'sold'}
            secondaryValue={showRevenue ? formatCurrency(metrics?.totalPremiumSoldCents ?? 0) : `${metrics?.soldCount ?? 0}`}
            loading={loading}
            onClick={() => onBucketClick('sold')}
          />
        </div>
      </div>
    </div>
  );
}
