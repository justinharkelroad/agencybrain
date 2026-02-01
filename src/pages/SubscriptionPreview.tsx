/**
 * Preview page for subscription UI components - shows actual in-app experience
 * Access at /preview/subscription
 */
import { useState } from "react";
import {
  Clock,
  X,
  CreditCard,
  AlertTriangle,
  Mail,
  LayoutDashboard,
  Phone,
  Bot,
  GraduationCap,
  Building2,
  Heart,
  Sun,
  LogOut,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";

type PreviewMode = 'trial' | 'active' | 'past_due';

// Mock sidebar for preview
function MockSidebar({ disabled = false, isTrialing = false }: { disabled?: boolean; isTrialing?: boolean }) {
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', trialRestricted: false },
    { icon: Phone, label: 'Call Scoring', trialRestricted: false },
    { icon: Bot, label: 'Sales', trialRestricted: false },
    { icon: GraduationCap, label: 'Training', trialRestricted: true },  // Scorecards are trial-restricted
    { icon: Building2, label: 'Agency Mgmt', trialRestricted: false },
    { icon: Heart, label: 'Personal Growth', trialRestricted: false },
  ];

  return (
    <div className={cn(
      "w-64 bg-sidebar border-r border-border flex flex-col h-full",
      disabled && "opacity-50 pointer-events-none"
    )}>
      <div className="p-4 border-b border-border/50">
        <AgencyBrainBadge />
      </div>

      <div className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
              i === 0 ? "bg-muted/50 text-foreground" : "text-muted-foreground hover:bg-muted/30"
            )}
          >
            <item.icon className="w-4 h-4" />
            <span className="flex-1">{item.label}</span>
            {isTrialing && item.trialRestricted && (
              <span title="Some features available after trial">
                <Clock className="w-3 h-3 text-sky-500" />
              </span>
            )}
            {item.label !== 'Dashboard' && item.label !== 'Call Scoring' && !item.trialRestricted && (
              <ChevronRight className="w-4 h-4 ml-auto" />
            )}
            {item.trialRestricted && !isTrialing && (
              <ChevronRight className="w-4 h-4 ml-auto" />
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border/50 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
          <Building2 className="w-4 h-4" />
          <span>My Agency</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
          <CreditCard className="w-4 h-4" />
          <span>Billing</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-3">
            <Sun className="w-4 h-4" />
            <span>Theme</span>
          </span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-destructive">
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </div>
      </div>
    </div>
  );
}

// Mock trial banner
function MockTrialBanner({ daysRemaining, onDismiss }: { daysRemaining: number; onDismiss?: () => void }) {
  const getMessage = () => {
    if (daysRemaining === 0) return "Your free trial ends today";
    if (daysRemaining === 1) return "Your free trial ends tomorrow";
    return `${daysRemaining} days left in your free trial`;
  };

  return (
    <div className="bg-sky-500/10 border border-sky-500/30 text-sky-500 rounded-lg px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Clock className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium">{getMessage()}</span>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="p-1 hover:bg-background/50 rounded">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// Mock FeatureGate overlay for trial users
function MockFeatureGate({ daysRemaining }: { daysRemaining: number }) {
  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="blur-sm pointer-events-none select-none">
        <Card>
          <CardHeader>
            <CardTitle>Scoring Rules</CardTitle>
            <CardDescription>Configure metrics and weights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-8 bg-muted rounded w-2/3" />
          </CardContent>
        </Card>
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
        <div className="text-center p-6 max-w-sm">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sky-500/10 mb-4">
            <Clock className="w-6 h-6 text-sky-500" />
          </div>
          <h3 className="font-semibold mb-2">Available After Trial</h3>
          <p className="text-sm text-muted-foreground">
            This feature is available after your free trial ends ({daysRemaining} days).
          </p>
        </div>
      </div>
    </div>
  );
}

// Mock dashboard content showing feature gate
function MockDashboardContent({ showGate = false, daysRemaining = 5 }: { showGate?: boolean; daysRemaining?: number }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scorecards</h1>
        <p className="text-muted-foreground">Manage your team's scorecards.</p>
      </div>

      {showGate ? (
        <MockFeatureGate daysRemaining={daysRemaining} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Scoring Rules</CardTitle>
            <CardDescription>Configure metrics and weights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-8 bg-muted rounded w-2/3" />
            <Button className="mt-4">Save Settings</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Payment Failed Lockout Screen
function PaymentFailedLockoutPreview() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <CardTitle className="text-xl">Payment Failed</CardTitle>
          <CardDescription>
            We couldn't process your subscription payment. Please update your payment method to restore access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full gap-2" size="lg">
            <CreditCard className="w-4 h-4" />
            Update Payment Method
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>Need help? Contact us at</p>
            <a
              href="mailto:support@agencybrain.io"
              className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
            >
              <Mail className="w-3 h-3" />
              support@agencybrain.io
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SubscriptionPreview() {
  const [mode, setMode] = useState<PreviewMode>('trial');
  const [trialDays, setTrialDays] = useState(5);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Payment failed shows full lockout
  if (mode === 'past_due') {
    return (
      <div className="relative">
        {/* Mode switcher overlay */}
        <div className="fixed top-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-3">
          <p className="text-xs text-muted-foreground mb-2">Preview Mode:</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMode('trial')}>Trial</Button>
            <Button size="sm" variant="outline" onClick={() => setMode('active')}>Active</Button>
            <Button size="sm" variant="default">Past Due</Button>
          </div>
        </div>
        <PaymentFailedLockoutPreview />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Mode switcher */}
      <div className="fixed top-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-3">
        <p className="text-xs text-muted-foreground mb-2">Preview Mode:</p>
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            variant={mode === 'trial' ? 'default' : 'outline'}
            onClick={() => { setMode('trial'); setBannerDismissed(false); }}
          >
            Trial
          </Button>
          <Button
            size="sm"
            variant={mode === 'active' ? 'default' : 'outline'}
            onClick={() => setMode('active')}
          >
            Active
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMode('past_due')}
          >
            Past Due
          </Button>
        </div>
        {mode === 'trial' && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Trial days remaining:</p>
            <div className="flex gap-1">
              {[7, 5, 3, 1, 0].map(d => (
                <Button
                  key={d}
                  size="sm"
                  variant={trialDays === d ? 'secondary' : 'ghost'}
                  className="h-7 px-2"
                  onClick={() => { setTrialDays(d); setBannerDismissed(false); }}
                >
                  {d}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <MockSidebar isTrialing={mode === 'trial'} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Trial banner area */}
        {mode === 'trial' && !bannerDismissed && (
          <div className="px-6 pt-6">
            <div className="max-w-6xl">
              <MockTrialBanner
                daysRemaining={trialDays}
                onDismiss={() => setBannerDismissed(true)}
              />
            </div>
          </div>
        )}

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl">
            <MockDashboardContent showGate={mode === 'trial'} daysRemaining={trialDays} />
          </div>
        </div>
      </div>
    </div>
  );
}
