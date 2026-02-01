import { motion, useReducedMotion } from 'framer-motion';
import { UserPlus, Settings, Play, TrendingUp } from 'lucide-react';
import { ScrollReveal } from './ui/ScrollReveal';
import { GradientText } from './ui/GradientText';
import { cn } from '@/lib/utils';

const steps = [
  {
    number: '01',
    title: 'Sign Up',
    description:
      'Create your account and start your 7-day free trial instantly.',
    icon: UserPlus,
    color: 'amber',
  },
  {
    number: '02',
    title: 'Configure',
    description:
      'Set up your team, customize scorecards, and define the KPIs that matter to your agency.',
    icon: Settings,
    color: 'emerald',
  },
  {
    number: '03',
    title: 'Launch',
    description:
      'Invite your team, assign training, and start uploading calls for AI analysis.',
    icon: Play,
    color: 'amber',
  },
  {
    number: '04',
    title: 'Scale',
    description:
      'Watch performance improve as your team levels up with data-driven insights.',
    icon: TrendingUp,
    color: 'emerald',
  },
];

export function HowItWorks() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <ScrollReveal className="text-center mb-16">
          <span className="inline-block px-4 py-2 rounded-full bg-marketing-surface border border-marketing-border-light text-sm text-marketing-text-muted mb-4">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-marketing-text mb-4">
            Up and Running in{' '}
            <GradientText>Minutes</GradientText>
          </h2>
          <p className="text-marketing-text-muted text-lg max-w-2xl mx-auto">
            Getting started is simple. Here's how top agencies transform their operations with AgencyBrain.
          </p>
        </ScrollReveal>

        {/* Steps */}
        <div className="relative">
          {/* Connection Line (desktop only) */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-marketing-border-light to-transparent -translate-y-1/2" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  className="relative"
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
                  whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.15,
                    ease: [0.25, 0.4, 0.25, 1],
                  }}
                >
                  {/* Card */}
                  <div className="relative bg-marketing-surface border border-marketing-border rounded-xl p-6 h-full">
                    {/* Step Number */}
                    <div className="absolute -top-3 -left-3">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold',
                          step.color === 'amber'
                            ? 'bg-marketing-amber text-white'
                            : 'bg-marketing-emerald text-marketing-bg'
                        )}
                      >
                        {step.number}
                      </span>
                    </div>

                    {/* Icon */}
                    <div
                      className={cn(
                        'w-14 h-14 rounded-xl flex items-center justify-center mb-4',
                        step.color === 'amber'
                          ? 'bg-marketing-amber/10 text-marketing-amber'
                          : 'bg-marketing-emerald/10 text-marketing-emerald'
                      )}
                    >
                      <Icon className="w-7 h-7" />
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-semibold text-marketing-text mb-2">
                      {step.title}
                    </h3>
                    <p className="text-marketing-text-muted text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {/* Arrow (mobile and tablet) */}
                  {index < steps.length - 1 && (
                    <div className="lg:hidden flex justify-center my-4">
                      <svg
                        className="w-6 h-6 text-marketing-border-light rotate-90"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                      </svg>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
