# Edge Function Scaffolding

Use this skill when creating new Supabase edge functions for AgencyBrain.

## Standard Template

When creating a new edge function, scaffold it with this pattern:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // TODO: Implement function logic

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('FUNCTION_NAME error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## Authentication Patterns

### For staff-facing endpoints (x-staff-session):
```typescript
const sessionToken = req.headers.get('x-staff-session');
if (!sessionToken) {
  return new Response(
    JSON.stringify({ error: 'Missing session token' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

const { data: session, error: sessionError } = await supabase
  .from('staff_sessions')
  .select('staff_user_id, expires_at')
  .eq('session_token', sessionToken)
  .gt('expires_at', new Date().toISOString())
  .maybeSingle();

if (sessionError || !session) {
  return new Response(
    JSON.stringify({ error: 'Invalid or expired session' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### For admin/owner endpoints (JWT auth):
```typescript
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(
    JSON.stringify({ error: 'Missing authorization' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Use user's context for RLS
const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
  global: { headers: { Authorization: authHeader } }
});
```

## Required Steps After Creating Function

1. Add entry to `supabase/config.toml`:
```toml
[functions.your_function_name]
verify_jwt = false  # or true for admin endpoints
```

2. Test locally:
```bash
supabase functions serve your_function_name --env-file .env.local
```

3. Function will auto-deploy on push to main via GitHub Actions

## Agency Isolation

ALWAYS ensure agency isolation:
- Get agency_id from session/JWT
- Filter all queries by agency_id
- Never trust client-provided agency_id without validation

## Naming Conventions

- Use snake_case for function names: `get_staff_dashboard`, `submit_quiz_attempt`
- Prefix admin functions with `admin_` or `admin-`
- Prefix staff-facing functions with `staff_` or `get_staff_`
