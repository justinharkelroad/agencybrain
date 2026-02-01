import { useState } from "react";
import { Clock, X } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

interface TrialBannerProps {
  /**
   * Whether the banner can be dismissed
   */
  dismissible?: boolean;
  /**
   * Storage key for dismissed state (if dismissible)
   */
  storageKey?: string;
  /**
   * Additional class names
   */
  className?: string;
  /**
   * Compact mode (less padding, smaller text)
   */
  compact?: boolean;
}

/**
 * Informational banner showing trial status and days remaining.
 * No action required - trial auto-converts to paid subscription.
 */
export function TrialBanner({
  dismissible = false,
  storageKey = "trial-banner-dismissed",
  className,
  compact = false,
}: TrialBannerProps) {
  const { data: subscription, isLoading } = useSubscription();
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissible) return false;
    return localStorage.getItem(storageKey) === "true";
  });

  // Don't show if not trialing or dismissed
  if (isLoading || !subscription?.isTrialing || dismissed) {
    return null;
  }

  const daysRemaining = subscription.trialDaysRemaining ?? 0;

  const handleDismiss = () => {
    setDismissed(true);
    if (dismissible) {
      localStorage.setItem(storageKey, "true");
    }
  };

  const getMessage = () => {
    if (daysRemaining === 0) {
      return "Your free trial ends today";
    }
    if (daysRemaining === 1) {
      return "Your free trial ends tomorrow";
    }
    return `${daysRemaining} days left in your free trial`;
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-between gap-4",
        "rounded-lg border",
        compact ? "px-3 py-2" : "px-4 py-3",
        "bg-sky-500/10 border-sky-500/30 text-sky-500",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Clock className={cn("flex-shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
        <span className={cn("font-medium", compact && "text-sm")}>{getMessage()}</span>
      </div>

      {dismissible && (
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-background/50 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

