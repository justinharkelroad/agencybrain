import { motion, useReducedMotion, useInView, animate } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  delay?: number;
  decimals?: number;
  className?: string;
  color?: 'amber' | 'emerald' | 'white';
}

export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  duration = 2,
  delay = 0,
  decimals = 0,
  className = '',
  color = 'white',
}: AnimatedCounterProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const colorClasses = {
    amber: 'text-marketing-amber',
    emerald: 'text-marketing-emerald',
    white: 'text-marketing-text',
  };

  useEffect(() => {
    if (!isInView || prefersReducedMotion) {
      if (prefersReducedMotion) {
        setDisplayValue(value);
      }
      return;
    }

    const timeout = setTimeout(() => {
      setIsAnimating(true);
      const controls = animate(0, value, {
        duration,
        ease: [0.4, 0, 0.2, 1],
        onUpdate: (latest) => {
          setDisplayValue(latest);
        },
        onComplete: () => {
          setIsAnimating(false);
          setDisplayValue(value);
        },
      });

      return () => controls.stop();
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [isInView, value, duration, delay, prefersReducedMotion]);

  const formattedValue = displayValue.toFixed(decimals);

  return (
    <motion.span
      ref={ref}
      className={`font-mono tabular-nums ${colorClasses[color]} ${className} ${isAnimating ? 'animate-pulse' : ''}`}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      {prefix}
      {formattedValue}
      {suffix}
    </motion.span>
  );
}

// Digital scoreboard style counter with flickering effect
interface DigitalCounterProps {
  value: number;
  digits?: number;
  delay?: number;
  color?: 'amber' | 'emerald' | 'white';
}

export function DigitalCounter({
  value,
  digits = 4,
  delay = 0,
  color = 'amber',
}: DigitalCounterProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();
  const [displayDigits, setDisplayDigits] = useState<string[]>(
    Array(digits).fill('0')
  );
  const [flickering, setFlickering] = useState<boolean[]>(
    Array(digits).fill(false)
  );

  const colorClasses = {
    amber: {
      text: 'text-marketing-amber',
      glow: 'drop-shadow-[0_0_4px_rgba(154,52,18,0.8)]',
      bg: 'bg-marketing-amber/10',
    },
    emerald: {
      text: 'text-marketing-emerald',
      glow: 'drop-shadow-[0_0_4px_rgba(34,197,94,0.8)]',
      bg: 'bg-marketing-emerald/10',
    },
    white: {
      text: 'text-marketing-text',
      glow: 'drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]',
      bg: 'bg-white/10',
    },
  };

  useEffect(() => {
    if (!isInView || prefersReducedMotion) {
      if (prefersReducedMotion) {
        setDisplayDigits(value.toString().padStart(digits, '0').split(''));
      }
      return;
    }

    const targetDigits = value.toString().padStart(digits, '0').split('');

    // Start flickering all digits
    setFlickering(Array(digits).fill(true));

    // Flicker effect - rapidly change digits
    const flickerInterval = setInterval(() => {
      setDisplayDigits((prev) =>
        prev.map((_, i) =>
          flickering[i] ? Math.floor(Math.random() * 10).toString() : targetDigits[i]
        )
      );
    }, 50);

    // Stop flickering one digit at a time from left to right
    targetDigits.forEach((digit, index) => {
      setTimeout(() => {
        setFlickering((prev) => {
          const next = [...prev];
          next[index] = false;
          return next;
        });
        setDisplayDigits((prev) => {
          const next = [...prev];
          next[index] = digit;
          return next;
        });
      }, delay * 1000 + 200 + index * 300);
    });

    // Clean up flickering after all digits settle
    setTimeout(() => {
      clearInterval(flickerInterval);
      setDisplayDigits(targetDigits);
      setFlickering(Array(digits).fill(false));
    }, delay * 1000 + 200 + digits * 300 + 100);

    return () => clearInterval(flickerInterval);
  }, [isInView, value, digits, delay, prefersReducedMotion]);

  return (
    <div
      ref={ref}
      className={`inline-flex gap-1 p-2 rounded-lg ${colorClasses[color].bg}`}
    >
      {displayDigits.map((digit, index) => (
        <motion.span
          key={index}
          className={`
            font-mono text-2xl font-bold w-8 h-10 flex items-center justify-center
            rounded bg-marketing-bg border border-marketing-border
            ${colorClasses[color].text}
            ${flickering[index] ? colorClasses[color].glow : ''}
          `}
          initial={{ opacity: 0, y: -10 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
          transition={{ delay: delay + index * 0.1, duration: 0.2 }}
        >
          {digit}
        </motion.span>
      ))}
    </div>
  );
}
