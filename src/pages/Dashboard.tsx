import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SharedInsights from '@/components/client/SharedInsights';
import PerformanceMetrics from '@/components/client/PerformanceMetrics';
import MonthOverMonthTrends from '@/components/client/MonthOverMonthTrends';
import ReportingPeriods from '@/components/client/ReportingPeriods';
import RoleplaySessionsCard from '@/components/client/RoleplaySessionsCard';
import { MyCurrentFocus } from '@/components/focus/MyCurrentFocus';
import { supabase } from '@/lib/supabaseClient';
import { versionLabel } from "@/version";
import EnvironmentStatusBadge from "@/components/EnvironmentStatusBadge";
import { getEnvironmentOverride, type EnvOverride } from "@/lib/environment";
import { enableMetrics } from "@/lib/featureFlags";

const Dashboard = () => {
  const { user, signOut, isAdmin } = useAuth();
  

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const [agencyName, setAgencyName] = useState<string | null>(null);
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
      <main className="container mx-auto px-4 py-6 space-y-6 overflow-x-hidden">
        <h1 className="sr-only">Client Dashboard</h1>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Dashboard</p>
            {agencyName && (
              <h2 className="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2">
                <span>{`${agencyName}${/[sS]$/.test(agencyName.trim()) ? "'" : "'s"}`}</span>
                <span role="img" aria-label="brain">🧠</span>
              </h2>
            )}
          </div>
          <Button variant="gradient-glow" asChild className="w-full sm:w-auto min-w-0">
            <Link to="/submit?mode=new">
              <span className="hidden sm:inline">Submit New 1:1 Coaching Call Form</span>
              <span className="sm:hidden">Submit New Form</span>
            </Link>
          </Button>
        </div>
        <PerformanceMetrics />
        <MyCurrentFocus />
        <MonthOverMonthTrends />
        <RoleplaySessionsCard />
        {enableMetrics && (
          <section>
            <Card className="border-border/10 bg-muted/20">
              <CardHeader>
                <CardTitle className="font-medium">Metrics Dashboard</CardTitle>
                <CardDescription className="text-muted-foreground/70">View team performance and analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" asChild>
                  <Link to="/metrics">View Metrics Dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        )}
        <SharedInsights />
        <ReportingPeriods />
        <div className="mt-8 pt-4 border-t border-border text-xs text-muted-foreground">
          Version: {versionLabel}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
