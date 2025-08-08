import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SharedInsights from '@/components/client/SharedInsights';
import PerformanceMetrics from '@/components/client/PerformanceMetrics';
import ReportingPeriods from '@/components/client/ReportingPeriods';
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const { user, signOut, isAdmin } = useAuth();
  

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const [agencyName, setAgencyName] = useState<string | null>(null);

  const fetchAgencyName = async () => {
    if (!user) return;
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .maybeSingle();
    if (!error && profile?.agency_id) {
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('name')
        .eq('id', profile.agency_id)
        .maybeSingle();
      if (!agencyError) {
        setAgencyName(agency?.name || null);
      }
    } else {
      setAgencyName(null);
    }
  };

  useEffect(() => {
    fetchAgencyName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img
              src="/lovable-uploads/58ab6d02-1a05-474c-b0c9-58e420b4a692.png"
              alt="Standard Analytics logo"
              className="h-8 mr-3"
              loading="lazy"
            />
            <span className="text-lg font-medium text-muted-foreground ml-2">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <Link to="/uploads">
                <Button variant="secondary" size="sm">Files</Button>
              </Link>
              {(isAdmin || user?.email === 'justin@hfiagencies.com') && (
                <Link to="/admin">
                  <Button variant="secondary" size="sm">Admin Portal</Button>
                </Link>
              )}
              <Link to="/account">
                <Button variant="secondary" size="sm">My Account</Button>
              </Link>
            </nav>
            <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <h1 className="sr-only">Client Dashboard</h1>
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Submit New Data for Coaching Call</CardTitle>
              <CardDescription>Start a new submission</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" asChild>
                <Link to="/submit?mode=new">Submit New Data for Coaching Call</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Agency</CardTitle>
              <CardDescription>Your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-medium">{agencyName ?? 'N/A'}</div>
            </CardContent>
          </Card>
        </section>
        <SharedInsights />
        <PerformanceMetrics />
        <ReportingPeriods />

      </main>
    </div>
  );
};

export default Dashboard;
