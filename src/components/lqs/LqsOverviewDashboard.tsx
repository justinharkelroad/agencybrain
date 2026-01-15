import { LqsMetrics } from '@/hooks/useLqsData';
import { LqsBucket } from './LqsBucket';
import { LqsWaterFlow } from './LqsWaterFlow';
import type { BucketType } from './LqsBucketSelector';

export interface LqsOverviewDashboardProps {
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
    <>
      {/* Desktop layout - horizontal with water flow */}
      <div className="hidden md:flex items-center justify-center gap-4 lg:gap-6">
        <LqsBucket
          variant="blue"
          title="Open Leads"
          count={metrics?.leadsCount ?? 0}
          secondaryLabel="quoted"
          secondaryValue={formatPercent(metrics?.leadsToQuotedRate ?? 0)}
          loading={loading}
          onClick={() => onBucketClick('leads')}
          className="w-40 lg:w-48"
        />
        
        <LqsWaterFlow
          fromVariant="blue"
          toVariant="amber"
          direction="horizontal"
        />
        
        <LqsBucket
          variant="amber"
          title="Quoted Households"
          count={metrics?.quotedCount ?? 0}
          secondaryLabel="closed"
          secondaryValue={formatPercent(metrics?.quotedToSoldRate ?? 0)}
          loading={loading}
          onClick={() => onBucketClick('quoted')}
          className="w-40 lg:w-48"
        />
        
        <LqsWaterFlow
          fromVariant="amber"
          toVariant="green"
          direction="horizontal"
        />
        
        <LqsBucket
          variant="green"
          title="Sold Households"
          count={metrics?.soldCount ?? 0}
          secondaryLabel={showRevenue ? 'premium' : 'sold'}
          secondaryValue={showRevenue ? formatCurrency(metrics?.totalPremiumSoldCents ?? 0) : `${metrics?.soldCount ?? 0}`}
          loading={loading}
          onClick={() => onBucketClick('sold')}
          className="w-40 lg:w-48"
        />
      </div>

      {/* Mobile layout - vertical with water flow */}
      <div className="flex md:hidden flex-col items-center gap-0">
        <LqsBucket
          variant="blue"
          title="Open Leads"
          count={metrics?.leadsCount ?? 0}
          secondaryLabel="quoted"
          secondaryValue={formatPercent(metrics?.leadsToQuotedRate ?? 0)}
          loading={loading}
          onClick={() => onBucketClick('leads')}
          className="w-36"
        />
        
        <LqsWaterFlow
          fromVariant="blue"
          toVariant="amber"
          direction="vertical"
        />
        
        <LqsBucket
          variant="amber"
          title="Quoted Households"
          count={metrics?.quotedCount ?? 0}
          secondaryLabel="closed"
          secondaryValue={formatPercent(metrics?.quotedToSoldRate ?? 0)}
          loading={loading}
          onClick={() => onBucketClick('quoted')}
          className="w-36"
        />
        
        <LqsWaterFlow
          fromVariant="amber"
          toVariant="green"
          direction="vertical"
        />
        
        <LqsBucket
          variant="green"
          title="Sold Households"
          count={metrics?.soldCount ?? 0}
          secondaryLabel={showRevenue ? 'premium' : 'sold'}
          secondaryValue={showRevenue ? formatCurrency(metrics?.totalPremiumSoldCents ?? 0) : `${metrics?.soldCount ?? 0}`}
          loading={loading}
          onClick={() => onBucketClick('sold')}
          className="w-36"
        />
      </div>
    </>
  );
}
