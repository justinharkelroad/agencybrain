import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { DollarSign, Users, TrendingUp, Target } from 'lucide-react';

interface AnimatedDashboardProps {
  delay?: number;
  variant?: 'full' | 'compact';
}

export function AnimatedDashboard({ delay = 0, variant = 'compact' }: AnimatedDashboardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  const [percentage, setPercentage] = useState(0);
  const [premium, setPremium] = useState(0);
  const [households, setHouseholds] = useState(0);
  const [policies, setPolicies] = useState(0);

  // Animate counters
  useEffect(() => {
    if (!isInView) return;
    if (prefersReducedMotion) {
      setPercentage(16);
      setPremium(32164);
      setHouseholds(20);
      setPolicies(30);
      return;
    }

    // Percentage
    setTimeout(() => {
      let val = 0;
      const interval = setInterval(() => {
        val += 1;
        setPercentage(val);
        if (val >= 16) clearInterval(interval);
      }, 80);
    }, delay * 1000 + 300);

    // Premium
    setTimeout(() => {
      let val = 0;
      const target = 32164;
      const step = target / 30;
      const interval = setInterval(() => {
        val += step;
        setPremium(Math.min(val, target));
        if (val >= target) clearInterval(interval);
      }, 40);
    }, delay * 1000 + 500);

    // Households
    setTimeout(() => {
      let val = 0;
      const interval = setInterval(() => {
        val += 1;
        setHouseholds(val);
        if (val >= 20) clearInterval(interval);
      }, 60);
    }, delay * 1000 + 400);

    // Policies
    setTimeout(() => {
      let val = 0;
      const interval = setInterval(() => {
        val += 1;
        setPolicies(val);
        if (val >= 30) clearInterval(interval);
      }, 50);
    }, delay * 1000 + 450);
  }, [isInView, delay, prefersReducedMotion]);

  const radius = variant === 'full' ? 60 : 45;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = variant === 'full' ? 10 : 8;
  const size = variant === 'full' ? 150 : 110;

  return (
    <div ref={ref} className="inline-block">
      <div className={`bg-marketing-surface rounded-xl p-4 border border-marketing-border ${variant === 'full' ? 'min-w-[280px]' : 'min-w-[200px]'}`}>
        {/* Header */}
        <motion.div
          className="flex items-center gap-2 mb-3"
          initial={{ opacity: 0, y: -10 }}
          animate={isInView ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay, duration: 0.3 }}
        >
          <TrendingUp className="w-4 h-4 text-marketing-amber" />
          <span className="text-xs text-marketing-text-muted">Agency Performance</span>
          <motion.span
            className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-marketing-emerald/20 text-marketing-emerald"
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : undefined}
            transition={{ delay: delay + 0.5, type: 'spring' }}
          >
            +1,660%
          </motion.span>
        </motion.div>

        <div className="flex items-center gap-4">
          {/* Big Donut Chart */}
          <div className="relative">
            <svg width={size} height={size}>
              {/* Background circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-marketing-surface-light"
              />
              {/* Animated progress */}
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="url(#dashboardGradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={isInView ? { strokeDashoffset: circumference * (1 - percentage / 100) } : undefined}
                transition={{ delay: delay + 0.3, duration: 1.5, ease: 'easeOut' }}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
              <defs>
                <linearGradient id="dashboardGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D97706" />
                  <stop offset="100%" stopColor="#F59E0B" />
                </linearGradient>
              </defs>
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`${variant === 'full' ? 'text-3xl' : 'text-2xl'} font-bold text-marketing-text`}>
                {percentage}%
              </span>
              <span className="text-[10px] text-marketing-text-muted">
                ${premium.toLocaleString()}
              </span>
              <span className="text-[8px] text-marketing-text-dim">
                of $200,000
              </span>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="flex flex-col gap-2">
            <StatCard
              icon={DollarSign}
              value={`$${Math.round(premium / 1000)}k`}
              label="Premium"
              color="amber"
              delay={delay + 0.4}
              isInView={isInView}
            />
            <StatCard
              icon={Users}
              value={households.toString()}
              label="Households"
              color="emerald"
              delay={delay + 0.5}
              isInView={isInView}
            />
            <StatCard
              icon={Target}
              value={policies.toString()}
              label="Policies"
              color="blue"
              delay={delay + 0.6}
              isInView={isInView}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: any;
  value: string;
  label: string;
  color: 'amber' | 'emerald' | 'blue';
  delay: number;
  isInView: boolean;
}

function StatCard({ icon: Icon, value, label, color, delay, isInView }: StatCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const colorClasses = {
    amber: 'text-marketing-amber bg-marketing-amber/10',
    emerald: 'text-marketing-emerald bg-marketing-emerald/10',
    blue: 'text-marketing-blue bg-marketing-blue/10',
  };

  return (
    <motion.div
      className="flex items-center gap-2 bg-marketing-bg/50 rounded-lg px-2 py-1.5"
      initial={{ opacity: 0, x: 10 }}
      animate={isInView ? { opacity: 1, x: 0 } : undefined}
      transition={{ delay, duration: 0.3 }}
    >
      <div className={`w-6 h-6 rounded flex items-center justify-center ${colorClasses[color]}`}>
        <Icon className="w-3 h-3" />
      </div>
      <div>
        <div className="text-sm font-bold text-marketing-text">{value}</div>
        <div className="text-[8px] text-marketing-text-muted">{label}</div>
      </div>
      <motion.span
        className="ml-auto text-[8px] text-marketing-emerald"
        initial={{ opacity: 0 }}
        animate={isInView && !prefersReducedMotion ? { opacity: [0, 1, 1] } : { opacity: 1 }}
        transition={{ delay: delay + 0.3, duration: 0.5 }}
      >
        ↑100%
      </motion.span>
    </motion.div>
  );
}
