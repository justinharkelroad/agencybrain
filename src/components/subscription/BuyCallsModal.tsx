import { useState } from "react";
import { Check, Loader2, Phone, Sparkles } from "lucide-react";
import { useCallPacks, usePurchaseCallPack, formatPrice } from "@/hooks/useCallBalance";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BuyCallsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyCallsModal({ open, onOpenChange }: BuyCallsModalProps) {
  const { data: callPacks, isLoading: packsLoading } = useCallPacks();
  const { data: subscription } = useSubscription();
  const purchaseMutation = usePurchaseCallPack();
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Require active subscription to buy call packs
  const canPurchase = subscription?.isPaid;

  const handlePurchase = async (packId: string) => {
    setSelectedPack(packId);
    setError(null);

    try {
      const result = await purchaseMutation.mutateAsync({
        callPackId: packId,
      });

      // Redirect to Stripe Checkout
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error("Purchase error:", err);
      setError(err instanceof Error ? err.message : "Failed to start purchase");
      setSelectedPack(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-sky-500" />
            Buy Call Scoring Packs
          </DialogTitle>
          <DialogDescription>
            Add more call scores to your account. Purchased calls never expire.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Subscription required warning */}
          {!canPurchase && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-sm">
              <p className="font-medium">Active subscription required</p>
              <p className="text-amber-500/80 mt-1">
                {subscription?.isTrialing
                  ? "Upgrade from your trial to purchase additional call packs."
                  : "Subscribe to AgencyBrain to purchase call packs."}
              </p>
            </div>
          )}

          {/* Call Packs */}
          {packsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-3">
              {callPacks?.map((pack) => {
                const isSelected = selectedPack === pack.id;
                const isPurchasing = purchaseMutation.isPending && isSelected;
                const pricePerCall = pack.price_cents / pack.call_count;

                return (
                  <div
                    key={pack.id}
                    className={cn(
                      "relative p-4 rounded-lg border transition-all",
                      canPurchase
                        ? "hover:border-sky-500/50 cursor-pointer"
                        : "opacity-60 cursor-not-allowed",
                      isSelected && "border-sky-500 bg-sky-500/5"
                    )}
                    onClick={() => canPurchase && !isPurchasing && handlePurchase(pack.id)}
                  >
                    {/* Best Value Badge */}
                    {pack.call_count === 50 && (
                      <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-medium">
                        Best Value
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-lg">{pack.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatPrice(pricePerCall)} per call
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {formatPrice(pack.price_cents)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {pack.call_count} calls
                        </div>
                      </div>
                    </div>

                    {/* Loading overlay */}
                    {isPurchasing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          {/* Features */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">All packs include:</p>
            <ul className="space-y-1">
              {[
                "AI-powered call analysis",
                "Detailed feedback & scoring",
                "Never expire - use anytime",
                "Track usage in dashboard",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Upgrade CTA for trial users */}
          {subscription?.isTrialing && (
            <div className="pt-4 border-t text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Upgrade to get 20 calls/month included
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  onOpenChange(false);
                  window.location.href = "/upgrade";
                }}
              >
                <Sparkles className="w-4 h-4" />
                Upgrade to Full Access
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
