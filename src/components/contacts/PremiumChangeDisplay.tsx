import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PremiumChangeDisplayProps {
  premiumOld: number | null;
  premiumNew: number | null;
  changePercent?: number | null;
  /** If true, displays cents values (divides by 100) */
  isCents?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * Displays premium change with color-coded indicator
 * Shows: $X → $Y (+/-$Z, +/-N%)
 * Green for decrease (good for customer), Red for increase
 */
export function PremiumChangeDisplay({
  premiumOld,
  premiumNew,
  changePercent,
  isCents = false,
  size = 'sm',
}: PremiumChangeDisplayProps) {
  // Convert cents to dollars if needed
  const oldValue = premiumOld != null ? (isCents ? premiumOld / 100 : premiumOld) : null;
  const newValue = premiumNew != null ? (isCents ? premiumNew / 100 : premiumNew) : null;

  // If we don't have both values, show what we have
  if (oldValue == null && newValue == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (oldValue == null) {
    return <span>${newValue?.toLocaleString()}</span>;
  }

  if (newValue == null) {
    return <span>${oldValue?.toLocaleString()}</span>;
  }

  // Calculate change
  const changeDollars = newValue - oldValue;
  const calculatedPercent = changePercent ?? (oldValue !== 0 ? ((changeDollars / oldValue) * 100) : 0);
  const isIncrease = changeDollars > 0;
  const isDecrease = changeDollars < 0;
  const isNoChange = changeDollars === 0;

  const textSizeClass = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSizeClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div className={cn('flex items-center gap-1', textSizeClass)}>
      <span className="text-muted-foreground">${oldValue.toLocaleString()}</span>
      <span className="text-muted-foreground">→</span>
      <span className="font-medium">${newValue.toLocaleString()}</span>

      {!isNoChange && (
        <span
          className={cn(
            'flex items-center gap-0.5 ml-1',
            isIncrease ? 'text-red-500' : 'text-green-500'
          )}
        >
          {isIncrease ? (
            <TrendingUp className={iconSizeClass} />
          ) : (
            <TrendingDown className={iconSizeClass} />
          )}
          <span>
            {isIncrease ? '+' : ''}${Math.abs(changeDollars).toLocaleString()}
          </span>
          {calculatedPercent != null && (
            <span className="opacity-75">
              ({isIncrease ? '+' : ''}{calculatedPercent.toFixed(0)}%)
            </span>
          )}
        </span>
      )}

      {isNoChange && (
        <span className="flex items-center gap-0.5 ml-1 text-muted-foreground">
          <Minus className={iconSizeClass} />
          <span>No change</span>
        </span>
      )}
    </div>
  );
}

export default PremiumChangeDisplay;
