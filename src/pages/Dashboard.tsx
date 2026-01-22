import React, { useEffect, useState } from 'react';
import { normalizeTier, isCallScoringTier } from '@/utils/tierAccess';
import { useAuth } from '@/lib/auth';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SharedInsights from '@/components/client/SharedInsights';
import PerformanceMetrics from '@/components/client/PerformanceMetrics';
import MonthOverMonthTrends from '@/components/client/MonthOverMonthTrends';
import ReportingPeriods from '@/components/client/ReportingPeriods';
import RoleplaySessionsCard from '@/components/client/RoleplaySessionsCard';
import { MyCurrentFocus } from '@/components/focus/MyCurrentFocus';
import { TeamCore4Overview } from '@/components/core4/TeamCore4Overview';
import { Core4Card } from '@/components/core4/Core4Card';
import { supabase } from '@/lib/supabaseClient';
import { versionLabel } from "@/version";
import EnvironmentStatusBadge from "@/components/EnvironmentStatusBadge";
import { getEnvironmentOverride, type EnvOverride } from "@/lib/environment";
import { enableMetrics } from "@/lib/featureFlags";
import { HelpVideoButton } from '@/components/HelpVideoButton';
import { PeriodRefreshProvider } from '@/contexts/PeriodRefreshContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { RenewalSummaryWidget } from '@/components/dashboard/RenewalSummaryWidget';
import { SalesDashboardWidget } from '@/components/sales/SalesDashboardWidget';
import { hasSalesBetaAccess } from '@/lib/salesBetaAccess';
import { AddQuoteModal } from '@/components/lqs/AddQuoteModal';
import { Plus } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut, isAdmin, membershipTier, isAgencyOwner, isKeyEmployee, hasTierAccess } = useAuth();
  const {
    canViewPerformanceMetrics,
    canViewMonthOverMonthTrends,
    canViewSharedInsights,
    canViewReportingPeriods,
    canSubmitCoachingCall,
    canSubmitMetrics,
    canViewFocusTargets,
    canViewRoleplaySessions,
    loading: permissionsLoading,
  } = useUserPermissions();

  // ALL useState hooks MUST be declared before any conditional returns (React Rules of Hooks)
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [envOverride, setEnvOverride] = useState<EnvOverride | null>(getEnvironmentOverride());
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [leadSources, setLeadSources] = useState<Array<{ id: string; name: string; is_self_generated: boolean; bucket?: { id: string; name: string } | null }>>([]);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);

  // ALL useEffect hooks MUST also be declared before any conditional returns (React Rules of Hooks)

  // Redirect Call Scoring tier users to /call-scoring
  useEffect(() => {
    if (isCallScoringTier(membershipTier)) {
      navigate('/call-scoring', { replace: true });
    }
  }, [membershipTier, navigate]);

  // Fetch agency name - moved BEFORE early returns to fix hooks order
  useEffect(() => {
    const fetchAgencyName = async () => {
      if (!user) return;
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && profile?.agency_id) {
        setAgencyId(profile.agency_id);
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
        setAgencyId(null);
      }
    };

    fetchAgencyName();
  }, [user?.id]);

  // Fetch lead sources and team members for the quote modal - moved BEFORE early returns
  useEffect(() => {
    async function fetchModalData() {
      if (!agencyId) return;

      const [sourcesRes, membersRes] = await Promise.all([
        supabase
          .from('lead_sources')
          .select('id, name, is_self_generated, bucket:marketing_buckets(id, name)')
          .eq('agency_id', agencyId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('team_members')
          .select('id, name')
          .eq('agency_id', agencyId)
          .eq('status', 'active')
          .order('name')
      ]);

      if (sourcesRes.data) {
        setLeadSources(sourcesRes.data.map(s => ({
          ...s,
          is_self_generated: s.is_self_generated ?? false,
          bucket: s.bucket ?? null
        })));
      }
      if (membersRes.data) setTeamMembers(membersRes.data);
    }

    fetchModalData();
  }, [agencyId]);

  // Early returns AFTER all hooks are declared
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Don't render dashboard for Call Scoring tier users (redirect is happening)
  if (isCallScoringTier(membershipTier)) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-6 space-y-6 overflow-x-hidden">
        <h1 className="sr-only">Client Dashboard</h1>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Dashboard</p>
              <HelpVideoButton videoKey="dashboard-overview" />
            </div>
            {agencyName && (
              <h2 className="text-2xl font-semibold leading-none tracking-tight flex items-center gap-2">
                <span>{`${agencyName}${/[sS]$/.test(agencyName.trim()) ? "'" : "'s"}`}</span>
                <span role="img" aria-label="brain">🧠</span>
              </h2>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowQuoteModal(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Quoted Household</span>
              <span className="sm:hidden">Add Quote</span>
            </Button>
            {canSubmitCoachingCall && normalizeTier(membershipTier) === 'one_on_one' && (
              <Button variant="flat" asChild className="w-full sm:w-auto min-w-0">
                <Link to="/submit?mode=new">
                  <span className="hidden sm:inline">Submit New 1:1 Coaching Call Form</span>
                  <span className="sm:hidden">Submit New Form</span>
                </Link>
              </Button>
            )}
            {canSubmitMetrics && normalizeTier(membershipTier) === 'boardroom' && (
              <Button variant="flat" asChild className="w-full sm:w-auto min-w-0">
                <Link to="/submit?mode=new&tier=boardroom">
                  <span className="hidden sm:inline">Submit Dashboard Metrics</span>
                  <span className="sm:hidden">Submit Metrics</span>
              </Link>
              </Button>
            )}
          </div>
        </div>
        <PeriodRefreshProvider>
          {/* 0. Sales Dashboard Widget - admin and beta agencies */}
          {(isAdmin || hasSalesBetaAccess(agencyId)) && <SalesDashboardWidget agencyId={agencyId} />}
          
          {/* 1. Core 4 + Flow */}
          <Core4Card />
          {(isAgencyOwner || isKeyEmployee) && <TeamCore4Overview />}
          
          {/* 2. Performance Metrics */}
          {canViewPerformanceMetrics && <PerformanceMetrics />}
          
          {/* 3. Month Over Month Trends */}
          {canViewMonthOverMonthTrends && <MonthOverMonthTrends />}
          
          {/* 4. Focus Targets */}
          {canViewFocusTargets && <MyCurrentFocus />}
          
          {/* 5. Renewal Summary Widget */}
          <RenewalSummaryWidget agencyId={agencyId} />
          
          {/* 6. Roleplay Sessions */}
          {canViewRoleplaySessions && <RoleplaySessionsCard />}
          
          {/* 6. Metrics Dashboard */}
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
          
          {/* 7. Shared Insights */}
          {canViewSharedInsights && <SharedInsights />}
          
          {/* 8. Reporting Periods */}
          {canViewReportingPeriods && <ReportingPeriods />}
        </PeriodRefreshProvider>
        <div className="mt-8 pt-4 border-t border-border text-xs text-muted-foreground">
          Version: {versionLabel}
        </div>
      </main>

      {/* Add Quoted Household Modal */}
      {agencyId && (
        <AddQuoteModal
          open={showQuoteModal}
          onOpenChange={setShowQuoteModal}
          agencyId={agencyId}
          leadSources={leadSources}
          teamMembers={teamMembers}
          currentTeamMemberId={null}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
};

export default Dashboard;
