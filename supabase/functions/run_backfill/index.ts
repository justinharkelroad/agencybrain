import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      headers: { 
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Headers": "authorization, apikey, content-type" 
      }
    });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!, 
      Deno.env.get("SUPABASE_ANON_KEY")!, 
      { 
        auth: { persistSession: false },
        global: { 
          headers: { 
            Authorization: req.headers.get('Authorization') ?? '' 
          } 
        }
      }
    );

    // Get user's agency
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const { data: profile } = await sb.from("profiles").select("agency_id").eq("id", user.id).single();
    if (!profile?.agency_id) {
      return new Response(JSON.stringify({ error: "No agency found" }), { 
        status: 400, 
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Parse request body for optional submission_ids
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const specificSubmissionIds = body.submission_ids as string[] | undefined;

    console.log(`Starting backfill for agency ${profile.agency_id}`);
    
    let submissionIds: string[] = [];

    if (specificSubmissionIds && specificSubmissionIds.length > 0) {
      // Use specific submission IDs provided
      console.log(`Processing ${specificSubmissionIds.length} specific submissions:`, specificSubmissionIds);
      submissionIds = specificSubmissionIds;
    } else {
      // Default: get failed flattenings from vw_flattening_health
      console.log('No specific submissions provided, fetching failed flattenings from vw_flattening_health');
      
      const { data: failedSubmissions, error: healthError } = await sb
        .from("vw_flattening_health")
        .select("submission_id")
        .in("status", ["flattening_failed", "partial_flattening"]);

      if (healthError) {
        console.error('Error fetching failed submissions:', healthError);
        return new Response(JSON.stringify({ error: "Failed to fetch submissions to backfill" }), { 
          status: 500, 
          headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      submissionIds = (failedSubmissions || []).map(s => s.submission_id);
      console.log(`Found ${submissionIds.length} failed/partial flattenings to process`);
    }

    if (submissionIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No submissions to process",
          processed: 0,
          errors: 0,
          total: 0,
          results: []
        }), 
        { 
          status: 200, 
          headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    // Process each submission
    let processed = 0;
    let errors = 0;
    const results: any[] = [];

    for (const submissionId of submissionIds) {
      try {
        console.log(`Processing submission ${submissionId}...`);
        
        const { data: result, error: rpcError } = await sb.rpc("flatten_quoted_household_details_enhanced", {
          p_submission_id: submissionId
        });
        
        if (rpcError) {
          console.error(`RPC error for submission ${submissionId}:`, rpcError);
          errors++;
          results.push({
            submission_id: submissionId,
            success: false,
            error: rpcError.message
          });
        } else {
          const resultData = result as any;
          if (resultData?.success) {
            console.log(`✓ Successfully processed submission ${submissionId}, created ${resultData.records_created} records`);
            processed++;
            results.push({
              submission_id: submissionId,
              success: true,
              records_created: resultData.records_created
            });
          } else {
            console.error(`✗ Function returned failure for submission ${submissionId}:`, resultData?.error_message);
            errors++;
            results.push({
              submission_id: submissionId,
              success: false,
              error: resultData?.error_message || "Unknown error",
              sql_state: resultData?.sql_state
            });
          }
        }
      } catch (err) {
        console.error(`Exception processing submission ${submissionId}:`, err);
        errors++;
        results.push({
          submission_id: submissionId,
          success: false,
          error: err.message
        });
      }
    }

    console.log(`Backfill complete: ${processed} processed, ${errors} errors, ${submissionIds.length} total`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed,
        errors,
        total: submissionIds.length,
        results
      }), 
      { 
        status: 200, 
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" }
      }
    );

  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), 
      { 
        status: 500, 
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" }
      }
    );
  }
});