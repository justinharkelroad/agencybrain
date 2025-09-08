import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteKpiRequest {
  agency_id: string;
  kpi_key: string;
}

interface DeleteKpiResponse {
  success: boolean;
  message: string;
  impact?: {
    forms_affected: number;
    rules_touched: boolean;
    remaining_kpis: number;
  };
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Set the auth header for the client
    supabase.auth.setAuth(authHeader.replace('Bearer ', ''));

    const { agency_id, kpi_key }: DeleteKpiRequest = await req.json();

    if (!agency_id || !kpi_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing agency_id or kpi_key' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Start transaction by using a database function
    const { data: result, error: transactionError } = await supabase.rpc('delete_kpi_transaction', {
      p_agency_id: agency_id,
      p_kpi_key: kpi_key,
      p_actor_id: (await supabase.auth.getUser()).data.user?.id || null
    });

    if (transactionError) {
      console.error('Transaction error:', transactionError);
      return new Response(
        JSON.stringify({ success: false, error: transactionError.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const response: DeleteKpiResponse = {
      success: true,
      message: `KPI "${kpi_key}" has been deleted successfully`,
      impact: result
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Delete KPI error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});