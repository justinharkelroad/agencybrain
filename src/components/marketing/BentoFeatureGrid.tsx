import { motion, useReducedMotion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';
import {
  Phone,
  Bot,
  BarChart3,
  UserCheck,
  TrendingUp,
  FileSearch,
  GraduationCap,
  Target,
  RefreshCw,
  DollarSign,
  Users,
  Zap,
} from 'lucide-react';
import { ScrollReveal } from './ui/ScrollReveal';
import { GradientText } from './ui/GradientText';
import { AnimatedRings } from './ui/AnimatedRings';
import { AnimatedCore4 } from './ui/AnimatedCore4';
import { AnimatedDashboard } from './ui/AnimatedDashboard';
import { AnimatedCallScoring, AnimatedPentagon } from './ui/AnimatedCallScoring';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

/*
 * FEATURE GRID with layered images and animations
 * Images are in: public/promo-images/
 */

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
  size: 'small' | 'medium' | 'large';
  accentColor: 'amber' | 'emerald';
  frontImage?: string;
  backImage?: string;
  layout?: 'offset-right' | 'offset-left' | 'stacked' | 'fan';
  animation?: 'donut' | 'rings' | 'progress' | 'callScoring' | 'dashboard' | 'core4';
  animationProps?: any;
  useCustomAnimation?: boolean;
}

const features: Feature[] = [
  {
    title: 'AI Call Scoring',
    description: 'Automatically analyze and score every sales call with detailed feedback on rapport, objection handling, and closing techniques.',
    icon: Phone,
    size: 'large',
    accentColor: 'amber',
    frontImage: '/promo-images/call-scoring-portrait.png',
    animation: 'callScoring',
    useCustomAnimation: true,
  },
  {
    title: 'AI Role-Play Bot',
    description: 'Practice sales scenarios with AI that plays realistic customer personas.',
    icon: Bot,
    size: 'medium',
    accentColor: 'emerald',
    frontImage: '/promo-images/AiRoleplay.png',
    animation: 'rings',
    animationProps: {
      rings: [
        { percentage: 85, color: 'emerald' },
        { percentage: 70, color: 'amber' },
      ],
      size: 100,
    },
  },
  {
    title: 'Real-Time Scorecard',
    description: 'Track daily KPIs across your entire team with live metrics and performance dashboards.',
    icon: BarChart3,
    size: 'large',
    accentColor: 'amber',
    frontImage: '/promo-images/agency-dashboard.png',
    backImage: '/promo-images/staff-dashboard.png',
    layout: 'stacked',
    animation: 'dashboard',
    useCustomAnimation: true,
  },
  {
    title: 'Cancel Audit',
    description: 'Proactive churn prevention. Identify at-risk policies before they cancel.',
    icon: FileSearch,
    size: 'medium',
    accentColor: 'emerald',
    frontImage: '/promo-images/cancel-audit.png',
    backImage: '/promo-images/cancel-audit-2.png',
    layout: 'offset-left',
  },
  {
    title: 'Winback HQ',
    description: 'Systematically recover lost customers with prioritized outreach and tracking.',
    icon: UserCheck,
    size: 'medium',
    accentColor: 'amber',
    frontImage: '/promo-images/winback-hq.png',
    backImage: '/promo-images/winback-hq-2.png',
    layout: 'offset-right',
  },
  {
    title: 'Renewal Tracking',
    description: 'Never miss a renewal. Track and manage upcoming policy renewals.',
    icon: RefreshCw,
    size: 'medium',
    accentColor: 'emerald',
    frontImage: '/promo-images/renewal-audit.png',
  },
  {
    title: 'Training Platform',
    description: 'Standard Playbook curriculum plus custom agency training videos and courses.',
    icon: GraduationCap,
    size: 'medium',
    accentColor: 'amber',
    frontImage: '/promo-images/training.png',
  },
  {
    title: 'Sales Analytics',
    description: 'ROI forecasters, lead tracking, and revenue projections.',
    icon: TrendingUp,
    size: 'medium',
    accentColor: 'emerald',
    frontImage: '/promo-images/roi-analytics.png',
  },
  {
    title: 'Commission Builder',
    description: 'Build and run comp plans with AI assistance in seconds.',
    icon: DollarSign,
    size: 'medium',
    accentColor: 'amber',
    frontImage: '/promo-images/Comp1.png',
    backImage: '/promo-images/Comp2.png',
    layout: 'offset-right',
  },
  {
    title: 'Core 4',
    description: 'Personal growth tracking across Body, Being, Balance, and Business.',
    icon: Target,
    size: 'medium',
    accentColor: 'emerald',
    animation: 'core4',
    useCustomAnimation: true,
  },
  {
    title: 'LQS Tracking',
    description: 'Lead-Quote-Sale pipeline tracking for complete visibility.',
    icon: Zap,
    size: 'medium',
    accentColor: 'emerald',
    frontImage: '/promo-images/lqs-analytics.png',
    backImage: '/promo-images/lqs-analytics-2.png',
    layout: 'stacked',
  },
  {
    title: 'Accountability Forms',
    description: 'Public forms for daily tracking with automated reminders.',
    icon: Users,
    size: 'medium',
    accentColor: 'amber',
    frontImage: '/promo-images/accountability-forms.png',
  },
];

