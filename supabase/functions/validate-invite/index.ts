import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();

    console.log('[validate-invite] Validating access code:', code ? '***' : 'missing');

    // Hardcoded access code validation
    const VALID_ACCESS_CODE = '3148178';

    if (code === VALID_ACCESS_CODE) {
      console.log('[validate-invite] Access code valid');
      return new Response(
        JSON.stringify({ valid: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[validate-invite] Access code invalid');
    return new Response(
      JSON.stringify({ error: 'Invalid access code' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
