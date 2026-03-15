import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

type DuplicatePolicyRow = {
  policy_number: string | null;
  sale_id: string;
  sales: {
    id: string;
    agency_id: string;
    source: string | null;
    customer_name: string | null;
    sale_date: string | null;
  } | {
    id: string;
    agency_id: string;
    source: string | null;
    customer_name: string | null;
    sale_date: string | null;
  }[] | null;
};

type SalesRecord = { id: string; agency_id: string; source: string | null; customer_name: string | null; sale_date: string | null };

function getSalesRecord(row: DuplicatePolicyRow): SalesRecord | null {
  if (Array.isArray(row.sales)) {
    return row.sales[0] ?? null;
  }
  return row.sales as SalesRecord | null;
}

function formatSaleDate(value: string | null | undefined): string {
  if (!value) {
    return "an unknown date";
  }

  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

export async function assertNoDuplicateSalePolicies(params: {
  agencyId: string;
  policyNumbers: Array<string | null | undefined>;
  currentSaleId?: string;
}): Promise<void> {
  const normalizedPolicyNumbers = [...new Set(
    params.policyNumbers
      .map((value) => value?.trim())
      .filter((value): value is string => !!value)
  )];

  if (normalizedPolicyNumbers.length === 0) {
    return;
  }

  const { data, error } = await supabase
    .from("sale_policies")
    .select(`
      policy_number,
      sale_id,
      sales!inner (
        id,
        agency_id,
        source,
        customer_name,
        sale_date
      )
    `)
    .in("policy_number", normalizedPolicyNumbers)
    .eq("sales.agency_id", params.agencyId);

  if (error) {
    throw error;
  }

  const duplicate = (data as DuplicatePolicyRow[] | null)?.find((row) => row.sale_id !== params.currentSaleId);

  if (!duplicate) {
    return;
  }

  const sale = getSalesRecord(duplicate);

  throw new Error(
    `Policy ${duplicate.policy_number} already exists for ${sale?.customer_name ?? "another customer"} on ${formatSaleDate(sale?.sale_date)}. Open Sales Log to edit the existing sale instead.`
  );
}
