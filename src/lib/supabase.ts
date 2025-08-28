import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global { 
  // eslint-disable-next-line no-var
  var __supa__: SupabaseClient | undefined;
}

const url = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
if (!url || !anon) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");

export const supa: SupabaseClient =
  globalThis.__supa__ ??
  createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Use default storage - no custom storageKey to avoid conflicts
    },
  });

if (!globalThis.__supa__) globalThis.__supa__ = supa;