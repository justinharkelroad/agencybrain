import { createClient } from "@supabase/supabase-js";
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Singleton client pattern
export const supabase =
  (globalThis as any).__sb__ ??
  ((globalThis as any).__sb__ = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      }
    }
  ));

// Expose legacy global for existing code
if (typeof window !== "undefined") {
  (window as any).supa = supabase;
}
if (typeof globalThis !== "undefined") {
  (globalThis as any).supa = supabase;
}

export default supabase;