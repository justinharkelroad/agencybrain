import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface LayeredMockupProps {
  frontImage: string;
  backImage?: string;
  alt: string;
  className?: string;
  delay?: number;
  // Layout options
  layout?: 'offset-right' | 'offset-left' | 'stacked' | 'fan';
}

export function LayeredMockup({
  frontImage,
  backImage,
  alt,
  className,
  delay = 0,
  layout = 'offset-right',
}: LayeredMockupProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  const layoutStyles = {
    'offset-right': {
      back: 'translate-x-4 translate-y-4 rotate-2',
      front: '-translate-x-2 -translate-y-2 -rotate-1',
    },
    'offset-left': {
      back: '-translate-x-4 translate-y-4 -rotate-2',
      front: 'translate-x-2 -translate-y-2 rotate-1',
    },
    'stacked': {
      back: 'translate-y-6 scale-95',
      front: '-translate-y-2',
    },
    'fan': {
      back: 'translate-x-8 rotate-6',
      front: '-translate-x-4 -rotate-3',
    },
  };

  // Single image - no layering needed
  if (!backImage) {
    return (
      <motion.div
        ref={ref}
        className={cn('relative', className)}
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.6, delay }}
      >
        <div className="rounded-xl overflow-hidden shadow-2xl border border-marketing-border-light bg-marketing-surface">
          <img
            src={frontImage}
            alt={alt}
            className="w-full h-auto"
            loading="lazy"
          />
        </div>
      </motion.div>
    );
  }

  // Layered images with depth effect
  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Back image */}
      <motion.div
        className={cn(
          'absolute inset-0 rounded-xl overflow-hidden shadow-xl border border-marketing-border bg-marketing-surface opacity-60',
          layoutStyles[layout].back
        )}
        initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
        animate={isInView ? { opacity: 0.6, scale: 1 } : undefined}
        transition={{ duration: 0.6, delay }}
        whileHover={prefersReducedMotion ? undefined : {
          opacity: 0.8,
          transition: { duration: 0.2 }
        }}
      >
        <img
          src={backImage}
          alt={`${alt} - secondary view`}
          className="w-full h-auto"
          loading="lazy"
        />
      </motion.div>

      {/* Front image */}
      <motion.div
        className={cn(
          'relative rounded-xl overflow-hidden shadow-2xl border border-marketing-border-light bg-marketing-surface',
          layoutStyles[layout].front
        )}
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.6, delay: delay + 0.15 }}
        whileHover={prefersReducedMotion ? undefined : {
          scale: 1.02,
          transition: { duration: 0.2 }
        }}
      >
        <img
          src={frontImage}
          alt={alt}
          className="w-full h-auto"
          loading="lazy"
        />
      </motion.div>
    </div>
  );
}

// Phone frame mockup for mobile screenshots
interface PhoneMockupProps {
  image: string;
  alt: string;
  className?: string;
  delay?: number;
}

export function PhoneMockup({
  image,
  alt,
  className,
  delay = 0,
}: PhoneMockupProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={cn('relative', className)}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, delay }}
    >
      {/* Phone frame */}
      <div className="relative mx-auto w-[280px] h-[580px] bg-marketing-surface-light rounded-[3rem] p-3 shadow-2xl border-4 border-marketing-surface-light">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-marketing-surface-light rounded-b-2xl z-10" />

        {/* Screen */}
        <div className="relative w-full h-full rounded-[2.25rem] overflow-hidden bg-marketing-bg">
          <img
            src={image}
            alt={alt}
            className="w-full h-full object-cover object-top"
            loading="lazy"
          />
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-marketing-text/30 rounded-full" />
      </div>
    </motion.div>
  );
}

// Browser window mockup
interface BrowserMockupProps {
  image: string;
  alt: string;
  url?: string;
  className?: string;
  delay?: number;
}

export function BrowserMockup({
  image,
  alt,
  url = 'app.agencybrain.io',
  className,
  delay = 0,
}: BrowserMockupProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={cn('relative', className)}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, delay }}
    >
      <div className="rounded-xl overflow-hidden shadow-2xl border border-marketing-border-light bg-marketing-surface">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 bg-marketing-surface-light border-b border-marketing-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-1 rounded-md bg-marketing-bg text-xs text-marketing-text-muted">
              {url}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-marketing-bg">
          <img
            src={image}
            alt={alt}
            className="w-full h-auto"
            loading="lazy"
          />
        </div>
      </div>
    </motion.div>
  );
}
