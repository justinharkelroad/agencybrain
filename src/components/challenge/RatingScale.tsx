import { cn } from '@/lib/utils';

interface RatingScaleProps {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function RatingScale({ value, onChange, disabled = false }: RatingScaleProps) {
  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              'w-8 h-8 rounded-full text-xs font-semibold transition-all',
              'border-2 flex items-center justify-center',
              value === n
                ? 'bg-amber-500 border-amber-500 text-white scale-110'
                : disabled
                ? 'border-muted bg-muted/30 text-muted-foreground cursor-not-allowed'
                : 'border-border hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 cursor-pointer'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>Worst</span>
        <span>Best</span>
      </div>
    </div>
  );
}
