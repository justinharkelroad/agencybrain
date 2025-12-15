import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONVERTIO_API_KEY = Deno.env.get('CONVERTIO_API_KEY');
const MAX_WHISPER_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

// Retry helper for transient network errors
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isTransient = error.message?.includes('connection reset') ||
                          error.message?.includes('timeout') ||
                          error.message?.includes('ECONNRESET') ||
                          error.message?.includes('network');
      
      if (!isTransient || attempt === maxAttempts) {
        throw error;
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms due to: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Convert large files to OGG using Convertio API with URL input (not base64)
async function convertWithConvertio(
  signedUrl: string,
  originalFilename: string
): Promise<ArrayBuffer> {
  const maxAttempts = 5;
  const backoffDelays = [0, 30000, 60000, 90000, 120000]; // ms
  const timeoutPerAttempt = 5 * 60 * 1000; // 5 minutes
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait before retry (exponential backoff)
    if (backoffDelays[attempt] > 0) {
      console.log(`Waiting ${backoffDelays[attempt] / 1000}s before Convertio retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelays[attempt]));
    }
    
    try {
      console.log(`Convertio attempt ${attempt + 1}/${maxAttempts}...`);
      
      // Step 1: Start conversion job using URL input (NOT base64)
      const startResponse = await fetch('https://api.convertio.co/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: CONVERTIO_API_KEY,
          input: 'url',           // Use URL instead of base64
          file: signedUrl,        // Pass the signed URL
          filename: originalFilename,
          outputformat: 'ogg'
        })
      });
      
      const startData = await startResponse.json();
      
      if (startData.status !== 'ok') {
        throw new Error(`Convertio start failed: ${startData.error || JSON.stringify(startData)}`);
      }
      
      const jobId = startData.data.id;
      console.log(`Convertio job started: ${jobId}`);
      
      // Step 2: Poll for completion
      const startTime = Date.now();
      let jobStatus = 'processing';
      
      while ((Date.now() - startTime) < timeoutPerAttempt) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
        
        const statusResponse = await fetch(`https://api.convertio.co/convert/${jobId}/status`);
        const statusData = await statusResponse.json();
        
        if (statusData.status !== 'ok') {
          throw new Error(`Convertio status check failed: ${statusData.error || JSON.stringify(statusData)}`);
        }
        
        jobStatus = statusData.data.step;
        console.log(`Convertio job ${jobId} status: ${jobStatus}`);
        
        if (jobStatus === 'finish') {
          // Step 3: Download converted file
          const downloadUrl = statusData.data.output.url;
          console.log(`Downloading converted file from: ${downloadUrl}`);
          
          const downloadResponse = await fetch(downloadUrl);
          
          if (!downloadResponse.ok) {
            throw new Error(`Failed to download converted file: ${downloadResponse.status}`);
          }
          
          const convertedBuffer = await downloadResponse.arrayBuffer();
          console.log(`Converted file size: ${convertedBuffer.byteLength} bytes`);
          
          // Step 4: Clean up job
          try {
            await fetch(`https://api.convertio.co/convert/${jobId}`, { method: 'DELETE' });
          } catch (cleanupError) {
            console.warn('Failed to cleanup Convertio job:', cleanupError);
          }
          
          return convertedBuffer;
        }
        
        if (jobStatus === 'error') {
          throw new Error(`Convertio conversion error: ${statusData.data.error || 'Unknown error'}`);
        }
      }
      
      // Timeout reached - clean up and throw
      console.log(`Convertio timeout reached, cleaning up job ${jobId}`);
      try {
        await fetch(`https://api.convertio.co/convert/${jobId}`, { method: 'DELETE' });
      } catch (e) { /* ignore cleanup errors */ }
      
      throw new Error('Convertio conversion timed out');
      
    } catch (error) {
      console.error(`Convertio attempt ${attempt + 1} failed:`, error);
      
      if (attempt === maxAttempts - 1) {
        throw new Error('Unable to process this file due to size. Please contact AgencyBrain with questions.');
      }
      // Continue to next attempt
    }
  }
  
  throw new Error('Unable to process this file due to size. Please contact AgencyBrain with questions.');
}

