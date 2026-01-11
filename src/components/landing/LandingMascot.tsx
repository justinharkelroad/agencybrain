import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { StanAvatar, StanVariant } from '@/components/chatbot/StanAvatar';

interface LandingMascotProps {
  className?: string;
}

export function LandingMascot({ className }: LandingMascotProps) {
  const [variant, setVariant] = useState<StanVariant>('waving');
  const prefersReducedMotion = useReducedMotion();

  // Cycle through moods: wave on entrance, then settle to idle
  useEffect(() => {
    const timer = setTimeout(() => {
      setVariant('idle');
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  // Reduced motion: skip animations
  if (prefersReducedMotion) {
    return (
      <div className={className}>
        <StanAvatar variant="idle" size="xl" animate={false} />
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      // Entrance animation
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay: 0.3,
      }}
      // Hover interaction
      whileHover={{ scale: 1.05 }}
    >
      {/* Glow effect behind Stan */}
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/20 blur-2xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Floating animation wrapper */}
      <motion.div
        className="relative"
        animate={{
          y: [0, -8, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <StanAvatar 
          variant={variant} 
          size="xl" 
          animate={true}
          className="w-24 h-24 sm:w-32 sm:h-32"
        />
      </motion.div>
    </motion.div>
  );
}
