import React, { useEffect, useState } from 'react';
import { normalizeTier, isCallScoringTier } from '@/utils/tierAccess';
import { useAuth } from '@/lib/auth';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from '@tanstack/react-query';
// SharedInsights — hidden (being phased out)
import PerformanceMetrics from '@/components/client/PerformanceMetrics';
import MonthOverMonthTrends from '@/components/client/MonthOverMonthTrends';
// ReportingPeriods — hidden (being phased out)
import RoleplaySessionsCard from '@/components/client/RoleplaySessionsCard';
import { MyCurrentFocus } from '@/components/focus/MyCurrentFocus';
import { TeamCore4Overview } from '@/components/core4/TeamCore4Overview';
import { Core4Card } from '@/components/core4/Core4Card';
import { supabase } from '@/lib/supabaseClient';
import { versionLabel } from "@/version";
import EnvironmentStatusBadge from "@/components/EnvironmentStatusBadge";
import { getEnvironmentOverride, type EnvOverride } from "@/lib/environment";
// enableMetrics — hidden (being phased out)
import { HelpButton } from '@/components/HelpButton';
import { PeriodRefreshProvider } from '@/contexts/PeriodRefreshContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { RenewalSummaryWidget } from '@/components/dashboard/RenewalSummaryWidget';
import { SalesDashboardWidget } from '@/components/sales/SalesDashboardWidget';
import { hasSalesAccess } from '@/lib/salesBetaAccess';
import { AddQuoteModal } from '@/components/lqs/AddQuoteModal';
import { useLqsObjections } from '@/hooks/useLqsObjections';
import { AgencyMetricRings } from '@/components/dashboard/AgencyMetricRings';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Plus } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut, isAdmin, membershipTier, isAgencyOwner, isKeyEmployee, keyEmployeeAgencyId, hasTierAccess } = useAuth();
  const {
    canViewPerformanceMetrics,
    canViewMonthOverMonthTrends,
    canSubmitCoachingCall,
    canSubmitMetrics,
    canViewFocusTargets,
    canViewRoleplaySessions,
    loading: permissionsLoading,
  } = useUserPermissions();

  // ALL useState hooks MUST be declared before any conditional returns (React Rules of Hooks)
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencySlug, setAgencySlug] = useState<string | null>(null);
  const [envOverride, setEnvOverride] = useState<EnvOverride | null>(getEnvironmentOverride());
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [leadSources, setLeadSources] = useState<Array<{ id: string; name: string; is_self_generated: boolean; bucket?: { id: string; name: string } | null }>>([]);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [dashboardCallMetricsEnabled, setDashboardCallMetricsEnabled] = useState(false);

  // Fetch objections for quote modal — must scope by agencyId so admins don't see all agencies
  const { data: objections = [] } = useLqsObjections(agencyId);

  // ALL useEffect hooks MUST also be declared before any conditional returns (React Rules of Hooks)

  // Redirect Call Scoring tier users to /call-scoring
  useEffect(() => {
    if (isCallScoringTier(membershipTier)) {
      navigate('/call-scoring', { replace: true });
    }
  }, [membershipTier, navigate]);

  // Fetch agency name - moved BEFORE early returns to fix hooks order
  // Key employees resolve agency via key_employees table, not profiles.agency_id
  useEffect(() => {
    let ignore = false;

    const fetchAgencyName = async () => {
      if (!user) return;

      // Resolve agency_id: try profiles first, then key_employees fallback
      let resolvedAgencyId: string | null = null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .maybeSingle();

      if (ignore) return;

      if (!error && profile?.agency_id) {
        resolvedAgencyId = profile.agency_id;
      } else if (keyEmployeeAgencyId) {
        resolvedAgencyId = keyEmployeeAgencyId;
      }

      if (resolvedAgencyId) {
        setAgencyId(resolvedAgencyId);
        const { data: agency, error: agencyError } = await supabase
          .from('agencies')
          .select('*')
          .eq('id', resolvedAgencyId)
          .maybeSingle();
        if (ignore) return;
        if (!agencyError && agency) {
          setAgencyName(agency.name || null);
          setAgencySlug(agency.slug || null);
          setDashboardCallMetricsEnabled((agency as any).dashboard_call_metrics_enabled ?? false);
        }
      } else {
        setAgencyName(null);
        setAgencyId(null);
        setAgencySlug(null);
      }
    };

    fetchAgencyName();

    return () => { ignore = true; };
  }, [user?.id, keyEmployeeAgencyId]);

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
              <HelpButton videoKey="dashboard-overview" />
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
          {dashboardCallMetricsEnabled ? (
            <>
              {/* Agency-wide metric rings */}
              {agencySlug && agencyId && (
                <AgencyMetricRings
                  agencySlug={agencySlug}
                  agencyId={agencyId}
                  canFilterByMember={isAdmin || isAgencyOwner || isKeyEmployee}
                />
              )}

              <Accordion type="multiple" defaultValue={["sales-performance"]}>
                {/* 0. Sales Dashboard Widget */}
                {(isAdmin || hasSalesAccess(agencyId)) && (
                  <AccordionItem value="sales-performance">
                    <AccordionTrigger className="text-lg font-semibold">Agency Sales Performance</AccordionTrigger>
                    <AccordionContent>
                      <SalesDashboardWidget agencyId={agencyId} />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* 1. Core 4 + Flow */}
                <AccordionItem value="core4">
                  <AccordionTrigger className="text-lg font-semibold">Core 4 + Flow</AccordionTrigger>
                  <AccordionContent className="space-y-6">
                    <Core4Card />
                    {(isAgencyOwner || isKeyEmployee) && <TeamCore4Overview />}
                  </AccordionContent>
                </AccordionItem>

                {/* 2. Performance Metrics + Month Over Month Trends (combined) */}
                {(canViewPerformanceMetrics || canViewMonthOverMonthTrends) && (
                  <AccordionItem value="performance-metrics">
                    <AccordionTrigger className="text-lg font-semibold">Performance Metrics</AccordionTrigger>
                    <AccordionContent className="space-y-6">
                      {canViewPerformanceMetrics && <PerformanceMetrics />}
                      {canViewMonthOverMonthTrends && <MonthOverMonthTrends />}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* 4. Focus Targets */}
                {canViewFocusTargets && (
                  <AccordionItem value="focus">
                    <AccordionTrigger className="text-lg font-semibold">Focus Targets</AccordionTrigger>
                    <AccordionContent>
                      <MyCurrentFocus />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* 5. Renewal Summary */}
                <AccordionItem value="renewals">
                  <AccordionTrigger className="text-lg font-semibold">Renewal Summary</AccordionTrigger>
                  <AccordionContent>
                    <RenewalSummaryWidget agencyId={agencyId} />
                  </AccordionContent>
                </AccordionItem>

                {/* 6. Roleplay Sessions */}
                {canViewRoleplaySessions && (
                  <AccordionItem value="roleplay">
                    <AccordionTrigger className="text-lg font-semibold">Roleplay Sessions</AccordionTrigger>
                    <AccordionContent>
                      <RoleplaySessionsCard />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Metrics Dashboard, Shared Insights, Reporting Periods — hidden (being phased out) */}
              </Accordion>
            </>
          ) : (
            <>
              {/* Original flat layout for non-redesign agencies */}
              {(isAdmin || hasSalesAccess(agencyId)) && <SalesDashboardWidget agencyId={agencyId} />}
              <Core4Card />
              {(isAgencyOwner || isKeyEmployee) && <TeamCore4Overview />}
              {canViewPerformanceMetrics && <PerformanceMetrics />}
              {canViewMonthOverMonthTrends && <MonthOverMonthTrends />}
              {canViewFocusTargets && <MyCurrentFocus />}
              <RenewalSummaryWidget agencyId={agencyId} />
              {canViewRoleplaySessions && <RoleplaySessionsCard />}
              {/* Metrics Dashboard, Shared Insights, Reporting Periods — hidden (being phased out) */}
            </>
          )}
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
          objections={objections}
          currentTeamMemberId={null}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['dashboard-daily'] });
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
