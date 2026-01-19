import { supabase } from '@/integrations/supabase/client';

interface RenewalRecord {
  id: string;
  agency_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  policy_number: string;
  product_name: string | null;
  renewal_effective_date: string | null;
  premium_old: number | null;
  premium_new: number | null;
  agent_number: string | null;
  household_key: string | null;
}

interface CancelAuditRecordForWinback {
  id: string;
  agency_id: string;
  insured_first_name: string | null;
  insured_last_name: string | null;
  insured_email: string | null;
  insured_phone: string | null;
  policy_number: string;
  product_name: string | null;
  premium_cents: number | null;
  cancel_date: string | null;
  pending_cancel_date: string | null;
  agent_number: string | null;
  household_key: string | null;
}

interface SendToWinbackResult {
  success: boolean;
  householdId?: string;
  error?: string;
}

// Export for reuse
export type { CancelAuditRecordForWinback, SendToWinbackResult };

function getPolicyTermMonths(productName: string | null): number {
  if (!productName) return 12;
  
  const upper = productName.toUpperCase();
  
  // Only these specific Standard Auto products are 6-month terms
  const sixMonthAutoProducts = [
    'AUTO PRIVATE PASS',
    'AUTO-INDEM',
    'AFCIC-AUTO PRIV PASS',
    'STANDARD AUTO',
  ];
  
  for (const product of sixMonthAutoProducts) {
    if (upper.includes(product)) {
      return 6;
    }
  }
  
  // All other products (including Auto - Special, Homeowners, etc.) are 12-month
  return 12;
}

function calculateWinbackDate(
  terminationDate: Date,
  policyTermMonths: number,
  contactDaysBefore: number
): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let competitorRenewal = new Date(terminationDate);
  competitorRenewal.setMonth(competitorRenewal.getMonth() + policyTermMonths);

  let winbackDate = new Date(competitorRenewal);
  winbackDate.setDate(winbackDate.getDate() - contactDaysBefore);

  while (winbackDate <= today) {
    competitorRenewal.setMonth(competitorRenewal.getMonth() + policyTermMonths);
    winbackDate = new Date(competitorRenewal);
    winbackDate.setDate(winbackDate.getDate() - contactDaysBefore);
  }

  return winbackDate;
}

