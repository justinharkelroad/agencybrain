import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

interface StartTrialButtonProps {
  className?: string;
  size?: 'default' | 'lg' | 'sm';
  showArrow?: boolean;
  children?: React.ReactNode;
}

/**
 * Button that initiates the free trial signup flow.
 * - If user is logged in and has agency: redirects to Stripe Checkout
 * - If user is logged in without agency: redirects to onboarding
 * - If user is not logged in: redirects to signup page
 */
export function StartTrialButton({
  className,
  size = 'lg',
  showArrow = true,
  children,
}: StartTrialButtonProps) {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    // If not logged in, redirect to signup
    if (!user) {
      window.location.href = '/auth?mode=signup&redirect=checkout';
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, display_name')
        .eq('id', user.id)
        .single();

      // If no agency, redirect to onboarding
      if (!profile?.agency_id) {
        window.location.href = '/onboarding';
        return;
      }

      // Check if already subscribed
      const { data: agency } = await supabase
        .from('agencies')
        .select('name, subscription_status')
        .eq('id', profile.agency_id)
        .single();

      // If already has active subscription, redirect to dashboard
      if (agency?.subscription_status === 'active' || agency?.subscription_status === 'trialing') {
        window.location.href = '/dashboard';
        return;
      }

      // Create checkout session
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agency_id: profile.agency_id,
            email: user.email,
            agency_name: agency?.name,
            user_id: user.id,
            success_url: `${window.location.origin}/dashboard?checkout=success`,
            cancel_url: `${window.location.origin}/?checkout=canceled`,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error('Start trial error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start trial');
      setLoading(false);
    }
  };

  const isLoading = loading || authLoading;

  return (
    <>
      <Button
        size={size}
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          'bg-marketing-amber hover:bg-marketing-amber-light text-white font-semibold rounded-full',
          size === 'lg' && 'px-8 py-6 text-lg',
          'group',
          className
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            {children || 'Start Free Trial'}
            {showArrow && (
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            )}
          </>
        )}
      </Button>
      {error && (
        <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
      )}
    </>
  );
}
