import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global { 
  // eslint-disable-next-line no-var
  var __supa__: SupabaseClient | undefined;
}

const url = "https://wjqyccbytctqwceuhzhk.supabase.co";
const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw";

export const supa: SupabaseClient =
  globalThis.__supa__ ??
  createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "sb-app-auth", // unique key to avoid multi-client warnings
    },
  });

if (!globalThis.__supa__) globalThis.__supa__ = supa;