export async function sendRenewalToWinback(
  renewal: RenewalRecord,
  contactDaysBefore: number = 45
): Promise<SendToWinbackResult> {
  try {
    if (!renewal.first_name || !renewal.last_name) {
      return { success: false, error: 'Missing customer name' };
    }
    if (!renewal.renewal_effective_date) {
      return { success: false, error: 'Missing renewal effective date' };
    }
    if (!renewal.policy_number) {
      return { success: false, error: 'Missing policy number' };
    }

    const terminationDate = new Date(renewal.renewal_effective_date);
    const policyTermMonths = getPolicyTermMonths(renewal.product_name);
    const winbackDate = calculateWinbackDate(terminationDate, policyTermMonths, contactDaysBefore);

    let zipCode = '00000';
    if (renewal.household_key) {
      const zipMatch = renewal.household_key.match(/\d{5}/);
      if (zipMatch) zipCode = zipMatch[0];
    }

    // Check for existing household
    const { data: existingHousehold } = await supabase
      .from('winback_households')
      .select('id')
      .eq('agency_id', renewal.agency_id)
      .ilike('first_name', renewal.first_name.trim())
      .ilike('last_name', renewal.last_name.trim())
      .maybeSingle();

    let householdId: string;

    if (existingHousehold) {
      householdId = existingHousehold.id;
    } else {
      const { data: newHousehold, error: householdError } = await supabase
        .from('winback_households')
        .insert({
          agency_id: renewal.agency_id,
          first_name: renewal.first_name.trim().toUpperCase(),
          last_name: renewal.last_name.trim().toUpperCase(),
          zip_code: zipCode,
          email: renewal.email || null,
          phone: renewal.phone || null,
          status: 'untouched',
        })
        .select('id')
        .single();

      if (householdError) {
        return { success: false, error: `Failed to create household: ${householdError.message}` };
      }
      householdId = newHousehold.id;
    }

    // Check for existing policy
    const { data: existingPolicy } = await supabase
      .from('winback_policies')
      .select('id')
      .eq('agency_id', renewal.agency_id)
      .eq('policy_number', renewal.policy_number)
      .maybeSingle();

    if (existingPolicy) {
      await supabase
        .from('renewal_records')
        .update({
          winback_household_id: householdId,
          sent_to_winback_at: new Date().toISOString(),
        })
        .eq('id', renewal.id);
      return { success: true, householdId };
    }

    // Create policy
    const premiumNewCents = renewal.premium_new ? Math.round(renewal.premium_new * 100) : null;
    const premiumOldCents = renewal.premium_old ? Math.round(renewal.premium_old * 100) : null;
    const premiumChangeCents = premiumNewCents && premiumOldCents ? premiumNewCents - premiumOldCents : null;
    const premiumChangePercent = premiumOldCents && premiumChangeCents
      ? Math.round((premiumChangeCents / premiumOldCents) * 10000) / 100
      : null;

    const { error: policyError } = await supabase
      .from('winback_policies')
      .insert({
        household_id: householdId,
        agency_id: renewal.agency_id,
        policy_number: renewal.policy_number,
        agent_number: renewal.agent_number || null,
        product_name: renewal.product_name || 'Unknown',
        policy_term_months: policyTermMonths,
        termination_effective_date: renewal.renewal_effective_date,
        termination_reason: 'Renewal Not Taken - From Renewal Audit',
        premium_new_cents: premiumNewCents,
        premium_old_cents: premiumOldCents,
        premium_change_cents: premiumChangeCents,
        premium_change_percent: premiumChangePercent,
        calculated_winback_date: winbackDate.toISOString().split('T')[0],
        is_cancel_rewrite: false,
      });

    if (policyError) {
      return { success: false, error: `Failed to create policy: ${policyError.message}` };
    }

    // Recalculate aggregates
    await supabase.rpc('recalculate_winback_household_aggregates', {
      p_household_id: householdId,
    });

    // Update renewal record
    await supabase
      .from('renewal_records')
      .update({
        winback_household_id: householdId,
        sent_to_winback_at: new Date().toISOString(),
      })
      .eq('id', renewal.id);

    return { success: true, householdId };

  } catch (error) {
    console.error('Error sending to Win-Back:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send a Cancel Audit record to Win-Back when marked as "Lost"
 */
export async function sendCancelAuditToWinback(
  record: CancelAuditRecordForWinback,
  contactDaysBefore: number = 45
): Promise<SendToWinbackResult> {
  try {
    // Validate required fields
    if (!record.insured_first_name || !record.insured_last_name) {
      return { success: false, error: 'Missing customer name' };
    }
    
    // Use cancel_date if available, otherwise pending_cancel_date
    const terminationDateStr = record.cancel_date || record.pending_cancel_date;
    if (!terminationDateStr) {
      return { success: false, error: 'Missing cancel date or pending cancel date' };
    }
    if (!record.policy_number) {
      return { success: false, error: 'Missing policy number' };
    }

    const terminationDate = new Date(terminationDateStr);
    const policyTermMonths = getPolicyTermMonths(record.product_name);
    const winbackDate = calculateWinbackDate(terminationDate, policyTermMonths, contactDaysBefore);

    // Extract zip code from household_key if available
    let zipCode = '00000';
    if (record.household_key) {
      const zipMatch = record.household_key.match(/\d{5}/);
      if (zipMatch) zipCode = zipMatch[0];
    }

    // Check for existing household
    const { data: existingHousehold } = await supabase
      .from('winback_households')
      .select('id')
      .eq('agency_id', record.agency_id)
      .ilike('first_name', record.insured_first_name.trim())
      .ilike('last_name', record.insured_last_name.trim())
      .maybeSingle();

    let householdId: string;

    if (existingHousehold) {
      householdId = existingHousehold.id;
    } else {
      const { data: newHousehold, error: householdError } = await supabase
        .from('winback_households')
        .insert({
          agency_id: record.agency_id,
          first_name: record.insured_first_name.trim().toUpperCase(),
          last_name: record.insured_last_name.trim().toUpperCase(),
          zip_code: zipCode,
          email: record.insured_email || null,
          phone: record.insured_phone || null,
          status: 'untouched',
        })
        .select('id')
        .single();

      if (householdError) {
        return { success: false, error: `Failed to create household: ${householdError.message}` };
      }
      householdId = newHousehold.id;
    }

    // Check for existing policy
    const { data: existingPolicy } = await supabase
      .from('winback_policies')
      .select('id')
      .eq('agency_id', record.agency_id)
      .eq('policy_number', record.policy_number)
      .maybeSingle();

    if (existingPolicy) {
      // Policy already exists, just update cancel audit record
      await supabase
        .from('cancel_audit_records')
        .update({
          winback_household_id: householdId,
          sent_to_winback_at: new Date().toISOString(),
        })
        .eq('id', record.id);
      return { success: true, householdId };
    }

    // Create policy - Cancel audit only has current premium (premium_cents)
    const premiumNewCents = record.premium_cents || null;

    const { error: policyError } = await supabase
      .from('winback_policies')
      .insert({
        household_id: householdId,
        agency_id: record.agency_id,
        policy_number: record.policy_number,
        agent_number: record.agent_number || null,
        product_name: record.product_name || 'Unknown',
        policy_term_months: policyTermMonths,
        termination_effective_date: terminationDateStr,
        termination_reason: 'Lost from Cancel Audit',
        premium_new_cents: premiumNewCents,
        premium_old_cents: null, // Cancel audit doesn't have old premium
        premium_change_cents: null,
        premium_change_percent: null,
        calculated_winback_date: winbackDate.toISOString().split('T')[0],
        is_cancel_rewrite: false,
      });

    if (policyError) {
      return { success: false, error: `Failed to create policy: ${policyError.message}` };
    }

    // Recalculate aggregates
    await supabase.rpc('recalculate_winback_household_aggregates', {
      p_household_id: householdId,
    });

    // Update cancel audit record with winback link
    await supabase
      .from('cancel_audit_records')
      .update({
        winback_household_id: householdId,
        sent_to_winback_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    return { success: true, householdId };

  } catch (error) {
    console.error('Error sending cancel audit to Win-Back:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
