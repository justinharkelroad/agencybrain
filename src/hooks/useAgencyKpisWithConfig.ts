import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { fetchWithAuth, hasStaffToken } from "@/lib/staffRequest";

export interface KPIWithConfig {
  id: string;
  agency_id: string;
  key: string;
  label: string;
  type: "number" | "currency" | "percentage" | "integer";
  color?: string;
  is_active: boolean;
  role?: string | null;
}

export interface ScorecardRulesConfig {
  id: string;
  agency_id: string;
  role: string;
  selected_metrics?: string[];
  ring_metrics?: string[];
  n_required?: number;
  weights?: Record<string, number>;
  counted_days?: string[];
  count_weekend_if_submitted?: boolean;
  backfill_days?: number;
}

export interface Target {
  id: string;
  agency_id: string;
  metric_key: string;
  value_number: number;
  team_member_id: string | null;
}

export interface KpisWithConfigResult {
  kpis: KPIWithConfig[];
  enabledKpis: KPIWithConfig[];
  kpiLabels: Record<string, string>;
  scorecardRules: ScorecardRulesConfig | null;
  targets: Target[];
}

/**
 * Unified hook for fetching KPIs with scorecard configuration.
 *
 * Supports both staff mode (via edge function) and owner mode (direct Supabase queries).
 * Includes role filtering, deduplication (role-specific KPIs override NULL role), and
 * graceful fallback behavior when no scorecard_rules are configured.
 *
 * @param agencyId - The agency ID
 * @param role - The team member role (Sales, Service, Hybrid, etc.)
 * @param options - Optional configuration (enabled flag)
 */
export function useAgencyKpisWithConfig(
  agencyId: string | undefined,
  role: string | undefined,
  options?: { enabled?: boolean }
): UseQueryResult<KpisWithConfigResult> {
  const isStaffMode = hasStaffToken();

  return useQuery({
    queryKey: ["agency-kpis-with-config", agencyId, role],
    enabled: !!(agencyId && role) && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    queryFn: async (): Promise<KpisWithConfigResult> => {
      if (isStaffMode) {
        // Staff mode: use edge function to get all data in one call
        const response = await fetchWithAuth("scorecards_admin", {
          method: "POST",
          body: {
            action: "kpis_with_config_get",
            role,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Request failed: ${response.status}`);
        }

        const data = await response.json();
        return {
          kpis: data.kpis || [],
          enabledKpis: data.enabledKpis || [],
          kpiLabels: data.kpiLabels || {},
          scorecardRules: data.scorecardRules || null,
          targets: data.targets || [],
        };
      }

      // Owner mode: direct Supabase queries with RLS
      // Fetch KPIs filtered by role
      // Hybrid and Manager roles see ALL KPIs (Sales + Service + Hybrid + NULL)
      let kpisQuery = supabase
        .from("kpis")
        .select("*")
        .eq("agency_id", agencyId!)
        .eq("is_active", true);

      if (role !== "Hybrid" && role !== "Manager") {
        kpisQuery = kpisQuery.or(`role.eq.${role},role.is.null`);
      }
      // For Hybrid/Manager, don't add role filter - they see all KPIs

      const { data: kpisData, error: kpisError } = await kpisQuery.order("label");

      if (kpisError) throw kpisError;

      // Dedupe: prefer role-specific KPI over NULL-role for the same key
      const uniqueKpis = new Map<string, KPIWithConfig>();
      (kpisData || []).forEach((kpi) => {
        const existing = uniqueKpis.get(kpi.key);
        // Keep role-specific over NULL role
        if (!existing || (kpi.role !== null && existing.role === null)) {
          uniqueKpis.set(kpi.key, kpi as KPIWithConfig);
        }
      });
      const kpis = Array.from(uniqueKpis.values());

      // Fetch scorecard rules for the role
      const { data: scorecardRules, error: rulesError } = await supabase
        .from("scorecard_rules")
        .select("*")
        .eq("agency_id", agencyId!)
        .eq("role", role!)
        .maybeSingle();

      if (rulesError && rulesError.code !== "PGRST116") {
        throw rulesError;
      }

      // Fetch targets for the KPI keys
      const kpiKeys = kpis.map((k) => k.key);
      let targets: Target[] = [];
      if (kpiKeys.length > 0) {
        const { data: targetsData, error: targetsError } = await supabase
          .from("targets")
          .select("*")
          .eq("agency_id", agencyId!)
          .is("team_member_id", null)
          .in("metric_key", kpiKeys);

        if (targetsError) throw targetsError;
        targets = (targetsData || []) as Target[];
      }

      // Build kpiLabels map
      const kpiLabels: Record<string, string> = {};
      kpis.forEach((kpi) => {
        kpiLabels[kpi.key] = kpi.label;
      });

      // Filter to enabled KPIs based on scorecard_rules.selected_metrics
      const selectedMetrics = new Set(scorecardRules?.selected_metrics || []);
      const enabledKpis =
        selectedMetrics.size > 0
          ? kpis.filter((kpi) => selectedMetrics.has(kpi.key))
          : []; // Empty if no rules configured (caller should use fallback)

      return {
        kpis,
        enabledKpis,
        kpiLabels,
        scorecardRules: scorecardRules as ScorecardRulesConfig | null,
        targets,
      };
    },
  });
}
