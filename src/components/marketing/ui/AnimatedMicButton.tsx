import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Mic } from 'lucide-react';

interface AnimatedMicButtonProps {
  size?: number;
  color?: 'amber' | 'emerald';
  delay?: number;
  pulseIntensity?: 'subtle' | 'medium' | 'strong';
}

export function AnimatedMicButton({
  size = 80,
  color = 'emerald',
  delay = 0,
  pulseIntensity = 'medium',
}: AnimatedMicButtonProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  const colorClasses = {
    amber: {
      bg: 'bg-marketing-amber',
      ring: 'bg-marketing-amber/30',
      glow: 'shadow-[0_0_30px_rgba(154,52,18,0.5)]',
    },
    emerald: {
      bg: 'bg-marketing-emerald',
      ring: 'bg-marketing-emerald/30',
      glow: 'shadow-[0_0_30px_rgba(34,197,94,0.5)]',
    },
  };

  const pulseScales = {
    subtle: [1, 1.1, 1],
    medium: [1, 1.3, 1],
    strong: [1, 1.5, 1],
  };

  const iconSize = size * 0.4;

  return (
    <div
      ref={ref}
      className="relative inline-flex items-center justify-center"
      style={{ width: size * 1.6, height: size * 1.6 }}
    >
      {/* Outer pulse rings */}
      {[0, 1, 2].map((ring) => (
        <motion.div
          key={ring}
          className={`absolute rounded-full ${colorClasses[color].ring}`}
          style={{
            width: size,
            height: size,
          }}
          initial={{ scale: 1, opacity: 0 }}
          animate={
            isInView && !prefersReducedMotion
              ? {
                  scale: pulseScales[pulseIntensity],
                  opacity: [0, 0.4, 0],
                }
              : { scale: 1, opacity: 0 }
          }
          transition={{
            duration: 2,
            delay: delay + ring * 0.4,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Main button */}
      <motion.div
        className={`
          relative rounded-full flex items-center justify-center
          ${colorClasses[color].bg} ${colorClasses[color].glow}
        `}
        style={{ width: size, height: size }}
        initial={{ scale: 0, opacity: 0 }}
        animate={isInView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
        transition={{
          delay,
          duration: 0.5,
          type: 'spring',
          stiffness: 200,
          damping: 15,
        }}
        whileHover={!prefersReducedMotion ? { scale: 1.1 } : undefined}
      >
        {/* Sound wave bars */}
        <div className="absolute inset-0 flex items-center justify-center gap-1">
          {[-1, 0, 1].map((pos) => (
            <motion.div
              key={pos}
              className="w-1 rounded-full bg-white/30"
              style={{
                position: 'absolute',
                left: `calc(50% + ${pos * 20}px - 2px)`,
              }}
              initial={{ height: 8 }}
              animate={
                isInView && !prefersReducedMotion
                  ? {
                      height: [8, 20 + Math.abs(pos) * 5, 8],
                    }
                  : { height: 8 }
              }
              transition={{
                duration: 0.8,
                delay: delay + 0.5 + pos * 0.1,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        {/* Mic icon */}
        <Mic
          className="text-white relative z-10"
          style={{ width: iconSize, height: iconSize }}
        />
      </motion.div>

      {/* "Live" indicator */}
      <motion.div
        className="absolute -top-1 -right-1 flex items-center gap-1 bg-marketing-bg/90 px-2 py-1 rounded-full border border-marketing-border"
        initial={{ opacity: 0, scale: 0 }}
        animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
        transition={{ delay: delay + 0.8, duration: 0.3 }}
      >
        <motion.div
          className="w-2 h-2 rounded-full bg-marketing-red"
          animate={!prefersReducedMotion ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <span className="text-xs text-marketing-text font-medium">LIVE</span>
      </motion.div>
    </div>
  );
}
