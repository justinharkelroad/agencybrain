import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Clock, PauseCircle } from 'lucide-react';

interface PendingActivationGuardProps {
  children: React.ReactNode;
}

export function PendingActivationGuard({ children }: PendingActivationGuardProps) {
  const { user, membershipTier, loading, signOut } = useAuth();

  // Still loading auth state
  if (loading) {
    return null;
  }

  // Check if account is inactive (suspended)
  const isInactive = membershipTier === 'Inactive';
  
  // Check if account is pending (NULL tier)
  const isPending = user && !membershipTier;

  // If logged in but inactive, show inactive screen
  if (user && isInactive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
        <Card className="max-w-md text-center">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <PauseCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Account Inactive</CardTitle>
            <CardDescription className="text-base">
              Your account is currently inactive. Your data has been preserved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To reactivate your account, please contact us. We'll be happy to help you get back up and running.
            </p>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <a href="mailto:info@standardplaybook.com">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact info@standardplaybook.com
                </a>
              </Button>
              <Button variant="outline" onClick={() => signOut()} className="w-full">
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If logged in but no tier assigned, show pending screen
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="max-w-md text-center">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Account Pending Activation</CardTitle>
            <CardDescription className="text-base">
              Your account has been created and is awaiting activation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please contact us to complete your setup and get access to your membership tier.
            </p>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <a href="mailto:info@standardplaybook.com">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact info@standardplaybook.com
                </a>
              </Button>
              <Button variant="outline" onClick={() => signOut()} className="w-full">
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
