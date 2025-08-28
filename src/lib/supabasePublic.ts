// stateless client only for public form pages
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _public: SupabaseClient | undefined;

export const supaPublic = (() => {
  if (_public) return _public;
  const url = import.meta.env.VITE_SUPABASE_URL!;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
  _public = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _public;
})();