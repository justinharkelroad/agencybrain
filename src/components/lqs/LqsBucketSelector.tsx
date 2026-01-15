import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type BucketType = 'leads' | 'quoted' | 'sold';

interface LqsBucketSelectorProps {
  activeBucket: BucketType;
  onBucketChange: (bucket: BucketType) => void;
  counts: {
    leads: number;
    quoted: number;
    sold: number;
  };
}

interface BucketTabProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  variant: 'blue' | 'amber' | 'green';
}

function BucketTab({ label, count, isActive, onClick, variant }: BucketTabProps) {
  const variantStyles = {
    blue: {
      active: 'bg-blue-100 dark:bg-blue-950 border-blue-500 text-blue-700 dark:text-blue-300',
      inactive: 'hover:bg-blue-50 dark:hover:bg-blue-950/50 text-muted-foreground hover:text-blue-600',
      badge: 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200',
    },
    amber: {
      active: 'bg-amber-100 dark:bg-amber-950 border-amber-500 text-amber-700 dark:text-amber-300',
      inactive: 'hover:bg-amber-50 dark:hover:bg-amber-950/50 text-muted-foreground hover:text-amber-600',
      badge: 'bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200',
    },
    green: {
      active: 'bg-green-100 dark:bg-green-950 border-green-500 text-green-700 dark:text-green-300',
      inactive: 'hover:bg-green-50 dark:hover:bg-green-950/50 text-muted-foreground hover:text-green-600',
      badge: 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-200',
    },
  };

  const styles = variantStyles[variant];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium transition-all',
        isActive ? styles.active : `border-transparent ${styles.inactive}`
      )}
    >
      <span className="uppercase tracking-wide text-sm">{label}</span>
      <Badge variant="secondary" className={cn('text-xs', isActive && styles.badge)}>
        {count.toLocaleString()}
      </Badge>
    </button>
  );
}

export function LqsBucketSelector({ activeBucket, onBucketChange, counts }: LqsBucketSelectorProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-xl w-fit">
      <BucketTab
        label="Open Leads"
        count={counts.leads}
        isActive={activeBucket === 'leads'}
        onClick={() => onBucketChange('leads')}
        variant="blue"
      />
      <BucketTab
        label="Quoted Households"
        count={counts.quoted}
        isActive={activeBucket === 'quoted'}
        onClick={() => onBucketChange('quoted')}
        variant="amber"
      />
      <BucketTab
        label="Sold Households"
        count={counts.sold}
        isActive={activeBucket === 'sold'}
        onClick={() => onBucketChange('sold')}
        variant="green"
      />
    </div>
  );
}
