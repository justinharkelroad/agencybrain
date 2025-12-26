import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Learning Cycle Huddle format for community/standard users
const COMMUNITY_PROMPT = `Analyze this video and reframe it into 'THE STANDARD PLAYBOOK: LEARNING CYCLE HUDDLE'.

MANDATORY RULES:
1. START immediately with a Markdown Level 1 Headline (#) followed by a descriptive 3-5 word topic name extracted from the video content.
2. Use Markdown hierarchy throughout.
3. Follow this EXACT structure:

# THE STANDARD PLAYBOOK: LEARNING CYCLE HUDDLE

## STEP 1: TRAIN
Provide the specific core tactical principle from this video. What is the ONE key concept the team needs to understand?

## STEP 2: TYPE/TEXT
Create a 3-5 minute writing prompt for team processing. What should they write about to internalize this concept?

## STEP 3: TALK
Provide facilitation discussion pointers. What questions should the leader ask to generate discussion?

## STEP 4: TEACH
Design a group solidification stand-up task. How can the team demonstrate understanding through action?

## VIDEO TRAINING KEY POINTS
- Provide 5-7 high-impact bullet points summarizing the most valuable insights from this video.

## 90-DAY FORMULA GOAL
Create a specific, trackable metric or goal derived from this content that can be achieved in 90 days.

## THE CORE STRATEGY
Provide an executive-level strategic takeaway. What is the overarching principle leaders should implement?

## IMPLEMENTATION STEPS
- List 3-5 concrete action items to put this training into practice immediately.`;

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
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

    // Download video from storage (training-assets bucket, video-analysis path)
    const { data: videoData, error: downloadError } = await supabase.storage
      .from('training-assets')
      .download(storagePath);

    if (downloadError) {
      throw new Error(`Failed to download video: ${downloadError.message}`);
    }

    // Convert to base64
    const arrayBuffer = await videoData.arrayBuffer();
    const base64Video = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

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

    // Select prompt based on role
    const prompt = role === 'leader' ? LEADER_PROMPT : COMMUNITY_PROMPT;

    console.log(`Calling Gemini API with ${role} prompt...`);

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              inlineData: {
                mimeType: mimeType,
                data: base64Video
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

    // Extract title from first H1 heading
    const lines = analysisText.split('\n');
    const h1Line = lines.find((l: string) => l.startsWith('# '));
    const title = h1Line ? h1Line.replace('# ', '').trim() : 'Training Module';

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

    // Delete video from storage (auto-cleanup)
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

    console.log(`Successfully processed module ${moduleId}: "${title}"`);

    return new Response(
      JSON.stringify({ success: true, moduleId, title }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);

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
