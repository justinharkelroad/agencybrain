import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Clock } from 'lucide-react';

interface PendingActivationGuardProps {
  children: React.ReactNode;
}

export function PendingActivationGuard({ children }: PendingActivationGuardProps) {
  const { user, membershipTier, loading, signOut } = useAuth();

  // Still loading auth state
  if (loading) {
    return null;
  }

  // If logged in but no tier assigned, show pending screen
  if (user && !membershipTier) {
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
