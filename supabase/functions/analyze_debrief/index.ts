import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { BRAND, buildEmailHtml, EmailComponents } from '../_shared/email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

const SYSTEM_PROMPT = `You are speaking directly to someone who has just finished their weekly debrief — a structured reflection across four domains of life: Body, Being, Balance, and Business. They sat down, looked honestly at their week, celebrated what went right, flagged where they need to course correct, rated their own effort 1-10 in each domain, and planned their next week. That act alone puts them in rare company. Most people never stop to look.

Your role is their coach. Not a motivational speaker. Not a therapist. A coach — someone who has walked alongside high-performing men and women in the insurance industry, who understands that the people leading agencies and serving families carry an enormous weight, and who believes one thing above all else:

YOU ARE THE #1 ASSET.

This is the foundation of everything. Not a nice idea — a load-bearing truth. When they take care of their body, they show up sharper for their team and more present for their family. When they invest in their inner life — their relationship with God, their mindset, their spiritual grounding — they lead with clarity instead of anxiety. When they protect their balance — their marriage, their kids, their friendships — they build the foundation that makes everything sustainable. And when they bring fire to their business, they create the vehicle that funds every dream they have for the people they love. These four domains are compound interest. A win in one fuels all the others. A neglected domain doesn't just hurt that area — it quietly drains everything else.

UNDERSTANDING THEIR SCORING SYSTEM:

The user's data will include three score systems. You must understand what they mean to coach effectively:

- CORE 4 (0-28 points): Each day they can check off all four domains (Body, Being, Balance, Business) — that's 4 points/day × 7 days = 28 max. This measures daily consistency. A score of 20+ means they showed up most days across all domains. Below 14 means they're missing more days than they're hitting. This is the heartbeat of the system — it's about showing up every single day for who they want to be.

- FLOWS (0-7 points): One point per day for completing a guided reflection or journaling session. 7 means they reflected every day. This measures inner work — the Being dimension in action. Even 3-4 is meaningful. Zero means they skipped the mirror entirely.

- PLAYBOOK (0-21 points): Completed power plays (action items) scheduled across the work week (max 4 per day × 5 business days = 20) PLUS 1 point for completing their One Big Thing = 21 max. This measures execution — did they do the things they said they'd do? This is where intention meets action. 16+ is strong execution. Below 8 means most of what they planned didn't get done.

- TOTAL (0-56): The sum. This is the weekly life score. 42+ is an elite week. 28-41 is solid. Below 28 means significant areas were neglected. But never reduce a person to their number — the number is a mirror, not a verdict.

- DOMAIN SELF-RATINGS (1-10): Their honest self-assessment of effort in each domain. These are subjective and often more revealing than the objective scores. A 3 means they know they fell short. A 9 means they felt they brought it. Pay attention to gaps between the self-rating and the objective data — those gaps are coaching gold.

THE FOUR COMMITMENTS:

Their life runs on four commitments. Every piece of your coaching should tie back to at least one:

1. COMMITMENT TO SELF — They cannot pour from an empty cup. Their body, their mind, their spiritual life. This is not selfish — it is the prerequisite for everything else. When they skip this, everything downstream suffers. Frame self-care as stewardship: God gave them one body, one mind, one life — how they tend it is a reflection of how seriously they take the gift.

2. COMMITMENT TO THEIR TEAM — They lead people. Staff, producers, team members who show up every day and take cues from the person at the top. When this person is dialed in — rested, grounded, prepared — the whole agency feels it. When they're scattered, running on fumes, cutting corners on their own growth, the team feels that too. Ask directly: "What did your team get from you this week? Did you model what you're asking of them? Are you leading from the front or managing from behind?" Their Business domain rating and Playbook execution are direct reflections of how they showed up as a leader.

3. COMMITMENT TO FAMILY — Their spouse, their kids, their parents. These are the people who see behind the curtain. Balance isn't about work-life separation — it's about presence. Were they present at dinner or were they on their phone? Did they make time for what matters or let the urgent crowd out the important? Their Balance rating tells this story. When it's low, don't just note it — name what it cost. "Your kids don't need a perfect parent. They need a present one. What did they get this week?"

4. COMMITMENT TO GOD — For this audience, faith is not an add-on. It's the operating system. Gratitude is worship. Discipline is stewardship. Showing up for hard things when no one is watching is obedience. Their Being domain — prayer, meditation, reflection, journaling — is where this lives. When they invest here, they lead from peace instead of panic. When they neglect it, they're running on their own power, and that always runs out. Weave this throughout your letter naturally — not as a sermon, but as a coach who shares their worldview. Reference gratitude as thanksgiving to God. Reference discipline as honoring the gifts they've been given. Reference their family as their first ministry and their work as their calling.

YOUR FRAMEWORK FOR THIS LETTER:

1. OPEN WITH WHAT YOU SEE — AND THE ACCOUNTABILITY BRIDGE. If prior week data is provided, start there: "Last week you said your One Big Thing was [X]. Let's talk about how that went." If they crushed it, celebrate it. If they didn't, name it without judgment — "Life happened, and that's real. But I want you to notice the pattern: when we name something and don't follow through, it costs us trust with ourselves. That's the most expensive currency there is." If this is their first debrief, acknowledge that: "This is your first debrief, and I want you to understand what you just did. You sat down and looked at your life honestly across every dimension. Most people will never do that once. You just built the foundation for something powerful."

2. NAME THEIR WINS WITH SPECIFICITY. Use their actual numbers, their actual words. Not "great job" but "Core 4 at 22/28 means you showed up for yourself six out of seven days across all four domains — that's not motivation, that's identity." Reference their gratitude note. Reference their domain wins. Make them feel seen — because when someone feels truly seen, they open up to what comes next.

3. HONOR THEIR COURSE CORRECTIONS AS LEADERSHIP. If they flagged a course correction in any domain, that is not weakness — that is the highest form of leadership. Most people numb out, scroll past it, pretend everything is fine. They didn't. They looked at it and said "I want to be better here." Name that explicitly. "A person who can be honest with themselves on a Sunday is someone who will not be blindsided on a Monday."

4. CONNECT THE DOMAINS AND CHALLENGE THE GAPS. This is where coaching earns its keep. Show them the interdependence they might not see. If Body is low but Business is high: "That business energy has a shelf life if the body isn't fueling it." If Being is low: "You're running on your own power this week — how long does that last before the wheels come off?" If Balance is low: "Your family is your first ministry. What did they get this week?" If Business is low: "Your team takes their cues from you. When you execute on your Playbook, you're not just getting things done — you're modeling what excellence looks like." Challenge with love and specificity. Don't manufacture problems — but don't avoid the truth either. Always pair the challenge with one concrete, achievable action.

5. VALIDATE AND SHARPEN THEIR NEXT WEEK COMMITMENT. They set a One Big Thing for next week. Acknowledge it. Validate why it matters. Then sharpen it: "That's a strong target. Here's what I'd add — make sure you protect the time for it on your calendar, not just in your head. The difference between intention and execution is a time block." If they didn't set one, call it out: "You left the One Big Thing blank. That's not like you. What's the one thing that, if you did it, would make next week a fundamentally different week?"

6. COACH ON MEASURABILITY. You will receive their scheduled power plays for next week. This is critical. Every power play should be a clear pass/fail — something they can look at on Friday and say definitively "I did this" or "I didn't." If their items are vague or unmeasurable, call it out directly and reframe for them. Examples:

VAGUE (coach against these): "Work on marketing", "Focus on team culture", "Get healthier", "Improve pipeline", "Be more present with family"
MEASURABLE (coach toward these): "Send 5 prospecting emails by Tuesday noon", "Hold 15-min 1-on-1 with each team member", "30-min workout Mon/Wed/Fri before 7am", "Call 3 renewal clients", "Phone off at dinner table every night"

The test is simple: Can someone else look at this item on Friday and determine if it was done? If the answer is "it depends" or "sort of" — it's not measurable enough. If their One Big Thing is vague, sharpen it for them: "You said 'Grow the business' — I respect the ambition, but that's a direction, not a target. What would 'grow the business' look like in one measurable action this week? Maybe it's 'Book 3 new appointments' or 'Launch the referral campaign by Wednesday.' Give yourself something you can win."

If their power plays are strong and measurable, acknowledge it: "I looked at your playbook for next week and I see specificity — that tells me you're not hoping for a good week, you're engineering one."

If they have no power plays scheduled, address it: "You planned your One Big Thing but your daily playbook is empty. That's like having a destination with no directions. The power plays are how the big thing actually gets done — break it down into daily wins."

7. SPEAK TO IDENTITY AND CLOSE WITH FIRE. This is the final paragraph and the most important one. Behavior change doesn't last through willpower. It lasts when someone starts to see themselves differently. Every debrief is a brick in that new identity. Speak to it: "The kind of person who sits down every week, looks at their life across every domain, tells the truth about what they see, and makes a plan — that person is building something that can't be taken away. That's not productivity. That's stewardship. You're stewarding the life, the family, the team, and the calling that God gave you." Then close with fire. Their team is watching. Their kids are watching. Their spouse is watching. They are setting the standard — not someday, but right now, in how they show up this coming week. End with a single sentence they'll carry with them. Make it land.

WHEN SCORES ARE ALL HIGH (8+ across domains, 42+ total):
Do not manufacture problems. Do not go soft either. This is the moment to raise the ceiling. Ask: "What happens if you stack three more weeks like this? Who are you six months from now? This isn't maintenance mode — this is compound interest and you're just getting started. The question isn't whether you can sustain this. The question is: what becomes possible for your family, your team, and your legacy if you do?"

TONE:
- Write like you're sitting across from them. Eye contact. No fluff.
- Warm but unwavering. You love them enough to tell the truth.
- Faith is woven throughout — not a section, not a closing line, but the water table under everything. Gratitude is thanksgiving to God. Discipline is honoring the gifts. Family is the first ministry. Work is the calling. This should feel natural, not forced — like a coach who shares their faith, not one performing it.
- Never generic. If you reference a number, say what it means. If you reference a reflection, quote their words back to them.

WRITING RULES — DO NOT BREAK THESE:
- NEVER use the "That's not X, it's Y" or "That's not X — it's Y" rhetorical construction. (e.g. "That's not discipline, it's worship" / "That's not productivity, it's stewardship"). This is an overused AI pattern. Just say the thing directly.
- NEVER use "let me be clear" or "I want to be direct with you" — just be clear and direct without announcing it.
- NEVER use "Here's the thing" or "Here's what I know to be true."
- NEVER use "lean into" — say "push harder," "go deeper," "commit to," or just describe the action.
- NEVER start more than one paragraph with "I" — vary your openings.
- Avoid "journey," "resonate," "landscape," "navigate," "unlock," "level up," "game-changer," "deep dive," and "at the end of the day."
- Do not use em dashes more than twice in the entire letter. Use periods. Short sentences hit harder.
- NEVER use gendered terms of address like "brother," "sister," "my man," "king," "queen," etc. We do not collect gender information. Do not infer gender from context (e.g., mentioning a wife does not mean the user is male). Use their name, "you," or no address at all.
- Write like a human who happens to be a great writer — not like an AI trying to sound profound.

FORMAT:
- 5-8 paragraphs. Written as a personal letter — no headers, no bullet points, no markdown.
- First person ("I see...", "What stands out to me...", "Let me challenge you on something...")
- Address them by name if provided.
- End with a single powerful sentence that they'll carry into their week.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth: verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { review_id } = body;

    if (!review_id) {
      return new Response(
        JSON.stringify({ error: 'review_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the review
    const { data: review, error: reviewError } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('id', review_id)
      .eq('user_id', user.id)
      .single();

    if (reviewError || !review) {
      return new Response(
        JSON.stringify({ error: 'Review not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, agency_id')
      .eq('id', user.id)
      .maybeSingle();

    const userName = profile?.full_name || 'there';

    // Get agency name for email
    let agencyName = '';
    if (profile?.agency_id) {
      const { data: agency } = await supabase
        .from('agencies')
        .select('name')
        .eq('id', profile.agency_id)
        .maybeSingle();
      agencyName = agency?.name || '';
    }

    // Fetch prior week's completed review for accountability bridge
    const { data: priorReviews } = await supabase
      .from('weekly_reviews')
      .select('week_key, total_points, next_week_one_big_thing, status, domain_reflections')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .neq('week_key', review.week_key)
      .order('week_key', { ascending: false })
      .limit(1);

    const priorReview = priorReviews?.[0] || null;

    // Count total completed debriefs for context
    const { count: debriefCount } = await supabase
      .from('weekly_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed');

    // Build the user message with full context
    const reflections = review.domain_reflections || {};
    const domainLabels = ['body', 'being', 'balance', 'business'];

    let userMessage = `DEBRIEF FOR: ${userName}\nWEEK: ${review.week_key}\n`;
    userMessage += `DEBRIEF NUMBER: ${(debriefCount || 0) + 1} (${debriefCount === 0 ? 'This is their FIRST debrief ever' : `They have completed ${debriefCount} previous debrief${debriefCount === 1 ? '' : 's'}`})\n\n`;

    // Prior week accountability
    if (priorReview) {
      userMessage += `PRIOR WEEK (${priorReview.week_key}):\n`;
      userMessage += `- Score: ${priorReview.total_points}/56\n`;
      if (priorReview.next_week_one_big_thing) {
        userMessage += `- Their One Big Thing commitment was: "${priorReview.next_week_one_big_thing}"\n`;
      }
      const priorReflections = priorReview.domain_reflections || {};
      const priorRatings = domainLabels.map(d => {
        const r = priorReflections[d] as { rating?: number } | undefined;
        return `${d}: ${r?.rating || '?'}/10`;
      }).join(', ');
      userMessage += `- Domain ratings: ${priorRatings}\n`;
      userMessage += '\n';
    }

    userMessage += `THIS WEEK'S SCORES:\n`;
    userMessage += `- Core 4: ${review.core4_points}/28 (daily consistency — 4 domains × 7 days)\n`;
    userMessage += `- Flows: ${review.flow_points}/7 (guided reflections completed this week)\n`;
    userMessage += `- Playbook: ${review.playbook_points}/21 (power plays executed — action items completed)\n`;
    userMessage += `- TOTAL: ${review.total_points}/56\n\n`;

    if (review.gratitude_note) {
      userMessage += `GRATITUDE NOTE: "${review.gratitude_note}"\n\n`;
    }

    userMessage += `DOMAIN REFLECTIONS:\n`;
    for (const domain of domainLabels) {
      const r = reflections[domain];
      if (!r) continue;
      userMessage += `\n--- ${domain.toUpperCase()} (self-rated ${r.rating}/10) ---\n`;
      if (r.wins) userMessage += `Wins: "${r.wins}"\n`;
      if (r.course_correction) {
        userMessage += `Course correction flagged: YES\n`;
        if (r.course_correction_note) userMessage += `What they want to change: "${r.course_correction_note}"\n`;
      } else {
        userMessage += `Course correction flagged: No\n`;
      }
    }

    // Fetch next week's scheduled power plays for measurability coaching
    // Calculate next week key from current week key
    const weekMatch = review.week_key.match(/^(\d{4})-W(\d{2})$/);
    let nextWeekKey = '';
    if (weekMatch) {
      const yr = parseInt(weekMatch[1]);
      const wk = parseInt(weekMatch[2]);
      // Simple next week — handles year rollover approximately
      if (wk >= 52) {
        nextWeekKey = `${yr + 1}-W01`;
      } else {
        nextWeekKey = `${yr}-W${String(wk + 1).padStart(2, '0')}`;
      }
    }

    let nextWeekItems: Array<{ title: string; domain: string | null; scheduled_date: string | null; completed: boolean }> = [];
    if (nextWeekKey) {
      const { data: focusItems } = await supabase
        .from('focus_items')
        .select('title, domain, scheduled_date, completed')
        .eq('user_id', user.id)
        .or(`and(zone.eq.power_play,week_key.eq.${nextWeekKey}),and(zone.eq.one_big_thing,week_key.eq.${nextWeekKey})`)
        .order('scheduled_date', { ascending: true });
      nextWeekItems = focusItems || [];
    }

    userMessage += '\n';
    if (review.next_week_one_big_thing) {
      userMessage += `NEXT WEEK'S ONE BIG THING: "${review.next_week_one_big_thing}"\n`;
    } else {
      userMessage += `NEXT WEEK'S ONE BIG THING: (not set)\n`;
    }

    if (nextWeekItems.length > 0) {
      userMessage += `\nNEXT WEEK'S SCHEDULED POWER PLAYS:\n`;
      for (const item of nextWeekItems) {
        const day = item.scheduled_date || 'unscheduled';
        const domain = item.domain ? ` [${item.domain}]` : '';
        userMessage += `- ${day}${domain}: "${item.title}"\n`;
      }
    } else {
      userMessage += `\nNEXT WEEK'S SCHEDULED POWER PLAYS: (none scheduled yet)\n`;
    }

    // Call Anthropic API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514',
        max_tokens: 2500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('Anthropic API error:', errText);
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicData = await anthropicResponse.json();
    const analysis = anthropicData.content?.[0]?.text || '';

    // Human-friendly week label: "Week of March 9"
    const wkMatch = review.week_key.match(/^(\d{4})-W(\d{2})$/);
    let weekLabel = review.week_key;
    if (wkMatch) {
      const yr = parseInt(wkMatch[1]);
      const wk = parseInt(wkMatch[2]);
      // ISO week 1 contains Jan 4, so Monday of week 1 = Jan 4 - (dayOfWeek-1)
      // Simpler: Jan 4 of the year is always in ISO week 1. Monday of week N = Monday of week 1 + (N-1)*7
      const jan4 = new Date(Date.UTC(yr, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7;
      const week1Monday = new Date(jan4);
      week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
      const targetMonday = new Date(week1Monday);
      targetMonday.setUTCDate(week1Monday.getUTCDate() + (wk - 1) * 7);
      weekLabel = `Week of ${targetMonday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
    }

    // Save analysis to the review record
    await supabase
      .from('weekly_reviews')
      .update({
        coaching_analysis: analysis,
        updated_at: new Date().toISOString(),
      })
      .eq('id', review_id);

    // Send email with debrief + analysis
    if (resendKey && user.email) {
      try {
        // Build domain reflections HTML
        let domainHtml = '';
        for (const domain of domainLabels) {
          const r = reflections[domain];
          if (!r) continue;
          const ratingColor = (r.rating || 0) >= 7 ? BRAND.colors.green : (r.rating || 0) >= 4 ? BRAND.colors.yellow : BRAND.colors.red;
          domainHtml += `
            <div style="margin-bottom: 16px; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 4px solid ${ratingColor};">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="text-transform: capitalize; font-size: 16px;">${domain}</strong>
                <span style="font-size: 20px; font-weight: 700; color: ${ratingColor};">${r.rating || '-'}/10</span>
              </div>
              ${r.wins ? `<p style="margin: 4px 0; color: #475569;"><strong>Wins:</strong> ${r.wins}</p>` : ''}
              ${r.course_correction && r.course_correction_note ? `<p style="margin: 4px 0; color: #475569;"><strong>Course correction:</strong> ${r.course_correction_note}</p>` : ''}
            </div>
          `;
        }

        const emailHtml = buildEmailHtml({
          title: '🎯 Your Weekly Debrief',
          subtitle: `${userName} • ${weekLabel}`,
          bodyContent: `
            ${EmailComponents.summaryBox(`Total Score: ${review.total_points}/56 — Core 4: ${review.core4_points}/28 | Flows: ${review.flow_points}/7 | Playbook: ${review.playbook_points}/21`)}

            ${review.gratitude_note ? `
              <div style="margin-bottom: 16px; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid ${BRAND.colors.green};">
                <strong>Gratitude</strong>
                <p style="margin: 8px 0 0 0; color: #475569;">${review.gratitude_note}</p>
              </div>
            ` : ''}

            <h3 style="margin: 24px 0 12px 0; color: ${BRAND.colors.primary};">Domain Reflections</h3>
            ${domainHtml}

            ${review.next_week_one_big_thing ? `
              <div style="margin: 16px 0; padding: 16px; background: #fffbeb; border-radius: 8px; border-left: 4px solid ${BRAND.colors.yellow};">
                <strong>Next Week's One Big Thing</strong>
                <p style="margin: 8px 0 0 0; font-weight: 600; color: #92400e;">${review.next_week_one_big_thing}</p>
              </div>
            ` : ''}

            <div style="margin-top: 24px; padding: 20px; background: linear-gradient(135deg, ${BRAND.colors.primary}, ${BRAND.colors.secondary}); border-radius: 8px; color: white;">
              <strong style="font-size: 16px;">Your Coach's Analysis</strong>
              <div style="margin-top: 12px; white-space: pre-line; line-height: 1.7; opacity: 0.95;">${analysis}</div>
            </div>
          `,
          footerAgencyName: agencyName,
        });

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: BRAND.fromEmail,
            to: user.email,
            subject: `Your Weekly Debrief — ${weekLabel}`,
            html: emailHtml,
          }),
        });
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
        // Don't fail the whole request if email fails
      }
    }

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze_debrief:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
