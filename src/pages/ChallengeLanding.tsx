import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Clock,
  Users,
  Brain,
  Flame,
  Target,
  BarChart3,
  MessageSquare,
  CalendarDays,
  Zap,
  Shield,
  Heart,
  Swords,
  Lightbulb,
  Crown,
  Handshake,
  Mail,
  UserPlus,
  CreditCard,
  PlayCircle,
} from 'lucide-react';
import standardLogo from '@/assets/standard-playbook-logo.png';

// Stripe Payment Links for each tier
const STRIPE_LINKS = {
  oneOnOne: 'https://buy.stripe.com/bJe8wP4KOgXc2pGcG84Vy0h',
  boardroom: 'https://buy.stripe.com/6oU14ncdg36mc0ggWo4Vy0g',
  callScoring: 'https://buy.stripe.com/9B6eVd6SW36m9S8fSk4Vy0f',
};

const WEEK_THEMES = [
  { week: 1, name: 'Foundation', icon: Shield, description: 'Build the habits and mindset that will carry you through the next 6 weeks and beyond.' },
  { week: 2, name: 'Consistency', icon: Flame, description: 'Develop the discipline of daily action. Show up every single day, no matter what.' },
  { week: 3, name: 'Discipline', icon: Swords, description: 'Push through resistance. Build the mental toughness that separates producers from pretenders.' },
  { week: 4, name: 'Relationships', icon: Handshake, description: 'Strengthen the connections that matter most — with clients, team, and yourself.' },
  { week: 5, name: 'Closing', icon: Target, description: 'Execute with precision and confidence. Turn your daily habits into measurable results.' },
  { week: 6, name: 'Identity', icon: Crown, description: 'Become the person who achieves their goals. Lock in the identity of a top producer.' },
];

