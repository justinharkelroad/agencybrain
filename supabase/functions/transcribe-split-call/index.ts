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
async function cleanupStorage(supabase: any, storagePaths: string[]) {
  for (const storagePath of storagePaths) {
    if (!storagePath) continue;
    try {
      await supabase.storage.from("call-recordings").remove([storagePath]);
      console.log(`Cleaned up file after error: ${storagePath}`);
    } catch (cleanupError) {
      console.warn('Failed to cleanup after error:', cleanupError);
    }
  }
}

// Convert large files to OGG using Convertio API with URL input
async function convertWithConvertio(
  signedUrl: string,
  originalFilename: string
): Promise<{ buffer: ArrayBuffer; attempts: number }> {
  const maxAttempts = 5;
  const backoffDelays = [0, 30000, 60000, 90000, 120000]; // ms
  const timeoutPerAttempt = 5 * 60 * 1000; // 5 minutes

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (backoffDelays[attempt - 1] > 0) {
      console.log(`Waiting ${backoffDelays[attempt - 1] / 1000}s before Convertio retry ${attempt}...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelays[attempt - 1]));
    }

    try {
      console.log(`Convertio attempt ${attempt}/${maxAttempts}...`);

      const startResponse = await fetch('https://api.convertio.co/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: CONVERTIO_API_KEY,
          input: 'url',
          file: signedUrl,
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

      const startTime = Date.now();
      let jobStatus = 'processing';

      while ((Date.now() - startTime) < timeoutPerAttempt) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statusResponse = await fetch(`https://api.convertio.co/convert/${jobId}/status`);
        const statusData = await statusResponse.json();

        if (statusData.status !== 'ok') {
          throw new Error(`Convertio status check failed: ${statusData.error || JSON.stringify(statusData)}`);
        }

        jobStatus = statusData.data.step;
        console.log(`Convertio job ${jobId} status: ${jobStatus}`);

        if (jobStatus === 'finish') {
          const downloadUrl = statusData.data.output.url;
          console.log(`Downloading converted file from: ${downloadUrl}`);

          const downloadResponse = await fetch(downloadUrl);

          if (!downloadResponse.ok) {
            throw new Error(`Failed to download converted file: ${downloadResponse.status}`);
          }

          const convertedBuffer = await downloadResponse.arrayBuffer();
          console.log(`Converted file size: ${convertedBuffer.byteLength} bytes`);

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
  let unchangedSpeakerStreak = 0;

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
    const isAgentPhrase = /(let me|i can|we offer|your policy|your coverage|your premium|i'll send|i'll email|what i can do|i'm going to|looking at your|quote|deductible)/i.test(text);
    const isCustomerPhrase = /(i need|i want|i'm looking|how much|what about|can you|do you|i have a question|my current|i was wondering|my policy|my coverage|my payment)/i.test(text);
    const prevSpeaker = currentSpeaker;

    if (index === 0 && isGreeting) {
      currentSpeaker = 'agent';
    } else if (isAgentPhrase) {
      currentSpeaker = 'agent';
    } else if (isCustomerPhrase) {
      currentSpeaker = 'customer';
    } else if (index > 0 && segment.start - segments[index - 1].end > 1.0) {
      currentSpeaker = currentSpeaker === 'agent' ? 'customer' : 'agent';
    }

    if (currentSpeaker === prevSpeaker) {
      unchangedSpeakerStreak += 1;
      if (unchangedSpeakerStreak >= 4) {
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

// Process a single file: download, convert if needed, transcribe
async function processFile(
  supabase: any,
  storagePath: string,
  originalFilename: string,
  fileSizeBytes: number,
  mimeType: string,
  openaiApiKey: string,
  fileLabel: string
): Promise<{
  transcript: string;
  segments: any[];
  duration: number;
  whisperCost: number;
  conversionRequired: boolean;
  conversionAttempts: number;
  originalSizeBytes: number;
  convertedSizeBytes: number;
}> {
  console.log(`[${fileLabel}] Processing file from storage: ${storagePath}, size: ${fileSizeBytes} bytes`);

  // Download file from Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("call-recordings")
    .download(storagePath);

  if (downloadError || !fileData) {
    console.error(`[${fileLabel}] Storage download error:`, downloadError);
    throw new Error(`Failed to download audio file from storage: ${downloadError?.message}`);
  }

  const originalBuffer = await fileData.arrayBuffer();
  const originalFileSizeBytes = fileSizeBytes || originalBuffer.byteLength;
  let audioBuffer = originalBuffer;
  let audioFilename = originalFilename || storagePath.split('/').pop() || 'audio.wav';
  let audioMimeType = mimeType || 'audio/wav';
  let convertedFileSizeBytes = originalFileSizeBytes;
  let conversionRequired = false;
  let conversionAttempts = 0;

  console.log(`[${fileLabel}] File downloaded from storage`);

  // Check if conversion needed for large files
  if (originalFileSizeBytes > MAX_WHISPER_SIZE_BYTES) {
    if (!CONVERTIO_API_KEY) {
      throw new Error("Large file processing not configured. Please contact support.");
    }

    conversionRequired = true;
    console.log(`[${fileLabel}] File size ${originalFileSizeBytes} exceeds 25MB, converting via Convertio...`);

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("call-recordings")
      .createSignedUrl(storagePath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error(`[${fileLabel}] Failed to create signed URL:`, signedUrlError);
      throw new Error(`Failed to create signed URL for conversion: ${signedUrlError?.message}`);
    }

    const signedUrl = signedUrlData.signedUrl;
    console.log(`[${fileLabel}] Signed URL created for Convertio`);

    const conversionResult = await convertWithConvertio(signedUrl, audioFilename);
    audioBuffer = conversionResult.buffer;
    conversionAttempts = conversionResult.attempts;
    audioFilename = audioFilename.replace(/\.[^.]+$/, '.ogg');
    audioMimeType = 'audio/ogg';
    convertedFileSizeBytes = audioBuffer.byteLength;
    console.log(`[${fileLabel}] Conversion complete in ${conversionAttempts} attempt(s): ${originalFileSizeBytes} → ${convertedFileSizeBytes} bytes`);
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

      console.log(`[${fileLabel}] Whisper API attempt ${whisperAttempts}/${maxWhisperAttempts}...`);

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
      console.error(`[${fileLabel}] Whisper attempt ${whisperAttempts} failed:`, error);
      if (whisperAttempts === maxWhisperAttempts) {
        throw new Error(`Transcription failed after ${maxWhisperAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`[${fileLabel}] Transcription complete. Duration: ${whisperResult.duration} seconds, Segments: ${whisperResult.segments?.length || 0}`);

  // Calculate Whisper cost ($0.006 per minute)
  const durationMinutes = whisperResult.duration / 60;
  const whisperCost = durationMinutes * 0.006;

  return {
    transcript: whisperResult.text,
    segments: whisperResult.segments || [],
    duration: whisperResult.duration,
    whisperCost,
    conversionRequired,
    conversionAttempts,
    originalSizeBytes: originalFileSizeBytes,
    convertedSizeBytes: convertedFileSizeBytes,
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

    // Parse JSON body - expects two storage paths
    const {
      storagePath1,
      storagePath2,
      originalFilename1,
      originalFilename2,
      fileSizeBytes1,
      fileSizeBytes2,
      mimeType1,
      mimeType2,
      callId,
      agencyId,
      teamMemberId,
      templateId,
    } = await req.json();

    if (!storagePath1 || !storagePath2 || !teamMemberId || !templateId || !agencyId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: storagePath1, storagePath2, team_member_id, template_id, agency_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storagePaths = [storagePath1, storagePath2];
    console.log(`Processing split call: Part 1 = ${storagePath1}, Part 2 = ${storagePath2}`);

    try {
      // Process both files in parallel
      const [result1, result2] = await Promise.all([
        processFile(supabase, storagePath1, originalFilename1, fileSizeBytes1, mimeType1, openaiApiKey, "Part 1"),
        processFile(supabase, storagePath2, originalFilename2, fileSizeBytes2, mimeType2, openaiApiKey, "Part 2"),
      ]);

      console.log(`Part 1: ${result1.duration}s, Part 2: ${result2.duration}s`);

      // Merge transcripts
      const mergedTranscript = result1.transcript + ' ' + result2.transcript;

      // Offset Part 2 segment timestamps by Part 1 duration
      const offsetSegments = result2.segments.map((seg: any) => ({
        ...seg,
        start: seg.start + result1.duration,
        end: seg.end + result1.duration,
      }));

      // Combine segments in order
      const mergedSegments = [...result1.segments, ...offsetSegments];

      // Sum durations
      const totalDuration = result1.duration + result2.duration;

      // Sum Whisper costs
      const totalWhisperCost = result1.whisperCost + result2.whisperCost;

      // Calculate talk metrics on merged segments
      const talkMetrics = calculateTalkMetrics(mergedSegments, totalDuration);
      console.log("Merged talk metrics:", talkMetrics);

      // Track conversion info
      const conversionRequired = result1.conversionRequired || result2.conversionRequired;
      const totalConversionAttempts = result1.conversionAttempts + result2.conversionAttempts;
      const totalOriginalSizeBytes = result1.originalSizeBytes + result2.originalSizeBytes;
      const totalConvertedSizeBytes = result1.convertedSizeBytes + result2.convertedSizeBytes;

      // Save to agency_calls table with merged data
      let callRecord: any = null;

      try {
        const result = await withRetry(async () => {
          const { data, error } = await supabase
            .from("agency_calls")
            .insert({
              agency_id: agencyId,
              team_member_id: teamMemberId,
              template_id: templateId,
              audio_storage_path: storagePath1,
              original_filename: `${originalFilename1 || 'part1.wav'} + ${originalFilename2 || 'part2.wav'}`,
              transcript: mergedTranscript,
              transcript_segments: mergedSegments,
              call_duration_seconds: Math.round(totalDuration),
              agent_talk_seconds: talkMetrics.agentSeconds,
              customer_talk_seconds: talkMetrics.customerSeconds,
              dead_air_seconds: talkMetrics.deadAirSeconds,
              agent_talk_percent: talkMetrics.agentPercent,
              customer_talk_percent: talkMetrics.customerPercent,
              dead_air_percent: talkMetrics.deadAirPercent,
              whisper_cost: totalWhisperCost,
              conversion_required: conversionRequired,
              conversion_attempts: totalConversionAttempts > 0 ? totalConversionAttempts : null,
              original_file_size_bytes: totalOriginalSizeBytes,
              converted_file_size_bytes: totalConvertedSizeBytes,
              status: "transcribed",
            })
            .select()
            .single();

          if (error) throw error;
          return data;
        }, 3, 1000);

        callRecord = result;
        console.log("Split call record saved:", callRecord.id);

        // Update usage tracking - split calls count as 1 call
        const currentMonth = new Date().toISOString().slice(0, 10);
        const { error: usageError } = await supabase.rpc("increment_call_usage", {
          p_agency_id: agencyId,
          p_month: currentMonth,
        });

        if (usageError) {
          console.error("Failed to update usage:", usageError);
        } else {
          console.log("Usage incremented by 1 for split call, agency:", agencyId);
        }

      } catch (err: unknown) {
        console.error("Failed to save call record after retries:", err);
        await cleanupStorage(supabase, storagePaths);
        return new Response(
          JSON.stringify({
            error: "Failed to save call record. Please try uploading again.",
            details: err instanceof Error ? err.message : 'Unknown error',
            retryable: true
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Trigger AI analysis (fire and forget)
      if (callRecord?.id) {
        console.log("Triggering AI analysis for split call:", callRecord.id);

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

      // CLEANUP: Delete both audio files from storage
      try {
        console.log(`Cleaning up: deleting both split call files from storage...`);

        const { error: deleteError } = await supabase.storage
          .from("call-recordings")
          .remove(storagePaths);

        if (deleteError) {
          console.warn(`Failed to delete audio files: ${deleteError.message}`);
        } else {
          console.log(`Successfully deleted both split call files from storage`);
        }
      } catch (cleanupError) {
        console.warn('Storage cleanup error:', cleanupError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          call_id: callRecord?.id,
          transcript: mergedTranscript,
          duration_seconds: Math.round(totalDuration),
          segments: mergedSegments,
          is_split_call: true,
          part1_duration: Math.round(result1.duration),
          part2_duration: Math.round(result2.duration),
          conversion_required: conversionRequired,
          original_size_bytes: totalOriginalSizeBytes,
          converted_size_bytes: totalConvertedSizeBytes,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (processingError) {
      console.error("Split call processing error:", processingError);
      await cleanupStorage(supabase, storagePaths);
      return new Response(
        JSON.stringify({ error: processingError instanceof Error ? processingError.message : "Failed to process split call" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to transcribe audio" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
