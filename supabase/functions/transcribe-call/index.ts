import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = lastError.message;
      const isTransient = errorMsg?.includes('connection reset') ||
                          errorMsg?.includes('timeout') ||
                          errorMsg?.includes('ECONNRESET') ||
                          errorMsg?.includes('network');

      if (!isTransient || attempt === maxAttempts) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms due to: ${errorMsg}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Helper to cleanup storage on error
async function cleanupStorage(supabase: any, storagePath: string | null) {
  if (!storagePath) return;
  try {
    await supabase.storage.from("call-recordings").remove([storagePath]);
    console.log(`Cleaned up file after error: ${storagePath}`);
  } catch (cleanupError) {
    console.warn('Failed to cleanup after error:', cleanupError);
  }
}

// Convert large files to OGG using Convertio API with URL input (not base64)
// Returns both the converted buffer AND the number of attempts used
async function convertWithConvertio(
  signedUrl: string,
  originalFilename: string
): Promise<{ buffer: ArrayBuffer; attempts: number }> {
  const maxAttempts = 5;
  const backoffDelays = [0, 30000, 60000, 90000, 120000]; // ms
  const timeoutPerAttempt = 5 * 60 * 1000; // 5 minutes
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Wait before retry (exponential backoff)
    if (backoffDelays[attempt - 1] > 0) {
      console.log(`Waiting ${backoffDelays[attempt - 1] / 1000}s before Convertio retry ${attempt}...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelays[attempt - 1]));
    }
    
    try {
      console.log(`Convertio attempt ${attempt}/${maxAttempts}...`);
      
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
          
          return { buffer: convertedBuffer, attempts: attempt };
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
      console.error(`Convertio attempt ${attempt} failed:`, error);
      
      if (attempt === maxAttempts) {
        throw new Error('Unable to process this file due to size. Please contact AgencyBrain with questions.');
      }
      // Continue to next attempt
    }
  }
  
  throw new Error('Unable to process this file due to size. Please contact AgencyBrain with questions.');
}

// Calculate talk metrics from Whisper segments with improved heuristics
// Uses confidence scoring, smoothing window, and hysteresis to reduce variance
function calculateTalkMetrics(segments: any[], totalDuration: number) {
  let agentSeconds = 0;
  let customerSeconds = 0;
  let deadAirSeconds = 0;
  let lastEndTime = 0;
  
  // Expanded keyword patterns for better speaker detection
  const agentPatterns = [
    /\b(your policy|your account|your coverage|your premium|your deductible)\b/i,
    /\b(let me|i can|i'll|i will|we offer|we have|we can)\b/i,
    /\b(looking at your|pulling up|checking your|i see here)\b/i,
    /\b(effective date|renewal|claims?|endorsement)\b/i,
    /\b(is there anything else|have a great day|thank you for calling)\b/i,
    /\b(what i can do|how can i help|may i help)\b/i,
  ];
  
  const customerPatterns = [
    /\b(i need|i want|i'm looking|i am looking|i was wondering)\b/i,
    /\b(how much|what about|can you|could you|do you)\b/i,
    /\b(my policy|my account|my car|my house|my payment|my coverage)\b/i,
    /\b(i have a question|i'm calling|i am calling|calling about)\b/i,
    /\b(the reason i'm calling|i received|i got a)\b/i,
  ];
  
  // Score each segment's agent probability (0-100)
  const segmentScores: number[] = segments.map((segment, index) => {
    const text = segment.text?.toLowerCase() || '';
    let agentScore = 50; // neutral baseline
    
    // Keyword scoring (+/- 25 points per match)
    agentPatterns.forEach(pattern => {
      if (pattern.test(text)) agentScore += 25;
    });
    customerPatterns.forEach(pattern => {
      if (pattern.test(text)) agentScore -= 25;
    });
    
    // First segment greeting bonus for agent
    if (index === 0 && /^(hi|hello|thank you for calling|good morning|good afternoon)/i.test(text.trim())) {
      agentScore += 30;
    }
    
    // Clamp to 0-100
    return Math.max(0, Math.min(100, agentScore));
  });
  
  // Apply 3-segment smoothing window to reduce single-segment noise
  const smoothedScores: number[] = segmentScores.map((score, index) => {
    const window = [
      segmentScores[index - 2] ?? score,
      segmentScores[index - 1] ?? score,
      score
    ];
    // Weighted average: current segment counts more (20/30/50 weights)
    return (window[0] * 0.2 + window[1] * 0.3 + window[2] * 0.5);
  });
  
  // Determine speaker per segment with hysteresis to prevent flapping
  let currentSpeaker = 'agent';
  const SWITCH_THRESHOLD = 15; // Must differ by 15+ points from neutral (50) to switch
  let unchangedSpeakerStreak = 0;
  
  segments.forEach((segment, index) => {
    const segmentDuration = segment.end - segment.start;
    const smoothedScore = smoothedScores[index];
    
    // Dead air calculation (gaps > 0.5s)
    if (segment.start > lastEndTime) {
      const gap = segment.start - lastEndTime;
      if (gap > 0.5) deadAirSeconds += gap;
    }
    lastEndTime = segment.end;
    
    const text = segment.text?.toLowerCase() || '';
    const prevSpeaker = currentSpeaker;

    // Strong lexical cues should override smoothing when one-sided
    const hasStrongAgentCue = /\b(let me|i can|i'll|we can|your policy|your coverage|premium|quote)\b/i.test(text);
    const hasStrongCustomerCue = /\b(my policy|my coverage|my payment|i need|i want|i was wondering|can you)\b/i.test(text);

    if (hasStrongAgentCue && !hasStrongCustomerCue) {
      currentSpeaker = 'agent';
    } else if (hasStrongCustomerCue && !hasStrongAgentCue) {
      currentSpeaker = 'customer';
    } else if (smoothedScore > 50 + SWITCH_THRESHOLD) {
      currentSpeaker = 'agent';
    } else if (smoothedScore < 50 - SWITCH_THRESHOLD) {
      currentSpeaker = 'customer';
    }
    // If between 35-65 with no strong lexical cue, keep current speaker (hysteresis)
    
    // Long gap (>2.5s) as tiebreaker only when score is neutral
    if (smoothedScore >= 35 && smoothedScore <= 65 && index > 0) {
      const gapFromPrevious = segment.start - segments[index - 1].end;
      if (gapFromPrevious > 1.0) {
        currentSpeaker = currentSpeaker === 'agent' ? 'customer' : 'agent';
      }
    }

    // Safety valve: if we haven't switched in many segments, force a turn on neutral content.
    if (currentSpeaker === prevSpeaker) {
      unchangedSpeakerStreak += 1;
      if (unchangedSpeakerStreak >= 4 && smoothedScore >= 40 && smoothedScore <= 60) {
        currentSpeaker = currentSpeaker === 'agent' ? 'customer' : 'agent';
        unchangedSpeakerStreak = 0;
      }
    } else {
      unchangedSpeakerStreak = 0;
    }
    
    if (currentSpeaker === 'agent') {
      agentSeconds += segmentDuration;
    } else {
      customerSeconds += segmentDuration;
    }
  });
  
  // If classifier collapses to one speaker on a multi-segment call, rebalance with turn-taking fallback
  if (segments.length >= 8 && (agentSeconds === 0 || customerSeconds === 0)) {
    agentSeconds = 0;
    customerSeconds = 0;
    let fallbackSpeaker = 'agent';
    segments.forEach((segment: any, index: number) => {
      const segmentDuration = Math.max(0, (segment.end || 0) - (segment.start || 0));
      if (index > 0) {
        const gap = (segment.start || 0) - (segments[index - 1].end || 0);
        if (gap > 0.8) {
          fallbackSpeaker = fallbackSpeaker === 'agent' ? 'customer' : 'agent';
        }
      }
      if (fallbackSpeaker === 'agent') agentSeconds += segmentDuration;
      else customerSeconds += segmentDuration;
      fallbackSpeaker = fallbackSpeaker === 'agent' ? 'customer' : 'agent';
    });
  }

  // Round and calculate percentages
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

    // Parse JSON body (client uploads to Storage first, then sends path here)
    const {
      storagePath,
      originalFilename,
      fileSizeBytes,
      mimeType,
      callId,
      agencyId,
      teamMemberId,
      templateId,
    } = await req.json();

    if (!storagePath || !teamMemberId || !templateId || !agencyId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: storagePath, team_member_id, template_id, agency_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing file from storage: ${storagePath}, size: ${fileSizeBytes} bytes`);

    // Download file from Storage (client already uploaded it)
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("call-recordings")
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error("Storage download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download audio file from storage", details: downloadError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get file buffer
    const originalBuffer = await fileData.arrayBuffer();
    const originalFileSizeBytes = fileSizeBytes || originalBuffer.byteLength;
    let audioBuffer = originalBuffer;
    let audioFilename = originalFilename || storagePath.split('/').pop() || 'audio.wav';
    let audioMimeType = mimeType || 'audio/wav';
    let convertedFileSizeBytes = originalFileSizeBytes;
  let conversionRequired = false;
  let conversionAttempts = 0;

  console.log("File downloaded from storage:", storagePath);

    // STEP 2: Check if conversion needed for large files
    if (originalFileSizeBytes > MAX_WHISPER_SIZE_BYTES) {
      if (!CONVERTIO_API_KEY) {
        await cleanupStorage(supabase, storagePath);
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
        await cleanupStorage(supabase, storagePath);
        return new Response(
          JSON.stringify({ error: "Failed to create signed URL for conversion", details: signedUrlError?.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const signedUrl = signedUrlData.signedUrl;
      console.log("Signed URL created for Convertio");
      
      try {
        // Pass the signed URL to Convertio (no base64 encoding needed!)
        const conversionResult = await convertWithConvertio(signedUrl, audioFilename);
        audioBuffer = conversionResult.buffer;
        conversionAttempts = conversionResult.attempts;
        audioFilename = audioFilename.replace(/\.[^.]+$/, '.ogg');
        audioMimeType = 'audio/ogg';
        convertedFileSizeBytes = audioBuffer.byteLength;
        console.log(`Conversion complete in ${conversionAttempts} attempt(s): ${originalFileSizeBytes} → ${convertedFileSizeBytes} bytes`);
      } catch (conversionError: unknown) {
        console.error("Conversion failed:", conversionError);
        await cleanupStorage(supabase, storagePath);
        return new Response(
          JSON.stringify({ error: conversionError instanceof Error ? conversionError.message : "Unable to process this file due to size. Please contact AgencyBrain with questions." }),
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
          await cleanupStorage(supabase, storagePath);
          return new Response(
            JSON.stringify({ error: "Transcription failed. Please try again.", details: error instanceof Error ? error.message : 'Unknown error' }),
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
            original_filename: originalFilename || audioFilename,
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
            conversion_attempts: conversionAttempts > 0 ? conversionAttempts : null,
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

    } catch (err: unknown) {
      console.error("Failed to save call record after retries:", err);
      await cleanupStorage(supabase, storagePath);
      return new Response(
        JSON.stringify({
          error: "Failed to save call record. Please try uploading again.",
          details: err instanceof Error ? err.message : 'Unknown error',
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

    // CLEANUP: Delete audio file from storage after successful processing
    // We only need the transcript and analysis, not the audio file
    try {
      console.log(`Cleaning up: deleting ${storagePath} from storage...`);
      
      const { error: deleteError } = await supabase.storage
        .from("call-recordings")
        .remove([storagePath]);
      
      if (deleteError) {
        console.warn(`Failed to delete audio file: ${deleteError.message}`);
        // Don't throw - cleanup failure shouldn't fail the whole operation
      } else {
        console.log(`Successfully deleted ${storagePath} from storage`);
      }
    } catch (cleanupError) {
      console.warn('Storage cleanup error:', cleanupError);
      // Continue anyway - transcription/analysis succeeded
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_id: callRecord?.id,
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to transcribe audio" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper to cleanup storage on early failures (called from error paths above)
// Note: For errors after storage upload, we should also clean up
// This is handled inline in the main try block for specific error cases
