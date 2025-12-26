import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Learning Cycle Huddle format for community/standard users
const COMMUNITY_PROMPT = `You are a training content architect for elite insurance agencies. Analyze this video and create a comprehensive 'LEARNING CYCLE HUDDLE' training framework.

CRITICAL RULES:
- Output ONLY the structured content below. No preamble, no "Here's the breakdown", no introductory text.
- Start IMMEDIATELY with the topic name line.
- Be specific and tactical, not generic. Pull real examples, phrases, and techniques directly from the video.
- Write for insurance agency team huddles (15-20 minute sessions).

OUTPUT FORMAT (follow exactly):

TOPIC: [3-5 word topic extracted from video]

STEP 1: TRAIN (The Knowledge Transfer)

KEY CONCEPT 1: [Title]
[2-3 sentences explaining this concept with specific examples from the video]

KEY CONCEPT 2: [Title]  
[2-3 sentences explaining this concept with specific examples from the video]

KEY CONCEPT 3: [Title]
[2-3 sentences explaining this concept with specific examples from the video. If only 2 concepts are applicable, omit this one.]

CORE TAKEAWAY: [One powerful sentence summarizing the training]

STEP 2: TYPE/TEXT (The 2-3 Minute Reflection)

INSTRUCTION FOR TEAM:
[Write a specific 2-3 minute solo writing exercise. Tell them exactly what to write about - be specific to the video content. Example format: "Take 2 minutes and write down..." or "Grab your notebook and answer this question..."]

WHAT THEY'RE CAPTURING:
[Explain what insights this exercise helps them internalize]

STEP 3: TALK (The Team Discussion)

FACILITATOR OPENS WITH:
"[Provide the exact opening question the leader should ask to start discussion]"

DISCUSSION FOCUS:
Each team member shares what they're hearing or seeing for themselves - specifically how this applies to how they operate at the agency. This isn't theory; it's personal application.

FOLLOW-UP QUESTIONS:
- [Specific follow-up question #1 tied to video content]
- [Specific follow-up question #2 tied to video content]
- [Optional question #3 if applicable]

STEP 4: TEACH (The Solidification)

STAND & DELIVER:
Select one team member to stand and teach back the core concept to the group in their own words. This confirms comprehension and builds confidence.

PROMPT FOR TEACHER: "[Specific prompt for the person teaching back]"

ACTION COMMITMENT:
Before leaving, every team member states ONE specific, actionable step they will deploy from this training. Not "I'll try to..." but "I will [specific action] by [specific time]."

EXAMPLE COMMITMENTS:
- [Provide 2-3 example action commitments specific to the video content]`;

// Strategic framework for leaders
const LEADER_PROMPT = `Analyze this video and create a comprehensive STRATEGIC LEADERSHIP FRAMEWORK.

MANDATORY RULES:
1. START immediately with a Markdown Level 1 Headline (#) followed by a descriptive 3-5 word topic name extracted from the video content.
2. Use Markdown hierarchy throughout.
3. Focus on high-level strategic insights, not tactical details.
4. Follow this EXACT structure:

# [TOPIC TITLE]

## EXECUTIVE SUMMARY
Provide a 2-3 sentence executive summary of the video's core strategic message.

## STRATEGIC PILLARS
Identify 3-5 strategic pillars or principles from this content that drive organizational success.

## LEADERSHIP FRAMEWORK
- What mindset shifts must leaders adopt?
- What behaviors must leaders model?
- How should leaders communicate this to their teams?

## IMPLEMENTATION ROADMAP
### Week 1-2: Foundation
### Week 3-4: Execution
### Month 2-3: Scaling

## KEY PERFORMANCE INDICATORS
List 3-5 measurable outcomes to track success of implementing this strategy.

## COMMON PITFALLS
Identify 3-5 mistakes leaders often make when implementing these concepts.

## COACHING QUESTIONS
Provide 5-7 powerful questions leaders can use in 1:1s to drive accountability around this topic.`;

// Upload file to Gemini Files API
async function uploadToGeminiFiles(
  apiKey: string,
  fileBytes: Uint8Array,
  mimeType: string,
  displayName: string
): Promise<string> {
  console.log(`Uploading to Gemini Files API: ${displayName} (${mimeType}, ${fileBytes.length} bytes)`);
  
  // Step 1: Start resumable upload
  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(fileBytes.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: { display_name: displayName }
      })
    }
  );

  if (!startResponse.ok) {
    const errorText = await startResponse.text();
    throw new Error(`Failed to start upload: ${startResponse.status} - ${errorText}`);
  }

  const uploadUrl = startResponse.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) {
    throw new Error('No upload URL returned from Gemini');
  }

  console.log('Got upload URL, uploading file bytes...');

  // Step 2: Upload the file bytes
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(fileBytes.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: fileBytes,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload file: ${uploadResponse.status} - ${errorText}`);
  }

  const uploadResult = await uploadResponse.json();
  const fileUri = uploadResult.file?.uri;
  
  if (!fileUri) {
    throw new Error('No file URI returned from Gemini upload');
  }

  console.log(`File uploaded successfully: ${fileUri}`);
  return fileUri;
}

// Wait for file to be processed by Gemini
async function waitForFileProcessing(apiKey: string, fileUri: string, maxWaitMs = 120000): Promise<void> {
  const fileName = fileUri.split('/').pop();
  const startTime = Date.now();
  
  console.log(`Waiting for file processing: ${fileName}`);
  
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to check file status: ${response.status} - ${errorText}`);
    }
    
    const fileInfo = await response.json();
    const state = fileInfo.state;
    
    console.log(`File state: ${state}`);
    
    if (state === 'ACTIVE') {
      console.log('File is ready for processing');
      return;
    } else if (state === 'FAILED') {
      throw new Error('File processing failed in Gemini');
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Timeout waiting for file processing');
}

