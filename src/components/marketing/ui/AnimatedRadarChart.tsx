import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface RadarPoint {
  label: string;
  value: number; // 0-100
}

interface AnimatedRadarChartProps {
  points: RadarPoint[];
  size?: number;
  color?: 'amber' | 'emerald';
  delay?: number;
  showLabels?: boolean;
}

export function AnimatedRadarChart({
  points,
  size = 200,
  color = 'amber',
  delay = 0,
  showLabels = true,
}: AnimatedRadarChartProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  const colorClasses = {
    amber: {
      fill: 'rgba(154, 52, 18, 0.3)',
      stroke: 'rgb(154, 52, 18)',
      dot: 'fill-marketing-amber',
    },
    emerald: {
      fill: 'rgba(34, 197, 94, 0.3)',
      stroke: 'rgb(34, 197, 94)',
      dot: 'fill-marketing-emerald',
    },
  };

  const center = size / 2;
  const maxRadius = (size / 2) * 0.7; // Leave room for labels
  const numPoints = points.length;
  const angleStep = (2 * Math.PI) / numPoints;

  // Calculate polygon points for the grid
  const getPoint = (index: number, radius: number) => {
    const angle = angleStep * index - Math.PI / 2; // Start from top
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  };

  // Grid lines (20%, 40%, 60%, 80%, 100%)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];

  // Data polygon path
  const dataPath = points
    .map((point, i) => {
      const radius = (point.value / 100) * maxRadius;
      const { x, y } = getPoint(i, radius);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ') + ' Z';

  // Initial (empty) polygon path
  const emptyPath = points
    .map((_, i) => {
      const { x, y } = getPoint(i, 0);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ') + ' Z';

  return (
    <div ref={ref} className="relative inline-block">
      <svg width={size} height={size}>
        {/* Grid polygons */}
        {gridLevels.map((level, levelIndex) => (
          <motion.polygon
            key={level}
            points={points
              .map((_, i) => {
                const { x, y } = getPoint(i, maxRadius * level);
                return `${x},${y}`;
              })
              .join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            className="text-marketing-border-light"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 0.5 } : { opacity: 0 }}
            transition={{ delay: delay + levelIndex * 0.1, duration: 0.3 }}
          />
        ))}

        {/* Axis lines */}
        {points.map((_, i) => {
          const { x, y } = getPoint(i, maxRadius);
          return (
            <motion.line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeWidth={1}
              className="text-marketing-border-light"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 0.3 } : { opacity: 0 }}
              transition={{ delay: delay + i * 0.1, duration: 0.3 }}
            />
          );
        })}

        {/* Data polygon - animated fill */}
        <motion.path
          d={dataPath}
          fill={colorClasses[color].fill}
          stroke={colorClasses[color].stroke}
          strokeWidth={2}
          initial={{ d: emptyPath, opacity: 0 }}
          animate={
            isInView && !prefersReducedMotion
              ? { d: dataPath, opacity: 1 }
              : prefersReducedMotion
              ? { d: dataPath, opacity: 1 }
              : { d: emptyPath, opacity: 0 }
          }
          transition={{
            d: { duration: 1, delay, ease: [0.4, 0, 0.2, 1] },
            opacity: { duration: 0.3, delay },
          }}
        />

        {/* Data points */}
        {points.map((point, i) => {
          const radius = (point.value / 100) * maxRadius;
          const { x, y } = getPoint(i, radius);
          return (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r={4}
              className={colorClasses[color].dot}
              initial={{ scale: 0, opacity: 0 }}
              animate={
                isInView
                  ? { scale: 1, opacity: 1 }
                  : { scale: 0, opacity: 0 }
              }
              transition={{
                delay: delay + 0.8 + i * 0.1,
                duration: 0.3,
                type: 'spring',
                stiffness: 300,
              }}
            />
          );
        })}
      </svg>

      {/* Labels */}
      {showLabels &&
        points.map((point, i) => {
          const { x, y } = getPoint(i, maxRadius + 20);
          return (
            <motion.div
              key={i}
              className="absolute text-xs text-marketing-text-muted whitespace-nowrap"
              style={{
                left: x,
                top: y,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ delay: delay + 1 + i * 0.1, duration: 0.3 }}
            >
              {point.label}
            </motion.div>
          );
        })}
    </div>
  );
}
