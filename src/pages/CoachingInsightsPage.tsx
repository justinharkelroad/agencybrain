import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Sparkles, Loader2, PartyPopper } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useAgencyProfile } from '@/hooks/useAgencyProfile';
import { useCoachingInsights } from '@/hooks/useCoachingInsights';
import { InsightsSummaryBar } from '@/components/coaching/InsightsSummaryBar';
import { TeamMemberInsightCard } from '@/components/coaching/TeamMemberInsightCard';
import { HelpButton } from '@/components/HelpButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InsightSeverity } from '@/types/coaching';

// Beta allowlist — only these agencies can access Coaching Insights
const COACHING_INSIGHTS_AGENCY_IDS = new Set([
  '16889dfb-81b2-4211-88c2-847e6b2c2cd0', // Test agency 1
  '979e8713-c266-4b23-96a9-fabd34f1fc9e', // Harkelroad Family Insurance
]);

type RoleFilter = 'All' | 'Sales' | 'Service';
type SeverityFilter = 'all' | InsightSeverity;

export default function CoachingInsightsPage() {
  const { user } = useAuth();
  const { data: agencyProfile, isLoading: profileLoading } = useAgencyProfile(user?.id, 'Manager');
  const agencyId = agencyProfile?.agencyId ?? null;

  const isAllowed = !agencyId || COACHING_INSIGHTS_AGENCY_IDS.has(agencyId);

  const { data, isLoading: insightsLoading, error } = useCoachingInsights(isAllowed ? agencyId : null);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  const isLoading = profileLoading || insightsLoading;

  // Gate: redirect non-allowed agencies once profile is loaded
  if (!profileLoading && agencyId && !isAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  // Apply filters
  const filteredInsights = data?.teamMemberInsights.filter((member) => {
    if (roleFilter !== 'All' && member.role !== roleFilter) return false;
    if (severityFilter !== 'all') {
      const hasMatchingSeverity = member.insights.some(i => i.severity === severityFilter);
      if (!hasMatchingSeverity) return false;
    }
    return true;
  }) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load coaching insights. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Coaching Insights</h1>
            <HelpButton videoKey="Coaching_Insights" />
          </div>
          <p className="text-muted-foreground mt-1">
            Automatically detected performance struggles with coaching recommendations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Roles</SelectItem>
              <SelectItem value="Sales">Sales</SelectItem>
              <SelectItem value="Service">Service</SelectItem>
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Bar */}
      <InsightsSummaryBar
        membersNeedingAttention={data?.membersNeedingAttention ?? 0}
        totalCritical={data?.totalCritical ?? 0}
        totalWarnings={data?.totalWarnings ?? 0}
        teamPassRate={data?.teamPassRate ?? 0}
        isLoading={isLoading}
      />

      {/* Insights Grid */}
      {filteredInsights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PartyPopper className="h-12 w-12 text-emerald-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your team is performing well!</h2>
          <p className="text-muted-foreground max-w-md">
            No performance concerns detected. Keep up the great work with your team.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredInsights.map((memberInsights) => (
            <TeamMemberInsightCard
              key={memberInsights.teamMemberId}
              memberInsights={memberInsights}
            />
          ))}
        </div>
      )}
    </div>
  );
}
