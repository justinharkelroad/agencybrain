import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2,
  Mail,
  KeyRound,
  Loader2,
  Sparkles,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SetupResult {
  id: string;
  stripe_session_id: string;
  agency_id: string;
  user_id: string;
  email: string;
  owner_setup_url: string;
  purchase_id: string;
  quantity: number;
  start_date: string;
}

export default function ChallengeSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [setupData, setSetupData] = useState<SetupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [copied, setCopied] = useState(false);

  // Poll challenge_setup_results for the setup data
  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const { data, error } = await supabase
        .from('challenge_setup_results')
        .select('*')
        .eq('stripe_session_id', sessionId)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        setSetupData(data as SetupResult);
        setLoading(false);
        return;
      }

      // Keep polling for up to 60 seconds (20 attempts at 3s intervals)
      setPollCount(prev => {
        const next = prev + 1;
        if (next >= 20) {
          setLoading(false);
          return next;
        }
        timeoutId = setTimeout(poll, 3000);
        return next;
      });
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [sessionId]);

  const handleCopyUrl = async () => {
    if (!setupData?.owner_setup_url) return;
    await navigator.clipboard.writeText(setupData.owner_setup_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedStartDate = setupData?.start_date
    ? new Date(setupData.start_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  // Loading state while webhook processes
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800/50 border-slate-700">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto">
              <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Setting Up Your Account...</h1>
              <p className="text-slate-400 mt-2">
                We're creating your agency and preparing your challenge. This usually takes just a few seconds.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Setup data loaded successfully
  if (setupData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full bg-slate-800/50 border-slate-700">
          <CardContent className="p-8 space-y-6">
            {/* Success Header */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-white">Purchase Complete!</h1>
              <p className="text-slate-400 mt-2">
                {setupData.quantity} seat{setupData.quantity > 1 ? 's' : ''} purchased
                {formattedStartDate && <> &middot; Starts {formattedStartDate}</>}
              </p>
            </div>

            {/* Primary CTA: Set Your Password */}
            {setupData.owner_setup_url && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-green-500" />
                  <h3 className="font-semibold text-white">Set Your Password</h3>
                </div>
                <p className="text-sm text-slate-300">
                  Click below to set your owner portal password. You'll use this to log in, manage your team, and track progress.
                </p>
                <div className="flex gap-2">
                  <Button
                    asChild
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold"
                  >
                    <a href={setupData.owner_setup_url} target="_blank" rel="noopener noreferrer">
                      <KeyRound className="h-4 w-4 mr-2" />
                      Set Your Password
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-slate-600 text-slate-300 hover:text-white"
                    onClick={handleCopyUrl}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Email Deliverability Warning */}
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-200">Email may be delayed</p>
                <p className="text-xs text-amber-200/70 mt-1">
                  Your password setup link was also emailed, but corporate email filters (especially Allstate) may block or delay delivery. Use the button above for immediate access.
                </p>
              </div>
            </div>

            {/* What Happens Next */}
            <div className="space-y-3">
              <h3 className="font-semibold text-white text-sm">What Happens Next:</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                  <span>Set your password using the button above</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  <span>Log in at the owner portal to manage your challenge</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  <span>Add your team members and assign challenge seats</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0">4</span>
                  <span>Challenge starts the next Monday — track your team's progress!</span>
                </li>
              </ul>
            </div>

            {/* Secondary CTA */}
            <div className="pt-2 space-y-3">
              <Button asChild variant="outline" className="w-full border-slate-600 text-slate-300 hover:text-white">
                <Link to="/auth">
                  Already set your password? Log in here
                </Link>
              </Button>
            </div>

            {/* Decorative */}
            <div className="flex items-center justify-center gap-2 text-slate-500 pt-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs">Get ready to transform your results</span>
              <Sparkles className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback: no session_id or polling timed out
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white">Purchase Complete!</h1>
            <p className="text-muted-foreground mt-2">
              Thank you for purchasing The 6-Week Challenge
            </p>
          </div>

          <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-orange-500 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Check Your Email</p>
                <p className="text-xs text-slate-400">
                  We've sent your setup instructions to the email address you provided during checkout.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 space-y-3">
            <Button asChild className="w-full bg-orange-500 hover:bg-orange-600">
              <Link to="/auth">
                Go to Login
              </Link>
            </Button>
            <p className="text-xs text-slate-500">
              Didn't receive your email? Check your spam folder or contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