const FAQ_ITEMS = [
  {
    q: 'What does the challenge cost?',
    a: 'Pricing is per seat: $50/seat for 1:1 Coaching members, $99/seat for Boardroom members, and $299/seat for standalone access. Buy as many seats as you need for your team.',
  },
  {
    q: 'How often does this happen daily?',
    a: 'Each weekday (Monday–Friday) your producer gets one training lesson with a short video, reflection questions, and a daily action item. Plus they track their Core 4 habits every day. It takes about 15–20 minutes.',
  },
  {
    q: 'What do I need to get started?',
    a: 'Just purchase your seats, add your team members, pick a start date (any Monday), and your team is ready to go. We handle everything — account setup, login credentials, and daily email reminders.',
  },
  {
    q: 'What is included in the app?',
    a: 'Full access to the challenge platform inside AgencyBrain: 30 daily video lessons, reflection prompts with AI coaching feedback, Core 4 daily habit tracker, weekly Discovery Flow reviews, progress dashboard, and daily email reminders.',
  },
  {
    q: 'What is the "Core 4"?',
    a: 'Core 4 is a daily habit tracker across four areas: Body (physical health), Being (spiritual/mental growth), Balance (relationships and rest), and Business (professional action). Your team tracks these every day to build holistic discipline.',
  },
  {
    q: 'What is a "Discovery Flow"?',
    a: 'Every Friday, instead of a standard lesson, your team completes a guided Discovery Flow — an AI-powered reflection exercise that helps them process the week, identify patterns, and set intentions for the next one.',
  },
  {
    q: 'What topics are covered in the 6 weeks?',
    a: 'The curriculum follows six themes: Foundation (Week 1), Consistency (Week 2), Discipline (Week 3), Relationships (Week 4), Closing (Week 5), and Identity (Week 6). Each builds on the last.',
  },
  {
    q: 'Do I get visibility into my team\'s progress?',
    a: 'Absolutely. You get a full owner dashboard showing each producer\'s daily progress, Core 4 streaks, lesson completion, and reflection quality. Plus you receive email reports with AI-generated coaching feedback every time a producer completes a lesson.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-cyan-900/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="font-semibold text-white text-sm sm:text-base pr-4">{q}</span>
        <ChevronDown className={`h-5 w-5 text-cyan-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 -mt-1">
          <p className="text-sm text-slate-400 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function ChallengeLanding() {
  return (
    <div className="min-h-screen bg-[#050a14] text-white">
      {/* ─── NAV ─── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#050a14]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <img src={standardLogo} alt="Standard Playbook" className="h-6 sm:h-7 brightness-200" />
          <div className="flex items-center gap-4">
            <Link to="/auth" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">
              Sign In
            </Link>
            <a href="#pricing">
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs">
                Get Started
              </Button>
            </a>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: 'url(/assets/hero-poster-1920.jpg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050a14]/60 via-[#050a14]/80 to-[#050a14]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 sm:pb-32">
          <div className="text-center space-y-6">
            <p className="uppercase tracking-[0.25em] text-cyan-400 text-xs sm:text-sm font-semibold">
              6 Weeks &middot; 30 Trainings &middot; Per Seat
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black uppercase leading-[0.95] tracking-tight">
              Producer<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
                Power Up
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Transform your producer from reactive chaos to systematic execution — in 42 days. You'll see every step.
            </p>
          </div>

          {/* Problem / Possibility cards */}
          <div className="mt-12 sm:mt-16 max-w-3xl mx-auto grid sm:grid-cols-2 gap-4">
            <div className="border border-red-500/30 bg-red-500/5 rounded-xl p-5 sm:p-6 space-y-3">
              <p className="uppercase text-xs font-bold tracking-wider text-red-400">The Problem</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                Your producers lack structure, mood and motivation. Follow-up is positional and chaotic. They operate without a
                standard — reacting to what's in front of them instead of executing a system.
              </p>
            </div>
            <div className="border border-cyan-500/30 bg-cyan-500/5 rounded-xl p-5 sm:p-6 space-y-3">
              <p className="uppercase text-xs font-bold tracking-wider text-cyan-400">The Possibility</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                In 6 weeks, they execute based on a daily system — communicating takeaways and action items directly to you.
                Daily accountability becomes automatic, not optional.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-col items-center gap-4">
            <a href="#pricing">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-base px-10 h-14 rounded-lg">
                Enroll Now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            <p className="text-xs text-slate-500">
              Rolling enrollment — sign up by Friday, they start the following Monday.
            </p>
          </div>
        </div>
      </section>

      {/* ─── NOT A COURSE ─── */}
      <section className="py-16 sm:py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="uppercase tracking-[0.2em] text-cyan-400 text-xs font-semibold text-center mb-3">
            This Isn't About Learning Information
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-center uppercase tracking-tight leading-tight">
            A System, Not a Course.
          </h2>
          <p className="text-slate-400 text-center mt-4 max-w-2xl mx-auto">
            Other programs provide content. The 6-Week Challenge provides a framework for real, verifiable change.
          </p>

          <div className="mt-12 grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: CalendarDays,
                title: 'A Daily Action Loop',
                desc: 'Each day your producers watch a short training, reflect on a challenge, log their Core 4, and communicate their takeaways — giving you full visibility.',
              },
              {
                icon: Brain,
                title: 'AI Feedback To You',
                desc: 'After each lesson, your producer\'s reflections are analyzed by AI and sent directly to you with coaching insights, relevance scores, and next steps.',
              },
              {
                icon: Lightbulb,
                title: 'Holistic Development',
                desc: 'This isn\'t just sales training. Core 4 tracks Body, Being, Balance, and Business — building the complete person, not just the producer.',
              },
            ].map((item) => (
              <div key={item.title} className="border border-cyan-900/30 bg-[#0a1020] rounded-xl p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-cyan-400" />
                </div>
                <h3 className="font-bold text-white">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── THE DAILY RHYTHM ─── */}
      <section className="py-16 sm:py-24 border-t border-white/5 bg-[#070e1a]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="uppercase tracking-[0.2em] text-cyan-400 text-xs font-semibold text-center mb-3">
            The Producer's Daily Rhythm
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-center uppercase tracking-tight">
            A Simple, Repeatable Process
          </h2>
          <p className="text-slate-400 text-center mt-4 max-w-2xl mx-auto">
            Designed to build momentum and real learning into every business day.
          </p>

          <div className="mt-12 grid sm:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Watch & Reflect',
                desc: 'They start their day with a 5-10 min training video. Getting clear on one of the 30 Standard Skillsets. Then they answer reflection questions — forcing them to internalize it.',
                image: '/promo-images/Standard Training1.png',
              },
              {
                step: '02',
                title: 'Execute & Track',
                desc: 'The training is tied to a specific, measurable action item they execute that day. Then they complete their Core 4 — Body, Being, Balance, Business.',
                image: '/promo-images/Core4.png',
              },
              {
                step: '03',
                title: 'You See Everything',
                desc: 'After they submit, AI analyzes their reflections and emails you a coaching report. You see quality, engagement, and areas to push — without micromanaging.',
                image: '/promo-images/Metrics1.png',
              },
            ].map((item) => (
              <div key={item.step} className="border border-cyan-900/30 bg-[#0a1020] rounded-xl overflow-hidden">
                <div className="aspect-video bg-[#0d1525] overflow-hidden">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover object-top opacity-80" />
                </div>
                <div className="p-5 space-y-2">
                  <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">{item.step}</p>
                  <h3 className="font-bold text-white">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CURRICULUM ─── */}
      <section className="py-16 sm:py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="uppercase tracking-[0.2em] text-cyan-400 text-xs font-semibold text-center mb-3">
            The 6-Week Curriculum
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-center uppercase tracking-tight">
            Each Week Builds on the Last
          </h2>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WEEK_THEMES.map((week) => (
              <div
                key={week.week}
                className="border border-cyan-900/30 bg-[#0a1020] rounded-xl p-5 space-y-3 hover:border-cyan-500/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-black text-sm">
                    W{week.week}
                  </div>
                  <div>
                    <p className="text-xs text-cyan-400 uppercase tracking-wider font-semibold">Week {week.week}</p>
                    <h3 className="font-bold text-white">{week.name}</h3>
                  </div>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{week.description}</p>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <PlayCircle className="h-3.5 w-3.5" />
                  <span>5 lessons &middot; Mon–Fri</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── THE TECHNOLOGY STACK ─── */}
      <section className="py-16 sm:py-24 border-t border-white/5 bg-[#070e1a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="uppercase tracking-[0.2em] text-cyan-400 text-xs font-semibold text-center mb-3">
            The Technology Stack
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-center uppercase tracking-tight">
            Built Inside AgencyBrain
          </h2>
          <p className="text-slate-400 text-center mt-4 max-w-2xl mx-auto">
            Your producers get full access to a professional-grade platform for training and personal development. No separate apps or logins.
          </p>

          <div className="mt-12 space-y-6">
            {/* Row 1 */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-cyan-900/30 bg-[#0a1020] rounded-xl overflow-hidden">
                <div className="p-5 border-b border-cyan-900/20">
                  <p className="uppercase text-xs font-bold tracking-wider text-cyan-400 mb-1">The Dashboard</p>
                  <p className="text-sm text-slate-400">
                    Your staff portal tracks all 30 of the 42-day journey — lessons, progress, streaks, and Core 4 at a glance.
                  </p>
                </div>
                <div className="bg-[#0d1525] p-3">
                  <img src="/promo-images/staff-dashboard.png" alt="Staff Dashboard" className="w-full rounded-lg shadow-2xl" />
                </div>
              </div>

              <div className="border border-cyan-900/30 bg-[#0a1020] rounded-xl overflow-hidden">
                <div className="p-5 border-b border-cyan-900/20">
                  <p className="uppercase text-xs font-bold tracking-wider text-cyan-400 mb-1">Core 4 Tracker</p>
                  <p className="text-sm text-slate-400">
                    Daily habit tracking across Body, Being, Balance, and Business. Streak tracking keeps them accountable.
                  </p>
                </div>
                <div className="bg-[#0d1525] p-3">
                  <img src="/promo-images/Core4.png" alt="Core 4 Tracker" className="w-full rounded-lg shadow-2xl" />
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-cyan-900/30 bg-[#0a1020] rounded-xl overflow-hidden">
                <div className="p-5 border-b border-cyan-900/20">
                  <p className="uppercase text-xs font-bold tracking-wider text-cyan-400 mb-1">Discovery Flows</p>
                  <p className="text-sm text-slate-400">
                    AI-powered weekly reflection sessions. Your producers process the week's lessons and get personalized coaching insights.
                  </p>
                </div>
                <div className="bg-[#0d1525] p-3">
                  <img src="/promo-images/Flows1.png" alt="Discovery Flows" className="w-full rounded-lg shadow-2xl" />
                </div>
              </div>

              <div className="border border-cyan-900/30 bg-[#0a1020] rounded-xl overflow-hidden">
                <div className="p-5 border-b border-cyan-900/20">
                  <p className="uppercase text-xs font-bold tracking-wider text-cyan-400 mb-1">Owner Visibility</p>
                  <p className="text-sm text-slate-400">
                    Track every producer's daily metrics, lesson completion, reflections, and Core 4 streaks from your dashboard.
                  </p>
                </div>
                <div className="bg-[#0d1525] p-3">
                  <img src="/promo-images/Metrics1.png" alt="Owner Dashboard" className="w-full rounded-lg shadow-2xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOR THE OWNER / FOR THE PRODUCER ─── */}
      <section className="py-16 sm:py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="uppercase tracking-[0.2em] text-cyan-400 text-xs font-semibold text-center mb-3">
            The Return on Investment
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-center uppercase tracking-tight">
            Wins for Everyone
          </h2>

          <div className="mt-12 grid md:grid-cols-2 gap-6">
            <div className="border border-cyan-900/30 bg-[#0a1020] rounded-xl p-6 sm:p-8 space-y-5">
              <p className="uppercase text-xs font-bold tracking-wider text-orange-400">For You, The Owner</p>
              <ul className="space-y-4">
                {[
                  'Full visibility through 30 daily reports',
                  'AI coaching analysis sent to your inbox',
                  'A clear process for identifying and closing gaps in your team\'s performance',
                  'A producer who takes ownership of their results',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-cyan-900/30 bg-[#0a1020] rounded-xl p-6 sm:p-8 space-y-5">
              <p className="uppercase text-xs font-bold tracking-wider text-cyan-400">For Your Producer</p>
              <ul className="space-y-4">
                {[
                  'A repeatable system for daily execution',
                  'AI-powered coaching on their reflections',
                  'Tools to manage the whole of their life — not just sales',
                  'A 6-week identity shift that compounds forever',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── THE ULTIMATE OUTCOME ─── */}
      <section className="py-16 sm:py-24 border-t border-white/5 bg-[#070e1a]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="uppercase tracking-[0.2em] text-cyan-400 text-xs font-semibold mb-3">
            The Ultimate Outcome
          </p>
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">
            The goal is not just a better producer.
          </h2>
          <p className="text-slate-400 mt-3 max-w-2xl mx-auto">
            It's a transformed, more committed team member.
          </p>

          <div className="mt-12 grid sm:grid-cols-3 gap-6">
            {[
              { icon: Shield, label: 'Integrity', desc: 'They learn to keep their word to themselves. What they say they\'ll do, they do — on and off the clock.' },
              { icon: Flame, label: 'Resilience', desc: 'They learn to overcome challenges instead of being derailed by them. Consistency becomes identity.' },
              { icon: Heart, label: 'Loyalty', desc: 'They feel seen and valued because their leader is invested in their whole person, not just their production.' },
            ].map((item) => (
              <div key={item.label} className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto">
                  <item.icon className="h-6 w-6 text-cyan-400" />
                </div>
                <h3 className="font-bold text-orange-400 uppercase tracking-wide text-sm">{item.label}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LOGISTICS ─── */}
      <section className="py-16 sm:py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="uppercase tracking-[0.2em] text-cyan-400 text-xs font-semibold text-center mb-3">
            Simple &amp; Seamless Logistics
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-center uppercase tracking-tight">
            Getting your producer started is simple.
          </h2>
          <p className="text-slate-400 text-center mt-4">Three steps, zero friction.</p>

          <div className="mt-12 grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: CreditCard,
                step: '1',
                title: 'Purchase Seats',
                desc: 'Choose your tier and buy the number of seats you need. Checkout takes 60 seconds.',
              },
              {
                icon: UserPlus,
                step: '2',
                title: 'Add Your Team',
                desc: 'Add producer names, pick a Monday start date, and we auto-generate their login credentials.',
              },
              {
                icon: Zap,
                step: '3',
                title: 'They Start Monday',
                desc: 'Daily email reminders, app access, and all 30 lessons queued and ready. You track everything from day one.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto text-white font-black text-xl">
                  {item.step}
                </div>
                <h3 className="font-bold text-white">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-16 sm:py-24 border-t border-white/5 bg-[#070e1a]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="uppercase tracking-[0.2em] text-cyan-400 text-xs font-semibold text-center mb-3">
            Ready to Build Your Next Top Producer?
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-center uppercase tracking-tight">
            Choose Your Tier
          </h2>
          <p className="text-slate-400 text-center mt-4 max-w-xl mx-auto">
            Enroll your producer by Friday to secure their spot for Monday's start.
          </p>

          <div className="mt-12 grid lg:grid-cols-3 gap-6">
            {/* 1:1 Coaching */}
            <div className="border border-cyan-900/30 bg-[#0a1020] rounded-xl overflow-hidden flex flex-col">
              <div className="p-6 sm:p-8 flex-1 space-y-4">
                <p className="uppercase text-xs font-bold tracking-wider text-green-400">1:1 Coaching Member</p>
                <div>
                  <span className="text-4xl font-black text-white">$50</span>
                  <span className="text-slate-500 ml-1">/seat</span>
                </div>
                <p className="text-sm text-slate-400">Best value for premium coaching members.</p>
                <ul className="space-y-2.5 pt-2">
                  {[
                    '30 daily video lessons',
                    'Reflection + AI coaching feedback',
                    'Core 4 habit tracker',
                    'Weekly Discovery Flows',
                    'Progress dashboard',
                    'Daily email reminders',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 pt-0">
                <a href={STRIPE_LINKS.oneOnOne} className="block">
                  <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold h-12">
                    Buy Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            {/* Boardroom - Popular */}
            <div className="border-2 border-orange-500 bg-[#0a1020] rounded-xl overflow-hidden flex flex-col relative">
              <div className="bg-orange-500 text-center py-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-white">Most Popular</span>
              </div>
              <div className="p-6 sm:p-8 flex-1 space-y-4">
                <p className="uppercase text-xs font-bold tracking-wider text-orange-400">Boardroom Member</p>
                <div>
                  <span className="text-4xl font-black text-white">$99</span>
                  <span className="text-slate-500 ml-1">/seat</span>
                </div>
                <p className="text-sm text-slate-400">Perfect for growing agencies in the Boardroom.</p>
                <ul className="space-y-2.5 pt-2">
                  {[
                    '30 daily video lessons',
                    'Reflection + AI coaching feedback',
                    'Core 4 habit tracker',
                    'Weekly Discovery Flows',
                    'Progress dashboard',
                    'Daily email reminders',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 pt-0">
                <a href={STRIPE_LINKS.boardroom} className="block">
                  <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-12">
                    Buy Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            {/* Standalone */}
            <div className="border border-cyan-900/30 bg-[#0a1020] rounded-xl overflow-hidden flex flex-col">
              <div className="p-6 sm:p-8 flex-1 space-y-4">
                <p className="uppercase text-xs font-bold tracking-wider text-cyan-400">Standalone Access</p>
                <div>
                  <span className="text-4xl font-black text-white">$299</span>
                  <span className="text-slate-500 ml-1">/seat</span>
                </div>
                <p className="text-sm text-slate-400">Full access for any agency — no membership required.</p>
                <ul className="space-y-2.5 pt-2">
                  {[
                    '30 daily video lessons',
                    'Reflection + AI coaching feedback',
                    'Core 4 habit tracker',
                    'Weekly Discovery Flows',
                    'Progress dashboard',
                    'Daily email reminders',
                    'Includes Core 4 + Flows access',
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 pt-0">
                <a href={STRIPE_LINKS.callScoring} className="block">
                  <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold h-12">
                    Buy Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            Already have an Agency Brain account?{' '}
            <Link to="/auth" className="text-cyan-400 hover:underline">
              Sign in
            </Link>{' '}
            to purchase at your member rate.
          </p>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-16 sm:py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <p className="uppercase tracking-[0.2em] text-cyan-400 text-xs font-semibold text-center mb-3">
            Producer Challenge
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-center uppercase tracking-tight">
            Frequently Asked Questions
          </h2>

          <div className="mt-10 space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <FAQItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-16 sm:py-20 border-t border-white/5 bg-gradient-to-b from-[#070e1a] to-[#050a14]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">
            Stop hoping they'll figure it out.
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Give them the system. See the proof. Watch them transform.
          </p>
          <a href="#pricing">
            <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-base px-10 h-14 rounded-lg mt-4">
              Enroll Your Producer Today <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <img src={standardLogo} alt="Standard Playbook" className="h-5 brightness-200 opacity-50" />
            <div className="flex items-center gap-6 text-xs text-slate-500">
              <Link to="/" className="hover:text-slate-300 transition-colors">Home</Link>
              <Link to="/auth" className="hover:text-slate-300 transition-colors">Sign In</Link>
            </div>
          </div>
          <p className="text-center text-xs text-slate-600 mt-6">
            &copy; {new Date().getFullYear()} The Standard Playbook. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
