import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  CheckCircle2,
  Calendar,
  Target,
  Flame,
  ArrowRight,
  Heart,
  Users,
  Trophy,
  Star,
} from 'lucide-react';

// Stripe Payment Links for each tier
const STRIPE_LINKS = {
  callScoring: 'https://buy.stripe.com/9B6eVd6SW36m9S8fSk4Vy0f',
  boardroom: 'https://buy.stripe.com/6oU14ncdg36mc0ggWo4Vy0g',
  oneOnOne: 'https://buy.stripe.com/bJe8wP4KOgXc2pGcG84Vy0h',
};

const PRICING_TIERS = [
  {
    id: 'oneOnOne',
    name: '1:1 Coaching Member',
    price: 50,
    description: 'Best value for premium coaching members',
    badge: 'Best Value',
    badgeColor: 'bg-green-100 text-green-800',
    features: [
      'Full 30-day challenge curriculum',
      'Daily video lessons + reflections',
      'Core 4 habit tracking',
      'Discovery Flow weekly reviews',
      'Progress dashboard',
    ],
    stripeLink: STRIPE_LINKS.oneOnOne,
    popular: false,
  },
  {
    id: 'boardroom',
    name: 'Boardroom Member',
    price: 99,
    description: 'Perfect for growing agencies',
    badge: 'Most Popular',
    badgeColor: 'bg-purple-100 text-purple-800',
    features: [
      'Full 30-day challenge curriculum',
      'Daily video lessons + reflections',
      'Core 4 habit tracking',
      'Discovery Flow weekly reviews',
      'Progress dashboard',
    ],
    stripeLink: STRIPE_LINKS.boardroom,
    popular: true,
  },
  {
    id: 'callScoring',
    name: 'Call Scoring',
    price: 299,
    description: 'Standalone access for any agency',
    badge: 'Full Access',
    badgeColor: 'bg-blue-100 text-blue-800',
    features: [
      'Full 30-day challenge curriculum',
      'Daily video lessons + reflections',
      'Core 4 habit tracking',
      'Discovery Flow weekly reviews',
      'Progress dashboard',
      'Includes Core 4 + Flows access',
    ],
    stripeLink: STRIPE_LINKS.callScoring,
    popular: false,
  },
];

const CHALLENGE_BENEFITS = [
  {
    icon: Target,
    title: 'Daily Focus',
    description: 'Start each day with a clear, actionable lesson designed for insurance professionals',
  },
  {
    icon: Flame,
    title: 'Build Momentum',
    description: 'Track your Core 4 habits and maintain streaks that drive lasting change',
  },
  {
    icon: Heart,
    title: 'Holistic Growth',
    description: 'Balance Body, Being, Balance, and Business for complete personal development',
  },
  {
    icon: Trophy,
    title: 'Proven Results',
    description: '6 weeks of structured content that transforms how you approach your work and life',
  },
];

const WEEK_THEMES = [
  { week: 1, name: 'Foundation', description: 'Build the habits that will carry you through' },
  { week: 2, name: 'Consistency', description: 'Develop the discipline of daily action' },
  { week: 3, name: 'Discipline', description: 'Push through resistance and build resilience' },
  { week: 4, name: 'Relationships', description: 'Strengthen connections that matter most' },
  { week: 5, name: 'Closing', description: 'Execute with precision and confidence' },
  { week: 6, name: 'Identity', description: 'Become the person who achieves their goals' },
];

export default function ChallengeLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-red-600/10" />
        <div className="max-w-6xl mx-auto px-4 py-16 sm:py-24 relative">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Transform Your Agency in 6 Weeks</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white">
              The 6-Week Challenge
            </h1>

            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              A proven system for insurance professionals to build unstoppable habits,
              elevate performance, and achieve breakthrough results.
            </p>

            <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                6 weeks
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                30 lessons
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                Buy per seat
              </span>
            </div>

            <div className="pt-4">
              <a href="#pricing">
                <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-slate-100/50 dark:bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Why The Challenge Works</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Built specifically for insurance professionals</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CHALLENGE_BENEFITS.map((benefit) => (
              <Card key={benefit.title} className="bg-white/80 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="h-6 w-6 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{benefit.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Week Overview Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Your 6-Week Journey</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Each week builds on the last</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WEEK_THEMES.map((week) => (
              <div
                key={week.week}
                className="flex items-center gap-4 p-4 rounded-lg bg-white/50 border border-slate-200/50 dark:bg-slate-800/30 dark:border-slate-700/50"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold shrink-0">
                  {week.week}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{week.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{week.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 bg-slate-100/50 dark:bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Choose Your Plan</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Per seat pricing - buy as many as you need</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
              <Card
                key={tier.id}
                className={`relative bg-white/80 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 ${
                  tier.popular ? 'ring-2 ring-orange-500' : ''
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className={tier.badgeColor}>{tier.badge}</Badge>
                  </div>
                )}
                <CardHeader className="text-center pt-8">
                  <CardTitle className="text-slate-900 dark:text-white">{tier.name}</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400">{tier.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">${tier.price}</span>
                    <span className="text-slate-500 dark:text-slate-400">/seat</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-600 dark:text-slate-300">{feature}</span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <a href={tier.stripeLink} className="w-full">
                    <Button
                      className={`w-full ${
                        tier.popular
                          ? 'bg-orange-500 hover:bg-orange-600'
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      Buy Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                </CardFooter>
              </Card>
            ))}
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            Already have an Agency Brain account?{' '}
            <Link to="/auth" className="text-orange-400 hover:underline">
              Sign in
            </Link>{' '}
            to purchase at your member rate.
          </p>
        </div>
      </section>

      {/* What's Included Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Everything You Need</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              '30 daily video lessons',
              'Reflection questions for each lesson',
              'Core 4 daily habit tracker',
              'Weekly Discovery Flow reviews',
              'Progress dashboard and analytics',
              'Daily email reminders',
              'Streak tracking for motivation',
              'Mobile-friendly interface',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/50 dark:bg-slate-800/30">
                <Star className="h-5 w-5 text-orange-500" />
                <span className="text-slate-600 dark:text-slate-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-orange-500/20 to-red-600/20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Ready to Transform Your Results?
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8">
            Join agencies across the country who have elevated their performance with The Challenge.
          </p>
          <a href="#pricing">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white">
              Start Your Challenge Today
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} Agency Brain. All rights reserved.</p>
          <p className="mt-2">
            <Link to="/" className="hover:text-slate-400">Home</Link>
            {' · '}
            <Link to="/auth" className="hover:text-slate-400">Sign In</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
