import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const teamMemberId = formData.get("team_member_id") as string;
    const templateId = formData.get("template_id") as string;
    const agencyId = formData.get("agency_id") as string;
    const fileName = formData.get("file_name") as string;

    if (!audioFile || !teamMemberId || !templateId || !agencyId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: audio, team_member_id, template_id, agency_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing audio file: ${fileName}, size: ${audioFile.size} bytes`);

    // Generate unique storage path
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${agencyId}/${teamMemberId}/${timestamp}_${sanitizedFileName}`;

    // Upload to Supabase Storage
    const arrayBuffer = await audioFile.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("call-recordings")
      .upload(storagePath, arrayBuffer, {
        contentType: audioFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload audio file", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("File uploaded to storage:", uploadData.path);

    // Prepare file for OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append("file", new Blob([arrayBuffer], { type: audioFile.type }), fileName);
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("response_format", "verbose_json");
    whisperFormData.append("timestamp_granularities[]", "segment");

    console.log("Sending to OpenAI Whisper API...");

    // Call OpenAI Whisper API
    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: whisperFormData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("Whisper API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Transcription failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const whisperResult = await whisperResponse.json();
    console.log("Transcription complete. Duration:", whisperResult.duration, "seconds");

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        storage_path: storagePath,
        transcript: whisperResult.text,
        duration_seconds: whisperResult.duration,
        segments: whisperResult.segments || [],
        language: whisperResult.language,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