// Calculate talk metrics from Whisper segments
function calculateTalkMetrics(segments: any[], totalDuration: number) {
  let agentSeconds = 0;
  let customerSeconds = 0;
  let lastEndTime = 0;
  let deadAirSeconds = 0;
  let currentSpeaker = 'agent';
  
  segments.forEach((segment, index) => {
    const segmentDuration = segment.end - segment.start;
    const text = segment.text?.toLowerCase() || '';
    
    if (segment.start > lastEndTime) {
      const gap = segment.start - lastEndTime;
      if (gap > 0.5) {
        deadAirSeconds += gap;
      }
    }
    lastEndTime = segment.end;
    
    const isGreeting = /^(hi|hello|hey|thank you for calling|thanks for calling|good morning|good afternoon)/i.test(text.trim());
    const isAgentPhrase = /(let me|i can|we offer|your policy|your coverage|your premium|i'll send|i'll email|what i can do|i'm going to|looking at your)/i.test(text);
    const isCustomerPhrase = /(i need|i want|i'm looking|how much|what about|can you|do you|i have a question|my current|i was wondering)/i.test(text);
    
    if (index === 0 && isGreeting) {
      currentSpeaker = 'agent';
    } else if (isAgentPhrase) {
      currentSpeaker = 'agent';
    } else if (isCustomerPhrase) {
      currentSpeaker = 'customer';
    } else if (index > 0 && segment.start - segments[index - 1].end > 1.0) {
      currentSpeaker = currentSpeaker === 'agent' ? 'customer' : 'agent';
    }
    
    if (currentSpeaker === 'agent') {
      agentSeconds += segmentDuration;
    } else {
      customerSeconds += segmentDuration;
    }
  });

  agentSeconds = Math.round(agentSeconds);
  customerSeconds = Math.round(customerSeconds);
  deadAirSeconds = Math.round(deadAirSeconds);

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Get original file buffer
    const originalBuffer = await audioFile.arrayBuffer();
    const originalFileSizeBytes = originalBuffer.byteLength;
    let audioBuffer = originalBuffer;
    let audioFilename = fileName;
    let audioMimeType = audioFile.type;
    let convertedFileSizeBytes = originalFileSizeBytes;
    let conversionRequired = false;

    // Generate unique storage path
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${agencyId}/${teamMemberId}/${timestamp}_${sanitizedFileName}`;

    // STEP 1: Upload original file to storage FIRST (before any conversion check)
    console.log("Uploading original file to storage...");
    const { error: uploadError } = await supabase.storage
      .from("call-recordings")
      .upload(storagePath, originalBuffer, {
        contentType: audioFile.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload audio file", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Original file uploaded to storage:", storagePath);

    // STEP 2: Check if conversion needed for large files
    if (originalFileSizeBytes > MAX_WHISPER_SIZE_BYTES) {
      if (!CONVERTIO_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Large file processing not configured. Please contact support." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      conversionRequired = true;
      console.log(`File size ${originalFileSizeBytes} exceeds 25MB, converting via Convertio using URL...`);
      
      // Generate signed URL for Convertio to fetch the file (valid for 1 hour)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("call-recordings")
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error("Failed to create signed URL:", signedUrlError);
        return new Response(
          JSON.stringify({ error: "Failed to create signed URL for conversion", details: signedUrlError?.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const signedUrl = signedUrlData.signedUrl;
      console.log("Signed URL created for Convertio");
      
      try {
        // Pass the signed URL to Convertio (no base64 encoding needed!)
        audioBuffer = await convertWithConvertio(signedUrl, fileName);
        audioFilename = fileName.replace(/\.[^.]+$/, '.ogg');
        audioMimeType = 'audio/ogg';
        convertedFileSizeBytes = audioBuffer.byteLength;
        
        console.log(`Conversion complete: ${originalFileSizeBytes} → ${convertedFileSizeBytes} bytes`);
      } catch (conversionError) {
        console.error("Conversion failed:", conversionError);
        return new Response(
          JSON.stringify({ error: conversionError.message || "Unable to process this file due to size. Please contact AgencyBrain with questions." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Send to Whisper API with retry
    let whisperResult: any = null;
    let whisperAttempts = 0;
    const maxWhisperAttempts = 3;

    while (!whisperResult && whisperAttempts < maxWhisperAttempts) {
      whisperAttempts++;
      try {
        const whisperFormData = new FormData();
        whisperFormData.append("file", new Blob([audioBuffer], { type: audioMimeType }), audioFilename);
        whisperFormData.append("model", "whisper-1");
        whisperFormData.append("response_format", "verbose_json");
        whisperFormData.append("timestamp_granularities[]", "segment");

        console.log(`Whisper API attempt ${whisperAttempts}/${maxWhisperAttempts}...`);

        const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
          },
          body: whisperFormData,
        });

        if (!whisperResponse.ok) {
          const errorText = await whisperResponse.text();
          throw new Error(`Whisper API error: ${errorText}`);
        }

        whisperResult = await whisperResponse.json();
      } catch (error) {
        console.error(`Whisper attempt ${whisperAttempts} failed:`, error);
        if (whisperAttempts === maxWhisperAttempts) {
          return new Response(
            JSON.stringify({ error: "Transcription failed. Please try again.", details: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log("Transcription complete. Duration:", whisperResult.duration, "seconds");
    console.log("Segments received:", whisperResult.segments?.length || 0);

    // Calculate Whisper cost ($0.006 per minute)
    const durationMinutes = whisperResult.duration / 60;
    const whisperCost = durationMinutes * 0.006;
    console.log(`Whisper cost for ${durationMinutes.toFixed(2)} minutes: $${whisperCost.toFixed(4)}`);

    // Calculate talk metrics
    const talkMetrics = calculateTalkMetrics(whisperResult.segments || [], whisperResult.duration);
    console.log("Talk metrics calculated:", talkMetrics);

    // Save to agency_calls table with conversion tracking
    let callRecord: any = null;
    
    try {
      const result = await withRetry(async () => {
        const { data, error } = await supabase
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
            whisper_cost: whisperCost,
            conversion_required: conversionRequired,
            original_file_size_bytes: originalFileSizeBytes,
            converted_file_size_bytes: convertedFileSizeBytes,
            status: "transcribed",
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }, 3, 1000);
      
      callRecord = result;
      console.log("Call record saved:", callRecord.id);

      // Update usage tracking ONLY after successful insert
      const currentMonth = new Date().toISOString().slice(0, 10);
      const { error: usageError } = await supabase.rpc("increment_call_usage", {
        p_agency_id: agencyId,
        p_month: currentMonth,
      });

      if (usageError) {
        console.error("Failed to update usage:", usageError);
      } else {
        console.log("Usage incremented for agency:", agencyId);
      }

    } catch (err) {
      console.error("Failed to save call record after retries:", err);
      return new Response(
        JSON.stringify({ 
          error: "Failed to save call record. Please try uploading again.", 
          details: err.message,
          retryable: true 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trigger AI analysis automatically (fire and forget)
    if (callRecord?.id) {
      console.log("Triggering AI analysis for call:", callRecord.id);
      
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

    return new Response(
      JSON.stringify({
        success: true,
        call_id: callRecord?.id,
        storage_path: storagePath,
        transcript: whisperResult.text,
        duration_seconds: Math.round(whisperResult.duration),
        segments: whisperResult.segments || [],
        language: whisperResult.language,
        conversion_required: conversionRequired,
        original_size_bytes: originalFileSizeBytes,
        converted_size_bytes: convertedFileSizeBytes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to transcribe audio" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
