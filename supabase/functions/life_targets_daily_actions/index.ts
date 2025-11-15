import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface DomainInput {
  target?: string;
  monthlyMissions?: Record<string, any>;
  narrative?: string;
}

interface BatchInput {
  body?: DomainInput;
  being?: DomainInput;
  balance?: DomainInput;
  business?: DomainInput;
}

interface DailyActionsOutput {
  body: string[];
  being: string[];
  balance: string[];
  business: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: BatchInput = await req.json();

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Generating daily actions for batch:', JSON.stringify(input, null, 2));

    const systemPrompt = `You are an expert life coach specializing in creating sustainable DAILY habits.

🚨 CRITICAL RULE: Every action MUST be repeatable EVERY SINGLE DAY without exception.

For each domain provided, generate 10 SIMPLE daily action options that support the quarterly target.

Each action MUST:
- Be doable literally EVERY day (365 days per year, including weekends, holidays, sick days)
- Take 5-30 minutes maximum
- Be specific and concrete (not vague goals)
- Start with an action verb (Read, Write, Practice, Do, Walk, Call, Journal, etc.)
- Be sustainable to repeat daily indefinitely
- Describe a repeatable personal behavior, not an appointment, not a scheduled event, and not something that depends on a calendar
- Be something the person can initiate on their own, even if others may or may not participate
- Explicitly include an approximate time (for example: "for 10 minutes", "for 20 minutes", "for about 5 minutes")

Must NOT contain these words or phrases:
"weekly", "once a week", "every Sunday", "Sundays", "monthly", "once a month", "quarterly", "event", "meeting", "service project", "game night", "outing", "gathering", "every weekend", "bi-weekly", "semi-monthly"

Do not generate actions that:
- Require a specific day of the week
- Require a specific time of the month  
- Depend on external events being scheduled (meetings, services, events, trips, gatherings)
- Require other people to be present or agree to participate

INVALID EXAMPLES (DO NOT GENERATE):
❌ "Attend youth group meetings once a week" (weekly, not daily + contains "meeting")
❌ "Plan a family outing monthly" (monthly, not daily + contains "outing")
❌ "Schedule one-on-one time weekly" (weekly, not daily)
❌ "Organize an event" (one-time, not repeatable + contains "event")
❌ "Go to church every Sunday" (weekly, not daily + contains "Sunday")
❌ "Attend a short daily team huddle" (contains "meeting" concept, calendar-dependent)
❌ "Host family game night" (scheduled event, not daily habit)

VALID EXAMPLES (GENERATE LIKE THESE):
✅ "Read a devotional for 10 minutes every morning"
✅ "Journal about gratitude for 5 minutes before bed"
✅ "Practice 10 minutes of mindfulness meditation"
✅ "Text or call one friend or family member to check in for 5 minutes"
✅ "Do 20 push-ups and 20 squats"
✅ "Walk for 15 minutes after dinner"
✅ "Read one chapter of a book for 15 minutes"
✅ "Write down 3 things you're grateful for (5 minutes)"
✅ "Pray or reflect for 10 minutes in the morning"
✅ "Practice a new skill for 20 minutes"

VALIDATION CHECK:
Before including an action, ask yourself: "Can someone literally do this 365 days per year, including weekends, holidays, sick days, and days when their schedule changes unexpectedly?"
If the answer is NO, do not include it.

HABITS vs EVENTS:
✅ HABITS = Repeatable personal behaviors (reading, writing, exercising, praying, journaling, practicing)
❌ EVENTS = Scheduled activities that happen at specific times (meetings, services, gatherings, outings, nights, projects)

FINAL SELF-CHECK PROCESS:
Before finalizing the list:
1. Scan your actions and remove any that are not clearly daily habits
2. Remove any that include forbidden words ("weekly", "monthly", "Sunday", "meeting", "event", "outing", "gathering", etc.)
3. Verify every action includes an approximate time duration (5-30 minutes)
4. Verify every action can be done alone without requiring others
5. Replace any removed actions with new actions that meet all rules

Return ONLY valid JSON with no markdown formatting. Each action should be a simple string (no objects, no metadata).`;

