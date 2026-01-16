/**
 * Hook to fetch chargeback data from cancel_audit_records for compensation calculations
 *
 * Chargebacks are policies that were cancelled during the payout period.
 * The 3-month rule filters to only include chargebacks where the policy was
 * in force for less than 90 days.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChargebackRecord {
  policyNumber: string;
  insuredName: string;
  agentNumber: string | null; // Maps to sub-producer code
  cancelDate: string;
  premiumCents: number;
  itemCount: number;
  productName: string | null;
  // For 3-month rule calculation
  saleDate?: string; // From lqs_sales lookup
  daysInForce?: number;
}

export interface ChargebacksByProducer {
  subProdCode: string;
  chargebacks: ChargebackRecord[];
  totalPremium: number;
  totalItems: number;
  // After 3-month rule filtering
  eligiblePremium: number;
  eligibleCount: number;
  excludedCount: number;
}

/**
 * Fetch chargebacks for a specific period
 * Joins with lqs_sales to get original sale date for 3-month rule
 */
export function useChargebackData(
  agencyId: string | null,
  periodMonth: number,
  periodYear: number
) {
  return useQuery({
    queryKey: ["chargebacks", agencyId, periodMonth, periodYear],
    enabled: !!agencyId,
    queryFn: async (): Promise<ChargebacksByProducer[]> => {
      if (!agencyId) return [];

      // Calculate period date range
      const periodStart = new Date(periodYear, periodMonth - 1, 1);
      const periodEnd = new Date(periodYear, periodMonth, 0); // Last day of month

      const startStr = periodStart.toISOString().split('T')[0];
      const endStr = periodEnd.toISOString().split('T')[0];

      console.log(`[useChargebackData] Fetching chargebacks for ${startStr} to ${endStr}`);

      // Query cancel_audit_records for cancellations in this period
      const { data: cancellations, error } = await supabase
        .from("cancel_audit_records")
        .select(`
          id,
          policy_number,
          insured_first_name,
          insured_last_name,
          agent_number,
          cancel_date,
          premium_cents,
          no_of_items,
          product_name
        `)
        .eq("agency_id", agencyId)
        .gte("cancel_date", startStr)
        .lte("cancel_date", endStr)
        .in("status", ["lost", "new", "in_progress"]); // Include all non-resolved

      if (error) {
        console.error("[useChargebackData] Error fetching cancellations:", error);
        throw error;
      }

      if (!cancellations || cancellations.length === 0) {
        console.log("[useChargebackData] No cancellations found for period");
        return [];
      }

      console.log(`[useChargebackData] Found ${cancellations.length} cancellations`);

      // Get policy numbers for sale date lookup
      const policyNumbers = cancellations.map(c => c.policy_number).filter(Boolean);

      // Look up original sale dates from lqs_sales
      const { data: sales } = await supabase
        .from("lqs_sales")
        .select("policy_number, sale_date")
        .eq("agency_id", agencyId)
        .in("policy_number", policyNumbers);

      const saleDateByPolicy = new Map<string, string>();
      if (sales) {
        for (const sale of sales) {
          if (sale.policy_number) {
            saleDateByPolicy.set(sale.policy_number, sale.sale_date);
          }
        }
      }

      // Group chargebacks by agent_number (sub-producer code)
      const byProducer = new Map<string, ChargebackRecord[]>();

      for (const cancel of cancellations) {
        const code = cancel.agent_number || "UNASSIGNED";
        const saleDate = saleDateByPolicy.get(cancel.policy_number);

        // Calculate days in force if we have sale date
        let daysInForce: number | undefined;
        if (saleDate && cancel.cancel_date) {
          const saleDateObj = new Date(saleDate);
          const cancelDateObj = new Date(cancel.cancel_date);
          daysInForce = Math.floor(
            (cancelDateObj.getTime() - saleDateObj.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        const record: ChargebackRecord = {
          policyNumber: cancel.policy_number,
          insuredName: `${cancel.insured_first_name || ''} ${cancel.insured_last_name || ''}`.trim(),
          agentNumber: cancel.agent_number,
          cancelDate: cancel.cancel_date,
          premiumCents: cancel.premium_cents || 0,
          itemCount: cancel.no_of_items || 1,
          productName: cancel.product_name,
          saleDate,
          daysInForce,
        };

        if (!byProducer.has(code)) {
          byProducer.set(code, []);
        }
        byProducer.get(code)!.push(record);
      }

      // Build result with 3-month rule filtering
      const result: ChargebacksByProducer[] = [];

      for (const [code, chargebacks] of byProducer) {
        const totalPremium = chargebacks.reduce((sum, c) => sum + c.premiumCents, 0);
        const totalItems = chargebacks.reduce((sum, c) => sum + c.itemCount, 0);

        // Apply 3-month rule: only count if days in force < 90
        const eligible = chargebacks.filter(c =>
          c.daysInForce === undefined || c.daysInForce < 90
        );
        const excluded = chargebacks.filter(c =>
          c.daysInForce !== undefined && c.daysInForce >= 90
        );

        const eligiblePremium = eligible.reduce((sum, c) => sum + c.premiumCents, 0);
        const eligibleCount = eligible.length;
        const excludedCount = excluded.length;

        result.push({
          subProdCode: code,
          chargebacks,
          totalPremium: totalPremium / 100, // Convert to dollars
          totalItems,
          eligiblePremium: eligiblePremium / 100,
          eligibleCount,
          excludedCount,
        });

        console.log(`[useChargebackData] ${code}: ${chargebacks.length} chargebacks, ${eligibleCount} eligible, ${excludedCount} excluded (>90 days)`);
      }

      return result;
    },
  });
}

/**
 * Get chargeback data for a specific sub-producer
 */
export function getChargebacksForProducer(
  allChargebacks: ChargebacksByProducer[] | undefined,
  subProdCode: string
): ChargebacksByProducer | null {
  if (!allChargebacks) return null;
  return allChargebacks.find(c => c.subProdCode === subProdCode) || null;
}
