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
  Calendar,
  Package,
  Gift,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { useCallBalance, useCallAddonSubscription, formatPrice } from "@/hooks/useCallBalance";
import { CallAddonSection } from "@/components/subscription/CallAddonSection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";


export default function BillingSettings() {
  const { user } = useAuth();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: callBalance, isLoading: balanceLoading } = useCallBalance();
  const isLoading = subLoading || balanceLoading;

  // Open Stripe Customer Portal for payment method management
  const handleManagePayment = () => {
    window.open('https://billing.stripe.com/p/login/eVa7uC0KQd1TaCkeUU', '_blank');
  };

  // Get status badge styling
  const getStatusBadge = () => {
    if (!subscription) return null;

    switch (subscription.status) {
      case "active":
        return (
          <Badge className="bg-green-500/15 text-green-500 border-green-500/20">
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
          <Badge className="bg-purple-500/15 text-purple-500 border-purple-500/20">
            <Sparkles className="w-3 h-3 mr-1" />
            1-on-1 Client
          </Badge>
        );
      case "past_due":
        return (
          <Badge className="bg-red-500/15 text-red-500 border-red-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Past Due
          </Badge>
        );
      case "canceled":
        return (
          <Badge className="bg-gray-500/15 text-gray-500 border-gray-500/20">
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

  const subscriptionCallsLimit = callBalance?.subscriptionLimit || (subscription?.isActive ? 20 : subscription?.isTrialing ? 3 : 0);
  const subscriptionCallsUsed = callBalance
    ? (callBalance.isUnlimited ? 0 : Math.max(0, subscriptionCallsLimit - callBalance.subscriptionRemaining))
    : 0;
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
                <div className="p-4 rounded-lg bg-red-500/15 border border-red-500/20">
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
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
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
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
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
                  href="mailto:info@standardplaybook.com"
                  className="text-primary hover:underline"
                >
                  info@standardplaybook.com
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Call Scoring Add-On */}
          <CallAddonSection />

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
                  <Badge className="bg-purple-500/15 text-purple-500 border-purple-500/20">
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
                  {/* Usage Priority Explanation */}
                  <div className="text-xs text-muted-foreground border border-border/50 rounded-lg p-3">
                    Credits are used in this order: <span className="text-foreground font-medium">Monthly Allowance</span> → <span className="text-sky-500 font-medium">Add-On</span> → <span className="text-emerald-500 font-medium">Bonus</span>
                  </div>

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
                        Resets at the start of each billing period — used first
                      </p>
                    </div>
                  )}

                  {/* Addon Credits */}
                  {(callBalance?.addonRemaining || 0) > 0 && (
                    <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-sky-500" />
                          <span>Monthly Add-On</span>
                        </div>
                        <span className="font-medium text-sky-500">
                          +{callBalance?.addonRemaining}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Resets monthly on your add-on billing date — used after monthly allowance
                      </p>
                    </div>
                  )}

                  {/* Bonus Credits */}
                  {(callBalance?.bonusRemaining || 0) > 0 && (
                    <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4 text-emerald-500" />
                          <span>Bonus Credits</span>
                        </div>
                        <span className="font-medium text-emerald-500">
                          +{callBalance?.bonusRemaining}
                        </span>
                      </div>
                      {callBalance?.bonusExpiresAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires {new Date(callBalance.bonusExpiresAt).toLocaleDateString()} — used after add-on credits
                        </p>
                      )}
                    </div>
                  )}

                  {/* Purchased Credits */}
                  {(callBalance?.purchasedRemaining || 0) > 0 && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span>Purchased Credits</span>
                        </div>
                        <span className="font-medium text-green-500">
                          +{callBalance?.purchasedRemaining}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Never expire — used last
                      </p>
                    </div>
                  )}

                  {/* Low Balance Warning */}
                  {callBalance && callBalance.totalRemaining <= 3 && callBalance.totalRemaining > 0 && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm">
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      Running low on credits. Consider adding a monthly add-on.
                    </div>
                  )}

                  {/* No Credits Warning */}
                  {callBalance && callBalance.totalRemaining === 0 && (
                    <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/20 text-red-500 text-sm">
                      <AlertTriangle className="w-4 h-4 inline mr-2" />
                      No credits remaining. Add a monthly add-on to continue scoring calls.
                    </div>
                  )}
                </div>
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
                  Each credit lets you analyze one sales call with AI. Your plan includes monthly credits
                  that reset each billing period. Need more? Add a monthly add-on for additional credits
                  at a discounted rate.
                </p>
              </div>
              <div>
                <div className="font-medium">In what order are credits used?</div>
                <p className="text-muted-foreground">
                  Monthly allowance is used first, then add-on credits, then bonus credits.
                </p>
              </div>
              <div>
                <div className="font-medium">When do credits reset?</div>
                <p className="text-muted-foreground">
                  Monthly allowance resets with your subscription billing period. Add-on credits reset
                  monthly on the date you purchased the add-on. Bonus credits expire on their expiration date.
                </p>
              </div>
              <div>
                <div className="font-medium">Need to update your subscription?</div>
                <p className="text-muted-foreground">
                  Contact us at{" "}
                  <a href="mailto:info@standardplaybook.com" className="text-primary hover:underline">
                    info@standardplaybook.com
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
