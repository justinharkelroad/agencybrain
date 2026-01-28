// Self-Gen Calculation Functions
// Calculates self-generated lead metrics from sales data

import { supabase } from '@/integrations/supabase/client';

export interface SelfGenMetrics {
  selfGenItems: number;
  totalItems: number;
  selfGenPercent: number;
  selfGenPremium: number;
  totalPremium: number;
  selfGenPolicies: number;
  totalPolicies: number;
  selfGenHouseholds: number;
  totalHouseholds: number;
}

/**
 * Calculate self-gen metrics for a team member in a given period.
 * Self-gen is determined by sales.lead_source_id → lead_sources.is_self_generated
 */
export async function calculateSelfGenMetrics(
  agencyId: string,
  teamMemberId: string,
  periodStartDate: Date,
  periodEndDate: Date
): Promise<SelfGenMetrics> {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id,
      total_items,
      total_premium,
      total_policies,
      lead_source_id,
      lead_sources!inner(is_self_generated)
    `)
    .eq('agency_id', agencyId)
    .eq('team_member_id', teamMemberId)
    .gte('sale_date', periodStartDate.toISOString().split('T')[0])
    .lte('sale_date', periodEndDate.toISOString().split('T')[0]);

  if (error) {
    console.error('[calculateSelfGenMetrics] Error:', error);
    return createEmptyMetrics();
  }

  // Also fetch sales without lead_sources (count as non-self-gen)
  const { data: salesWithoutSource, error: noSourceError } = await supabase
    .from('sales')
    .select(`
      id,
      total_items,
      total_premium,
      total_policies
    `)
    .eq('agency_id', agencyId)
    .eq('team_member_id', teamMemberId)
    .is('lead_source_id', null)
    .gte('sale_date', periodStartDate.toISOString().split('T')[0])
    .lte('sale_date', periodEndDate.toISOString().split('T')[0]);

  if (noSourceError) {
    console.error('[calculateSelfGenMetrics] Error fetching sales without source:', noSourceError);
  }

  let selfGenItems = 0;
  let totalItems = 0;
  let selfGenPremium = 0;
  let totalPremium = 0;
  let selfGenPolicies = 0;
  let totalPolicies = 0;
  const selfGenHouseholdIds = new Set<string>();
  const totalHouseholdIds = new Set<string>();

  // Process sales with lead sources
  for (const sale of data || []) {
    const items = sale.total_items || 0;
    const premium = sale.total_premium || 0;
    const policies = sale.total_policies || 0;
    // Handle both array and object response formats
    const leadSource = Array.isArray(sale.lead_sources)
      ? sale.lead_sources[0]
      : sale.lead_sources;
    const isSelfGen = leadSource?.is_self_generated === true;

    totalItems += items;
    totalPremium += premium;
    totalPolicies += policies;
    totalHouseholdIds.add(sale.id);

    if (isSelfGen) {
      selfGenItems += items;
      selfGenPremium += premium;
      selfGenPolicies += policies;
      selfGenHouseholdIds.add(sale.id);
    }
  }

  // Add sales without lead sources to totals (not self-gen)
  for (const sale of salesWithoutSource || []) {
    const items = sale.total_items || 0;
    const premium = sale.total_premium || 0;
    const policies = sale.total_policies || 0;

    totalItems += items;
    totalPremium += premium;
    totalPolicies += policies;
    totalHouseholdIds.add(sale.id);
  }

  return {
    selfGenItems,
    totalItems,
    selfGenPercent: totalItems > 0 ? (selfGenItems / totalItems) * 100 : 0,
    selfGenPremium,
    totalPremium,
    selfGenPolicies,
    totalPolicies,
    selfGenHouseholds: selfGenHouseholdIds.size,
    totalHouseholds: totalHouseholdIds.size,
  };
}

/**
 * Get self-gen metrics for multiple team members at once (batch)
 */
export async function calculateSelfGenMetricsBatch(
  agencyId: string,
  teamMemberIds: string[],
  periodStartDate: Date,
  periodEndDate: Date
): Promise<Map<string, SelfGenMetrics>> {
  const results = new Map<string, SelfGenMetrics>();

  if (teamMemberIds.length === 0) {
    return results;
  }

  // Fetch all sales for these team members in the period
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id,
      team_member_id,
      total_items,
      total_premium,
      total_policies,
      lead_source_id,
      lead_sources(is_self_generated)
    `)
    .eq('agency_id', agencyId)
    .in('team_member_id', teamMemberIds)
    .gte('sale_date', periodStartDate.toISOString().split('T')[0])
    .lte('sale_date', periodEndDate.toISOString().split('T')[0]);

  if (error) {
    console.error('[calculateSelfGenMetricsBatch] Error:', error);
    // Return empty metrics for all requested members
    for (const memberId of teamMemberIds) {
      results.set(memberId, createEmptyMetrics());
    }
    return results;
  }

  // Initialize metrics for all members
  const metricsMap = new Map<string, {
    selfGenItems: number;
    totalItems: number;
    selfGenPremium: number;
    totalPremium: number;
    selfGenPolicies: number;
    totalPolicies: number;
    selfGenHouseholdIds: Set<string>;
    totalHouseholdIds: Set<string>;
  }>();

  for (const memberId of teamMemberIds) {
    metricsMap.set(memberId, {
      selfGenItems: 0,
      totalItems: 0,
      selfGenPremium: 0,
      totalPremium: 0,
      selfGenPolicies: 0,
      totalPolicies: 0,
      selfGenHouseholdIds: new Set(),
      totalHouseholdIds: new Set(),
    });
  }

  // Process each sale
  for (const sale of data || []) {
    const memberId = sale.team_member_id;
    if (!memberId) continue;

    const metrics = metricsMap.get(memberId);
    if (!metrics) continue;

    const items = sale.total_items || 0;
    const premium = sale.total_premium || 0;
    const policies = sale.total_policies || 0;
    const leadSource = Array.isArray(sale.lead_sources)
      ? sale.lead_sources[0]
      : sale.lead_sources;
    const isSelfGen = leadSource?.is_self_generated === true;

    metrics.totalItems += items;
    metrics.totalPremium += premium;
    metrics.totalPolicies += policies;
    metrics.totalHouseholdIds.add(sale.id);

    if (isSelfGen) {
      metrics.selfGenItems += items;
      metrics.selfGenPremium += premium;
      metrics.selfGenPolicies += policies;
      metrics.selfGenHouseholdIds.add(sale.id);
    }
  }

  // Convert to SelfGenMetrics
  for (const [memberId, m] of metricsMap) {
    results.set(memberId, {
      selfGenItems: m.selfGenItems,
      totalItems: m.totalItems,
      selfGenPercent: m.totalItems > 0 ? (m.selfGenItems / m.totalItems) * 100 : 0,
      selfGenPremium: m.selfGenPremium,
      totalPremium: m.totalPremium,
      selfGenPolicies: m.selfGenPolicies,
      totalPolicies: m.totalPolicies,
      selfGenHouseholds: m.selfGenHouseholdIds.size,
      totalHouseholds: m.totalHouseholdIds.size,
    });
  }

  return results;
}

function createEmptyMetrics(): SelfGenMetrics {
  return {
    selfGenItems: 0,
    totalItems: 0,
    selfGenPercent: 0,
    selfGenPremium: 0,
    totalPremium: 0,
    selfGenPolicies: 0,
    totalPolicies: 0,
    selfGenHouseholds: 0,
    totalHouseholds: 0,
  };
}
