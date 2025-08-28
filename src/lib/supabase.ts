import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global { var __supa__: SupabaseClient | undefined }

const url = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
if (!url || !anon) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");

export const supa: SupabaseClient =
  globalThis.__supa__ ?? createClient(url, anon, {
    auth: {
      persistSession: true,          // was false — causes anonymous reads
      autoRefreshToken: true,
      storageKey: "mab-auth"         // unique key to avoid collisions
    }
  });

if (!globalThis.__supa__) globalThis.__supa__ = supa;