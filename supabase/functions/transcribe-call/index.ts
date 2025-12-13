import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Calculate talk metrics from Whisper segments
function calculateTalkMetrics(segments: any[], totalDuration: number) {
  let agentSeconds = 0;
  let customerSeconds = 0;
  let lastEndTime = 0;
  let deadAirSeconds = 0;
  let currentSpeaker = 'agent'; // Agent usually speaks first (greeting)
  
  segments.forEach((segment, index) => {
    const segmentDuration = segment.end - segment.start;
    const text = segment.text?.toLowerCase() || '';
    
    // Calculate dead air (gaps between segments > 0.5s)
    if (segment.start > lastEndTime) {
      const gap = segment.start - lastEndTime;
      if (gap > 0.5) {
        deadAirSeconds += gap;
      }
    }
    lastEndTime = segment.end;
    
    // Speaker detection heuristics
    const isGreeting = /^(hi|hello|hey|thank you for calling|thanks for calling|good morning|good afternoon)/i.test(text.trim());
    const isAgentPhrase = /(let me|i can|we offer|your policy|your coverage|your premium|i'll send|i'll email|what i can do|i'm going to|looking at your)/i.test(text);
    const isCustomerPhrase = /(i need|i want|i'm looking|how much|what about|can you|do you|i have a question|my current|i was wondering)/i.test(text);
    
    // Determine speaker
    if (index === 0 && isGreeting) {
      currentSpeaker = 'agent';
    } else if (isAgentPhrase) {
      currentSpeaker = 'agent';
    } else if (isCustomerPhrase) {
      currentSpeaker = 'customer';
    } else if (index > 0 && segment.start - segments[index - 1].end > 1.0) {
      // Alternate on significant pauses
      currentSpeaker = currentSpeaker === 'agent' ? 'customer' : 'agent';
    }
    
    // Assign time
    if (currentSpeaker === 'agent') {
      agentSeconds += segmentDuration;
    } else {
      customerSeconds += segmentDuration;
    }
  });

  // Round values
  agentSeconds = Math.round(agentSeconds);
  customerSeconds = Math.round(customerSeconds);
  deadAirSeconds = Math.round(deadAirSeconds);

  // Calculate percentages
  const total = agentSeconds + customerSeconds + deadAirSeconds;
  const effectiveTotal = total > 0 ? total : totalDuration;

  return {
    agentSeconds,
    customerSeconds,
    deadAirSeconds,
    agentPercent: effectiveTotal > 0 ? Math.round((agentSeconds / effectiveTotal) * 100 * 100) / 100 : 0,
    customerPercent: effectiveTotal > 0 ? Math.round((customerSeconds / effectiveTotal) * 100 * 100) / 100 : 0,
    deadAirPercent: effectiveTotal > 0 ? Math.round((deadAirSeconds / effectiveTotal) * 100 * 100) / 100 : 0,
  };
}

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
    console.log("Segments received:", whisperResult.segments?.length || 0);

    // Calculate talk metrics from segments
    const talkMetrics = calculateTalkMetrics(whisperResult.segments || [], whisperResult.duration);
    console.log("Talk metrics calculated:", talkMetrics);

    // Save to agency_calls table with talk metrics
    const { data: callRecord, error: insertError } = await supabase
      .from("agency_calls")
      .insert({
        agency_id: agencyId,
        team_member_id: teamMemberId,
        template_id: templateId,
        audio_storage_path: storagePath,
        original_filename: fileName,
        transcript: whisperResult.text,
        transcript_segments: whisperResult.segments,
        call_duration_seconds: Math.round(whisperResult.duration),
        agent_talk_seconds: talkMetrics.agentSeconds,
        customer_talk_seconds: talkMetrics.customerSeconds,
        dead_air_seconds: talkMetrics.deadAirSeconds,
        agent_talk_percent: talkMetrics.agentPercent,
        customer_talk_percent: talkMetrics.customerPercent,
        dead_air_percent: talkMetrics.deadAirPercent,
        status: "transcribed",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save call record:", insertError);
    } else {
      console.log("Call record saved:", callRecord.id);
      
      // Trigger AI analysis automatically (fire and forget - don't wait)
      if (callRecord?.id) {
        console.log("Triggering AI analysis for call:", callRecord.id);
        
        // Fire and forget - don't await, let it run in background
        fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ call_id: callRecord.id }),
        }).then(async (response) => {
          if (response.ok) {
            console.log("Analysis triggered successfully");
          } else {
            console.error("Analysis trigger failed:", await response.text());
          }
        }).catch((err) => {
          console.error("Failed to trigger analysis:", err);
        });
      }
    }

    // Update usage tracking
    const currentMonth = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { error: usageError } = await supabase.rpc("increment_call_usage", {
      p_agency_id: agencyId,
      p_month: currentMonth,
    });

    if (usageError) {
      console.error("Failed to update usage:", usageError);
    }

    // Return success response with call_id
    return new Response(
      JSON.stringify({
        success: true,
        call_id: callRecord?.id,
        storage_path: storagePath,
        transcript: whisperResult.text,
        duration_seconds: Math.round(whisperResult.duration),
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
