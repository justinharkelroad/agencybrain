import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, FileText, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AgencyBrainBadge } from '@/components/AgencyBrainBadge';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-12 animate-fade-in">
        <AgencyBrainBadge size="lg" />

        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <Link to="/auth" className="w-full">
            <Button size="lg" className="w-full text-lg py-6">
              Sign In
            </Button>
          </Link>
          <Link to="/auth" className="w-full">
            <Button size="lg" variant="outline" className="w-full text-lg py-6">
              Create Account
            </Button>
          </Link>
          <a
            href="https://standardplaybook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-3/4 mt-2"
          >
            <Button variant="ghost" className="w-full text-sm py-4 text-muted-foreground">
              How do I access AgencyBrain?
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Index;
