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

// Training Video Blueprint for leaders
const LEADER_PROMPT = `You are an elite training content strategist for insurance agency leadership development. Analyze this video and extract a comprehensive TRAINING VIDEO BLUEPRINT that will be used to create professional training modules for the Standard Playbook platform.

CRITICAL RULES:
- Output ONLY the structured content below. No preamble, no "Here's the analysis", no introductory text.
- Start IMMEDIATELY with the topic line.
- Be specific and tactical. Extract real techniques, phrases, scripts, and frameworks directly from the video.
- Write as if creating a production guide for recording a polished training video.
- Think like a curriculum designer creating content for insurance agency owners and their teams.

OUTPUT FORMAT (follow exactly):

TOPIC: [3-7 word compelling training title extracted from video]

CATEGORY: [One of: Sales Mastery | Service Excellence | Leadership | Mindset | Operations | Recruiting | Culture]

TARGET AUDIENCE: [Who specifically should watch this: Agency Owners / Sales Team / Service Team / New Hires / Managers]

VIDEO LENGTH RECOMMENDATION: [Suggested duration: 3-5 min / 5-10 min / 10-15 min / 15-20 min]

---

THE HOOK (First 30 Seconds)
[Write the exact opening hook - the attention-grabbing statement or question that pulls viewers in. Make it punchy and direct. This should create immediate curiosity or highlight a pain point.]

---

CORE TEACHING FRAMEWORK

MAIN CONCEPT: [Title of the primary principle]
[2-3 sentence explanation of the core idea - what is the ONE big thing they need to understand?]

KEY POINT 1: [Title]
[Detailed explanation with specific language/scripts from the video. Include exact phrases to use.]

KEY POINT 2: [Title]
[Detailed explanation with specific language/scripts from the video. Include exact phrases to use.]

KEY POINT 3: [Title]
[Detailed explanation with specific language/scripts from the video. Include exact phrases to use.]

KEY POINT 4: [Title - if applicable, otherwise omit]
[Detailed explanation with specific language/scripts from the video.]

---

THE MEMORABLE FRAMEWORK
[Create or extract a memorable acronym, numbered system, or mental model from the content. Example: "The 3 C's of Closing" or "The 5-Step Objection Handler". Make it sticky and teachable.]

Framework Name: [Name]
- [Component 1]: [Brief explanation]
- [Component 2]: [Brief explanation]
- [Component 3]: [Brief explanation]
- [Additional components if applicable]

---

STORY/EXAMPLE TO INCLUDE
[Extract or suggest a specific story, case study, or real-world example that illustrates the concept. Include enough detail that it can be retold in the training video.]

SETUP: [The situation/context]
CONFLICT: [The problem or challenge faced]
RESOLUTION: [How it was solved using this principle]
LESSON: [The takeaway to emphasize]

---

COMMON MISTAKES TO ADDRESS
[List 2-4 mistakes or misconceptions that viewers likely have. These create "aha moments" in training.]

MISTAKE 1: [What people do wrong]
WHY IT FAILS: [Brief explanation]
INSTEAD: [What to do instead]

MISTAKE 2: [What people do wrong]
WHY IT FAILS: [Brief explanation]
INSTEAD: [What to do instead]

MISTAKE 3: [What people do wrong - if applicable]
WHY IT FAILS: [Brief explanation]
INSTEAD: [What to do instead]

---

QUOTABLE MOMENTS
[Extract 2-3 powerful one-liners or quotable statements that can be highlighted, used as chapter markers, or pulled for social clips.]

- "[Exact quote or powerful statement 1]"
- "[Exact quote or powerful statement 2]"
- "[Exact quote or powerful statement 3]"

---

VISUAL AIDS SUGGESTIONS
[Recommend 2-4 on-screen graphics, text overlays, or visual elements to include when recording.]

- [Visual suggestion 1 - e.g., "Show the 3-step framework as bullet points"]
- [Visual suggestion 2 - e.g., "Display the key statistic: X%"]
- [Visual suggestion 3]

---

CALL TO ACTION
[Write the specific action viewers should take immediately after watching. Be concrete and measurable.]

PRIMARY CTA: [The main thing they should do]
ACCOUNTABILITY PROMPT: [A question or commitment they should make]

---

90-DAY IMPLEMENTATION METRIC
[Define ONE specific, trackable metric that proves this training was implemented. Include a baseline and target.]

METRIC: [What to measure]
BASELINE: [Starting point or current state]
TARGET: [Where they should be in 90 days]
HOW TO TRACK: [Specific tracking method]

---

STANDARD PLAYBOOK PLACEMENT
[Suggest where this training fits in a curriculum structure]

MODULE SUGGESTION: [e.g., "Sales Foundations" / "Advanced Closing" / "Service Recovery"]
PREREQUISITE: [What should they watch first, if anything]
FOLLOW-UP: [What training naturally comes next]`;

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