// Image Carousel Component for cards with multiple images
interface ImageCarouselProps {
  images: string[];
  title: string;
  size: 'small' | 'medium' | 'large';
  index: number;
  isInView: boolean;
  animation?: string;
  animationProps?: any;
}

function ImageCarousel({ images, title, size, index, isInView, animation, animationProps }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const hasMultiple = images.length > 1;

  return (
    <div className={cn(
      'mt-4 relative',
      size === 'large' && 'flex-grow min-h-[200px]'
    )}>
      {/* Image container */}
      <motion.div
        className={cn(
          'relative rounded-lg overflow-hidden border border-marketing-border-light shadow-lg',
          size === 'large' && 'h-full'
        )}
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : undefined}
        transition={{ delay: index * 0.1 + 0.1, duration: 0.5 }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            alt={`${title} screenshot ${currentIndex + 1}`}
            className={cn(
              'w-full object-cover object-top',
              size === 'large' ? 'h-full' : 'h-auto max-h-48'
            )}
            loading="lazy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        </AnimatePresence>
      </motion.div>

      {/* Navigation dots for multiple images */}
      {hasMultiple && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                idx === currentIndex
                  ? 'bg-marketing-amber w-4'
                  : 'bg-marketing-text-dim hover:bg-marketing-text-muted'
              )}
              aria-label={`View image ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Floating animation overlay for medium/large cards */}
      {animation === 'rings' && animationProps && (
        <div className="absolute bottom-3 right-3 bg-marketing-bg/90 rounded-xl p-2 border border-marketing-border">
          <AnimatedRings {...animationProps} delay={index * 0.1 + 0.3} />
        </div>
      )}
    </div>
  );
}

interface BentoCardProps {
  feature: Feature;
  index: number;
}

function BentoCard({ feature, index }: BentoCardProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  const {
    title,
    description,
    icon: Icon,
    size,
    accentColor,
    frontImage,
    backImage,
    layout = 'offset-right',
    animation,
    animationProps,
    useCustomAnimation,
  } = feature;

  const sizeClasses = {
    small: 'col-span-1 sm:col-span-2 md:col-span-1 row-span-1',
    medium: 'col-span-1 sm:col-span-2 md:col-span-2 row-span-1',
    large: 'col-span-1 sm:col-span-2 md:col-span-2 row-span-2',
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
      ref={ref}
      className={cn(
        'group relative rounded-xl bg-marketing-surface border border-marketing-border p-5 overflow-hidden',
        'transition-all duration-300 hover:border-marketing-border-light',
        sizeClasses[size],
        accentClasses[accentColor].glow,
        size === 'large' && 'flex flex-col'
      )}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.015, y: -2 }}
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

      <div className={cn('relative z-10', size === 'large' ? 'flex flex-col h-full' : '')}>
        {/* Header row - icon + animation (if small card) */}
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              accentClasses[accentColor].icon
            )}
          >
            <Icon className="w-5 h-5" />
          </div>

          {/* Animation in corner for small cards */}
          {animation === 'rings' && size === 'small' && animationProps && (
            <AnimatedRings {...animationProps} delay={index * 0.1} />
          )}
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-marketing-text mb-1.5">
          {title}
        </h3>
        <p className={cn(
          'text-marketing-text-muted text-sm leading-relaxed',
          size === 'large' ? '' : 'line-clamp-2'
        )}>
          {description}
        </p>

        {/* Custom animation components */}
        {useCustomAnimation && animation === 'callScoring' && (
          <div className={cn('mt-4 flex justify-center', size === 'large' && 'flex-grow')}>
            <AnimatedCallScoring delay={index * 0.1} />
          </div>
        )}

        {useCustomAnimation && animation === 'dashboard' && (
          <div className={cn('mt-4 flex justify-center', size === 'large' && 'flex-grow')}>
            <AnimatedDashboard delay={index * 0.1} variant="compact" />
          </div>
        )}

        {useCustomAnimation && animation === 'core4' && (
          <div className="mt-4 flex justify-center">
            <AnimatedCore4 delay={index * 0.1} size="medium" />
          </div>
        )}

        {/* Images - carousel when multiple images exist */}
        {frontImage && !useCustomAnimation && (
          <ImageCarousel
            images={backImage ? [frontImage, backImage] : [frontImage]}
            title={title}
            size={size}
            index={index}
            isInView={isInView}
            animation={animation}
            animationProps={animationProps}
          />
        )}
      </div>
    </motion.div>
  );
}

export function BentoFeatureGrid() {
  return (
    <section id="features" className="py-20 md:py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <ScrollReveal className="text-center mb-12 md:mb-16">
          <span className="inline-block px-4 py-2 rounded-full bg-marketing-surface border border-marketing-border-light text-sm text-marketing-text-muted mb-4">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-marketing-text mb-4">
            Everything You Need to{' '}
            <GradientText>Scale Your Agency</GradientText>
          </h2>
          <p className="text-marketing-text-muted text-lg max-w-2xl mx-auto">
            From call analysis to team training, AgencyBrain provides the tools
            that top-performing agencies use to dominate their markets.
          </p>
        </ScrollReveal>

        {/* Bento Grid - responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {features.map((feature, index) => (
            <BentoCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
