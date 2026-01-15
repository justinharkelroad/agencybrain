import { cn } from '@/lib/utils';

type BucketVariant = 'blue' | 'amber' | 'green';

interface LqsBucketProps {
  variant: BucketVariant;
  title: string;
  count: number;
  secondaryLabel: string;
  secondaryValue: string;
  onClick: () => void;
  loading?: boolean;
  className?: string;
}

const variantStyles = {
  blue: {
    stroke: 'stroke-blue-500 dark:stroke-blue-400',
    fill: 'fill-blue-500/20 dark:fill-blue-400/20',
    waterFill: 'fill-blue-400/40 dark:fill-blue-400/30',
    text: 'text-blue-600 dark:text-blue-300',
    badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    glow: 'group-hover:drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]',
  },
  amber: {
    stroke: 'stroke-amber-500 dark:stroke-amber-400',
    fill: 'fill-amber-500/20 dark:fill-amber-400/20',
    waterFill: 'fill-amber-400/40 dark:fill-amber-400/30',
    text: 'text-amber-600 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    glow: 'group-hover:drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]',
  },
  green: {
    stroke: 'stroke-green-500 dark:stroke-green-400',
    fill: 'fill-green-500/20 dark:fill-green-400/20',
    waterFill: 'fill-green-400/40 dark:fill-green-400/30',
    text: 'text-green-600 dark:text-green-300',
    badge: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
    glow: 'group-hover:drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]',
  },
};

export function LqsBucket({
  variant,
  title,
  count,
  secondaryLabel,
  secondaryValue,
  onClick,
  loading,
  className,
}: LqsBucketProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'group cursor-pointer transition-transform hover:scale-[1.02] flex flex-col items-center',
        className
      )}
      onClick={onClick}
    >
      {/* Title ABOVE the bucket */}
      <h3 className={cn('text-sm md:text-base font-bold uppercase tracking-wider mb-1', styles.text)}>
        {title}
      </h3>

      {/* SVG Bucket */}
      <div className="relative">
        <svg
          viewBox="0 0 200 200"
          className={cn('w-full h-auto transition-all duration-300', styles.glow)}
          style={{ maxWidth: '180px', margin: '0 auto', display: 'block' }}
        >
          <defs>
            {/* Wave animation for water surface */}
            <clipPath id={`bucket-clip-${variant}`}>
              <path d="M30 50 L30 160 Q30 180 50 180 L150 180 Q170 180 170 160 L170 50 Z" />
            </clipPath>

            {/* Gradient for water */}
            <linearGradient id={`water-gradient-${variant}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={variant === 'blue' ? '#60a5fa' : variant === 'amber' ? '#fbbf24' : '#4ade80'} stopOpacity="0.6" />
              <stop offset="100%" stopColor={variant === 'blue' ? '#2563eb' : variant === 'amber' ? '#d97706' : '#16a34a'} stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Bucket handle */}
          <path
            d="M50 35 Q100 5 150 35"
            className={cn('fill-none stroke-[4]', styles.stroke)}
            strokeLinecap="round"
          />

          {/* Handle attachments */}
          <circle cx="50" cy="35" r="5" className={cn('stroke-[3] fill-none', styles.stroke)} />
          <circle cx="150" cy="35" r="5" className={cn('stroke-[3] fill-none', styles.stroke)} />

          {/* Bucket rim (ellipse at top) */}
          <ellipse
            cx="100"
            cy="50"
            rx="70"
            ry="12"
            className={cn('stroke-[3] fill-none', styles.stroke)}
          />

          {/* Bucket body outline */}
          <path
            d="M30 50 L30 160 Q30 180 50 180 L150 180 Q170 180 170 160 L170 50"
            className={cn('stroke-[3] fill-none', styles.stroke)}
          />

          {/* Water fill with wave animation */}
          <g clipPath={`url(#bucket-clip-${variant})`}>
            {/* Static water body */}
            <rect
              x="30"
              y="80"
              width="140"
              height="100"
              fill={`url(#water-gradient-${variant})`}
              className="opacity-80"
            />

            {/* Animated wave surface */}
            <path
              d="M30 80 Q55 70 80 80 T130 80 T180 80 L180 80 Q155 90 130 80 T80 80 T30 80"
              fill={`url(#water-gradient-${variant})`}
              className="opacity-90"
            >
              <animate
                attributeName="d"
                dur="3s"
                repeatCount="indefinite"
                values="
                  M30 80 Q55 70 80 80 T130 80 T180 80 L180 80 Q155 90 130 80 T80 80 T30 80;
                  M30 80 Q55 90 80 80 T130 80 T180 80 L180 80 Q155 70 130 80 T80 80 T30 80;
                  M30 80 Q55 70 80 80 T130 80 T180 80 L180 80 Q155 90 130 80 T80 80 T30 80
                "
              />
            </path>
          </g>

          {/* Inner rim shadow for depth */}
          <ellipse
            cx="100"
            cy="50"
            rx="65"
            ry="10"
            className={cn('fill-none stroke-[1] opacity-30', styles.stroke)}
          />
        </svg>

        {/* Content overlay - only count and percentage INSIDE bucket */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
          <div className="text-center space-y-1">
            {/* Count */}
            {loading ? (
              <div className="h-10 w-16 mx-auto bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <p className={cn('text-3xl md:text-4xl font-bold', styles.text)}>
                {count.toLocaleString()}
              </p>
            )}

            {/* Secondary metric badge */}
            {loading ? (
              <div className="h-5 w-20 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            ) : (
              <div className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                styles.badge
              )}>
                <span>{secondaryValue}</span>
                <span className="opacity-70">{secondaryLabel}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View link BELOW the bucket */}
      <div className={cn(
        'mt-1 text-xs font-medium flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity',
        styles.text
      )}>
        View {title.split(' ')[0]} <span className="group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </div>
  );
}
