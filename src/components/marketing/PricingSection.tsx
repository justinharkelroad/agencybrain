import { motion, useReducedMotion } from 'framer-motion';
import { Check, Sparkles, Phone, Zap } from 'lucide-react';
import { ScrollReveal } from './ui/ScrollReveal';
import { GradientText } from './ui/GradientText';
import { StartTrialButton } from './StartTrialButton';

const includedFeatures = [
  'Real-time scorecards & KPI tracking',
  'Team leaderboards & performance rings',
  'Standard Playbook training access',
  '20 AI call scoring credits/month',
  'Winback HQ & Cancel Audit',
  'Sales analytics & forecasting',
  'Core 4 personal development',
  'Mobile-friendly staff portal',
  'Unlimited team members',
];

const addOns = [
  {
    title: 'Additional Call Scoring',
    description: 'Need more AI call analysis? Purchase additional packs of 20 or 30 calls inside the app.',
    icon: Phone,
  },
  {
    title: 'AI Role-Play Bot',
    description: 'Unlimited practice sessions with AI. Premium feature available for 1-on-1 coaching clients.',
    icon: Sparkles,
  },
  {
    title: 'Quarterly Targets Process',
    description: 'Guided goal-setting framework. Premium feature for 1-on-1 coaching clients.',
    icon: Zap,
  },
];

export function PricingSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="pricing" className="py-24 px-4 bg-marketing-surface/30">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <ScrollReveal className="text-center mb-16">
          <span className="inline-block px-4 py-2 rounded-full bg-marketing-surface border border-marketing-border-light text-sm text-marketing-text-muted mb-4">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-marketing-text mb-4">
            Simple,{' '}
            <GradientText>Transparent Pricing</GradientText>
          </h2>
          <p className="text-marketing-text-muted text-lg max-w-2xl mx-auto">
            One plan with everything you need. Start with a free trial, upgrade when you're ready.
          </p>
        </ScrollReveal>

        {/* Pricing Card */}
        <motion.div
          className="relative"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        >
          {/* Stan thinking - peeking from corner */}
          <motion.div
            className="absolute -right-8 -top-16 z-10 hidden lg:block"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <motion.img
              src="/marketing/stan-thinking.png"
              alt="Stan mascot thinking"
              className="w-24 h-auto drop-shadow-xl"
              animate={prefersReducedMotion ? undefined : {
                rotate: [0, 3, 0, -3, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>

          {/* Glow Effect */}
          <div
            className="absolute -inset-1 rounded-2xl opacity-40"
            style={{
              background: 'linear-gradient(135deg, var(--marketing-amber) 0%, var(--marketing-emerald) 100%)',
              filter: 'blur(20px)',
            }}
          />

          <div className="relative bg-marketing-surface border border-marketing-border-light rounded-2xl overflow-hidden">
            {/* Header Badge */}
            <div className="bg-gradient-to-r from-marketing-amber to-marketing-emerald p-px">
              <div className="bg-marketing-surface py-2 text-center">
                <span className="text-sm font-medium text-marketing-text">
                  Most Popular
                </span>
              </div>
            </div>

            <div className="p-8 md:p-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Left: Price & CTA */}
                <div>
                  <div className="mb-8">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-5xl md:text-6xl font-bold text-marketing-text">
                        $299
                      </span>
                      <span className="text-marketing-text-muted text-lg">/month</span>
                    </div>
                    <p className="text-marketing-text-muted">
                      Billed monthly. Cancel anytime.
                    </p>
                  </div>

                  {/* Trial Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-marketing-emerald/10 border border-marketing-emerald/20 mb-8">
                    <span className="w-2 h-2 rounded-full bg-marketing-emerald animate-pulse" />
                    <span className="text-marketing-emerald font-medium">
                      7-Day Free Trial Included
                    </span>
                  </div>

                  {/* CTA Buttons */}
                  <div className="space-y-4">
                    <StartTrialButton
                      className="w-full py-6"
                      showArrow={false}
                    />
                    <p className="text-center text-sm text-marketing-text-muted">
                      Setup in under 5 minutes
                    </p>
                  </div>
                </div>

                {/* Right: Features */}
                <div>
                  <h3 className="text-lg font-semibold text-marketing-text mb-4">
                    Everything included:
                  </h3>
                  <ul className="space-y-3">
                    {includedFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-marketing-emerald shrink-0 mt-0.5" />
                        <span className="text-marketing-text">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Add-ons Section */}
        <ScrollReveal className="mt-16">
          <h3 className="text-xl font-semibold text-marketing-text text-center mb-8">
            Expand with Add-Ons
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {addOns.map((addon, index) => {
              const Icon = addon.icon;
              return (
                <motion.div
                  key={addon.title}
                  className="bg-marketing-surface border border-marketing-border rounded-xl p-6"
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
                  whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                >
                  <div className="w-10 h-10 rounded-lg bg-marketing-surface-light flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-marketing-amber" />
                  </div>
                  <h4 className="text-marketing-text font-medium mb-2">
                    {addon.title}
                  </h4>
                  <p className="text-marketing-text-muted text-sm">
                    {addon.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
