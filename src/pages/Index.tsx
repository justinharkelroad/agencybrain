import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, FileText, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">The Standard App</h1>
          <Link to="/auth">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold mb-6 text-foreground">
            Insurance Agency Performance Reporting
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Streamline your agency's performance tracking with structured 30-day reports, 
            AI-powered analysis, and comprehensive coaching tools.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <Card>
              <CardHeader>
                <FileText className="w-12 h-12 mx-auto mb-4 text-primary" />
                <CardTitle>Structured Reporting</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Comprehensive forms covering sales, marketing, operations, retention, 
                  cash flow, and qualitative metrics.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-primary" />
                <CardTitle>AI Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  GPT-powered insights analyze your data and files to provide 
                  actionable recommendations and performance insights.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-primary" />
                <CardTitle>Coach Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Dedicated coaching interface with client management, 
                  analysis tools, and automated PDF report generation.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Link to="/auth">
              <Button size="lg" className="text-lg px-8 py-4">
                Start Your Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t bg-muted/30 py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            © 2024 The Standard App. Built for insurance agencies.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
