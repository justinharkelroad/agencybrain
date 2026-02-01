import { motion, useReducedMotion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BentoCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  screenshot?: string;
  size?: 'small' | 'medium' | 'large';
  accentColor?: 'amber' | 'emerald';
  className?: string;
  index?: number;
}

export function BentoCard({
  title,
  description,
  icon: Icon,
  screenshot,
  size = 'medium',
  accentColor = 'amber',
  className,
  index = 0,
}: BentoCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const sizeClasses = {
    small: 'col-span-1 row-span-1',
    medium: 'col-span-1 md:col-span-2 row-span-1',
    large: 'col-span-1 md:col-span-2 row-span-2',
  };

  const accentClasses = {
    amber: {
      icon: 'bg-marketing-amber/20 text-marketing-amber',
      glow: 'group-hover:shadow-[0_0_40px_rgba(154,52,18,0.2)]',
    },
    emerald: {
      icon: 'bg-marketing-emerald/20 text-marketing-emerald',
      glow: 'group-hover:shadow-[0_0_40px_rgba(34,197,94,0.15)]',
    },
  };

  return (
    <motion.div
      className={cn(
        'group relative rounded-xl bg-marketing-surface border border-marketing-border p-6 overflow-hidden',
        'transition-all duration-300 hover:border-marketing-border-light',
        sizeClasses[size],
        accentClasses[accentColor].glow,
        // For large cards, use flex column to fill space
        size === 'large' && 'flex flex-col',
        className
      )}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
    >
      {/* Background gradient on hover */}
      <div
        className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none',
          accentColor === 'amber'
            ? 'bg-gradient-to-br from-marketing-amber/5 to-transparent'
            : 'bg-gradient-to-br from-marketing-emerald/5 to-transparent'
        )}
      />

      <div className={cn(
        'relative z-10',
        size === 'large' ? 'flex flex-col h-full' : 'h-full flex flex-col'
      )}>
        {/* Icon */}
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center mb-4 shrink-0',
            accentClasses[accentColor].icon
          )}
        >
          <Icon className="w-6 h-6" />
        </div>

        {/* Content */}
        <h3 className="text-xl font-semibold text-marketing-text mb-2">
          {title}
        </h3>
        <p className={cn(
          'text-marketing-text-muted text-sm leading-relaxed',
          // Only grow if no screenshot, otherwise stay fixed
          !screenshot && 'flex-grow'
        )}>
          {description}
        </p>

        {/* Screenshot - fills remaining space for large cards */}
        {screenshot && (
          <div className={cn(
            'mt-4 rounded-lg overflow-hidden bg-marketing-bg border border-marketing-border',
            size === 'large' && 'flex-grow min-h-0'
          )}>
            <img
              src={screenshot}
              alt={`${title} screenshot`}
              className={cn(
                'w-full object-cover',
                size === 'large' ? 'h-full object-top' : 'h-auto'
              )}
              loading="lazy"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
