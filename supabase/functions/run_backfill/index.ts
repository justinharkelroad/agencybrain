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

    // Get recent submissions for this agency
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: submissions } = await sb
      .from("submissions")
      .select("id")
      .eq("final", true)
      .gte("submitted_at", thirtyDaysAgo.toISOString())
      .in("form_template_id", sb
        .from("form_templates")
        .select("id")
        .eq("agency_id", profile.agency_id)
      );

    let processed = 0;
    let errors = 0;

    // Reprocess each submission with enhanced flattener
    for (const submission of submissions || []) {
      try {
        const { error } = await sb.rpc("flatten_quoted_household_details_enhanced", {
          submission_id: submission.id
        });
        
        if (error) {
          console.error(`Error processing submission ${submission.id}:`, error);
          errors++;
        } else {
          processed++;
        }
      } catch (err) {
        console.error(`Exception processing submission ${submission.id}:`, err);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed,
        errors,
        total: (submissions || []).length
      }), 
      { 
        status: 200, 
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" }
      }
    );

  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }), 
      { 
        status: 500, 
        headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" }
      }
    );
  }
});