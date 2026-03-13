import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompPlans } from "./useCompPlans";
import { calculateAllPayouts, convertToPerformance, calculateMemberPayout, BrokeredMetrics } from "@/lib/payout-calculator/calculator";
import { PayoutCalculation, WrittenMetrics, BrokeredBundlingMetrics } from "@/lib/payout-calculator/types";
import { calculateSelfGenMetricsBatch, SelfGenMetrics } from "@/lib/payout-calculator/self-gen";
import { SubProducerMetrics } from "@/lib/allstate-analyzer/sub-producer-analyzer";
import { normalizePolicyType } from "@/lib/payout-calculator/policyTypeFilter";
import { calculateCountableTotals, isExcludedProduct } from "@/lib/product-constants";
import { toast } from "sonner";

// Manual override interface for testing compensation calculations
export interface ManualOverride {
  subProdCode: string;
  teamMemberId: string | null;
  teamMemberName: string | null;
  // Total metrics (for tier qualification)
  writtenItems: number | null;
  writtenPremium: number | null;
  writtenPolicies: number | null;
  writtenHouseholds: number | null;
  writtenPoints: number | null;
  // Brokered metrics (for brokered commission and tier contribution)
  brokeredItems: number | null;
  brokeredPremium: number | null;
  brokeredPolicies: number | null;
  brokeredHouseholds: number | null;
  // Bundle breakdown (for commission calculation)
  bundledItems: number | null;
  bundledPremium: number | null;
  monolineItems: number | null;
  monolinePremium: number | null;
}

// Helper function to send payout notifications
async function sendPayoutNotifications(
  payoutIds: string[],
  notificationType: 'finalized' | 'paid',
  agencyId: string
): Promise<{ sent: number; skipped: number; errors?: string[] }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-payout-notification', {
      body: {
        payout_ids: payoutIds,
        notification_type: notificationType,
        agency_id: agencyId,
      },
    });

    if (error) {
      console.error('Error sending payout notifications:', error);
      return { sent: 0, skipped: 0, errors: [error.message] };
    }

    return data || { sent: 0, skipped: 0 };
  } catch (err: unknown) {
    console.error('Failed to send payout notifications:', err);
    const message = err instanceof Error ? err.message : String(err);
    return { sent: 0, skipped: 0, errors: [message] };
  }
}


interface TeamMember {
  id: string;
  name: string;
  sub_producer_code: string | null;
}

interface Assignment {
  team_member_id: string;
  comp_plan_id: string;
}

interface SalePolicy {
  id: string;
  policy_type_name: string | null;
  total_premium: number | null;
  total_items: number | null;
  total_points: number | null;
}

export interface CompPayout {
  id: string;
  team_member_id: string;
  agency_id: string;
  comp_plan_id: string | null;
  period_month: number;
  period_year: number;
  written_premium: number | null;
  written_items: number | null;
  written_policies: number | null;
  written_households: number | null;
  written_points: number | null;
  issued_premium: number | null;
  issued_items: number | null;
  issued_policies: number | null;
  issued_points: number | null;
  chargeback_premium: number | null;
  chargeback_count: number | null;
  net_premium: number | null;
  net_items: number | null;
  tier_threshold_met: number | null;
  tier_commission_value: number | null;
  base_commission: number | null;
  bonus_amount: number | null;
  total_payout: number | null;
  rollover_premium: number | null;
  status: string | null;
  finalized_at: string | null;
  paid_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Phase 3/8: Audit trail fields
  self_gen_percent: number | null;
  self_gen_met_requirement: boolean | null;
  self_gen_penalty_amount: number | null;
  self_gen_bonus_amount: number | null;
  bundling_percent: number | null;
  bundling_multiplier: number | null;
  brokered_commission: number | null;
  chargeback_details_json: unknown | null;
  calculation_snapshot_json: unknown | null;
}

interface SavedPayoutRow {
  id: string;
  team_member_id: string;
  period_month: number;
  period_year: number;
}

