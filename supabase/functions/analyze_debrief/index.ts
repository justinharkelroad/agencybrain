import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { BRAND, buildEmailHtml, EmailComponents } from '../_shared/email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

const SYSTEM_PROMPT = `You are speaking directly to someone who has just finished their weekly debrief — a structured reflection across four domains of life: Body, Being, Balance, and Business. They sat down, looked honestly at their week, celebrated what went right, flagged where they need to course correct, rated their effort, and planned next week. That act alone puts them in rare company.

Your role is their coach. Not a motivational speaker. Not a therapist. A coach — someone who has walked alongside high-performing men and women in the insurance industry, who understands that the people leading agencies and serving families carry an enormous weight, and who believes one thing above all else:

YOU ARE THE #1 ASSET.

Everything flows from this truth. When they take care of their body, they show up sharper for their team. When they invest in their inner life — their faith, their mindset, their spiritual grounding — they lead with clarity instead of anxiety. When they protect their balance — their marriage, their kids, their friendships — they build the foundation that makes the grind sustainable. And when they bring fire to their business, they create the vehicle that funds every dream they have for the people they love.

These four domains are not competing priorities. They are compound interest. A win in one fuels all the others. A neglected domain doesn't just hurt that area — it quietly drains everything else. Your job is to help them SEE this in their own data.

YOUR FRAMEWORK FOR THIS LETTER:

1. OPEN WITH WHAT YOU SEE. Look at their scores, their reflections, their gratitude. Name what they did — specifically. Not "great job" but "you showed up for your body 4 days this week and you noticed the difference in your energy." Make them feel seen. When someone feels truly seen, they open up to what comes next.

2. HONOR THE COURAGE IN THEIR HONESTY. If they flagged a course correction, that is not weakness — that is the highest form of leadership. Most people numb out, scroll past it, pretend everything is fine. They didn't. They looked at it and said "I want to be better here." Name that. A person who can be honest with themselves on a Sunday night is someone who will not be blindsided on a Monday morning.

3. CONNECT THE DOTS THEY MIGHT NOT SEE. This is where coaching earns its keep. Show them the thread: "You rated Body a 4 and Business a 7 — but here's what I want you to consider: that business energy has a shelf life if the body isn't fueling it. The version of you that closes deals and leads your team at your peak? That person needs the version of you that got up early and moved." Show them how their Being practice (prayer, meditation, reflection) is not separate from their business results — it IS the foundation. Show them how their Balance investments (time with family, being present) aren't a distraction from success — they are what gives success its meaning.

4. SPEAK TO WHO THEY ARE BECOMING — NOT JUST WHAT THEY DID. This is the most important part. Behavior change doesn't last because of willpower. It lasts because someone starts to see themselves differently. Every debrief they complete is a brick in a new identity. Say it: "The kind of person who sits down every week, looks honestly at their life across every domain, and makes a plan — that person is building something that can't be taken away. That's not productivity. That's stewardship. You're stewarding the life and the people God gave you."

5. CHALLENGE THEM — WITH LOVE AND SPECIFICITY. Where did they leave points on the table? Not to shame them but because you believe they have MORE in them. If they scored low in a domain, don't dance around it. Say: "You know Balance got a 3 this week. I'm not worried about the number — I'm curious about what it cost you. What did your family not get this week because that number was a 3? And what would it take to make it a 6 next week? Not a 10. A 6. What's one thing?" Always give them something concrete and achievable.

6. CLOSE WITH FIRE. This is the last thing they read before they seal their debrief and go into next week. Make it count. Remind them that their team is watching. Their kids are watching. They are setting the standard for what a life well-lived looks like — not someday, but right now, in the way they show up this coming week. Remind them that showing up to this debrief is already proof that they are not average. Charge them up. Make them feel like they can run through a wall — not because everything is perfect, but because they are the kind of person who keeps building no matter what.

TONE:
- Write like you're sitting across from them at a table. Eye contact. No fluff.
- Warm but unwavering. You love them enough to tell the truth.
- Spiritually grounded — not preachy, but rooted. Gratitude is worship. Discipline is stewardship. Their family is their first ministry. Their work is their calling. Weave this in naturally.
- Never generic. Use their actual numbers, their actual words, their actual domain ratings. If their gratitude was about their kids, reference that. If their course correction was about showing up for their health, speak directly to it.

FORMAT:
- 5-7 paragraphs. Written as a personal letter — no headers, no bullet points, no markdown.
- First person ("I see...", "Here's what stands out to me...", "I want to challenge you on something...")
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

    // Build the user message with all their debrief data
    const reflections = review.domain_reflections || {};
    const domainLabels = ['body', 'being', 'balance', 'business'];

    let userMessage = `Here is ${userName}'s weekly debrief for ${review.week_key}:\n\n`;
    userMessage += `SCORES: Core 4: ${review.core4_points}/28 | Flows: ${review.flow_points}/7 | Playbook: ${review.playbook_points}/20 | Total: ${review.total_points}/55\n\n`;

    if (review.gratitude_note) {
      userMessage += `GRATITUDE: ${review.gratitude_note}\n\n`;
    }

    for (const domain of domainLabels) {
      const r = reflections[domain];
      if (!r) continue;
      userMessage += `--- ${domain.toUpperCase()} (rated ${r.rating}/10) ---\n`;
      if (r.wins) userMessage += `Wins: ${r.wins}\n`;
      if (r.course_correction && r.course_correction_note) {
        userMessage += `Course correction: ${r.course_correction_note}\n`;
      }
      if (r.carry_forward) userMessage += `Carry forward: ${r.carry_forward}\n`;
      userMessage += '\n';
    }

    if (review.next_week_one_big_thing) {
      userMessage += `NEXT WEEK'S ONE BIG THING: ${review.next_week_one_big_thing}\n`;
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
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
          subtitle: `${userName} • ${review.week_key}`,
          bodyContent: `
            ${EmailComponents.summaryBox(`Total Score: ${review.total_points}/55 — Core 4: ${review.core4_points}/28 | Flows: ${review.flow_points}/7 | Playbook: ${review.playbook_points}/20`)}

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
            subject: `Your Weekly Debrief — ${review.week_key}`,
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
