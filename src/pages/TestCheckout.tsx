/**
 * Test page for Stripe checkout flow
 * Access at /test/checkout
 *
 * This is a hidden test page - not linked from anywhere public
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, CheckCircle, AlertCircle } from "lucide-react";

export default function TestCheckout() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Fetch agency info for the logged-in user
  useEffect(() => {
    async function fetchAgency() {
      if (!user?.id) {
        setLoadingProfile(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (profile?.agency_id) {
        setAgencyId(profile.agency_id);

        // Get agency name
        const { data: agency } = await supabase
          .from('agencies')
          .select('name')
          .eq('id', profile.agency_id)
          .single();

        setAgencyName(agency?.name || null);
      }
      setLoadingProfile(false);
    }

    fetchAgency();
  }, [user?.id]);

  const handleStartTrial = async () => {
    if (!user || !agencyId) {
      setError("You must be logged in with an agency to test checkout");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          agency_id: agencyId,
          email: user.email,
          agency_name: agencyName || 'Test Agency',
          user_id: user.id,
          success_url: `${window.location.origin}/test/checkout?success=true`,
          cancel_url: `${window.location.origin}/test/checkout?canceled=true`,
        }
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Redirect to Stripe Checkout
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err.message || "Failed to create checkout session");
    } finally {
      setLoading(false);
    }
  };

  const searchParams = new URLSearchParams(window.location.search);
  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Test Checkout</CardTitle>
          <CardDescription>
            This is a test page for the Stripe subscription flow.
            <br />
            <span className="text-xs text-muted-foreground mt-2 block">
              URL: /test/checkout
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-600 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Checkout successful!</p>
                <p className="text-sm opacity-80">Your subscription has been created.</p>
              </div>
            </div>
          )}

          {isCanceled && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Checkout canceled</p>
                <p className="text-sm opacity-80">You can try again when ready.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-600 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Error</p>
                <p className="text-sm opacity-80">{error}</p>
              </div>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <p><strong>Plan:</strong> AgencyBrain - $299/month</p>
            <p><strong>Trial:</strong> 7 days free</p>
            <p><strong>Includes:</strong> 20 call scores/month</p>
          </div>

          {user ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p>Logged in as: {user.email}</p>
                <p>Agency: {loadingProfile ? 'Loading...' : (agencyName || 'None')}</p>
                <p className="text-xs opacity-60">ID: {agencyId || 'None'}</p>
              </div>

              <Button
                onClick={handleStartTrial}
                disabled={loading || loadingProfile || !agencyId}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating checkout...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Start 7-Day Free Trial
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <p>Please log in first to test checkout.</p>
              <Button variant="outline" className="mt-3" asChild>
                <a href="/auth">Log In</a>
              </Button>
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center pt-4 border-t">
            <p>Use Stripe test card: <code className="bg-muted px-1 rounded">4242 4242 4242 4242</code></p>
            <p>Any future date, any CVC</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