    // Build the input list for the prompt
    const domainInputs: string[] = [];
    const domains = ['body', 'being', 'balance', 'business'] as const;
    
    for (const domain of domains) {
      const domainData = input[domain];
      if (domainData && domainData.target) {
        let domainText = `${domain.toUpperCase()}:\n`;
        domainText += `Target: ${domainData.target}\n`;
        if (domainData.narrative) {
          domainText += `Context: ${domainData.narrative}\n`;
        }
        if (domainData.monthlyMissions) {
          domainText += `Monthly Missions: ${JSON.stringify(domainData.monthlyMissions, null, 2)}\n`;
        }
        domainInputs.push(domainText);
      }
    }

    const userPrompt = `Generate 10 daily action options for EACH of these domains:

${domainInputs.join('\n\n')}

Return JSON in this EXACT format - just arrays of simple strings:
{
  "body": [
    "Walk 10,000 steps every day",
    "Do 20 push-ups in the morning",
    "Drink 8 glasses of water",
    "Stretch for 10 minutes before bed",
    "Take the stairs instead of elevator",
    "Do a 5-minute plank",
    "Practice yoga poses for 15 minutes",
    "Track daily protein intake",
    "Meditate for 5 minutes after waking",
    "Journal about physical sensations for 5 minutes"
  ],
  "being": [...10 actions...],
  "balance": [...10 actions...],
  "business": [...10 actions...]
}

IMPORTANT: 
🚨 DAILY FREQUENCY REQUIREMENT (CRITICAL):
- Return EXACTLY 10 actions per domain
- Each action should be a simple string (no objects)
- Make actions diverse and varied
- Only include domains that were provided in the input
- EVERY action must be doable EVERY SINGLE DAY (no weekly/monthly/event-based suggestions)
- Every action must mention an approximate duration between 5 and 30 minutes
- If you're unsure if something is daily, ask yourself: "Can someone literally do this 365 days per year?" If no, don't include it

NO PATTERNS ALLOWED:
- NO weekly activities (no "once a week", "every Sunday", "weekly")
- NO monthly activities (no "once a month", "monthly")  
- NO scheduled events (no "meeting", "service", "gathering", "outing", "event", "game night")
- NO calendar-dependent actions (no "Sundays", "weekends", "first Monday")
- NO actions requiring specific external schedules

365-DAY TEST: Every action must pass this test: "Can I do this today, tomorrow, next Tuesday, on Christmas, when I'm traveling, when I'm sick, on weekends, and on my birthday?" If NO to any, reject it.

FOCUS: Generate HABITS (daily personal behaviors) not EVENTS (scheduled activities).

DURATION REQUIREMENT: Every action must include an explicit time phrase like "for 10 minutes", "for 5 minutes", "for 20 minutes".

EVENT REJECTION RULE: If any suggestion even slightly resembles a scheduled event (service, meeting, group, outing, night, project), discard it and replace it with a solo, repeatable daily behavior.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('OpenAI raw response:', content);

    let dailyActions: Partial<DailyActionsOutput>;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      dailyActions = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse daily actions from AI response');
    }

    // Validate structure
    for (const domain of domains) {
      const actions = dailyActions[domain];
      if (actions) {
        if (!Array.isArray(actions)) {
          throw new Error(`${domain} must be an array`);
        }
        if (actions.length !== 10) {
          throw new Error(`${domain} must have exactly 10 actions, got ${actions.length}`);
        }
        for (const action of actions) {
          if (typeof action !== 'string') {
            throw new Error(`All actions in ${domain} must be strings`);
          }
        }
      }
    }

    console.log('Successfully generated daily actions');

    return new Response(
      JSON.stringify({ dailyActions }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in life_targets_daily_actions function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error generating daily actions' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