// Fetch brokered business metrics from sales data for a given period
async function fetchBrokeredMetrics(
  agencyId: string,
  month: number,
  year: number
): Promise<Map<string, BrokeredMetrics>> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  const { data: sales, error } = await supabase
    .from("sales")
    .select(`
      id,
      team_member_id,
      brokered_carrier_id,
      sale_policies(id, policy_type_name, total_premium, total_items, total_points)
    `)
    .eq("agency_id", agencyId)
    .not("brokered_carrier_id", "is", null)
    .gte("sale_date", startStr)
    .lte("sale_date", endStr);

  if (error) {
    console.error("Error fetching brokered metrics:", error);
    return new Map();
  }

  const brokeredByMember = new Map<string, BrokeredMetrics>();
  const householdsByMember = new Map<string, Set<string>>();

  for (const sale of sales || []) {
    if (!sale.team_member_id) continue;

    const current = brokeredByMember.get(sale.team_member_id) || {
      items: 0,
      premium: 0,
      policies: 0,
      households: 0,
    };

    const countable = calculateCountableTotals((sale.sale_policies as SalePolicy[] | null) || []);
    current.items += countable.items;
    current.premium += countable.premium;
    current.policies += countable.policyCount;

    // Track unique households (countable sales only)
    let householdSet = householdsByMember.get(sale.team_member_id);
    if (!householdSet) {
      householdSet = new Set();
      householdsByMember.set(sale.team_member_id, householdSet);
    }
    if (countable.policyCount > 0 && sale.id) {
      householdSet.add(sale.id);
    }

    brokeredByMember.set(sale.team_member_id, current);
  }

  // Update household counts
  for (const [memberId, householdSet] of householdsByMember) {
    const metrics = brokeredByMember.get(memberId);
    if (metrics) {
      metrics.households = householdSet.size;
    }
  }

  return brokeredByMember;
}

// Fetch brokered bundling metrics - sales marked to count toward bundling
async function fetchBrokeredBundlingMetrics(
  agencyId: string,
  month: number,
  year: number
): Promise<Map<string, BrokeredBundlingMetrics>> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  const { data: sales, error } = await supabase
    .from("sales")
    .select(`
      id,
      team_member_id,
      brokered_carrier_id,
      brokered_counts_toward_bundling,
      bundle_type,
      sale_policies(id, policy_type_name, total_premium, total_items, total_points)
    `)
    .eq("agency_id", agencyId)
    .not("brokered_carrier_id", "is", null)
    .eq("brokered_counts_toward_bundling", true)
    .gte("sale_date", startStr)
    .lte("sale_date", endStr);

  if (error) {
    console.error("Error fetching brokered bundling metrics:", error);
    return new Map();
  }

  const metricsByMember = new Map<string, BrokeredBundlingMetrics>();

  for (const sale of sales || []) {
    if (!sale.team_member_id) continue;

    const current = metricsByMember.get(sale.team_member_id) || {
      bundledItems: 0,
      bundledHouseholds: 0,
      totalItems: 0,
    };

    const countable = calculateCountableTotals((sale.sale_policies as SalePolicy[] | null) || []);
    const items = countable.items;
    current.totalItems += items;

    // Count as bundled if bundle_type is Standard or Preferred
    const bundleType = (sale.bundle_type || '').toLowerCase();
    if (bundleType === 'standard' || bundleType === 'preferred') {
      current.bundledItems += items;
      if (countable.policyCount > 0) {
        current.bundledHouseholds += 1;
      }
    }

    metricsByMember.set(sale.team_member_id, current);
  }

  return metricsByMember;
}

