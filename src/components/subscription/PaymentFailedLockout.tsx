import { useState } from "react";
import { AlertTriangle, CreditCard, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

/**
 * Full-screen lockout displayed when subscription payment has failed.
 * User must update their payment method to regain access.
 */
export function PaymentFailedLockout() {
  const [loading, setLoading] = useState(false);

  const handleUpdatePayment = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

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
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={handleUpdatePayment}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
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
