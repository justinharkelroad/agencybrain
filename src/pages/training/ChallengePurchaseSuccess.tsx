import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Users,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface PurchaseDetails {
  quantity: number;
  total_price_cents: number;
  purchased_at: string;
}

export default function ChallengePurchaseSuccess() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [purchase, setPurchase] = useState<PurchaseDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyWithStripe = useCallback(async () => {
    if (!sessionId) return false;
    
    setVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Please log in to verify your purchase');
        return false;
      }

      const { data, error: fnError } = await supabase.functions.invoke('challenge-verify-session', {
        body: { session_id: sessionId },
      });

      if (fnError) {
        console.error('Verification error:', fnError);
        return false;
      }

      if (data?.verified && data?.purchase) {
        setPurchase({
          quantity: data.purchase.quantity,
          total_price_cents: data.purchase.total_price_cents,
          purchased_at: data.purchase.purchased_at,
        });
        setError(null);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Error verifying with Stripe:', err);
      return false;
    } finally {
      setVerifying(false);
    }
  }, [sessionId]);

  const checkPurchase = useCallback(async () => {
    try {
      // Poll for purchase completion (webhook might take a moment)
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const { data, error: fetchError } = await supabase
          .from('challenge_purchases')
          .select('quantity, total_price_cents, purchased_at, status')
          .eq('stripe_checkout_session_id', sessionId)
          .single();

        if (fetchError) {
          console.error('Error fetching purchase:', fetchError);
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        if (data?.status === 'completed') {
          setPurchase({
            quantity: data.quantity,
            total_price_cents: data.total_price_cents,
            purchased_at: data.purchased_at,
          });
          setLoading(false);
          return;
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Polling timed out - try fallback verification
      console.log('Polling timed out, attempting Stripe verification...');
      const verified = await verifyWithStripe();
      
      if (!verified) {
        setError('Payment is being processed. Click "Verify Payment" to check status.');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to verify purchase. Click "Verify Payment" to retry.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, verifyWithStripe]);

  useEffect(() => {
    if (user?.id && sessionId) {
      checkPurchase();
    } else if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
    }
  }, [user?.id, sessionId, checkPurchase]);

  const handleManualVerify = async () => {
    const verified = await verifyWithStripe();
    if (!verified) {
      setError('Payment still processing. Please try again in a moment.');
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verifying your purchase...</p>
        </div>
      </div>
    );
  }

  if (error && !purchase) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="mt-4 text-lg font-semibold">Processing Payment</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <div className="mt-6 space-y-3">
              <Button 
                onClick={handleManualVerify} 
                disabled={verifying}
                className="w-full"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Verify Payment
                  </>
                )}
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/training/challenge">Return to Challenge</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6">
      <Card className="overflow-hidden">
        {/* Success Header */}
        <div
          className="p-6 text-center"
          style={{
            background: 'linear-gradient(135deg, #1e283a 0%, #020817 100%)',
          }}
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground dark:text-white">Purchase Complete!</h1>
          <p className="mt-2 text-muted-foreground">
            Your challenge seats are ready to assign
          </p>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Purchase Summary */}
          {purchase && (
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Seats purchased</span>
                <span className="font-medium">
                  {purchase.quantity} seat{purchase.quantity > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Total paid</span>
                <span className="font-medium">
                  {formatPrice(purchase.total_price_cents)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {new Date(purchase.purchased_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="space-y-4">
            <h3 className="font-semibold">Next Steps</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <p className="text-sm text-muted-foreground">
                  Assign your purchased seats to staff members
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <p className="text-sm text-muted-foreground">
                  Choose a Monday start date for each staff member
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <p className="text-sm text-muted-foreground">
                  Staff will receive daily email reminders with their lessons
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button className="w-full" asChild>
              <Link to="/training/challenge/assign">
                <Users className="h-4 w-4 mr-2" />
                Assign Staff Members
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/training/challenge">Return to Challenge</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
