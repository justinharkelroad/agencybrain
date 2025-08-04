import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://wjqyccbytctqwceuhzhk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});