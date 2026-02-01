import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface AnimatedDonutProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: 'amber' | 'emerald' | 'blue';
  label?: string;
  sublabel?: string;
  delay?: number;
}

export function AnimatedDonut({
  percentage,
  size = 120,
  strokeWidth = 10,
  color = 'amber',
  label,
  sublabel,
  delay = 0,
}: AnimatedDonutProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colorClasses = {
    amber: {
      stroke: 'stroke-marketing-amber',
      text: 'text-marketing-amber',
      glow: 'drop-shadow-[0_0_8px_rgba(154,52,18,0.5)]',
    },
    emerald: {
      stroke: 'stroke-marketing-emerald',
      text: 'text-marketing-emerald',
      glow: 'drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]',
    },
    blue: {
      stroke: 'stroke-marketing-blue',
      text: 'text-marketing-blue',
      glow: 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]',
    },
  };

  return (
    <div ref={ref} className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className={`transform -rotate-90 ${isInView ? colorClasses[color].glow : ''}`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-marketing-surface-light opacity-30"
        />
        {/* Animated progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={colorClasses[color].stroke}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={isInView && !prefersReducedMotion ? { strokeDashoffset } : { strokeDashoffset: circumference }}
          transition={{
            duration: 1.5,
            delay,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && (
          <motion.span
            className={`text-2xl font-bold ${colorClasses[color].text}`}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: delay + 0.5, duration: 0.5 }}
          >
            {label}
          </motion.span>
        )}
        {sublabel && (
          <motion.span
            className="text-xs text-marketing-text-muted"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: delay + 0.7, duration: 0.5 }}
          >
            {sublabel}
          </motion.span>
        )}
      </div>
    </div>
  );
}