// Fetch written metrics from sales table for tier qualification
// This is used when tier_metric_source = 'written' to use manual sales entries
// instead of Allstate statement data for determining which tier a producer qualifies for
async function fetchWrittenMetrics(
  agencyId: string,
  teamMemberIds: string[],
  month: number,
  year: number
): Promise<Map<string, WrittenMetrics>> {
  if (teamMemberIds.length === 0) {
    return new Map();
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  console.log('[fetchWrittenMetrics] Fetching from sales table:', {
    agencyId,
    teamMemberIds,
    dateRange: `${startStr} to ${endStr}`,
  });

  const { data: policies, error } = await supabase
    .from("sale_policies")
    .select(`
      sale_id,
      policy_type_name,
      total_items,
      total_premium,
      sale:sales!inner(
        team_member_id,
        agency_id,
        sale_date
      )
    `)
    .eq("sale.agency_id", agencyId)
    .in("sale.team_member_id", teamMemberIds)
    .gte("sale.sale_date", startStr)
    .lte("sale.sale_date", endStr);

  if (error) {
    console.error("[fetchWrittenMetrics] Error fetching written metrics:", error);
    return new Map();
  }

  console.log(`[fetchWrittenMetrics] Found ${policies?.length || 0} sale policy records`);

  const writtenByMember = new Map<string, WrittenMetrics>();
  const householdSalesByMember = new Map<string, Set<string>>();
  const policyTypeHouseholdsByMember = new Map<string, Map<string, Set<string>>>();
  type SalePolicyWithSale = {
    sale_id: string;
    policy_type_name: string | null;
    total_items: number | null;
    total_premium: number | null;
    sale: { team_member_id: string | null } | Array<{ team_member_id: string | null }> | null;
  };

  for (const policy of (policies || []) as SalePolicyWithSale[]) {
    const sale = Array.isArray(policy.sale) ? policy.sale[0] : policy.sale;
    const teamMemberId = sale?.team_member_id || null;
    if (!teamMemberId) continue;
    if (isExcludedProduct(policy.policy_type_name)) continue;

    const current = writtenByMember.get(teamMemberId) || {
      writtenItems: 0,
      writtenPremium: 0,
      writtenPolicies: 0,
      writtenHouseholds: 0,
      writtenPoints: 0,
      policyTypeBreakdown: {},
    };

    const items = policy.total_items || 0;
    const premium = policy.total_premium || 0;
    const saleId = policy.sale_id || "";
    const normalizedPolicyType = normalizePolicyType(policy.policy_type_name || "other");

    current.writtenItems += items;
    current.writtenPremium += premium;
    current.writtenPolicies += 1;

    if (!current.policyTypeBreakdown![normalizedPolicyType]) {
      current.policyTypeBreakdown![normalizedPolicyType] = {
        writtenItems: 0,
        writtenPremium: 0,
        writtenPolicies: 0,
        writtenHouseholds: 0,
        writtenPoints: 0,
        householdSaleIds: [],
      };
    }
    current.policyTypeBreakdown![normalizedPolicyType].writtenItems += items;
    current.policyTypeBreakdown![normalizedPolicyType].writtenPremium += premium;
    current.policyTypeBreakdown![normalizedPolicyType].writtenPolicies += 1;
    current.writtenPoints += items;
    current.policyTypeBreakdown![normalizedPolicyType].writtenPoints =
      (current.policyTypeBreakdown![normalizedPolicyType].writtenPoints || 0) + items;

    if (!householdSalesByMember.has(teamMemberId)) {
      householdSalesByMember.set(teamMemberId, new Set());
    }
    if (saleId) {
      householdSalesByMember.get(teamMemberId)!.add(saleId);
    }

    if (!policyTypeHouseholdsByMember.has(teamMemberId)) {
      policyTypeHouseholdsByMember.set(teamMemberId, new Map());
    }
    const policyTypeHouseholds = policyTypeHouseholdsByMember.get(teamMemberId)!;
    if (!policyTypeHouseholds.has(normalizedPolicyType)) {
      policyTypeHouseholds.set(normalizedPolicyType, new Set());
    }
    if (saleId) {
      policyTypeHouseholds.get(normalizedPolicyType)!.add(saleId);
    }

    writtenByMember.set(teamMemberId, current);
  }

  for (const [memberId, metrics] of writtenByMember) {
    metrics.writtenHouseholds = householdSalesByMember.get(memberId)?.size || 0;
    if (metrics.policyTypeBreakdown) {
      const policyHouseholdMap = policyTypeHouseholdsByMember.get(memberId) || new Map<string, Set<string>>();
      for (const [policyType, breakdown] of Object.entries(metrics.policyTypeBreakdown)) {
        const saleIdSet = policyHouseholdMap.get(policyType) || new Set<string>();
        breakdown.writtenHouseholds = saleIdSet.size;
        breakdown.householdSaleIds = Array.from(saleIdSet);
      }
    }
  }

  // Log results for debugging
  for (const [memberId, metrics] of writtenByMember) {
    console.log(`[fetchWrittenMetrics] ${memberId}:`, metrics);
  }

  return writtenByMember;
}

export function usePayoutCalculator(agencyId: string | null) {
  const queryClient = useQueryClient();
  const { data: plans = [] } = useCompPlans(agencyId);

  // Fetch team members with sub_producer_code
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members-for-payouts", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, sub_producer_code")
        .eq("agency_id", agencyId!)
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  // The currently active assignment set is authoritative at run time.
  // Monthly comp uses whatever plan assignment is active when the admin calculates/finalizes.
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ["comp-plan-assignments", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comp_plan_assignments")
        .select("team_member_id, comp_plan_id")
        .is("end_date", null);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing payouts for a period
  const fetchPayouts = async (month: number, year: number): Promise<CompPayout[]> => {
    if (!agencyId) return [];
    
    const { data, error } = await supabase
      .from("comp_payouts")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("period_month", month)
      .eq("period_year", year);
    
    if (error) throw error;
    return data || [];
  };

  const persistPayoutSet = async (payouts: PayoutCalculation[]): Promise<SavedPayoutRow[]> => {
    if (!agencyId) throw new Error("No agency ID");
    if (payouts.length === 0) return [];

    const periodMonth = payouts[0].periodMonth;
    const periodYear = payouts[0].periodYear;
    const mixedPeriod = payouts.some(
      (p) => p.periodMonth !== periodMonth || p.periodYear !== periodYear
    );
    if (mixedPeriod) {
      throw new Error("All payouts in a save batch must belong to the same month and year");
    }

    const integerFieldChecks: Array<{ key: keyof PayoutCalculation; label: string }> = [
      { key: "writtenItems", label: "written items" },
      { key: "writtenPolicies", label: "written policies" },
      { key: "writtenHouseholds", label: "written households" },
      { key: "issuedItems", label: "issued items" },
      { key: "issuedPolicies", label: "issued policies" },
      { key: "chargebackCount", label: "chargeback count" },
      { key: "eligibleChargebackCount", label: "eligible chargeback count" },
      { key: "excludedChargebackCount", label: "excluded chargeback count" },
      { key: "netItems", label: "net items" },
    ];

    for (const payout of payouts) {
      for (const field of integerFieldChecks) {
        const value = payout[field.key];
        if (typeof value === "number" && !Number.isInteger(value)) {
          throw new Error(`${payout.teamMemberName} has ${field.label} = ${value}. Count fields must be whole numbers.`);
        }
      }
    }

    const payoutRows = payouts.map((p) => ({
      team_member_id: p.teamMemberId,
      agency_id: agencyId,
      comp_plan_id: p.compPlanId,
      period_month: p.periodMonth,
      period_year: p.periodYear,
      written_premium: p.writtenPremium,
      written_items: p.writtenItems,
      written_policies: p.writtenPolicies,
      written_households: p.writtenHouseholds,
      written_points: p.writtenPoints,
      issued_premium: p.issuedPremium,
      issued_items: p.issuedItems,
      issued_policies: p.issuedPolicies,
      issued_points: p.issuedPoints,
      chargeback_premium: p.chargebackPremium,
      chargeback_count: p.chargebackCount,
      net_premium: p.netPremium,
      net_items: p.netItems,
      tier_threshold_met: p.tierThresholdMet,
      tier_commission_value: p.tierCommissionValue,
      base_commission: p.baseCommission,
      bonus_amount: p.bonusAmount,
      total_payout: p.totalPayout,
      rollover_premium: p.rolloverPremium,
      status: p.status,
      self_gen_percent: p.selfGenPercent ?? null,
      self_gen_met_requirement: p.selfGenMetRequirement ?? null,
      self_gen_penalty_amount: p.selfGenPenaltyAmount ?? 0,
      self_gen_bonus_amount: p.selfGenBonusAmount ?? 0,
      bundling_percent: p.bundlingPercent ?? null,
      bundling_multiplier: p.bundlingMultiplier ?? 1,
      brokered_commission: p.brokeredCommission ?? 0,
      chargeback_details_json: p.chargebackDetails ?? null,
      calculation_snapshot_json: p.calculationSnapshot ?? null,
    }));

    const { data: savedRows, error: upsertError } = await supabase
      .from("comp_payouts")
      .upsert(payoutRows, {
        onConflict: "team_member_id,period_month,period_year",
      })
      .select("id, team_member_id, period_month, period_year");

    if (upsertError) throw upsertError;

    const savedIds = new Set((savedRows || []).map((row) => row.id));
    const { data: draftRows, error: draftRowsError } = await supabase
      .from("comp_payouts")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("period_month", periodMonth)
      .eq("period_year", periodYear)
      .eq("status", "draft");

    if (draftRowsError) throw draftRowsError;

    const staleDraftIds = (draftRows || [])
      .map((row) => row.id)
      .filter((id) => !savedIds.has(id));

    if (staleDraftIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("comp_payouts")
        .delete()
        .in("id", staleDraftIds);

      if (deleteError) throw deleteError;
    }

    return (savedRows || []) as SavedPayoutRow[];
  };

  // Calculate payouts from sub-producer data (async for promo bonus calculation)
  const calculatePayouts = async (
    subProducerData: SubProducerMetrics[] | undefined | null,
    month: number,
    year: number,
    manualOverrides?: ManualOverride[],
    useManualWrittenMetrics: boolean = false
  ): Promise<{ payouts: PayoutCalculation[]; warnings: string[] }> => {
    // TEST LOG - If you see this, the new code IS running
    console.log('🔥🔥🔥 NEW CODE IS RUNNING - FB84E946 🔥🔥🔥', { month, year, teamMembersCount: teamMembers.length });

    // Guard against missing data
    if (!subProducerData || !Array.isArray(subProducerData) || subProducerData.length === 0) {
      return { payouts: [], warnings: ['No sub-producer data available for this statement'] };
    }

    if (!agencyId) {
      return { payouts: [], warnings: ['No agency ID available'] };
    }

    // Get period dates for batch queries
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    // Get team member IDs for batch queries
    const teamMemberIds = teamMembers.map(tm => tm.id);

    // Fetch full self-gen metrics using batch function (Phase 3)
    const selfGenMetricsByMember = await calculateSelfGenMetricsBatch(
      agencyId,
      teamMemberIds,
      startDate,
      endDate
    );

    // Build legacy selfGenByMember map from the metrics (for backward compatibility)
    const selfGenByMember = new Map<string, number>();
    for (const [memberId, metrics] of selfGenMetricsByMember) {
      selfGenByMember.set(memberId, metrics.selfGenItems);
    }

    // Fetch brokered business metrics (Phase 5)
    const brokeredMetricsByMember = await fetchBrokeredMetrics(agencyId, month, year);

    // Fetch written metrics from sales table (for tier qualification when source = 'written')
    const writtenMetricsByMember = await fetchWrittenMetrics(agencyId, teamMemberIds, month, year);

    // Fetch brokered bundling metrics - sales marked to count toward bundling
    const brokeredBundlingMetricsByMember = await fetchBrokeredBundlingMetrics(agencyId, month, year);

    return await calculateAllPayouts(
      subProducerData,
      plans,
      assignments,
      teamMembers,
      month,
      year,
      agencyId,
      manualOverrides,
      selfGenByMember,
      selfGenMetricsByMember,
      brokeredMetricsByMember,
      writtenMetricsByMember,
      brokeredBundlingMetricsByMember,
      useManualWrittenMetrics
    );
  };

  // Save payouts to database
  const savePayoutsMutation = useMutation({
    mutationFn: async (payouts: PayoutCalculation[]) => {
      return await persistPayoutSet(payouts);
    },
    onSuccess: (rows) => {
      toast.success(`Saved ${rows.length} payout calculations`);
      queryClient.invalidateQueries({ queryKey: ["comp-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["comp-payouts-history"] });
    },
    onError: (error) => {
      console.error("Error saving payouts:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save payouts");
    },
  });

  // Finalize payouts
  const finalizePayoutsMutation = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      if (!agencyId) throw new Error("No agency ID");
      
      const { error } = await supabase
        .from("comp_payouts")
        .update({ 
          status: "finalized", 
          finalized_at: new Date().toISOString() 
        })
        .eq("agency_id", agencyId)
        .eq("period_month", month)
        .eq("period_year", year)
        .eq("status", "draft");

      if (error) throw error;
      return { month, year };
    },
    onSuccess: async ({ month, year }) => {
      toast.success("Payouts finalized");
      queryClient.invalidateQueries({ queryKey: ["comp-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["comp-payouts-history"] });

      // Send notification emails
      if (agencyId) {
        const { data: payouts } = await supabase
          .from("comp_payouts")
          .select("id")
          .eq("agency_id", agencyId)
          .eq("period_month", month)
          .eq("period_year", year)
          .eq("status", "finalized");

        if (payouts && payouts.length > 0) {
          const payoutIds = payouts.map(p => p.id);
          const result = await sendPayoutNotifications(payoutIds, 'finalized', agencyId);
          
          if (result.sent > 0) {
            toast.success(`Statement emails sent to ${result.sent} team member${result.sent !== 1 ? 's' : ''}`);
          }
          if (result.errors && result.errors.length > 0) {
            toast.error("Some notification emails failed to send");
          }
        }
      }
    },
    onError: (error) => {
      console.error("Error finalizing payouts:", error);
      toast.error("Failed to finalize payouts");
    },
  });

  const finalizeCalculatedPayoutsMutation = useMutation({
    mutationFn: async (payouts: PayoutCalculation[]) => {
      if (!agencyId) throw new Error("No agency ID");
      if (payouts.length === 0) throw new Error("No calculated payouts to finalize");

      const savedRows = await persistPayoutSet(payouts);
      const payoutIds = savedRows.map((row) => row.id);
      if (payoutIds.length === 0) {
        throw new Error("No payout rows were saved for finalization");
      }

      const { error } = await supabase
        .from("comp_payouts")
        .update({
          status: "finalized",
          finalized_at: new Date().toISOString(),
        })
        .in("id", payoutIds)
        .eq("status", "draft");

      if (error) throw error;

      return {
        payoutIds,
        month: payouts[0].periodMonth,
        year: payouts[0].periodYear,
      };
    },
    onSuccess: async ({ payoutIds }) => {
      toast.success("Payouts saved and finalized");
      queryClient.invalidateQueries({ queryKey: ["comp-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["comp-payouts-history"] });

      if (agencyId && payoutIds.length > 0) {
        const result = await sendPayoutNotifications(payoutIds, 'finalized', agencyId);
        if (result.sent > 0) {
          toast.success(`Statement emails sent to ${result.sent} team member${result.sent !== 1 ? 's' : ''}`);
        }
        if (result.errors && result.errors.length > 0) {
          toast.error("Some notification emails failed to send");
        }
      }
    },
    onError: (error) => {
      console.error("Error saving and finalizing payouts:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save and finalize payouts");
    },
  });

  // Mark payouts as paid
  const markPaidMutation = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      if (!agencyId) throw new Error("No agency ID");
      
      const { error } = await supabase
        .from("comp_payouts")
        .update({ 
          status: "paid", 
          paid_at: new Date().toISOString() 
        })
        .eq("agency_id", agencyId)
        .eq("period_month", month)
        .eq("period_year", year)
        .eq("status", "finalized");

      if (error) throw error;
      return { month, year };
    },
    onSuccess: async ({ month, year }) => {
      toast.success("Payouts marked as paid");
      queryClient.invalidateQueries({ queryKey: ["comp-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["comp-payouts-history"] });

      // Send notification emails
      if (agencyId) {
        const { data: payouts } = await supabase
          .from("comp_payouts")
          .select("id")
          .eq("agency_id", agencyId)
          .eq("period_month", month)
          .eq("period_year", year)
          .eq("status", "paid");

        if (payouts && payouts.length > 0) {
          const payoutIds = payouts.map(p => p.id);
          const result = await sendPayoutNotifications(payoutIds, 'paid', agencyId);
          
          if (result.sent > 0) {
            toast.success(`Payment confirmation emails sent to ${result.sent} team member${result.sent !== 1 ? 's' : ''}`);
          }
          if (result.errors && result.errors.length > 0) {
            toast.error("Some notification emails failed to send");
          }
        }
      }
    },
    onError: (error) => {
      console.error("Error marking payouts as paid:", error);
      toast.error("Failed to mark payouts as paid");
    },
  });

  const deleteDraftPayoutsMutation = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      if (!agencyId) throw new Error("No agency ID");

      const { data: existingRows, error: fetchError } = await supabase
        .from("comp_payouts")
        .select("id, status")
        .eq("agency_id", agencyId)
        .eq("period_month", month)
        .eq("period_year", year);

      if (fetchError) throw fetchError;

      const rows = existingRows || [];
      const blockingStatuses = rows.filter((row) => row.status === "finalized" || row.status === "paid");
      if (blockingStatuses.length > 0) {
        throw new Error("This period already has finalized or paid payouts. Re-open that run before starting over.");
      }

      const draftIds = rows
        .filter((row) => row.status === "draft")
        .map((row) => row.id);

      if (draftIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("comp_payouts")
          .delete()
          .in("id", draftIds);

        if (deleteError) throw deleteError;
      }

      return draftIds.length;
    },
    onSuccess: (deletedCount) => {
      if (deletedCount > 0) {
        toast.success(`Deleted ${deletedCount} draft payout${deletedCount === 1 ? "" : "s"} and reset the run`);
      } else {
        toast.success("Run reset");
      }
      queryClient.invalidateQueries({ queryKey: ["comp-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["comp-payouts-history"] });
    },
    onError: (error) => {
      console.error("Error deleting draft payouts:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reset the draft run");
    },
  });

  return {
    plans,
    teamMembers,
    assignments,
    calculatePayouts,
    fetchPayouts,
    savePayouts: savePayoutsMutation.mutate,
    savePayoutsAsync: savePayoutsMutation.mutateAsync,
    isSaving: savePayoutsMutation.isPending,
    finalizeCalculatedPayouts: finalizeCalculatedPayoutsMutation.mutate,
    finalizeCalculatedPayoutsAsync: finalizeCalculatedPayoutsMutation.mutateAsync,
    isFinalizingCalculatedPayouts: finalizeCalculatedPayoutsMutation.isPending,
    finalizePayouts: finalizePayoutsMutation.mutate,
    isFinalizingPayouts: finalizePayoutsMutation.isPending,
    markPaid: markPaidMutation.mutate,
    isMarkingPaid: markPaidMutation.isPending,
    deleteDraftPayoutsForPeriod: deleteDraftPayoutsMutation.mutate,
    deleteDraftPayoutsForPeriodAsync: deleteDraftPayoutsMutation.mutateAsync,
    isDeletingDraftPayouts: deleteDraftPayoutsMutation.isPending,
  };
}
