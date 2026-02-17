import { useState } from "react";
import { Phone, Sparkles, AlertTriangle, Infinity } from "lucide-react";
import { useCallBalance } from "@/hooks/useCallBalance";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BuyCallsModal } from "./BuyCallsModal";
import { cn } from "@/lib/utils";

interface CallBalanceIndicatorProps {
  /**
   * Show detailed breakdown or just the total
   */
  detailed?: boolean;
  /**
   * Additional class names
   */
  className?: string;
  /**
   * Show as inline badge (for headers/nav)
   */
  inline?: boolean;
}

/**
 * Displays the current call scoring balance with option to buy more.
 */
export function CallBalanceIndicator({
  detailed = false,
  className,
  inline = false,
}: CallBalanceIndicatorProps) {
  const { data: balance, isLoading } = useCallBalance();
  const { data: subscription } = useSubscription();
  const [buyModalOpen, setBuyModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={cn("animate-pulse h-6 w-20 bg-muted rounded", className)} />
    );
  }

  if (!balance) return null;

  // For unlimited users
  if (balance.isUnlimited) {
    if (inline) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md",
                "bg-emerald-500/10 text-emerald-500 text-sm font-medium",
                className
              )}>
                <Infinity className="w-3.5 h-3.5" />
                <span>Unlimited</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Unlimited call scoring included with your plan</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <div className={cn("flex items-center gap-2 text-emerald-500", className)}>
        <Infinity className="w-4 h-4" />
        <span className="text-sm font-medium">Unlimited Call Scoring</span>
      </div>
    );
  }

  // Determine status
  const isLow = balance.totalRemaining <= 3 && balance.totalRemaining > 0;
  const isEmpty = balance.totalRemaining === 0;

  // Inline badge view
  if (inline) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setBuyModalOpen(true)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium transition-colors",
                  isEmpty
                    ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    : isLow
                    ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                    : "bg-sky-500/10 text-sky-500 hover:bg-sky-500/20",
                  className
                )}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{balance.totalRemaining}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {isEmpty
                  ? "No call scores remaining. Click to buy more."
                  : `${balance.totalRemaining} call scores remaining`}
              </p>
              {balance.bonusRemaining > 0 && (
                <p className="text-emerald-400 text-xs">
                  Includes {balance.bonusRemaining} bonus credits
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <BuyCallsModal open={buyModalOpen} onOpenChange={setBuyModalOpen} />
      </>
    );
  }

  // Full card view
  const subscriptionLimit = subscription?.isActive ? 20 : subscription?.isTrialing ? 3 : 0;
  const subscriptionUsed = subscriptionLimit - balance.subscriptionRemaining;
  const subscriptionProgress = subscriptionLimit > 0
    ? (subscriptionUsed / subscriptionLimit) * 100
    : 0;

  return (
    <>
      <div className={cn("p-4 rounded-lg border bg-card", className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Phone className={cn(
              "w-5 h-5",
              isEmpty ? "text-red-500" : isLow ? "text-amber-500" : "text-sky-500"
            )} />
            <h3 className="font-medium">Call Scoring Balance</h3>
          </div>
          <Button
            size="sm"
            variant={isEmpty ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => setBuyModalOpen(true)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Buy More
          </Button>
        </div>

        {/* Total */}
        <div className={cn(
          "text-3xl font-bold mb-2",
          isEmpty ? "text-red-500" : isLow ? "text-amber-500" : ""
        )}>
          {balance.totalRemaining}
          <span className="text-lg font-normal text-muted-foreground ml-2">
            calls remaining
          </span>
        </div>

        {/* Warning message */}
        {isEmpty && (
          <div className="flex items-center gap-2 text-red-500 text-sm mb-4">
            <AlertTriangle className="w-4 h-4" />
            <span>No calls remaining. Purchase a pack to continue scoring.</span>
          </div>
        )}
        {isLow && !isEmpty && (
          <div className="flex items-center gap-2 text-amber-500 text-sm mb-4">
            <AlertTriangle className="w-4 h-4" />
            <span>Running low on calls. Consider purchasing more.</span>
          </div>
        )}

        {/* Detailed breakdown */}
        {detailed && subscriptionLimit > 0 && (
          <div className="space-y-4 pt-4 border-t">
            {/* Subscription calls */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Monthly allowance</span>
                <span>
                  {balance.subscriptionRemaining} / {subscriptionLimit}
                </span>
              </div>
              <Progress value={subscriptionProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Resets at the start of each billing period
              </p>
            </div>

            {/* Bonus calls */}
            {balance.bonusRemaining > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bonus credits</span>
                <span className="text-emerald-500 font-medium">
                  +{balance.bonusRemaining}
                </span>
              </div>
            )}

            {/* Purchased calls */}
            {balance.purchasedRemaining > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Purchased packs</span>
                <span className="text-emerald-500 font-medium">
                  +{balance.purchasedRemaining}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <BuyCallsModal open={buyModalOpen} onOpenChange={setBuyModalOpen} />
    </>
  );
}
