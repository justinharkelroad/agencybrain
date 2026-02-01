import { motion, useReducedMotion } from 'framer-motion';
import { GradientText } from './ui/GradientText';
import { StartTrialButton } from './StartTrialButton';

export function FinalCTA() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="py-24 px-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(ellipse, var(--marketing-amber) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, var(--marketing-emerald) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      <motion.div
        className="relative z-10 max-w-4xl mx-auto text-center"
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 40 }}
        whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
      >
        {/* Stan waving - centered above headline */}
        <motion.div
          className="flex justify-center mb-8"
          animate={prefersReducedMotion ? undefined : {
            y: [0, -8, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <img
            src="/marketing/stan-waving.png"
            alt="Stan mascot"
            className="w-24 h-auto drop-shadow-2xl"
          />
        </motion.div>

        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-marketing-text mb-6 leading-tight">
          Ready to Transform
          <br />
          <GradientText>Your Agency?</GradientText>
        </h2>

        {/* Subtext */}
        <p className="text-lg sm:text-xl text-marketing-text-muted max-w-2xl mx-auto mb-10">
          Join the top-performing insurance agencies that use AgencyBrain to
          scale their operations and maximize their team's potential.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <StartTrialButton className="px-10 py-6">
            Start Your Free Trial
          </StartTrialButton>
        </div>

        {/* Trust Note */}
        <p className="mt-6 text-sm text-marketing-text-muted">
          7-day free trial included - Cancel anytime
        </p>
      </motion.div>
    </section>
  );
}
