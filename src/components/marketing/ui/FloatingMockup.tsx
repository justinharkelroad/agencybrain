import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FloatingMockupProps {
  src: string;
  alt: string;
  className?: string;
  delay?: number;
  floatDuration?: number;
  floatY?: number;
}

export function FloatingMockup({
  src,
  alt,
  className,
  delay = 0,
  floatDuration = 3,
  floatY = 8,
}: FloatingMockupProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div
        className={cn(
          'rounded-xl overflow-hidden shadow-2xl border border-marketing-border-light',
          className
        )}
      >
        <img src={src} alt={alt} className="w-full h-auto" loading="lazy" />
      </div>
    );
  }

  return (
    <motion.div
      className={cn(
        'rounded-xl overflow-hidden shadow-2xl border border-marketing-border-light',
        'bg-marketing-surface',
        className
      )}
      initial={{ opacity: 0, y: 60, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      animate={{
        y: [0, -floatY, 0],
      }}
      style={{
        animationDelay: `${delay}s`,
      }}
    >
      <motion.div
        animate={{
          y: [0, -floatY, 0],
        }}
        transition={{
          duration: floatDuration,
          repeat: Infinity,
          ease: 'easeInOut',
          delay,
        }}
      >
        <img src={src} alt={alt} className="w-full h-auto" loading="lazy" />
      </motion.div>
    </motion.div>
  );
}
