import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SharedInsights from '@/components/client/SharedInsights';
import PerformanceMetrics from '@/components/client/PerformanceMetrics';
import MonthOverMonthTrends from '@/components/client/MonthOverMonthTrends';
import ReportingPeriods from '@/components/client/ReportingPeriods';
import { supabase } from "@/integrations/supabase/client";
import { versionLabel } from "@/version";
import { MarketingCalculatorModal } from "@/components/MarketingCalculatorModal";

const Dashboard = () => {
  const { user, signOut, isAdmin } = useAuth();
  

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [roiOpen, setRoiOpen] = useState(false);

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
      <header className="frosted-header">
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
            <nav className="flex items-center bg-background/40 backdrop-blur-md border border-border/60 rounded-full p-1 shadow-elegant font-inter gap-1">
              <Link to="/uploads">
                <Button variant="glass" size="sm" className="rounded-full">Files</Button>
              </Link>
              <Link to="/process-vault">
                <Button variant="glass" size="sm" className="rounded-full">Process Vault</Button>
              </Link>
              {(isAdmin || user?.email === 'justin@hfiagencies.com') && (
                <Link to="/admin">
                  <Button variant="glass" size="sm" className="rounded-full">Admin Portal</Button>
                </Link>
              )}
              <Link to="/account">
                <Button variant="glass" size="sm" className="rounded-full">My Account</Button>
              </Link>
              <Button variant="glass" size="sm" className="rounded-full" onClick={() => setRoiOpen(true)}>ROI Forecaster</Button>
            </nav>
            <Button variant="glass" className="rounded-full" onClick={handleSignOut}>Sign Out</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <h1 className="sr-only">Client Dashboard</h1>
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-surface elevate rounded-2xl">
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
          <Card className="glass-surface elevate rounded-2xl">
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
        <MonthOverMonthTrends />
        <ReportingPeriods />
        <div className="mt-8 pt-4 border-t border-border text-xs text-muted-foreground">
          Version: {versionLabel}
        </div>
      </main>
      <MarketingCalculatorModal open={roiOpen} onOpenChange={setRoiOpen} />
    </div>
  );
};

export default Dashboard;
