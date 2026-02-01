import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface Ring {
  percentage: number;
  color: 'amber' | 'emerald' | 'blue' | 'red';
  label?: string;
}

interface AnimatedRingsProps {
  rings: Ring[];
  size?: number;
  strokeWidth?: number;
  gap?: number;
  delay?: number;
  showCenter?: boolean;
  centerLabel?: string;
  centerValue?: string;
}

export function AnimatedRings({
  rings,
  size = 140,
  strokeWidth = 8,
  gap = 4,
  delay = 0,
  showCenter = true,
  centerLabel,
  centerValue,
}: AnimatedRingsProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  const colorClasses = {
    amber: {
      stroke: 'stroke-marketing-amber',
      bg: 'stroke-marketing-amber/20',
    },
    emerald: {
      stroke: 'stroke-marketing-emerald',
      bg: 'stroke-marketing-emerald/20',
    },
    blue: {
      stroke: 'stroke-marketing-blue',
      bg: 'stroke-marketing-blue/20',
    },
    red: {
      stroke: 'stroke-marketing-red',
      bg: 'stroke-marketing-red/20',
    },
  };

  return (
    <div ref={ref} className="relative inline-flex items-center justify-center">
      <svg width={size} height={size}>
        {rings.map((ring, index) => {
          // Calculate radius for each ring (outer to inner)
          const radius = (size / 2) - strokeWidth / 2 - (index * (strokeWidth + gap));
          const circumference = 2 * Math.PI * radius;
          const strokeDashoffset = circumference - (ring.percentage / 100) * circumference;

          return (
            <g key={index}>
              {/* Background ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                className={colorClasses[ring.color].bg}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
              {/* Animated progress ring */}
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className={colorClasses[ring.color].stroke}
                strokeDasharray={circumference}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                initial={{ strokeDashoffset: circumference }}
                animate={
                  isInView && !prefersReducedMotion
                    ? { strokeDashoffset }
                    : prefersReducedMotion
                    ? { strokeDashoffset }
                    : { strokeDashoffset: circumference }
                }
                transition={{
                  duration: 1.2,
                  delay: delay + index * 0.2,
                  ease: [0.4, 0, 0.2, 1],
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Center content */}
      {showCenter && (centerLabel || centerValue) && (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ delay: delay + rings.length * 0.2, duration: 0.4 }}
        >
          {centerValue && (
            <span className="text-2xl font-bold text-marketing-text">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-xs text-marketing-text-muted">
              {centerLabel}
            </span>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Simpler single ring with icon
interface AnimatedProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: 'amber' | 'emerald' | 'blue';
  icon?: React.ReactNode;
  label?: string;
  delay?: number;
}

export function AnimatedProgressRing({
  percentage,
  size = 80,
  strokeWidth = 6,
  color = 'amber',
  icon,
  label,
  delay = 0,
}: AnimatedProgressRingProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  const colorClasses = {
    amber: {
      stroke: 'stroke-marketing-amber',
      bg: 'stroke-marketing-surface-light',
      text: 'text-marketing-amber',
    },
    emerald: {
      stroke: 'stroke-marketing-emerald',
      bg: 'stroke-marketing-surface-light',
      text: 'text-marketing-emerald',
    },
    blue: {
      stroke: 'stroke-marketing-blue',
      bg: 'stroke-marketing-surface-light',
      text: 'text-marketing-blue',
    },
  };

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div ref={ref} className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size}>
          {/* Background */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={colorClasses[color].bg}
            opacity={0.3}
          />
          {/* Progress */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={colorClasses[color].stroke}
            strokeDasharray={circumference}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            initial={{ strokeDashoffset: circumference }}
            animate={
              isInView && !prefersReducedMotion
                ? { strokeDashoffset }
                : { strokeDashoffset: circumference }
            }
            transition={{
              duration: 1,
              delay,
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        </svg>

        {/* Center icon or percentage */}
        <motion.div
          className={`absolute inset-0 flex items-center justify-center ${colorClasses[color].text}`}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: delay + 0.5, duration: 0.3 }}
        >
          {icon || (
            <span className="text-sm font-bold">{percentage}%</span>
          )}
        </motion.div>
      </div>

      {label && (
        <motion.span
          className="text-xs text-marketing-text-muted"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: delay + 0.7, duration: 0.3 }}
        >
          {label}
        </motion.span>
      )}
    </div>
  );
}
