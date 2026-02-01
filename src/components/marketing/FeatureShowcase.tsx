import { motion, useReducedMotion } from 'framer-motion';
import { Phone, Bot, BarChart3, CheckCircle2 } from 'lucide-react';
import { ScrollReveal } from './ui/ScrollReveal';
import { GradientText } from './ui/GradientText';
import { cn } from '@/lib/utils';

interface Feature {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  benefits: string[];
  icon: typeof Phone;
  accentColor: 'amber' | 'emerald';
  imagePosition: 'left' | 'right';
  screenshot: string;
}

const features: Feature[] = [
  {
    id: 'call-scoring',
    title: 'AI Call Scoring',
    subtitle: 'Turn Every Call Into a Learning Opportunity',
    description:
      'Upload any sales call and our AI analyzes it against proven insurance selling frameworks. Get actionable feedback your team can implement immediately.',
    benefits: [
      'Automated scoring across 15+ key metrics',
      'Detailed feedback on objection handling',
      'Track improvement over time with trends',
      '20 calls included per month',
    ],
    icon: Phone,
    accentColor: 'amber',
    imagePosition: 'right',
    screenshot: '/promo-images/Callscoring3.png',
  },
  {
    id: 'roleplay',
    title: 'AI Role-Play Bot',
    subtitle: 'Practice Makes Perfect',
    description:
      'Your agents can practice unlimited scenarios with an AI that plays realistic customer personas. From price shoppers to angry callers, build confidence before the real thing.',
    benefits: [
      'Unlimited practice sessions',
      'Multiple customer personality types',
      'Real-time feedback during calls',
      'Premium feature for 1-on-1 clients',
    ],
    icon: Bot,
    accentColor: 'emerald',
    imagePosition: 'left',
    screenshot: '/promo-images/AiRoleplay.png',
  },
  {
    id: 'scorecard',
    title: 'Real-Time Scorecard',
    subtitle: 'Know Your Numbers, Know Your Team',
    description:
      'Daily scorecards that track the metrics that matter. See at a glance who\'s crushing it and who needs coaching. No more end-of-month surprises.',
    benefits: [
      'Customizable KPIs per role',
      'Daily, weekly, and monthly views',
      'Team leaderboards and rings',
      'Mobile-friendly for managers on the go',
    ],
    icon: BarChart3,
    accentColor: 'amber',
    imagePosition: 'right',
    screenshot: '/promo-images/Metrics2.png',
  },
];

interface FeatureShowcaseSectionProps {
  feature: Feature;
  index: number;
}

function FeatureShowcaseSection({ feature, index }: FeatureShowcaseSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = feature.icon;
  const isLeft = feature.imagePosition === 'left';

  return (
    <div
      className={cn(
        'grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center',
        isLeft && 'lg:[&>*:first-child]:order-2'
      )}
    >
      {/* Content */}
      <ScrollReveal delay={index * 0.1}>
        <div className="space-y-6">
          {/* Icon Badge */}
          <div
            className={cn(
              'inline-flex items-center gap-3 px-4 py-2 rounded-full border',
              feature.accentColor === 'amber'
                ? 'bg-marketing-amber/10 border-marketing-amber/20 text-marketing-amber'
                : 'bg-marketing-emerald/10 border-marketing-emerald/20 text-marketing-emerald'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-sm font-medium">{feature.title}</span>
          </div>

          {/* Title */}
          <h3 className="text-3xl sm:text-4xl font-bold text-marketing-text">
            {feature.subtitle}
          </h3>

          {/* Description */}
          <p className="text-lg text-marketing-text-muted leading-relaxed">
            {feature.description}
          </p>

          {/* Benefits List */}
          <ul className="space-y-3">
            {feature.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <CheckCircle2
                  className={cn(
                    'w-5 h-5 shrink-0 mt-0.5',
                    feature.accentColor === 'amber'
                      ? 'text-marketing-amber'
                      : 'text-marketing-emerald'
                  )}
                />
                <span className="text-marketing-text">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </ScrollReveal>

      {/* Screenshot */}
      <ScrollReveal delay={index * 0.1 + 0.2}>
        <motion.div
          className="relative"
          animate={prefersReducedMotion ? undefined : {
            y: [0, -8, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Glow Effect */}
          <div
            className={cn(
              'absolute -inset-4 rounded-2xl opacity-30',
              feature.accentColor === 'amber'
                ? 'bg-marketing-amber'
                : 'bg-marketing-emerald'
            )}
            style={{ filter: 'blur(40px)' }}
          />

          {/* Browser Frame */}
          <div className="relative rounded-xl overflow-hidden shadow-2xl border border-marketing-border-light bg-marketing-surface">
            {/* Browser Chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-marketing-surface-light border-b border-marketing-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-marketing-bg text-xs text-marketing-text-muted">
                  app.agencybrain.io/{feature.id}
                </div>
              </div>
            </div>

            {/* Screenshot */}
            <div className="aspect-[4/3] bg-marketing-bg">
              <img
                src={feature.screenshot}
                alt={`${feature.title} screenshot`}
                className="w-full h-full object-cover object-top"
                loading="lazy"
              />
            </div>
          </div>
        </motion.div>
      </ScrollReveal>
    </div>
  );
}

export function FeatureShowcase() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="py-24 px-4 bg-marketing-surface/30">
      <div className="max-w-7xl mx-auto">
        {/* Section Header with Stan pointing */}
        <div className="relative">
          <ScrollReveal className="text-center mb-20">
            <span className="inline-block px-4 py-2 rounded-full bg-marketing-surface border border-marketing-border-light text-sm text-marketing-text-muted mb-4">
              Deep Dive
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-marketing-text mb-4">
              Powerful Features,{' '}
              <GradientText>Simple to Use</GradientText>
            </h2>
            <p className="text-marketing-text-muted text-lg max-w-2xl mx-auto">
              Built by insurance professionals who understand what agencies actually need to succeed.
            </p>
          </ScrollReveal>

          {/* Stan pointing - positioned to the right of header */}
          <motion.div
            className="absolute -right-4 lg:right-20 top-0 z-10 hidden lg:block"
            initial={prefersReducedMotion ? undefined : { opacity: 0, x: 50 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <motion.img
              src="/marketing/stan-pointing.png"
              alt="Stan mascot pointing"
              className="w-28 h-auto drop-shadow-xl"
              animate={prefersReducedMotion ? undefined : {
                y: [0, -6, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        </div>

        {/* Feature Sections */}
        <div className="space-y-32">
          {features.map((feature, index) => (
            <FeatureShowcaseSection
              key={feature.id}
              feature={feature}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
