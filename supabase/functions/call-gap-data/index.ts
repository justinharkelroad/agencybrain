import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Verify request (supports both Supabase JWT and staff session)
    const authResult = await verifyRequest(req);
    if (isVerifyError(authResult)) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { mode, agencyId, userId, staffUserId, isManager } = authResult;

    // Staff must be a manager to access call gaps
    if (mode === "staff" && !isManager) {
      return new Response(
        JSON.stringify({ error: "Manager access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { operation, ...params } = await req.json();

    if (!operation) {
      return new Response(
        JSON.stringify({ error: "operation is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    switch (operation) {
      // ─── Save Upload + Records ───────────────────────────────────
      case "save_upload": {
        const { fileName, sourceFormat, rawCallCount, records } = params;

        if (!fileName || !sourceFormat || !records || !Array.isArray(records)) {
          return new Response(
            JSON.stringify({ error: "fileName, sourceFormat, and records are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Insert upload metadata
        const { data: upload, error: uploadError } = await adminClient
          .from("call_gap_uploads")
          .insert({
            agency_id: agencyId,
            file_name: fileName,
            source_format: sourceFormat,
            raw_call_count: rawCallCount || records.length,
            record_count: 0, // Updated after records insert
            created_by_user_id: userId || null,
            created_by_staff_id: staffUserId || null,
          })
          .select("id")
          .single();

        if (uploadError || !upload) {
          console.error("Failed to insert upload:", uploadError);
          return new Response(
            JSON.stringify({ error: "Failed to save upload" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const uploadId = upload.id;

        // Batch insert records (500 per chunk) with ON CONFLICT DO NOTHING
        let totalInserted = 0;
        const CHUNK_SIZE = 500;

        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
          const chunk = records.slice(i, i + CHUNK_SIZE).map((r: any) => ({
            agency_id: agencyId,
            upload_id: uploadId,
            agent_name: r.agent_name,
            call_start: r.call_start,
            call_date: r.call_date,
            duration_seconds: r.duration_seconds || 0,
            direction: r.direction,
            contact_name: r.contact_name || "",
            contact_phone: r.contact_phone || "",
            result: r.result || "",
          }));

          const { data: inserted, error: chunkError } = await adminClient
            .from("call_gap_records")
            .upsert(chunk, {
              onConflict: "agency_id,agent_name,call_start,duration_seconds",
              ignoreDuplicates: true,
            })
            .select("id");

          if (chunkError) {
            console.error(`Chunk insert error at offset ${i}:`, chunkError);
          } else {
            totalInserted += inserted?.length || 0;
          }
        }

        // Compute date range and update upload record
        const dates = records
          .map((r: any) => r.call_date)
          .filter(Boolean)
          .sort();
        const dateRangeStart = dates[0] || null;
        const dateRangeEnd = dates[dates.length - 1] || null;

        await adminClient
          .from("call_gap_uploads")
          .update({
            record_count: totalInserted,
            date_range_start: dateRangeStart,
            date_range_end: dateRangeEnd,
          })
          .eq("id", uploadId);

        return new Response(
          JSON.stringify({
            uploadId,
            recordsInserted: totalInserted,
            duplicatesSkipped: records.length - totalInserted,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Get Uploads ─────────────────────────────────────────────
      case "get_uploads": {
        const { data: uploads, error } = await adminClient
          .from("call_gap_uploads")
          .select("id, file_name, source_format, raw_call_count, record_count, date_range_start, date_range_end, created_at")
          .eq("agency_id", agencyId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("Failed to fetch uploads:", error);
          return new Response(
            JSON.stringify({ error: "Failed to fetch uploads" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ uploads: uploads || [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Get Records ─────────────────────────────────────────────
      case "get_records": {
        const { uploadId } = params;

        if (!uploadId) {
          return new Response(
            JSON.stringify({ error: "uploadId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify upload belongs to this agency
        const { data: upload, error: uploadCheckError } = await adminClient
          .from("call_gap_uploads")
          .select("id, source_format")
          .eq("id", uploadId)
          .eq("agency_id", agencyId)
          .single();

        if (uploadCheckError || !upload) {
          return new Response(
            JSON.stringify({ error: "Upload not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch all records (override Supabase default 1000-row limit)
        const allRecords: any[] = [];
        const PAGE_SIZE = 1000;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: page, error: pageError } = await adminClient
            .from("call_gap_records")
            .select("agent_name, call_start, call_date, duration_seconds, direction, contact_name, contact_phone, result")
            .eq("upload_id", uploadId)
            .eq("agency_id", agencyId)
            .order("agent_name", { ascending: true })
            .order("call_start", { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

          if (pageError) {
            console.error("Failed to fetch records page:", pageError);
            return new Response(
              JSON.stringify({ error: "Failed to fetch records" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          allRecords.push(...(page || []));
          hasMore = (page?.length || 0) === PAGE_SIZE;
          offset += PAGE_SIZE;
        }

        const records = allRecords;

        return new Response(
          JSON.stringify({
            records,
            sourceFormat: upload.source_format,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ─── Delete Upload ───────────────────────────────────────────
      case "delete_upload": {
        const { uploadId } = params;

        if (!uploadId) {
          return new Response(
            JSON.stringify({ error: "uploadId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: deleteError } = await adminClient
          .from("call_gap_uploads")
          .delete()
          .eq("id", uploadId)
          .eq("agency_id", agencyId);

        if (deleteError) {
          console.error("Failed to delete upload:", deleteError);
          return new Response(
            JSON.stringify({ error: "Failed to delete upload" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown operation: ${operation}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("call-gap-data error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