// Delete file from Gemini Files API
async function deleteGeminiFile(apiKey: string, fileUri: string): Promise<void> {
  const fileName = fileUri.split('/').pop();
  try {
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}`,
      { method: 'DELETE' }
    );
    console.log(`Deleted Gemini file: ${fileName}`);
  } catch (e) {
    console.error('Failed to delete Gemini file (non-critical):', e);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let geminiFileUri: string | null = null;
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

  try {
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { storagePath, moduleId, agencyId, userId, role = 'community' } = await req.json();

    if (!storagePath || !moduleId || !agencyId || !userId) {
      throw new Error("Missing required parameters: storagePath, moduleId, agencyId, userId");
    }

    console.log(`Processing video: ${storagePath} for module ${moduleId}`);

    // Update status to processing
    await supabase
      .from('video_training_modules')
      .update({ status: 'processing' })
      .eq('id', moduleId);

    // Download video from storage as stream/blob (not loading fully into memory for base64)
    const { data: videoData, error: downloadError } = await supabase.storage
      .from('training-assets')
      .download(storagePath);

    if (downloadError) {
      throw new Error(`Failed to download video: ${downloadError.message}`);
    }

    // Get file bytes for Gemini upload
    const fileBytes = new Uint8Array(await videoData.arrayBuffer());
    
    // Determine MIME type from extension
    const extension = storagePath.split('.').pop()?.toLowerCase() || 'mp4';
    const mimeTypes: Record<string, string> = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska',
    };
    const mimeType = mimeTypes[extension] || 'video/mp4';
    const displayName = storagePath.split('/').pop() || 'video';

    // Upload to Gemini Files API (avoids base64 in-memory conversion)
    geminiFileUri = await uploadToGeminiFiles(geminiApiKey, fileBytes, mimeType, displayName);
    
    // Wait for Gemini to process the file
    await waitForFileProcessing(geminiApiKey, geminiFileUri);

    // Select prompt based on role
    const prompt = role === 'leader' ? LEADER_PROMPT : COMMUNITY_PROMPT;

    console.log(`Calling Gemini API with ${role} prompt using file URI...`);

    // Call Gemini API using file URI instead of inline base64
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              fileData: {
                mimeType: mimeType,
                fileUri: geminiFileUri
              }
            }]
          }],
          systemInstruction: {
            parts: [{ text: prompt }]
          },
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiResult = await geminiResponse.json();
    const analysisText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysisText) {
      throw new Error("No analysis returned from Gemini");
    }

    // Extract title - check for TOPIC: line first (community format), then H1
    const lines = analysisText.split('\n');
    const topicLine = lines.find((l: string) => l.startsWith('TOPIC:'));
    const h1Line = lines.find((l: string) => l.startsWith('# '));
    const title = topicLine 
      ? topicLine.replace('TOPIC:', '').trim()
      : h1Line 
        ? h1Line.replace('# ', '').trim() 
        : 'Training Module';

    console.log(`Analysis complete. Title: "${title}"`);

    // Update module with results
    const { error: updateError } = await supabase
      .from('video_training_modules')
      .update({
        title,
        content: analysisText,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId);

    if (updateError) {
      throw new Error(`Failed to save results: ${updateError.message}`);
    }

    // Delete video from Supabase storage (auto-cleanup)
    const { error: deleteError } = await supabase.storage
      .from('training-assets')
      .remove([storagePath]);

    if (deleteError) {
      console.error('Video cleanup failed (non-critical):', deleteError);
    } else {
      await supabase
        .from('video_training_modules')
        .update({ video_deleted_at: new Date().toISOString() })
        .eq('id', moduleId);
    }

    // Clean up Gemini file
    if (geminiFileUri) {
      await deleteGeminiFile(geminiApiKey, geminiFileUri);
    }

    console.log(`Successfully processed module ${moduleId}: "${title}"`);

    return new Response(
      JSON.stringify({ success: true, moduleId, title }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);

    // Clean up Gemini file on error
    if (geminiFileUri && geminiApiKey) {
      await deleteGeminiFile(geminiApiKey, geminiFileUri);
    }

    // Try to mark module as failed
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const body = await req.clone().json().catch(() => ({}));

      if (body.moduleId) {
        await supabase
          .from('video_training_modules')
          .update({ 
            status: 'failed', 
            error_message: error instanceof Error ? error.message : 'Unknown error' 
          })
          .eq('id', body.moduleId);
      }
    } catch (e) {
      console.error("Failed to update error status:", e);
    }

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
