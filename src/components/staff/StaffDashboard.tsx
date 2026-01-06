import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AlertTriangle, CheckCircle, XCircle, Target } from 'lucide-react';
import { RING_COLORS } from '@/components/rings/colors';
import { StaffFocusTargets } from './StaffFocusTargets';
import { StaffTeamOverview } from './StaffTeamOverview';
import { StaffRoleplaySessions } from './StaffRoleplaySessions';
import { AgencyDailyGoals } from '@/components/dashboard/AgencyDailyGoals';
import { StaffCore4Card } from './StaffCore4Card';
import { StaffCore4MonthlyMissions } from './StaffCore4MonthlyMissions';
import { StaffSalesSummary } from './StaffSalesSummary';
import { hasSalesBetaAccess } from '@/lib/salesBetaAccess';
interface KPIData {
  key: string;
  slug: string;
  label: string;
  actual: number;
  target: number;
  passed: boolean;
  progress: number;
}

function getPreviousBusinessDay(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  let daysToSubtract = 1;
  if (dayOfWeek === 0) daysToSubtract = 2; // Sunday → Friday
  else if (dayOfWeek === 1) daysToSubtract = 3; // Monday → Friday
  
  return subDays(today, daysToSubtract);
}

// Compact Ring Component for Staff Dashboard
function CompactRing({ 
  progress, 
  color, 
  actual,
  size = 70, 
}: { 
  progress: number; 
  color: string; 
  actual: number;
  size?: number; 
}) {
  const r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;
  const dashArray = Math.max(0, Math.min(progress, 1)) * circumference;

  return (
    <div className="relative">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="hsl(var(--border))"
          strokeOpacity="0.2"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${dashArray} ${circumference}`}
          strokeLinecap="round"
          fill="none"
          className={progress >= 1 ? "drop-shadow-sm" : ""}
          style={{ transition: 'stroke-dasharray 0.5s ease-out' }}
        />
      </svg>
      <div 
        className="absolute inset-0 flex items-center justify-center z-10"
        style={{ fontSize: `${size * 0.22}px`, lineHeight: 1 }}
      >
        <span 
          className="font-bold tabular-nums text-foreground drop-shadow-sm bg-background/80 rounded px-1"
        >
          {actual}
        </span>
      </div>
    </div>
  );
}

export function StaffDashboard() {
  const { user, sessionToken } = useStaffAuth();
  const [loading, setLoading] = useState(true);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [kpiData, setKpiData] = useState<KPIData[]>([]);
  
  const isManager = user?.role === 'Manager';
  const previousBusinessDay = getPreviousBusinessDay();
  const previousBusinessDayStr = format(previousBusinessDay, 'yyyy-MM-dd');
  const displayDate = format(previousBusinessDay, 'EEEE, MMMM d');
  const firstName = user?.display_name?.split(' ')[0] || 'Team Member';
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy');

  useEffect(() => {
    async function loadDashboardData() {
      if (!user?.team_member_id || !sessionToken) {
        setLoading(false);
        return;
      }

      try {
        // Use edge function to bypass RLS (staff users don't have Supabase auth)
        const { data, error } = await supabase.functions.invoke('get_staff_dashboard', {
          headers: { 'x-staff-session': sessionToken },
          body: { work_date: previousBusinessDayStr }
        });

        if (error) {
          console.error('Error loading dashboard:', error);
          setLoading(false);
          return;
        }

        if (data?.error) {
          console.error('Dashboard error:', data.error);
          setLoading(false);
          return;
        }

        const { submission, submissionSchema, formTemplateSchema, targets: targetsMap } = data;

        const hasData = !!submission;
        setHasSubmission(hasData);

        // Use submission schema or fallback to form template schema
        const schema = hasData 
          ? submissionSchema?.schema_json
          : formTemplateSchema;

        const kpis = schema?.kpis || [];
        const payload = hasData ? (submission.payload_json || {}) : {};

        const kpiResults: KPIData[] = kpis.map((kpi: any) => {
          const actual = hasData ? (Number(payload[kpi.selectedKpiSlug]) || Number(payload[kpi.key]) || 0) : 0;
          const target = kpi.target?.goal ?? targetsMap[kpi.selectedKpiSlug] ?? targetsMap[kpi.key] ?? 0;
          const progress = target > 0 ? Math.min(actual / target, 1) : 0;
          
          return {
            key: kpi.key,
            slug: kpi.selectedKpiSlug || kpi.key,
            label: kpi.label,
            actual,
            target,
            passed: target > 0 ? actual >= target : false,
            progress
          };
        });

        // Only show KPIs with targets
        setKpiData(kpiResults.filter(k => k.target > 0));

      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [user, sessionToken, previousBusinessDayStr]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const passedCount = kpiData.filter(k => k.passed).length;
  const totalCount = kpiData.length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome, {firstName}!</h1>
        <p className="text-muted-foreground">{currentDate}</p>
      </div>

      {/* Sales Summary Widget - At Top (only for whitelisted agencies) */}
      {user?.agency_id && user?.team_member_id && hasSalesBetaAccess(user.agency_id) && (
        <StaffSalesSummary 
          agencyId={user.agency_id} 
          teamMemberId={user.team_member_id} 
          showViewAll 
        />
      )}

      {/* Yesterday's Team Goals */}
      {user?.agency_id && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Yesterday's Team Results</h2>
          <AgencyDailyGoals 
            agencyId={user.agency_id} 
            date={previousBusinessDayStr}
          />
        </div>
      )}

      {/* Previous Day Performance Card */}
      <Card>
        <CardHeader>
          <CardTitle>Yesterday's Performance</CardTitle>
          <CardDescription>{displayDate}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* No Submission Alert - show above rings */}
          {!hasSubmission && (
            <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">No submission recorded for {displayDate}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Make sure to submit your daily scorecard.
              </p>
            </div>
          )}

          {/* Always show rings - empty/gray if no submission */}
          {kpiData.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-6 justify-center">
                {kpiData.map((kpi) => (
                  <div key={kpi.key} className="flex flex-col items-center gap-2">
                    <CompactRing
                      progress={kpi.progress}
                      color={hasSubmission ? (RING_COLORS[kpi.slug] || '#9ca3af') : 'hsl(var(--muted-foreground) / 0.3)'}
                      actual={kpi.actual}
                    />
                    <span className="text-xs text-muted-foreground text-center max-w-[80px]">
                      {kpi.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Stats Summary */}
              <div className={`rounded-lg p-4 ${
                !hasSubmission 
                  ? 'bg-muted/50' 
                  : passRate >= 50 
                    ? 'bg-green-500/10' 
                    : 'bg-red-500/10'
              }`}>
                <div className="flex items-center justify-center gap-2">
                  {!hasSubmission ? (
                    <span className="text-muted-foreground">No data for this day</span>
                  ) : passRate >= 50 ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-semibold">
                        {passedCount}/{totalCount} targets met ({passRate}%)
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-semibold">
                        {passedCount}/{totalCount} targets met ({passRate}%)
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Stats Table - always visible */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Metric</th>
                      <th className="px-4 py-2 text-right font-medium">Actual</th>
                      <th className="px-4 py-2 text-right font-medium">Target</th>
                      <th className="px-4 py-2 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiData.map((kpi) => (
                      <tr key={kpi.key} className="border-t">
                        <td className="px-4 py-2">{kpi.label}</td>
                        <td className="px-4 py-2 text-right font-mono">{kpi.actual}</td>
                        <td className="px-4 py-2 text-right font-mono text-muted-foreground">{kpi.target}</td>
                        <td className="px-4 py-2 text-center">
                          {!hasSubmission ? (
                            <span className="text-muted-foreground">—</span>
                          ) : kpi.passed ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No KPI targets configured for this form.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales Summary removed from here - moved to top of dashboard */}

      {/* Core 4 - All staff see this */}
      <StaffCore4Card />

      {/* Monthly Missions - Only show if missions exist */}
      <StaffCore4MonthlyMissions hideEmptyDomains />

      {/* Focus Targets Section - All staff see this */}
      <StaffFocusTargets />

      {/* Manager-only sections */}
      {isManager && (
        <>
          <StaffTeamOverview />
          <StaffRoleplaySessions />
        </>
      )}
    </div>
  );
}
