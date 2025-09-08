import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from '@/integrations/supabase/types';

declare global {
  // Legacy global used across the app
  var supa: SupabaseClient<Database>;
}

export {};