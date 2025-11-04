import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, token } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization: Check for either authenticated user OR valid token
    let isAuthorized = false;

    if (token) {
      // Validate token for staff access
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!
      );

      const { data: tokenData, error: tokenError } = await supabase
        .from('roleplay_access_tokens')
        .select('*')
        .eq('token', token)
        .eq('used', true)
        .eq('invalidated', false)
        .single();

      if (!tokenError && tokenData && new Date(tokenData.expires_at) > new Date()) {
        isAuthorized = true;
        console.log(`Staff access authorized via token for: ${tokenData.staff_name}`);
      }
    } else {
      // Check for authenticated user
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user) {
          isAuthorized = true;
          console.log(`Authenticated user access: ${user.id}`);
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for API key
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Grading transcript with ${messages.length} messages`);

    // Format transcript for the AI
    const formattedTranscript = messages.map((msg: any) => 
      `${msg.role === 'assistant' ? 'AI Trainer' : 'Sales Agent'}: ${msg.content}`
    ).join('\n\n');

    const gradingPrompt = `You are an expert sales performance analyst. Grade the following sales roleplay transcript based on these specific criteria.

All analysis must be:
• Specific — No vagueness or conjecture.
• Grounded — Each conclusion must cite transcript-based observations.
• Challenged — Actively attempt to disprove assumptions via cross-validation (quote + tone + sequence).
• Triple-Checked — Verify every item through at least two distinct signals.
• Structured — Follow the exact format below.
• No PII — There should NEVER be any PII (personal identifiable information) listed in a result. This includes last names, dates of birth, specific addresses, bank account info, credit card info, socials etc)

OPERATIONAL DEFINITIONS (for consistent analysis):
• Explicit Close Attempt = a direct request for commitment today (e.g., "Let's get this started," "We can activate coverage now," "Shall we lock this in today?").
• Assumptive Ownership Phrase = language implying the decision is made/inevitable (e.g., "when we switch you," "we'll keep your home protected," "your new policy will…").
• Objection Loop = Acknowledge ➜ Address/Reframe with value or proof ➜ Check ("does that solve it?") ➜ Ask again (new or repeated close).

GRADING CRITERIA:

**Information Verification**: In this section, focus on how they verify information: Basic info like the drivers, full names, DOB's, etc. I NEVER want you to bring over any Personal Identifiable Information, just go into detail on if they did, how they went about it and if they did it in a manner of conversation or more just "order take" format.

**Rapport**: Inside of this section focus on how they do with the customer and getting to know them on a personal level and getting connected with them. Do they ask about their family? Do they ask about their job? Do they ask about their things they enjoy doing or they want to do in the future? How do they do about expanding on when the customer responds with specific details that they're excited about? Does the sales person just move on or dig deeper to get the customer talking?

**Coverage Conversation**: In this section, focus on if the sales person creates the opportunity to educate the client on the coverage and what it covers. If the client has low coverage, does the sales person act alarmed and question why they chose that? Does the sales person try to educate the client on why they need more coverage? If so, how did they do so? Did they do a good job trying to explain bodily injury limits? Or what about property damage? Evaluate how the salesperson verifies the client's current coverage. Do they ask if the client understands what they have? Do they ask why the client chose that coverage? If the coverage is low, does the salesperson sound concerned and highlight the risk? If the sales person didn't address this at all, please say that as well.

**Wrap Up**: In this section, focus on wrapping up the call. Does the sales person set the frame for closing the piece of business or does the sales person simply just quote price and wait for the client to answer with their objection? If the client does give an objection, does the sales person do a good job of trying to overcome that objection or do they just let it flow? Does the sales person set the next follow up appointment and make it sound like it's a solidified time and date? Does the sales person set the expectation that they're going to send them a text to remind them or get it on the calendar via an email? Or is it simply just I'll call you at another time and no concrete plan is set? Timezone is not a concern.

**Lever Pulls**: In this section, focus on the sales person actually pulling levers. To have the opportunity to pull levers, we must first focus on having levers to pull. First and foremost did the sales person do a good job of justifying a higher presentation of liability based upon a deep conversation on what the client needs to protect? And then, secondly the moment they reached the point of resistance were they able to smoothly pivot into lower options to try to close the deal on this call? What levers mean is they are changing the coverage to re-offer based upon the clients objection of price for example, we want to really know on every single call that we score did the salesperson present the lowest option in bodily injury which would be based on the specific state if they did not then I want you to really call that out and say they simply stopped at their current presentation and did not try to dig any deeper.

TRANSCRIPT TO GRADE:
${formattedTranscript}

Use the grade_sales_call tool to provide your structured analysis.`;

    // Call Lovable AI with tool calling
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: gradingPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "grade_sales_call",
              description: "Grade a sales roleplay transcript based on specific criteria",
              parameters: {
                type: "object",
                properties: {
                  overall_score: { 
                    type: "string", 
                    description: "Overall performance rating (e.g., Excellent, Good, Needs Improvement, Poor)" 
                  },
                  information_verification: {
                    type: "object",
                    properties: {
                      summary: { type: "string", description: "Summary of information verification approach" },
                      strengths: { type: "array", items: { type: "string" }, description: "Specific strengths observed" },
                      improvements: { type: "array", items: { type: "string" }, description: "Specific areas for improvement" }
                    },
                    required: ["summary", "strengths", "improvements"]
                  },
                  rapport: {
                    type: "object",
                    properties: {
                      summary: { type: "string", description: "Summary of rapport-building approach" },
                      strengths: { type: "array", items: { type: "string" } },
                      improvements: { type: "array", items: { type: "string" } }
                    },
                    required: ["summary", "strengths", "improvements"]
                  },
                  coverage_conversation: {
                    type: "object",
                    properties: {
                      summary: { type: "string", description: "Summary of coverage discussion approach" },
                      strengths: { type: "array", items: { type: "string" } },
                      improvements: { type: "array", items: { type: "string" } }
                    },
                    required: ["summary", "strengths", "improvements"]
                  },
                  wrap_up: {
                    type: "object",
                    properties: {
                      summary: { type: "string", description: "Summary of call wrap-up approach" },
                      strengths: { type: "array", items: { type: "string" } },
                      improvements: { type: "array", items: { type: "string" } }
                    },
                    required: ["summary", "strengths", "improvements"]
                  },
                  lever_pulls: {
                    type: "object",
                    properties: {
                      summary: { type: "string", description: "Summary of lever-pulling behavior" },
                      lowest_option_presented: { 
                        type: "boolean", 
                        description: "Was the lowest state-minimum bodily injury option presented?" 
                      },
                      strengths: { type: "array", items: { type: "string" } },
                      improvements: { type: "array", items: { type: "string" } }
                    },
                    required: ["summary", "lowest_option_presented", "strengths", "improvements"]
                  }
                },
                required: ["overall_score", "information_verification", "rapport", "coverage_conversation", "wrap_up", "lever_pulls"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "grade_sales_call" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI API error:', response.status, errorText);
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Lovable AI unauthorized: missing or invalid API key' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please wait and try again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));

    // Extract the tool call result
    if (!data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      console.error('Unexpected AI response structure:', data);
      throw new Error('AI did not return structured grading data');
    }

    const gradingResult = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
    console.log('Grading completed successfully');

    return new Response(JSON.stringify(gradingResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in grade-roleplay function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to grade transcript',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
