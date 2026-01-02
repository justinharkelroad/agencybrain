import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { getStaffHomePath } from '@/utils/tierAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AgencyBrainBadge } from '@/components/AgencyBrainBadge';
import { supabase } from '@/integrations/supabase/client';

export default function StaffLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, user, setImpersonationSession } = useStaffAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [agencySlug, setAgencySlug] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [impersonationLoading, setImpersonationLoading] = useState(false);

  // Handle impersonation token from URL
  useEffect(() => {
    const impersonateToken = searchParams.get('impersonate_token');
    if (impersonateToken) {
      setImpersonationLoading(true);
      
      // Verify the impersonation session token
      supabase.functions.invoke('staff_verify_session', {
        body: { session_token: impersonateToken }
      }).then(({ data, error }) => {
        if (error || !data?.valid) {
          setError('Impersonation session invalid or expired');
          setImpersonationLoading(false);
          // Clear the URL params
          window.history.replaceState({}, '', '/staff/login');
          return;
        }

        // Set the impersonation session
        setImpersonationSession(impersonateToken, {
          ...data.user,
          is_impersonation: true,
        });
        
        // Clear URL params and redirect to staff home
        window.history.replaceState({}, '', '/staff/login');
        navigate(getStaffHomePath(data.user?.agency_membership_tier));
      });
    }
  }, [searchParams, setImpersonationSession, navigate]);

  // Redirect if already authenticated - tier-aware home path
  if (isAuthenticated && !impersonationLoading) {
    navigate(getStaffHomePath(user?.agency_membership_tier));
    return null;
  }

  // Show loading while processing impersonation
  if (impersonationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Setting up impersonation session...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password, agencySlug || undefined);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      // Redirect based on tier - tier-aware home path
      navigate(getStaffHomePath(result.user?.agency_membership_tier));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <AgencyBrainBadge size="lg" />
          </div>
          
          <CardDescription className="text-center">
            Sign in with your staff credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agencySlug">
                Agency Code <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="agencySlug"
                type="text"
                placeholder="Enter agency code if required"
                value={agencySlug}
                onChange={(e) => setAgencySlug(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="text-center text-sm">
              <Link to="/staff/forgot-password" className="text-muted-foreground hover:text-primary transition-colors">
                Forgot your password?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
