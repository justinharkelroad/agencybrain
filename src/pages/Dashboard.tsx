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
import { ROIForecastersModal } from "@/components/ROIForecastersModal";
import { TopNav } from "@/components/TopNav";
import EnvironmentStatusBadge from "@/components/EnvironmentStatusBadge";
import { getEnvironmentOverride, type EnvOverride } from "@/lib/environment";

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
  const [envOverride, setEnvOverride] = useState<EnvOverride | null>(getEnvironmentOverride());

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
      <TopNav title="Dashboard" onOpenROI={() => setRoiOpen(true)} />

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
      <ROIForecastersModal open={roiOpen} onOpenChange={setRoiOpen} />
    </div>
  );
};

export default Dashboard;
