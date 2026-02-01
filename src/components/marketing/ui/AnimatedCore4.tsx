import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Heart, Cross, Briefcase, Dumbbell, Flame } from 'lucide-react';

interface AnimatedCore4Props {
  delay?: number;
  size?: 'small' | 'medium' | 'large';
}

export function AnimatedCore4({ delay = 0, size = 'medium' }: AnimatedCore4Props) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const sizeClasses = {
    small: { grid: 'gap-1', box: 'w-12 h-12', icon: 'w-4 h-4', text: 'text-[10px]' },
    medium: { grid: 'gap-2', box: 'w-16 h-16', icon: 'w-5 h-5', text: 'text-xs' },
    large: { grid: 'gap-3', box: 'w-20 h-20', icon: 'w-6 h-6', text: 'text-sm' },
  };

  const categories = [
    { name: 'BODY', icon: Dumbbell, color: 'bg-teal-500', delay: 0 },
    { name: 'BEING', icon: Cross, color: 'bg-purple-500', delay: 0.1 },
    { name: 'BALANCE', icon: Heart, color: 'bg-pink-500', delay: 0.2 },
    { name: 'BUSINESS', icon: Briefcase, color: 'bg-emerald-500', delay: 0.3 },
  ];

  // Animate score counting up
  useEffect(() => {
    if (!isInView || prefersReducedMotion) {
      if (prefersReducedMotion) {
        setScore(25);
        setStreak(7);
      }
      return;
    }

    const scoreTimer = setTimeout(() => {
      let current = 0;
      const interval = setInterval(() => {
        current += 1;
        setScore(current);
        if (current >= 25) clearInterval(interval);
      }, 50);
    }, delay * 1000 + 500);

    const streakTimer = setTimeout(() => {
      let current = 0;
      const interval = setInterval(() => {
        current += 1;
        setStreak(current);
        if (current >= 7) clearInterval(interval);
      }, 100);
    }, delay * 1000 + 800);

    return () => {
      clearTimeout(scoreTimer);
      clearTimeout(streakTimer);
    };
  }, [isInView, delay, prefersReducedMotion]);

  const s = sizeClasses[size];

  return (
    <div ref={ref} className="inline-flex flex-col items-center gap-3">
      {/* 2x2 Grid of categories */}
      <div className={`grid grid-cols-2 ${s.grid}`}>
        {categories.map((cat) => (
          <motion.div
            key={cat.name}
            className={`${s.box} ${cat.color} rounded-lg flex flex-col items-center justify-center`}
            initial={{ scale: 0, opacity: 0 }}
            animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
            transition={{
              delay: delay + cat.delay,
              duration: 0.4,
              type: 'spring',
              stiffness: 200,
            }}
            whileHover={!prefersReducedMotion ? { scale: 1.05 } : undefined}
          >
            <cat.icon className={`${s.icon} text-white mb-1`} />
            <span className={`${s.text} text-white font-medium`}>{cat.name}</span>
          </motion.div>
        ))}
      </div>

      {/* Score and Streak row */}
      <div className="flex items-center gap-3">
        {/* Donut Score */}
        <div className="relative">
          <svg width={size === 'small' ? 50 : size === 'medium' ? 60 : 70} height={size === 'small' ? 50 : size === 'medium' ? 60 : 70}>
            <circle
              cx="50%"
              cy="50%"
              r={size === 'small' ? 20 : size === 'medium' ? 24 : 28}
              fill="none"
              stroke="currentColor"
              strokeWidth={size === 'small' ? 4 : 5}
              className="text-marketing-surface-light"
            />
            <motion.circle
              cx="50%"
              cy="50%"
              r={size === 'small' ? 20 : size === 'medium' ? 24 : 28}
              fill="none"
              stroke="white"
              strokeWidth={size === 'small' ? 4 : 5}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * (size === 'small' ? 20 : size === 'medium' ? 24 : 28)}
              initial={{ strokeDashoffset: 2 * Math.PI * (size === 'small' ? 20 : size === 'medium' ? 24 : 28) }}
              animate={isInView ? {
                strokeDashoffset: 2 * Math.PI * (size === 'small' ? 20 : size === 'medium' ? 24 : 28) * (1 - 25/28)
              } : undefined}
              transition={{ delay: delay + 0.5, duration: 1, ease: 'easeOut' }}
              transform={`rotate(-90 ${size === 'small' ? 25 : size === 'medium' ? 30 : 35} ${size === 'small' ? 25 : size === 'medium' ? 30 : 35})`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`${size === 'small' ? 'text-sm' : 'text-lg'} font-bold text-white`}>{score}</span>
            <span className="text-[8px] text-marketing-text-muted">/28</span>
          </div>
        </div>

        {/* Streak */}
        <motion.div
          className="flex items-center gap-1 bg-marketing-surface px-2 py-1 rounded-full"
          initial={{ opacity: 0, x: 10 }}
          animate={isInView ? { opacity: 1, x: 0 } : undefined}
          transition={{ delay: delay + 0.8, duration: 0.3 }}
        >
          <motion.div
            animate={!prefersReducedMotion && isInView ? { scale: [1, 1.2, 1] } : undefined}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
          >
            <Flame className="w-4 h-4 text-orange-500" />
          </motion.div>
          <span className="text-xs text-marketing-text font-medium">{streak} day streak!</span>
        </motion.div>
      </div>
    </div>
  );
}
