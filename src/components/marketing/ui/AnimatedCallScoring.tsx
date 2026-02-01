import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Phone, CheckCircle2, XCircle } from 'lucide-react';

interface AnimatedCallScoringProps {
  delay?: number;
  variant?: 'bars' | 'pentagon' | 'full';
}

export function AnimatedCallScoring({ delay = 0, variant = 'full' }: AnimatedCallScoringProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  const scores = [
    { label: 'Rapport', value: 87, color: 'emerald' },
    { label: 'Coverage', value: 92, color: 'emerald' },
    { label: 'Objections', value: 45, color: 'red' },
    { label: 'Closing', value: 78, color: 'amber' },
    { label: 'Energy', value: 95, color: 'emerald' },
  ];

  return (
    <div ref={ref} className="inline-block">
      <div className="bg-marketing-surface rounded-xl p-4 border border-marketing-border min-w-[220px]">
        {/* Header */}
        <motion.div
          className="flex items-center gap-2 mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={isInView ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay, duration: 0.3 }}
        >
          <div className="w-8 h-8 rounded-lg bg-marketing-amber/20 flex items-center justify-center">
            <Phone className="w-4 h-4 text-marketing-amber" />
          </div>
          <div>
            <div className="text-sm font-semibold text-marketing-text">Call Score</div>
            <div className="text-[10px] text-marketing-text-muted">Sales Call Analysis</div>
          </div>
        </motion.div>

        {/* Overall Score */}
        <motion.div
          className="flex items-center justify-center mb-4"
          initial={{ scale: 0 }}
          animate={isInView ? { scale: 1 } : undefined}
          transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
        >
          <div className="relative">
            <svg width={80} height={80}>
              <circle
                cx={40}
                cy={40}
                r={32}
                fill="none"
                stroke="currentColor"
                strokeWidth={6}
                className="text-marketing-surface-light"
              />
              <motion.circle
                cx={40}
                cy={40}
                r={32}
                fill="none"
                stroke="url(#scoreGradient)"
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 32}
                initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                animate={isInView ? { strokeDashoffset: 2 * Math.PI * 32 * (1 - 0.79) } : undefined}
                transition={{ delay: delay + 0.4, duration: 1.2, ease: 'easeOut' }}
                transform="rotate(-90 40 40)"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22C55E" />
                  <stop offset="100%" stopColor="#4ADE80" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatedNumber value={79} delay={delay + 0.5} isInView={isInView} />
              <span className="text-[8px] text-marketing-text-muted">/ 100</span>
            </div>
          </div>
        </motion.div>

        {/* Score Bars */}
        <div className="space-y-2">
          {scores.map((score, index) => (
            <ScoreBar
              key={score.label}
              label={score.label}
              value={score.value}
              color={score.color as 'emerald' | 'red' | 'amber'}
              delay={delay + 0.3 + index * 0.1}
              isInView={isInView}
            />
          ))}
        </div>

        {/* Feedback indicators */}
        <motion.div
          className="flex items-center justify-between mt-4 pt-3 border-t border-marketing-border"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : undefined}
          transition={{ delay: delay + 1, duration: 0.3 }}
        >
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-marketing-emerald" />
            <span className="text-[10px] text-marketing-text-muted">4 strengths</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-marketing-red" />
            <span className="text-[10px] text-marketing-text-muted">2 improvements</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

interface ScoreBarProps {
  label: string;
  value: number;
  color: 'emerald' | 'red' | 'amber';
  delay: number;
  isInView: boolean;
}

function ScoreBar({ label, value, color, delay, isInView }: ScoreBarProps) {
  const prefersReducedMotion = useReducedMotion();

  const colorClasses = {
    emerald: 'bg-marketing-emerald',
    red: 'bg-marketing-red',
    amber: 'bg-marketing-amber',
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-marketing-text-muted w-16 truncate">{label}</span>
      <div className="flex-1 h-2 bg-marketing-surface-light rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${colorClasses[color]}`}
          initial={{ width: 0 }}
          animate={isInView && !prefersReducedMotion ? { width: `${value}%` } : { width: `${value}%` }}
          transition={{ delay, duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] text-marketing-text font-medium w-6 text-right">{value}%</span>
    </div>
  );
}

interface AnimatedNumberProps {
  value: number;
  delay: number;
  isInView: boolean;
}

function AnimatedNumber({ value, delay, isInView }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isInView) return;
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }

    const timeout = setTimeout(() => {
      let current = 0;
      const interval = setInterval(() => {
        current += 1;
        setDisplay(current);
        if (current >= value) clearInterval(interval);
      }, 20);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [isInView, value, delay, prefersReducedMotion]);

  return <span className="text-xl font-bold text-marketing-text">{display}</span>;
}

// Pentagon/Radar chart for call scoring
export function AnimatedPentagon({ delay = 0 }: { delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  const points = [
    { label: 'Rapport', value: 85 },
    { label: 'Coverage', value: 90 },
    { label: 'Objections', value: 60 },
    { label: 'Closing', value: 75 },
    { label: 'Energy', value: 95 },
  ];

  const size = 120;
  const center = size / 2;
  const maxRadius = 45;

  const getPoint = (index: number, radius: number) => {
    const angle = (2 * Math.PI * index) / 5 - Math.PI / 2;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  };

  const dataPath = points
    .map((p, i) => {
      const { x, y } = getPoint(i, (p.value / 100) * maxRadius);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ') + ' Z';

  const emptyPath = points
    .map((_, i) => {
      const { x, y } = getPoint(i, 0);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ') + ' Z';

  return (
    <div ref={ref} className="relative inline-block">
      <svg width={size} height={size}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <polygon
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
            className="text-marketing-border"
            opacity={0.3}
          />
        ))}

        {/* Axis lines */}
        {points.map((_, i) => {
          const { x, y } = getPoint(i, maxRadius);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeWidth={1}
              className="text-marketing-border"
              opacity={0.2}
            />
          );
        })}

        {/* Data polygon */}
        <motion.path
          d={dataPath}
          fill="rgba(34, 197, 94, 0.2)"
          stroke="#22C55E"
          strokeWidth={2}
          initial={{ d: emptyPath, opacity: 0 }}
          animate={isInView && !prefersReducedMotion ? { d: dataPath, opacity: 1 } : { d: dataPath, opacity: 1 }}
          transition={{ delay, duration: 1, ease: 'easeOut' }}
        />

        {/* Data points */}
        {points.map((p, i) => {
          const { x, y } = getPoint(i, (p.value / 100) * maxRadius);
          return (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r={3}
              fill="#22C55E"
              initial={{ scale: 0 }}
              animate={isInView ? { scale: 1 } : undefined}
              transition={{ delay: delay + 0.8 + i * 0.1, type: 'spring' }}
            />
          );
        })}
      </svg>

      {/* Labels */}
      {points.map((p, i) => {
        const { x, y } = getPoint(i, maxRadius + 15);
        return (
          <motion.span
            key={i}
            className="absolute text-[8px] text-marketing-text-muted whitespace-nowrap"
            style={{
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : undefined}
            transition={{ delay: delay + 1 + i * 0.05 }}
          >
            {p.label}
          </motion.span>
        );
      })}
    </div>
  );
}
