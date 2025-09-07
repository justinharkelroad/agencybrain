import { supa } from "@/lib/supabase";

interface SearchQuery {
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
}

interface ExplorerResponse {
  rows: any[];
  page: number;
  pageSize: number;
  total: number;
}

export async function fetchExplorerData(searchQuery: SearchQuery): Promise<ExplorerResponse> {
  // Get current session with explicit token
  const { data: { session } } = await supa.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("No authentication session found");
  }

  const response = await fetch(
    "https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/explorer_feed",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw",
      },
      body: JSON.stringify(searchQuery)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Explorer API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data;
}