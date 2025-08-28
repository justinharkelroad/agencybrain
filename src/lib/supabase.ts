// single authenticated client for the app
import { createClient, SupabaseClient } from "@supabase/supabase-js";

declare global { var __supa__: SupabaseClient | undefined; }

const url = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
if (!url || !anon) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");

// keep session so RLS sees logged-in user
export const supa: SupabaseClient =
  globalThis.__supa__ ?? createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

if (!globalThis.__supa__) globalThis.__supa__ = supa;