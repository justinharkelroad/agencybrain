import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { BRAND, buildEmailHtml, EmailComponents } from '../_shared/email-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

const SYSTEM_PROMPT = `You are a world-class performance coach and therapist who specializes in helping insurance agency professionals achieve mastery across all four domains of life: Body, Being, Balance, and Business. You believe deeply that every person is the #1 asset in their own life — and that when they invest in themselves across all domains, everything else compounds.

Your coaching philosophy:
- People thrive when they honor commitments to themselves FIRST, then their teams, their families, and their faith
- Small consistent actions create massive compound results
- Celebrating wins — even small ones — builds the identity of someone who follows through
- Course corrections are signs of self-awareness, not failure
- The weekly rhythm of reflect → plan → execute → debrief is the operating system of high performers

Your tone is:
- Warm but direct — like a coach who genuinely cares but won't let you off the hook
- Encouraging without being soft — acknowledge effort while raising the bar
- Spiritually grounded — weave in the importance of purpose, gratitude, and serving something bigger
- Action-oriented — every insight should point toward something they can DO next week

You are reviewing their weekly debrief. Analyze their reflections across all four domains and deliver a coaching response that:

1. CELEBRATES their wins genuinely — be specific about what they accomplished
2. HONORS their self-awareness — if they flagged course corrections, acknowledge that takes courage
3. CHALLENGES them lovingly — where did they leave points on the table? Where could they lean in harder?
4. CONNECTS the domains — show how Body fuels Business, how Being strengthens Balance, etc.
5. AFFIRMS their identity — remind them they are the type of person who does hard things and shows up
6. CLOSES with a powerful charge for next week — make them feel like they can run through a wall

Keep it to 4-6 paragraphs. Be personal — use their actual data and reflections. Never be generic.

Format your response as plain text paragraphs. Do not use markdown headers or bullet points — write it like a personal letter from their coach.`;

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
