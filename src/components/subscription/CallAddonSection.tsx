import { useState } from "react";
import { Loader2, Phone, Calendar, Zap, ExternalLink } from "lucide-react";
import {
  useCallAddonPlans,
  useCallAddonSubscription,
  usePurchaseCallAddon,
  formatPrice,
} from "@/hooks/useCallBalance";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CallAddonSection() {
  const { data: subscription } = useSubscription();
  const { data: addonPlans, isLoading: plansLoading } = useCallAddonPlans();
  const { data: addonSub, isLoading: subLoading } = useCallAddonSubscription();
  const purchaseMutation = usePurchaseCallAddon();
  const [portalLoading, setPortalLoading] = useState(false);

  const isLoading = plansLoading || subLoading;
  const hasActiveAddon = addonSub && addonSub.status === "active";

  const handleSubscribe = async (addonId: string) => {
    try {
      const result = await purchaseMutation.mutateAsync({ addonId });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Addon purchase error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to start subscription"
      );
    }
  };

  const handleManageAddon = async () => {
    setPortalLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            return_url: window.location.href,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to open billing portal");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error("Portal error:", error);
      toast.error("Failed to open billing portal");
      setPortalLoading(false);
    }
  };

  // Don't show for non-paid or unlimited users
  if (!subscription?.isPaid || subscription?.is1on1Client) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Monthly Call Scoring Add-On
            </CardTitle>
            <CardDescription>
              Add predictable monthly call scoring capacity to your plan
            </CardDescription>
          </div>
          {hasActiveAddon && (
            <Badge className="bg-green-500/15 text-green-500 border-green-500/20">
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasActiveAddon ? (
          // Active addon view
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <div className="font-semibold">
                  {addonSub.calls_per_month} Calls/Month
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatPrice(addonSub.price_cents)}/month
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                {addonSub.current_period_end && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {addonSub.cancel_at_period_end
                      ? `Cancels ${new Date(addonSub.current_period_end).toLocaleDateString()}`
                      : `Renews ${new Date(addonSub.current_period_end).toLocaleDateString()}`}
                  </div>
                )}
              </div>
            </div>

            {addonSub.cancel_at_period_end && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm">
                Your add-on will not renew at the end of the current period.
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={handleManageAddon}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Manage Add-On
            </Button>
          </div>
        ) : (
          // Plan selection view
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Stack additional calls on top of your 20 included monthly calls.
              Addon calls reset each billing period.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {addonPlans?.map((plan) => {
                const isPurchasing = purchaseMutation.isPending;
                const pricePerCall = plan.price_cents / plan.calls_per_month;
                const isBestValue = plan.calls_per_month === 100;

                return (
                  <button
                    key={plan.id}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isPurchasing}
                    className={cn(
                      "relative p-4 rounded-lg border text-left transition-all",
                      "hover:border-primary/50 hover:bg-muted/50",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      isBestValue && "border-green-500/50 dark:border-green-500/30"
                    )}
                  >
                    {isBestValue && (
                      <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-medium">
                        Best Value
                      </div>
                    )}
                    <div className="font-semibold">
                      +{plan.calls_per_month} Calls
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {formatPrice(plan.price_cents)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatPrice(pricePerCall)} per call
                    </div>
                  </button>
                );
              })}
            </div>

            {purchaseMutation.isPending && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">
                  Redirecting to checkout...
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
