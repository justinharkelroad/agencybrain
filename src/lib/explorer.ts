import { fetchWithAuth, hasStaffToken } from "@/lib/staffRequest";
import { supabase } from "@/lib/supabaseClient";

export interface ExplorerQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  start?: string;         // YYYY-MM-DD
  end?: string;           // YYYY-MM-DD
  staffId?: string;
  leadSource?: string;
  finalOnly?: boolean;    // default true
  includeSuperseded?: boolean; // default false
  lateOnly?: boolean;     // default false
  sortBy?: string;        // sort field
  sortOrder?: "asc" | "desc"; // sort direction
  recordType?: "all" | "prospect" | "customer"; // filter by record type
}

export interface ExplorerResponse {
  rows: any[];
  page: number;
  pageSize: number;
  total: number;
  prospectCount?: number;
  customerCount?: number;
}

/**
 * Fetch explorer data using dual-mode auth (Supabase JWT or staff session token).
 */
export async function fetchExplorerData(q: ExplorerQuery): Promise<ExplorerResponse> {
  const isStaff = hasStaffToken();

  // For Supabase users, verify session exists
  if (!isStaff) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("No authentication session found");
    }
  }

  // Log payload to demonstrate sortBy/sortOrder inclusion
  console.log("Explorer API payload:", JSON.stringify(q, null, 2));

  const res = await fetchWithAuth("explorer_feed", {
    method: "POST",
    body: q,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Explorer API error ${res.status}`);
  }
  
  const response = await res.json();
  
  // Transform the rows to extract notes from extras
  if (response.rows) {
    response.rows = response.rows.map((row: any) => ({
      ...row,
      notes: row.extras?.raw_json?.detailed_notes || row.extras?.detailed_notes || row.notes || null,
      items_quoted: row.items_quoted ?? null,
      policies_quoted: row.policies_quoted ?? null,
      premium_potential_cents: row.premium_potential_cents || 0,
    }));
  }
  
  return response;
}
