import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2,
  Mail,
  LogIn,
  Sparkles,
} from 'lucide-react';

export default function ChallengeSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-slate-800/50 border-slate-700">
        <CardContent className="p-8 text-center space-y-6">
          {/* Success Icon */}
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-white">Purchase Complete!</h1>
            <p className="text-slate-400 mt-2">
              Thank you for purchasing The 6-Week Challenge
            </p>
          </div>

          {/* Info Card */}
          <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-orange-500 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Check Your Email</p>
                <p className="text-xs text-slate-400">
                  We've sent your login credentials to the email address you provided during checkout.
                </p>
              </div>
            </div>
          </div>

          {/* What's Next */}
          <div className="space-y-3 text-left">
            <h3 className="font-semibold text-white text-sm">What Happens Next:</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-orange-500 font-bold">1.</span>
                <span>Check your email for login credentials</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 font-bold">2.</span>
                <span>Log in to the Staff Portal using your credentials</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 font-bold">3.</span>
                <span>Your challenge starts the next Monday after purchase</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 font-bold">4.</span>
                <span>Complete daily lessons and track your Core 4 habits</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="pt-4 space-y-3">
            <Button asChild className="w-full bg-orange-500 hover:bg-orange-600">
              <Link to="/staff/login">
                <LogIn className="h-4 w-4 mr-2" />
                Go to Staff Login
              </Link>
            </Button>

            <p className="text-xs text-slate-500">
              Didn't receive your email? Check your spam folder or contact support.
            </p>
          </div>

          {/* Decorative Element */}
          <div className="flex items-center justify-center gap-2 text-slate-500 pt-4">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs">Get ready to transform your results</span>
            <Sparkles className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
