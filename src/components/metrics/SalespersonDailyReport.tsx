import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Users, TrendingUp, Award, CheckCircle, Flame } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { supabase } from "@/lib/supabaseClient";
import {
  useSalespersonDailyMetrics,
  DailyMetricRow,
} from "@/hooks/useSalespersonDailyMetrics";
import {
  SalespersonDailyReportFilters,
  QuickDatePreset,
  getDateRangeFromPreset,
} from "./SalespersonDailyReportFilters";
import { SalespersonDailyReportTable } from "./SalespersonDailyReportTable";
import { exportToCSV } from "@/utils/exportUtils";

interface ScorecardRules {
  selected_metrics?: string[];
  selected_metric_slugs?: string[];
  ring_metrics?: string[];
}

interface SalespersonDailyReportProps {
  agencyId: string;
  role: "Sales" | "Service";
  kpiLabels: Record<string, string>;
  scorecardRules?: ScorecardRules;
}

interface TeamMember {
  id: string;
  name: string;
}

// Map of metric slugs to their data field names
const metricFieldMap: Record<string, keyof DailyMetricRow> = {
  outbound_calls: "outbound_calls",
  talk_minutes: "talk_minutes",
  quoted_count: "quoted_count",
  quoted_households: "quoted_count",
  sold_items: "sold_items",
  items_sold: "sold_items",
  cross_sells_uncovered: "cross_sells_uncovered",
  mini_reviews: "mini_reviews",
};

