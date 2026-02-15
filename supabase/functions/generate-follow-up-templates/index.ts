import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FollowUpPromptConfig {
  crmNotes?: {
    enabled: boolean;
    instructions: string;
  };
  emailTemplate?: {
    enabled: boolean;
    tone: 'professional' | 'friendly' | 'casual';
    instructions: string;
  };
  textTemplate?: {
    enabled: boolean;
    tone: 'professional' | 'friendly' | 'casual';
    maxLength: number;
    instructions: string;
  };
}

function buildEmailPrompt(
  callData: any,
  config: FollowUpPromptConfig['emailTemplate'],
  clientFirstName: string
): string {
  const tone = config?.tone || 'professional';
  const customInstructions = config?.instructions || '';

  const toneGuidance = {
    professional: 'Use a formal, professional tone. Address the client respectfully.',
    friendly: 'Use a warm, approachable tone while remaining professional. Be personable.',
    casual: 'Use a conversational, relaxed tone. Be genuine and down-to-earth.',
  };

  return `Generate a follow-up email for an insurance client based on this call.

## CALL CONTEXT
Client Name: ${clientFirstName}
Call Summary: ${callData.summary || 'N/A'}
CRM Notes: ${JSON.stringify(callData.closing_attempts || callData.crm_notes || {}, null, 2)}
Notable Topics: ${(callData.notable_quotes || []).map((q: any) => q.context).filter(Boolean).join('; ') || 'N/A'}

## TONE
${toneGuidance[tone]}

## CUSTOM INSTRUCTIONS
${customInstructions || 'None provided - use best judgment for insurance follow-up.'}

## REQUIREMENTS
1. Keep the email concise (150-250 words)
2. Reference specific topics discussed in the call
3. Include a clear call-to-action
4. Do NOT include placeholder brackets like [Your Name] - leave those sections for the agent to fill
5. Start with a greeting that uses the client's first name
6. End with a professional sign-off (but leave the sender name blank)

## OUTPUT FORMAT
Return ONLY the email body text, no subject line, no additional commentary.`;
}

function buildTextPrompt(
  callData: any,
  config: FollowUpPromptConfig['textTemplate'],
  clientFirstName: string
): string {
  const tone = config?.tone || 'friendly';
  const maxLength = config?.maxLength || 160;
  const customInstructions = config?.instructions || '';

  const toneGuidance = {
    professional: 'Keep it brief and professional.',
    friendly: 'Be warm and personable while being concise.',
    casual: 'Use a conversational, relaxed tone.',
  };

  return `Generate a follow-up SMS/text message for an insurance client based on this call.

## CALL CONTEXT
Client Name: ${clientFirstName}
Call Summary: ${callData.summary || 'N/A'}
Key Topics: ${JSON.stringify(callData.closing_attempts || callData.crm_notes || {}, null, 2)}

## TONE
${toneGuidance[tone]}

## CUSTOM INSTRUCTIONS
${customInstructions || 'None provided - use best judgment for insurance follow-up.'}

## REQUIREMENTS
1. Maximum ${maxLength} characters
2. Reference something specific from the call
3. Include a brief call-to-action
4. Use the client's first name
5. No emojis unless the tone is casual
6. Do NOT include any placeholder text

## OUTPUT FORMAT
Return ONLY the text message content, nothing else.`;
}

serve(async (req) => {
  console.log('generate-follow-up-templates invoked');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { call_id, template_type } = await req.json();

    if (!call_id) {
      return new Response(
        JSON.stringify({ error: "Missing call_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!template_type || !['email', 'text', 'both'].includes(template_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid template_type. Must be 'email', 'text', or 'both'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating ${template_type} template(s) for call: ${call_id}`);

    // Fetch the call record with template config
    const { data: call, error: callError } = await supabase
      .from("agency_calls")
      .select(`
        *,
        call_scoring_templates (
          skill_categories
        )
      `)
      .eq("id", call_id)
      .single();

    if (callError || !call) {
      return new Response(
        JSON.stringify({ error: "Call not found", details: callError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract follow-up prompts config from template
    const skillCategories = call.call_scoring_templates?.skill_categories as any;
    const followupPrompts: FollowUpPromptConfig = skillCategories?.followupPrompts || {};

    // Get client first name from various sources
    const clientFirstName =
      call.client_profile?.client_first_name ||
      call.client_first_name ||
      'valued client';

    const results: { email?: string; text?: string } = {};
    const generateEmail = template_type === 'email' || template_type === 'both';
    const generateText = template_type === 'text' || template_type === 'both';

    // Check if email template is enabled (default: true if not specified)
    const emailEnabled = followupPrompts.emailTemplate?.enabled !== false;
    // Check if text template is enabled (default: true if not specified)
    const textEnabled = followupPrompts.textTemplate?.enabled !== false;

    // Generate email template
    if (generateEmail && emailEnabled) {
      console.log('Generating email template...');
      const emailPrompt = buildEmailPrompt(call, followupPrompts.emailTemplate, clientFirstName);

      const emailResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          messages: [
            { role: "user", content: emailPrompt }
          ],
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error("Anthropic API error (email):", errorText);
        throw new Error(`Email generation failed: ${errorText}`);
      }

      const emailResult = await emailResponse.json();
      results.email = emailResult.content?.[0]?.text || '';
      console.log('Email template generated:', results.email?.substring(0, 100));
    } else if (generateEmail && !emailEnabled) {
      console.log('Email template disabled in config');
    }

    // Generate text template
    if (generateText && textEnabled) {
      console.log('Generating text template...');
      const textPrompt = buildTextPrompt(call, followupPrompts.textTemplate, clientFirstName);

      const textResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 100,
          messages: [
            { role: "user", content: textPrompt }
          ],
        }),
      });

      if (!textResponse.ok) {
        const errorText = await textResponse.text();
        console.error("Anthropic API error (text):", errorText);
        throw new Error(`Text generation failed: ${errorText}`);
      }

      const textResult = await textResponse.json();
      results.text = textResult.content?.[0]?.text || '';
      console.log('Text template generated:', results.text);
    } else if (generateText && !textEnabled) {
      console.log('Text template disabled in config');
    }

    // Store results in database
    const updatePayload: Record<string, any> = {
      followup_generated_at: new Date().toISOString(),
    };

    if (results.email) {
      updatePayload.generated_email_template = results.email;
    }
    if (results.text) {
      updatePayload.generated_text_template = results.text;
    }

    const { error: updateError } = await supabase
      .from("agency_calls")
      .update(updatePayload)
      .eq("id", call_id);

    if (updateError) {
      console.error("Failed to save templates:", updateError);
      // Don't fail the request, still return the generated content
    }

    console.log('Templates saved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        call_id,
        templates: results,
        generated_at: updatePayload.followup_generated_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
