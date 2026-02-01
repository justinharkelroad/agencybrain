import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface Bar {
  value: number; // 0-100
  label?: string;
  color?: 'amber' | 'emerald' | 'blue';
}

interface AnimatedBarChartProps {
  bars: Bar[];
  height?: number;
  barWidth?: number;
  gap?: number;
  showLabels?: boolean;
  delay?: number;
}

export function AnimatedBarChart({
  bars,
  height = 100,
  barWidth = 24,
  gap = 8,
  showLabels = true,
  delay = 0,
}: AnimatedBarChartProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  const colorClasses = {
    amber: 'bg-marketing-amber',
    emerald: 'bg-marketing-emerald',
    blue: 'bg-marketing-blue',
  };

  const totalWidth = bars.length * barWidth + (bars.length - 1) * gap;

  return (
    <div ref={ref} className="inline-flex flex-col items-center">
      <div
        className="flex items-end"
        style={{ height, gap, width: totalWidth }}
      >
        {bars.map((bar, index) => (
          <motion.div
            key={index}
            className={`rounded-t-sm ${colorClasses[bar.color || 'amber']}`}
            style={{ width: barWidth }}
            initial={{ height: 0 }}
            animate={isInView && !prefersReducedMotion ? { height: `${bar.value}%` } : { height: 0 }}
            transition={{
              duration: 0.8,
              delay: delay + index * 0.1,
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        ))}
      </div>

      {showLabels && (
        <div className="flex mt-2" style={{ gap, width: totalWidth }}>
          {bars.map((bar, index) => (
            <motion.span
              key={index}
              className="text-xs text-marketing-text-muted text-center"
              style={{ width: barWidth }}
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ delay: delay + 0.5 + index * 0.1 }}
            >
              {bar.label}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}
