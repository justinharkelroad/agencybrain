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
}

interface ExplorerResponse {
  rows: any[];
  page: number;
  pageSize: number;
  total: number;
}

export async function fetchExplorerData(q: ExplorerQuery): Promise<ExplorerResponse> {
  // Get current session with explicit token
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("No authentication session found");
  }

  // Log payload to demonstrate sortBy/sortOrder inclusion
  console.log("Explorer API payload:", JSON.stringify(q, null, 2));

  const res = await fetch(
    "https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/explorer_feed",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw",
      },
      body: JSON.stringify(q)
    }
  );

  if (!res.ok) {
    throw new Error(`Explorer API error ${res.status}`);
  }
  
  const response = await res.json();
  
  // Transform the rows to extract notes from extras
  if (response.rows) {
    response.rows = response.rows.map((row: any) => ({
      ...row,
      notes: row.extras?.notes || row.notes || null,
      items_quoted: row.items_quoted || 0,
      policies_quoted: row.policies_quoted || 0,
      premium_potential_cents: row.premium_potential_cents || 0,
    }));
  }
  
  return response;
}