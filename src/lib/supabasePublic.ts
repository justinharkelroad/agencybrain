import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __supa_pub__: SupabaseClient | undefined;
}

const url = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
if (!url || !anon) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");

export const supaPublic: SupabaseClient =
  globalThis.__supa_pub__ ??
  createClient(url, anon, {
    auth: {
      persistSession: false, // stateless
    },
  });

if (!globalThis.__supa_pub__) globalThis.__supa_pub__ = supaPublic;