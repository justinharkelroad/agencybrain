import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Check whether a comp payout period has finalized or paid rows.
 * Throws if the period is locked (cannot be overwritten).
 *
 * Extracted from persistPayoutSet so it can be tested independently
 * of the React hook and Supabase singleton.
 */
export async function assertPeriodNotFinalized(
  client: Pick<SupabaseClient, "from"> | { from: (...args: any[]) => any },
  agencyId: string,
  periodMonth: number,
  periodYear: number,
): Promise<void> {
  const { data: existingRows, error } = await (client as SupabaseClient)
    .from("comp_payouts")
    .select("id, status")
    .eq("agency_id", agencyId)
    .eq("period_month", periodMonth)
    .eq("period_year", periodYear)
    .in("status", ["finalized", "paid"]);

  if (error) {
    throw new Error(`Failed to check existing payouts: ${error.message}`);
  }

  if (existingRows && existingRows.length > 0) {
    const status = existingRows[0].status;
    throw new Error(
      `This period already has ${status} payouts and cannot be overwritten.`
    );
  }
}
