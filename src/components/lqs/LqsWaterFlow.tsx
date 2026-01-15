import { cn } from '@/lib/utils';

interface LqsWaterFlowProps {
  fromVariant: 'blue' | 'amber';
  toVariant: 'amber' | 'green';
  direction: 'horizontal' | 'vertical';
  className?: string;
}

export function LqsWaterFlow({
  fromVariant,
  toVariant,
  direction,
  className,
}: LqsWaterFlowProps) {
  const fromColor = fromVariant === 'blue' ? '#60a5fa' : '#fbbf24';
  const toColor = toVariant === 'amber' ? '#fbbf24' : '#4ade80';

  // Blend color for transition
  const midColor = fromVariant === 'blue' ? '#93c5fd' : '#fcd34d';

  if (direction === 'horizontal') {
    return (
      <div className={cn('relative flex items-center justify-center', className)}>
        <svg
          viewBox="0 0 120 100"
          className="w-full h-auto"
          style={{ maxWidth: '100px' }}
        >
          <defs>
            {/* Gradient for the pour stream */}
            <linearGradient id={`pour-gradient-${fromVariant}-${toVariant}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={fromColor} stopOpacity="0.8" />
              <stop offset="50%" stopColor={midColor} stopOpacity="0.6" />
              <stop offset="100%" stopColor={toColor} stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Curved pour stream path */}
          <path
            d="M10 20 Q60 0 110 80"
            fill="none"
            stroke={`url(#pour-gradient-${fromVariant}-${toVariant})`}
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.4"
          />

          {/* Animated water drops along the path */}
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} r="6" fill={fromColor} opacity="0.8">
              <animateMotion
                dur="1.5s"
                repeatCount="indefinite"
                begin={`${i * 0.3}s`}
                path="M10 20 Q60 0 110 80"
              />
              <animate
                attributeName="r"
                values="6;4;6"
                dur="1.5s"
                repeatCount="indefinite"
                begin={`${i * 0.3}s`}
              />
              <animate
                attributeName="opacity"
                values="0.9;0.6;0.9"
                dur="1.5s"
                repeatCount="indefinite"
                begin={`${i * 0.3}s`}
              />
              <animate
                attributeName="fill"
                values={`${fromColor};${midColor};${toColor}`}
                dur="1.5s"
                repeatCount="indefinite"
                begin={`${i * 0.3}s`}
              />
            </circle>
          ))}

          {/* Small splash drops at the end */}
          {[0, 1, 2].map((i) => (
            <circle key={`splash-${i}`} cx="110" cy="80" r="3" fill={toColor} opacity="0">
              <animate
                attributeName="cx"
                values={`110;${105 + i * 5};110`}
                dur="0.8s"
                repeatCount="indefinite"
                begin={`${i * 0.5}s`}
              />
              <animate
                attributeName="cy"
                values="80;70;80"
                dur="0.8s"
                repeatCount="indefinite"
                begin={`${i * 0.5}s`}
              />
              <animate
                attributeName="opacity"
                values="0;0.6;0"
                dur="0.8s"
                repeatCount="indefinite"
                begin={`${i * 0.5}s`}
              />
            </circle>
          ))}
        </svg>
      </div>
    );
  }

  // Vertical direction for mobile
  return (
    <div className={cn('relative flex items-center justify-center py-2', className)}>
      <svg
        viewBox="0 0 60 80"
        className="w-auto h-full"
        style={{ maxHeight: '60px' }}
      >
        <defs>
          <linearGradient id={`pour-gradient-v-${fromVariant}-${toVariant}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={fromColor} stopOpacity="0.8" />
            <stop offset="50%" stopColor={midColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={toColor} stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Vertical pour stream */}
        <path
          d="M30 5 Q40 30 30 75"
          fill="none"
          stroke={`url(#pour-gradient-v-${fromVariant}-${toVariant})`}
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Animated drops falling vertically */}
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} r="5" fill={fromColor} opacity="0.8">
            <animateMotion
              dur="1.2s"
              repeatCount="indefinite"
              begin={`${i * 0.3}s`}
              path="M30 5 Q40 30 30 75"
            />
            <animate
              attributeName="r"
              values="5;3;5"
              dur="1.2s"
              repeatCount="indefinite"
              begin={`${i * 0.3}s`}
            />
            <animate
              attributeName="opacity"
              values="0.9;0.5;0.9"
              dur="1.2s"
              repeatCount="indefinite"
              begin={`${i * 0.3}s`}
            />
            <animate
              attributeName="fill"
              values={`${fromColor};${midColor};${toColor}`}
              dur="1.2s"
              repeatCount="indefinite"
              begin={`${i * 0.3}s`}
            />
          </circle>
        ))}
      </svg>
    </div>
  );
}
