import { useState } from "react";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Feature that triggered the upgrade prompt (for analytics)
   */
  featureKey?: string;
  /**
   * Custom title
   */
  title?: string;
  /**
   * Custom description
   */
  description?: string;
}

const FEATURES = [
  "Unlimited scorecards & custom KPIs",
  "20 AI call scores per month",
  "Full Standard Playbook access",
  "Custom training platform",
  "Team management tools",
  "Comp analyzer & bonus tools",
  "Cancel audit & winback HQ",
  "Priority support",
];

export function UpgradeModal({
  open,
  onOpenChange,
  featureKey,
  title,
  description,
}: UpgradeModalProps) {
  const { user } = useAuth();
  const { data: subscription } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id, display_name")
        .eq("id", user.id)
        .single();

      if (!profile?.agency_id) {
        throw new Error("No agency found");
      }

      // Get agency details
      const { data: agency } = await supabase
        .from("agencies")
        .select("name")
        .eq("id", profile.agency_id)
        .single();

      // Create checkout session
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agency_id: profile.agency_id,
            email: user.email,
            agency_name: agency?.name,
            user_id: user.id,
            success_url: `${window.location.origin}/dashboard?checkout=success`,
            cancel_url: `${window.location.origin}${window.location.pathname}?checkout=canceled`,
            skip_trial: subscription?.isTrialing ? false : true, // Skip trial if not currently trialing
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create checkout session");
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error("Upgrade error:", err);
      setError(err instanceof Error ? err.message : "Failed to start upgrade");
      setLoading(false);
    }
  };

  const defaultTitle = subscription?.isTrialing
    ? "Upgrade to Full Access"
    : "Subscribe to AgencyBrain";

  const defaultDescription = subscription?.isTrialing
    ? `Your trial has ${subscription.trialDaysRemaining} days remaining. Upgrade now to unlock all features.`
    : "Get full access to AgencyBrain's complete suite of agency management tools.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            {title || defaultTitle}
          </DialogTitle>
          <DialogDescription>
            {description || defaultDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Price */}
          <div className="text-center">
            <div className="text-4xl font-bold">$299</div>
            <div className="text-sm text-muted-foreground">per month</div>
          </div>

          {/* Features */}
          <ul className="space-y-2">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          {/* CTA */}
          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Upgrade Now
              </>
            )}
          </Button>

          {/* Fine print */}
          <p className="text-xs text-center text-muted-foreground">
            Secure payment via Stripe. Cancel anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
