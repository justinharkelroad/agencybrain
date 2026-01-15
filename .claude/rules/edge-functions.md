---
paths:
  - "supabase/functions/**/index.ts"
  - "supabase/functions/**/*.ts"
---

# Supabase Edge Functions Rules

## File Structure
- Each function in `supabase/functions/{function-name}/index.ts`
- Function name uses snake_case (e.g., `get_staff_renewals`)
- Register in `supabase/config.toml`

## Standard Template
```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // CORS preflight - ALWAYS handle first
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' }
        }
      }
    );

    // Parameter validation
    const url = new URL(req.url);
    const requiredParam = url.searchParams.get('param');

    if (!requiredParam) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: param' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Business logic here
    const { data, error } = await supabase.rpc('function_name', { p_param: requiredParam });

    if (error) {
      console.error('Function error:', error);
      return new Response(
        JSON.stringify({ error: 'Operation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## Security Requirements
- **JWT Verification**: Configure in `config.toml` for protected endpoints
- **Input Validation**: Validate ALL parameters before use
- **Agency Scoping**: Use `has_agency_access()` for agency-specific data
- **Never expose**: Internal error details to client

## Error Response Format
```json
{ "error": "User-friendly error message" }
```
Use HTTP status codes: 400 (bad input), 401 (auth), 403 (forbidden), 500 (server)

## Performance
- Target: <5s for form submissions, <150ms for queries
- Use indexed queries
- Return only needed fields

## Config.toml Entry
```toml
[functions.function_name]
verify_jwt = true  # or false for public endpoints
```