export default function SalespersonDailyReport({
  agencyId,
  role,
  kpiLabels,
  scorecardRules,
}: SalespersonDailyReportProps) {
  // Initialize with "this_week" preset
  const initialDateRange = getDateRangeFromPreset("this_week");

  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string | null>(null);
  const [quickDatePreset, setQuickDatePreset] = useState<QuickDatePreset>("this_week");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch team members for the dropdown
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-for-daily-report", agencyId, role],
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("agency_id", agencyId)
        .eq("status", "active")
        .eq("role", role)
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId,
  });

  // Fetch daily metrics
  const { data: metricsData, isLoading } = useSalespersonDailyMetrics({
    agencyId,
    teamMemberId: selectedTeamMemberId,
    startDate: dateRange?.from || new Date(),
    endDate: dateRange?.to || new Date(),
    role,
  });

  const rows = metricsData?.rows || [];
  const summary = metricsData?.summary;

  // Determine visible metrics based on scorecardRules
  const visibleMetrics = useMemo(() => {
    const selectedMetrics =
      scorecardRules?.selected_metric_slugs?.length ?? 0 > 0
        ? scorecardRules?.selected_metric_slugs
        : scorecardRules?.selected_metrics;

    const metrics = (selectedMetrics || []).filter(Boolean);

    // Filter metrics based on role
    const roleMetrics = metrics.filter((slug) => {
      if (role === "Sales") {
        // Sales-specific metrics
        return ["outbound_calls", "talk_minutes", "quoted_count", "quoted_households", "sold_items", "items_sold"].includes(slug);
      } else {
        // Service-specific metrics
        return ["outbound_calls", "talk_minutes", "cross_sells_uncovered", "mini_reviews"].includes(slug);
      }
    });

    return roleMetrics
      .filter((slug) => metricFieldMap[slug])
      .map((slug) => ({
        slug,
        field: metricFieldMap[slug],
        label: kpiLabels[slug] || slug.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      }));
  }, [scorecardRules, kpiLabels, role]);

  // Handle filter changes
  const handleClearFilters = () => {
    setSelectedTeamMemberId(null);
    setQuickDatePreset("this_week");
    setDateRange(getDateRangeFromPreset("this_week"));
  };

  // Handle export
  const handleExport = () => {
    if (!rows.length) return;

    setIsExporting(true);

    try {
      const exportData = rows.map((row) => {
        const base: Record<string, string | number> = {
          Date: format(new Date(row.date), "yyyy-MM-dd"),
        };

        if (!selectedTeamMemberId) {
          base["Team Member"] = row.team_member_name;
        }

        // Add dynamic metric columns
        const rowRecord = row as unknown as Record<string, unknown>;
        visibleMetrics.forEach((m) => {
          const value = rowRecord[m.field];
          base[m.label] = typeof value === "number" ? value : 0;
        });

        base["Pass"] = row.pass ? "Yes" : "No";
        base["Daily Score"] = row.daily_score;
        base["Streak"] = row.streak_count;

        return base;
      });

      const memberName = selectedTeamMemberId
        ? teamMembers.find((t) => t.id === selectedTeamMemberId)?.name?.replace(/\s+/g, "-") ||
          "unknown"
        : "all-team";

      const startStr = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "start";
      const endStr = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "end";
      const filename = `daily-report-${memberName}-${startStr}-to-${endStr}.csv`;

      exportToCSV(exportData, filename);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <SalespersonDailyReportFilters
            teamMembers={teamMembers}
            selectedTeamMemberId={selectedTeamMemberId}
            onTeamMemberChange={setSelectedTeamMemberId}
            quickDatePreset={quickDatePreset}
            onQuickDatePresetChange={setQuickDatePreset}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onClearFilters={handleClearFilters}
            onExport={handleExport}
            isExporting={isExporting}
          />
        </CardContent>
      </Card>

      {/* Summary Tiles */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <SummaryTile
            title="Total Days"
            value={summary.totalDays}
            icon={<Users className="h-5 w-5" />}
          />
          {visibleMetrics.some((m) => m.field === "outbound_calls") && (
            <SummaryTile
              title={kpiLabels["outbound_calls"] || "Outbound Calls"}
              value={summary.totalCalls}
              icon={<Target className="h-5 w-5" />}
            />
          )}
          {visibleMetrics.some((m) => m.field === "talk_minutes") && (
            <SummaryTile
              title={kpiLabels["talk_minutes"] || "Talk Minutes"}
              value={summary.totalTalkMinutes}
              icon={<TrendingUp className="h-5 w-5" />}
            />
          )}
          {role === "Sales" && visibleMetrics.some((m) => m.field === "quoted_count") && (
            <SummaryTile
              title={kpiLabels["quoted_count"] || kpiLabels["quoted_households"] || "Quoted"}
              value={summary.totalQuoted}
              icon={<TrendingUp className="h-5 w-5" />}
            />
          )}
          {role === "Sales" && visibleMetrics.some((m) => m.field === "sold_items") && (
            <SummaryTile
              title={kpiLabels["sold_items"] || kpiLabels["items_sold"] || "Sold Items"}
              value={summary.totalSoldItems}
              icon={<Award className="h-5 w-5" />}
            />
          )}
          {role === "Service" && visibleMetrics.some((m) => m.field === "cross_sells_uncovered") && (
            <SummaryTile
              title={kpiLabels["cross_sells_uncovered"] || "Cross-Sells"}
              value={summary.totalCrossSells}
              icon={<TrendingUp className="h-5 w-5" />}
            />
          )}
          {role === "Service" && visibleMetrics.some((m) => m.field === "mini_reviews") && (
            <SummaryTile
              title={kpiLabels["mini_reviews"] || "Mini Reviews"}
              value={summary.totalMiniReviews}
              icon={<Award className="h-5 w-5" />}
            />
          )}
          <SummaryTile
            title="Pass Days"
            value={`${summary.passDays} (${summary.passRate}%)`}
            icon={<CheckCircle className="h-5 w-5" />}
          />
          <SummaryTile
            title="Avg Daily Score"
            value={summary.avgDailyScore}
            icon={<Flame className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Performance Data</CardTitle>
        </CardHeader>
        <CardContent>
          <SalespersonDailyReportTable
            data={rows}
            isLoading={isLoading}
            visibleMetrics={visibleMetrics}
            showNameColumn={selectedTeamMemberId === null}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  title,
  value,
  icon,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="glass-surface">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-foreground">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
          </div>
          <div className="text-primary opacity-70">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
