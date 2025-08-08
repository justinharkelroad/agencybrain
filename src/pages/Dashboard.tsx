import React from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Upload } from 'lucide-react';
import SharedInsights from '@/components/client/SharedInsights';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img
              src="/lovable-uploads/a2a07245-ffb4-4abf-acb8-03c996ab79a1.png"
              alt="Standard Analytics logo"
              className="h-8 mr-3"
              loading="lazy"
            />
            <span className="text-lg font-medium text-muted-foreground ml-2">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <Link to="/uploads">
                <Button variant="ghost" size="sm">Uploads</Button>
              </Link>
              <Button variant="ghost" size="sm">Insights</Button>
            </nav>
            <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <h1 className="sr-only">Client Dashboard</h1>
        {/* Shared Insights */}
        <SharedInsights />
        <section className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Jump back into your workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" asChild>
                <Link to="/submit">
                  <Play className="w-4 h-4 mr-2" />
                  Open Meeting Form
                </Link>
              </Button>
              <Button className="w-full" asChild variant="secondary">
                <Link to="/uploads">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload new files
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

      </main>
    </div>
  );
};

export default Dashboard;
