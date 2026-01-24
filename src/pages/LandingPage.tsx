import { useAuth } from '@/lib/auth';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Phone,
  BarChart3,
  RotateCcw,
  FileSpreadsheet,
  GraduationCap,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Zap,
  Shield,
  Users,
  TrendingUp
} from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AgencyBrainBadge } from '@/components/AgencyBrainBadge';
import { cn } from '@/lib/utils';

// Feature section component for alternating layouts
function FeatureSection({
  title,
  description,
  benefits,
  imageSrc,
  imageAlt,
  reverse = false,
  ctaText,
  icon: Icon
}: {
  title: string;
  description: string;
  benefits: string[];
  imageSrc: string;
  imageAlt: string;
  reverse?: boolean;
  ctaText: string;
  icon: React.ElementType;
}) {
  return (
    <section className={cn(
      "py-20 lg:py-28",
      reverse ? "bg-muted/30" : "bg-background"
    )}>
      <div className="container mx-auto px-4">
        <div className={cn(
          "grid lg:grid-cols-2 gap-12 lg:gap-16 items-center",
          reverse && "lg:flex-row-reverse"
        )}>
          {/* Content */}
          <div className={cn("space-y-6", reverse && "lg:order-2")}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Icon className="w-4 h-4" />
              <span>Feature</span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground leading-tight">
              {title}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {description}
            </p>
            <ul className="space-y-3">
              {benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
            <Link to="/auth">
              <Button size="lg" className="mt-4 group">
                {ctaText}
                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          {/* Image */}
          <div className={cn(
            "relative",
            reverse && "lg:order-1"
          )}>
            <div className="relative rounded-xl overflow-hidden shadow-2xl border border-border/50">
              <img
                src={imageSrc}
                alt={imageAlt}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
            {/* Decorative gradient */}
            <div className="absolute -z-10 inset-0 bg-gradient-to-br from-primary/20 to-transparent blur-3xl opacity-50 scale-150" />
          </div>
        </div>
      </div>
    </section>
  );
}

const LandingPage = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <AgencyBrainBadge size="md" asLink to="/" />
          <div className="flex items-center gap-4">
            <Link to="/auth" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Sign In
            </Link>
            <Link to="/auth">
              <Button>Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-32 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl opacity-50" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              <span>Built for Insurance Agency Owners</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Run Your Insurance Agency{' '}
              <span className="text-primary">on Autopilot</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              AgencyBrain gives agency owners the visibility, accountability, and AI-powered coaching
              they need to grow premium without adding headcount.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="text-lg px-8 h-14 w-full sm:w-auto">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="text-lg px-8 h-14 w-full sm:w-auto">
                  See It In Action
                </Button>
              </Link>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              No credit card required. Cancel anytime.
            </p>
          </div>

          {/* Hero Image */}
          <div className="mt-16 relative max-w-5xl mx-auto">
            <div className="rounded-xl overflow-hidden shadow-2xl border border-border/50">
              <img
                src="/promo-images/Dashboard1.png"
                alt="AgencyBrain Dashboard showing agency sales performance"
                className="w-full h-auto"
              />
            </div>
            {/* Decorative elements */}
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
            <div className="absolute -top-4 -right-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="py-8 bg-muted/50 border-y border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" />
              <span className="text-lg font-semibold">150+ Agencies</span>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <span className="text-lg font-semibold">42 States</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <span className="text-lg font-semibold">Enterprise Security</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 lg:py-28 bg-secondary text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Your agency runs on gut feel.{' '}
              <span className="text-primary">It shouldn't.</span>
            </h2>
            <p className="text-xl text-gray-300 mb-12 leading-relaxed">
              You built something great. But now you're drowning in spreadsheets,
              chasing staff for numbers, and wondering why your best producers aren't hitting their targets.
            </p>

            <div className="grid md:grid-cols-2 gap-6 text-left">
              {[
                { text: "Sales calls go unreviewed. You have no idea if your team is following the process." },
                { text: "Cancellations pile up. By the time you notice, the customer is gone." },
                { text: "Compensation statements are a black box. You're trusting the carrier got it right." },
                { text: "Training happens once and dies. New hires take 6 months to ramp up." }
              ].map((item, i) => (
                <Card key={i} className="bg-white/5 border-white/10">
                  <CardContent className="p-6">
                    <p className="text-gray-200">{item.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-xl text-primary font-semibold mt-12">
              You didn't build your agency to babysit spreadsheets. You built it to grow.
            </p>
          </div>
        </div>
      </section>

      {/* Feature 1: AI Call Scoring */}
      <FeatureSection
        icon={Phone}
        title="Know exactly how your team sells. Every single call."
        description="Upload any sales or service call and get an instant AI-powered scorecard. See what's working, what's not, and where each producer needs coaching—without listening to hours of recordings yourself."
        benefits={[
          "Scores calls against your agency's proven sales process",
          "Identifies specific coaching opportunities for each producer",
          "Tracks improvement over time with analytics dashboards",
          "Works with any phone system—just upload the recording"
        ]}
        imageSrc="/promo-images/Callscoring1.png"
        imageAlt="AI Call Scoring showing talk-to-listen ratio and critical assessment"
        ctaText="See a Sample Scorecard"
      />

      {/* Feature 2: Team Scorecards */}
      <FeatureSection
        icon={BarChart3}
        title="Daily accountability that actually sticks"
        description="Replace your whiteboard with real-time performance rings. Staff submit their numbers daily. You see who's on track, who's falling behind, and who deserves recognition—all in one view."
        benefits={[
          "Daily KPI tracking for calls, quotes, and sales",
          "Customizable scorecards for sales vs. service roles",
          "Streak tracking keeps producers motivated",
          "Manager dashboards show team performance at a glance"
        ]}
        imageSrc="/promo-images/Metrics1.png"
        imageAlt="Team Performance Overview with individual performance rings"
        ctaText="Explore Scorecards"
        reverse
      />

      {/* Feature 3: Winback HQ */}
      <FeatureSection
        icon={RotateCcw}
        title="Save revenue you're already losing"
        description="Your cancellation file isn't just a list—it's a goldmine. Winback HQ shows you which households are worth calling back, tracks outreach efforts, and measures won-back premium."
        benefits={[
          "Upload termination reports and instantly see prioritized opportunities",
          "Assign follow-ups to specific team members",
          "Track outreach status: untouched, in progress, won back, dismissed",
          "See ROI on your retention efforts with termination analytics"
        ]}
        imageSrc="/promo-images/WinbackHQ.png"
        imageAlt="Winback HQ showing opportunities and activity tracking"
        ctaText="Recover Lost Premium"
      />

      {/* Feature 4: Compensation Analyzer */}
      <FeatureSection
        icon={FileSpreadsheet}
        title="Verify every dollar the carrier owes you"
        description="Upload your Allstate compensation statements and AgencyBrain audits them automatically. Compare month-over-month, flag rate discrepancies, and stop leaving money on the table."
        benefits={[
          "Parses compensation statements in seconds",
          "Compares current vs. prior periods to catch changes",
          "Flags potential underpayments for review",
          "Stores report history so you can reference past analyses"
        ]}
        imageSrc="/promo-images/Comp1.png"
        imageAlt="Compensation Statement Analyzer showing comparison report"
        ctaText="Audit Your Statements"
        reverse
      />

      {/* Feature 5: Training Platform */}
      <FeatureSection
        icon={GraduationCap}
        title="Onboard new hires in weeks, not months"
        description="Give your team a single place for playbooks, video training, and agency-specific content. Track completion, assign courses, and ensure everyone follows the same process."
        benefits={[
          "Standard Playbook with proven insurance sales frameworks",
          "Custom agency training you can build and assign",
          "Progress tracking shows who completed what",
          "AI Sales Bot for roleplay practice (1:1 Coaching tier)"
        ]}
        imageSrc="/promo-images/Standard Training1.png"
        imageAlt="Standard Playbook training platform"
        ctaText="See the Training Library"
      />

      {/* How It Works */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Get up and running in 15 minutes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              No IT department required. No complex integrations. Just results.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "1",
                title: "Connect your agency",
                description: "Add your team members, set roles, and configure your KPIs."
              },
              {
                step: "2",
                title: "Staff submits daily",
                description: "Your team logs calls, quotes, and sales each day using simple forms."
              },
              {
                step: "3",
                title: "You see everything",
                description: "Dashboards show performance at a glance. AI analyzes calls automatically."
              },
              {
                step: "4",
                title: "Your agency grows",
                description: "Better visibility means faster coaching, higher retention, and more closed business."
              }
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-white text-xl font-bold flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-5xl text-primary mb-8">"</div>
            <blockquote className="text-2xl lg:text-3xl font-medium text-foreground mb-8 leading-relaxed">
              I used to spend Friday afternoons manually pulling numbers. Now I open AgencyBrain
              and see exactly where we stand. My team knows I'm watching—and they perform better because of it.
            </blockquote>
            <div className="text-muted-foreground">
              <span className="font-semibold text-foreground">Agency Owner</span>
              <span className="mx-2">·</span>
              <span>Texas</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            {[
              {
                q: "Who is AgencyBrain built for?",
                a: "Insurance agency owners and managers who want visibility into daily performance without chasing staff for spreadsheets."
              },
              {
                q: "Do I need to switch phone systems?",
                a: "No. Call Scoring works with any phone system. Just upload your audio files."
              },
              {
                q: "How long does setup take?",
                a: "Most agencies are fully operational within a day. Add your team, configure scorecards, and you're tracking."
              },
              {
                q: "Can my staff access it?",
                a: "Yes. Staff get their own portal to submit daily metrics, view training, and see their scorecards."
              },
              {
                q: "What carriers do you support?",
                a: "AgencyBrain is carrier-agnostic for scorecards and training. The Compensation Analyzer currently supports Allstate statements, with more carriers coming soon."
              }
            ].map((item, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.q}</h3>
                  <p className="text-muted-foreground">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 lg:py-28 bg-secondary text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              Stop guessing. Start growing.
            </h2>
            <p className="text-xl text-gray-300 mb-10">
              Join 150+ agencies using AgencyBrain to hold their teams accountable,
              coach smarter, and close more business.
            </p>
            <Link to="/auth">
              <Button size="lg" className="text-lg px-10 h-14 bg-white text-secondary hover:bg-gray-100">
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <p className="text-sm text-gray-400 mt-4">
              No credit card required. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-background border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <AgencyBrainBadge size="sm" asLink to="/" />
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/auth" className="hover:text-foreground transition-colors">
                Sign In
              </Link>
              <span>© {new Date().getFullYear()} AgencyBrain</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
