import { ReactNode } from "react";
import { Lock, Clock } from "lucide-react";
import { useFeatureAccess, FeatureKey } from "@/hooks/useFeatureAccess";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

interface FeatureGateProps {
  featureKey: FeatureKey;
  children: ReactNode;
  /**
   * What to show when feature is locked
   * - "blur" - shows blurred content with lock overlay
   * - "message" - shows lock message only
   * - "hide" - completely hides the content
   */
  fallback?: "blur" | "message" | "hide";
  /**
   * Custom message (overrides default)
   */
  lockedMessage?: string;
  /**
   * Additional class names for the container
   */
  className?: string;
}

/**
 * Gate component that conditionally renders content based on feature access.
 *
 * For trial users: Shows informational message that feature is available after trial.
 * No "upgrade" button since trial auto-converts to paid.
 *
 * Usage:
 * ```tsx
 * <FeatureGate featureKey={FeatureKeys.SCORECARD_EDIT}>
 *   <ScorecardEditor />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  featureKey,
  children,
  fallback = "blur",
  lockedMessage,
  className,
}: FeatureGateProps) {
  const { data: access, isLoading: accessLoading } = useFeatureAccess(featureKey);
  const { data: subscription, isLoading: subLoading } = useSubscription();

  const isLoading = accessLoading || subLoading;

  // While loading, show a subtle loading state
  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        {children}
      </div>
    );
  }

  // If user can access, render children normally
  if (access?.canAccess) {
    return <>{children}</>;
  }

  // Determine the message to show
  const isTrialing = subscription?.isTrialing;
  const daysRemaining = subscription?.trialDaysRemaining ?? 0;

  const defaultMessage = isTrialing
    ? `This feature is available after your free trial ends${daysRemaining > 0 ? ` (${daysRemaining} days)` : ''}.`
    : access?.upgradeMessage || "This feature is not available on your current plan.";

  const message = lockedMessage || defaultMessage;

  // Handle different fallback types
  if (fallback === "hide") {
    return null;
  }

  if (fallback === "message") {
    return (
      <div className={cn("p-6 text-center", className)}>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sky-500/10 mb-4">
          {isTrialing ? (
            <Clock className="w-6 h-6 text-sky-500" />
          ) : (
            <Lock className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    );
  }

  // Default: blur fallback
  return (
    <div className={cn("relative", className)}>
      {/* Blurred content */}
      <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
        <div className="text-center p-6 max-w-sm">
          <div className={cn(
            "inline-flex items-center justify-center w-12 h-12 rounded-full mb-4",
            isTrialing ? "bg-sky-500/10" : "bg-muted"
          )}>
            {isTrialing ? (
              <Clock className="w-6 h-6 text-sky-500" />
            ) : (
              <Lock className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <h3 className="font-semibold mb-2">
            {isTrialing ? "Available After Trial" : "Feature Locked"}
          </h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Simple hook to check feature access without rendering UI
 */
export function useCanAccessFeature(featureKey: FeatureKey): {
  canAccess: boolean;
  isLoading: boolean;
  remaining: number;
} {
  const { data, isLoading } = useFeatureAccess(featureKey);

  return {
    canAccess: data?.canAccess ?? false,
    isLoading,
    remaining: data?.remaining ?? 0,
  };
}
