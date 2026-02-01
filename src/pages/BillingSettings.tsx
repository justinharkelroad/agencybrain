import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard,
  ArrowLeft,
  Phone,
  Sparkles,
  CheckCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Calendar,
  Package,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { useCallBalance, useCallPacks, usePurchaseCallPack, formatPrice } from "@/hooks/useCallBalance";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function BillingSettings() {
  const { user } = useAuth();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: callBalance, isLoading: balanceLoading } = useCallBalance();
  const { data: callPacks, isLoading: packsLoading } = useCallPacks();
  const purchaseMutation = usePurchaseCallPack();

  const [portalLoading, setPortalLoading] = useState(false);

  const isLoading = subLoading || balanceLoading;

  // Handle opening Stripe Customer Portal
  const handleManagePayment = async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            return_url: window.location.href,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to open billing portal");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error("Portal error:", error);
      toast.error("Failed to open billing portal");
      setPortalLoading(false);
    }
  };

  // Handle purchasing a call pack
  const handlePurchasePack = async (packId: string) => {
    try {
      const result = await purchaseMutation.mutateAsync({ callPackId: packId });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Purchase error:", error);
      toast.error("Failed to start purchase");
    }
  };

  // Get status badge styling
  const getStatusBadge = () => {
    if (!subscription) return null;

    switch (subscription.status) {
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case "trialing":
        return (
          <Badge className="bg-sky-500/10 text-sky-500 border-sky-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Trial ({subscription.trialDaysRemaining} days left)
          </Badge>
        );
      case "1on1_client":
        return (
          <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">
            <Sparkles className="w-3 h-3 mr-1" />
            1-on-1 Client
          </Badge>
        );
      case "past_due":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Past Due
          </Badge>
        );
      case "canceled":
        return (
          <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
            Canceled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {subscription.status}
          </Badge>
        );
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to access billing settings.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-48 bg-muted rounded" />
            <div className="h-48 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  const subscriptionCallsUsed = callBalance
    ? (callBalance.isUnlimited ? 0 : 20 - callBalance.subscriptionRemaining)
    : 0;
  const subscriptionCallsLimit = subscription?.isActive ? 20 : subscription?.isTrialing ? 3 : 0;
  const subscriptionProgress = subscriptionCallsLimit > 0
    ? (subscriptionCallsUsed / subscriptionCallsLimit) * 100
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <Link
          to="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CreditCard className="h-8 w-8" />
            Billing & Subscription
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your subscription and call scoring credits
          </p>
        </div>

        <div className="space-y-6">
          {/* Subscription Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Subscription</CardTitle>
                  <CardDescription>Your current plan and billing status</CardDescription>
                </div>
                {getStatusBadge()}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Plan Details */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <div className="font-semibold text-lg">Agency Brain Pro</div>
                  <div className="text-sm text-muted-foreground">
                    {subscription?.is1on1Client
                      ? "1-on-1 Coaching Client"
                      : "$299/month"}
                  </div>
                </div>
                {subscription?.isPaid && !subscription?.is1on1Client && (
                  <div className="text-right text-sm text-muted-foreground">
                    {subscription.periodEnd && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Next billing: {subscription.periodEnd.toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Trial Banner */}
              {subscription?.isTrialing && (
                <div className="p-4 rounded-lg bg-sky-500/10 border border-sky-500/20">
                  <div className="flex items-center gap-2 text-sky-500 font-medium mb-1">
                    <Clock className="w-4 h-4" />
                    {subscription.trialDaysRemaining} days left in your trial
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your subscription will automatically continue at $299/month when your trial ends.
                  </p>
                </div>
              )}

              {/* Past Due Warning */}
              {subscription?.status === "past_due" && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 text-red-500 font-medium mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    Payment Failed
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Please update your payment method to continue using Agency Brain.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleManagePayment}
                    disabled={portalLoading}
                  >
                    {portalLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4 mr-2" />
                    )}
                    Update Payment Method
                  </Button>
                </div>
              )}

              {/* Payment Method Section */}
              {subscription?.isPaid && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Payment Method</div>
                      <div className="text-sm text-muted-foreground">
                        Manage your card and billing details
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleManagePayment}
                      disabled={portalLoading}
                    >
                      {portalLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="w-4 h-4 mr-2" />
                      )}
                      Manage
                    </Button>
                  </div>
                </>
              )}

              {/* Contact for Changes */}
              <Separator />
              <div className="text-sm text-muted-foreground">
                Need to make changes to your subscription? Contact us at{" "}
                <a
                  href="mailto:support@agencybrain.io"
                  className="text-primary hover:underline"
                >
                  support@agencybrain.io
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Call Scoring Balance Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5" />
                    Call Scoring Credits
                  </CardTitle>
                  <CardDescription>
                    AI-powered call analysis for your team
                  </CardDescription>
                </div>
                {callBalance?.isUnlimited ? (
                  <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                    Unlimited
                  </Badge>
                ) : (
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {callBalance?.totalRemaining || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">available</div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Balance Breakdown */}
              {!callBalance?.isUnlimited && (
                <div className="space-y-4">
                  {/* Monthly Allowance */}
                  {subscriptionCallsLimit > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span>Monthly Allowance</span>
                        <span>
                          {callBalance?.subscriptionRemaining || 0} / {subscriptionCallsLimit} remaining
                        </span>
                      </div>
                      <Progress value={subscriptionProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        Resets at the start of each billing period
                      </p>
                    </div>
                  )}

                  {/* Purchased Credits */}
                  {(callBalance?.purchasedRemaining || 0) > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span>Purchased Credits</span>
                      </div>
                      <span className="font-medium text-green-500">
                        +{callBalance?.purchasedRemaining}
                      </span>
                    </div>
                  )}

                  {/* Low Balance Warning */}
                  {callBalance && callBalance.totalRemaining <= 3 && callBalance.totalRemaining > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm">
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      Running low on credits. Purchase more to keep scoring calls.
                    </div>
                  )}

                  {/* No Credits Warning */}
                  {callBalance && callBalance.totalRemaining === 0 && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      No credits remaining. Purchase a pack to continue scoring calls.
                    </div>
                  )}
                </div>
              )}

              {/* Call Packs */}
              {subscription?.isPaid && !callBalance?.isUnlimited && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3">Buy More Credits</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Purchased credits never expire and can be used anytime.
                    </p>

                    {packsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-3">
                        {callPacks?.map((pack) => {
                          const isPurchasing = purchaseMutation.isPending;
                          const pricePerCall = pack.price_cents / pack.call_count;

                          return (
                            <button
                              key={pack.id}
                              onClick={() => handlePurchasePack(pack.id)}
                              disabled={isPurchasing}
                              className={cn(
                                "relative p-4 rounded-lg border text-left transition-all",
                                "hover:border-primary/50 hover:bg-muted/50",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                              )}
                            >
                              {pack.call_count === 50 && (
                                <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-medium">
                                  Best Value
                                </div>
                              )}
                              <div className="font-semibold">{pack.call_count} Credits</div>
                              <div className="text-2xl font-bold mt-1">
                                {formatPrice(pack.price_cents)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatPrice(pricePerCall)} per call
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Trial User - Upgrade Prompt */}
              {subscription?.isTrialing && (
                <>
                  <Separator />
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Upgrade to get 20 call scoring credits per month
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your subscription will continue automatically at the end of your trial.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* FAQ / Help */}
          <Card>
            <CardHeader>
              <CardTitle>Questions?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="font-medium">How do call scoring credits work?</div>
                <p className="text-muted-foreground">
                  Each credit lets you analyze one sales call with AI. Monthly credits reset at the
                  start of each billing period. Purchased credits never expire.
                </p>
              </div>
              <div>
                <div className="font-medium">Need to update your subscription?</div>
                <p className="text-muted-foreground">
                  Contact us at{" "}
                  <a href="mailto:support@agencybrain.io" className="text-primary hover:underline">
                    support@agencybrain.io
                  </a>{" "}
                  and we'll help you out.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
