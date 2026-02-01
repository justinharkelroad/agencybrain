import { motion, useReducedMotion } from 'framer-motion';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientText } from './ui/GradientText';
import { StartTrialButton } from './StartTrialButton';

// Updated promo images - use the correctly labeled screenshots
const MOCKUP_DASHBOARD = '/promo-images/agency-dashboard.png';
const MOCKUP_SECONDARY = '/promo-images/staff-dashboard.png';

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.4, 0.25, 1],
      },
    },
  };

  const mockupVariants = {
    hidden: { opacity: 0, y: 60, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: [0.25, 0.4, 0.25, 1],
      },
    },
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-16 px-4 overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, var(--marketing-amber) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, var(--marketing-emerald) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
      </div>

      <motion.div
        className="relative z-10 max-w-7xl mx-auto"
        variants={prefersReducedMotion ? undefined : containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="text-center mb-12 lg:mb-16">
          {/* Badge */}
          <motion.div
            variants={prefersReducedMotion ? undefined : itemVariants}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-marketing-surface border border-marketing-border-light mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-marketing-emerald animate-pulse" />
            <span className="text-sm text-marketing-text-muted">
              Start Your 7-Day Free Trial
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={prefersReducedMotion ? undefined : itemVariants}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-marketing-text leading-tight mb-6"
          >
            Run Your Agency
            <br />
            Like a <GradientText>Machine</GradientText>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            variants={prefersReducedMotion ? undefined : itemVariants}
            className="text-lg sm:text-xl text-marketing-text-muted max-w-2xl mx-auto mb-8"
          >
            AI-powered call scoring, real-time scorecards, and training systems
            that transform your insurance agency into a high-performance operation.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={prefersReducedMotion ? undefined : itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <StartTrialButton className="px-8 py-6" />
            <Button
              size="lg"
              variant="outline"
              className="border-marketing-border-light text-marketing-text hover:bg-marketing-surface rounded-full px-8 py-6 text-lg"
              asChild
            >
              <a href="#demo">
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </a>
            </Button>
          </motion.div>
        </div>

        {/* Floating Mockups with Stan */}
        <div className="relative mt-12 lg:mt-20">
          {/* Stan waving - positioned to the left */}
          <motion.div
            className="absolute -left-4 lg:left-0 top-1/2 -translate-y-1/2 z-20 hidden md:block"
            initial={prefersReducedMotion ? undefined : { opacity: 0, x: -50 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <motion.img
              src="/marketing/stan-waving.png"
              alt="Stan mascot waving"
              className="w-32 lg:w-40 h-auto drop-shadow-2xl"
              animate={prefersReducedMotion ? undefined : {
                y: [0, -10, 0],
                rotate: [0, 2, 0, -2, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-8">
            {/* Main Dashboard Mockup */}
            <motion.div
              variants={prefersReducedMotion ? undefined : mockupVariants}
              className="relative w-full max-w-3xl"
              animate={prefersReducedMotion ? undefined : {
                y: [0, -8, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
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
                      app.agencybrain.io
                    </div>
                  </div>
                </div>
                {/* Screenshot */}
                <div className="aspect-[16/10] bg-marketing-bg">
                  <img
                    src={MOCKUP_DASHBOARD}
                    alt="AgencyBrain Dashboard"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
              {/* Glow effect */}
              <div
                className="absolute -inset-4 -z-10 opacity-40 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, var(--marketing-amber) 0%, var(--marketing-emerald) 100%)',
                  filter: 'blur(40px)',
                }}
              />
            </motion.div>

            {/* Secondary Mockup (visible on larger screens) */}
            <motion.div
              variants={prefersReducedMotion ? undefined : mockupVariants}
              className="hidden lg:block relative w-full max-w-sm"
              animate={prefersReducedMotion ? undefined : {
                y: [0, -12, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.5,
              }}
            >
              <div className="relative rounded-xl overflow-hidden shadow-2xl border border-marketing-border-light bg-marketing-surface transform rotate-2 hover:rotate-0 transition-transform duration-500">
                {/* Browser Chrome */}
                <div className="flex items-center gap-2 px-3 py-2 bg-marketing-surface-light border-b border-marketing-border">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500/80" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/80" />
                    <div className="w-2 h-2 rounded-full bg-green-500/80" />
                  </div>
                </div>
                {/* Screenshot */}
                <div className="aspect-[4/3] bg-marketing-bg">
                  <img
                    src={MOCKUP_SECONDARY}
                    alt="Staff Dashboard"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
