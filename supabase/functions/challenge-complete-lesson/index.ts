import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get staff session token from header
    const sessionToken = req.headers.get('x-staff-session');
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Missing staff session token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate staff session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id, expires_at')
      .eq('session_token', sessionToken)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffUserId = session.staff_user_id;

    // Parse request body
    const { assignment_id, lesson_id, reflection_response, video_watched_seconds, video_completed } = await req.json();

    if (!assignment_id || !lesson_id) {
      return new Response(
        JSON.stringify({ error: 'Assignment ID and Lesson ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify assignment belongs to this staff user and is active
    const { data: assignment, error: assignmentError } = await supabase
      .from('challenge_assignments')
      .select('id, start_date, status, challenge_product_id, agency_id')
      .eq('id', assignment_id)
      .eq('staff_user_id', staffUserId)
      .single();

    if (assignmentError || !assignment) {
      return new Response(
        JSON.stringify({ error: 'Assignment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (assignment.status !== 'active' && assignment.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Assignment is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify lesson exists and get lesson + module context for AI feedback
    const { data: lesson, error: lessonError } = await supabase
      .from('challenge_lessons')
      .select('id, day_number, title, preview_text, questions, challenge_product_id, challenge_modules(name, description)')
      .eq('id', lesson_id)
      .eq('challenge_product_id', assignment.challenge_product_id)
      .single();

    if (lessonError || !lesson) {
      return new Response(
        JSON.stringify({ error: 'Lesson not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate current business day to verify lesson is unlocked
    const today = new Date();
    const startDate = new Date(assignment.start_date);
    let businessDay = 0;
    const currentDate = new Date(startDate);
    while (currentDate <= today) {
      const dow = currentDate.getDay();
      if (dow !== 0 && dow !== 6) {
        businessDay++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (lesson.day_number > businessDay) {
      return new Response(
        JSON.stringify({ error: 'Lesson is not yet unlocked' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate reflection questions are answered if the lesson has them
    const lessonQuestions = (lesson.questions || []) as Array<string | { text: string }>;
    if (lessonQuestions.length > 0) {
      const missingAnswers = lessonQuestions.some((_, i) => {
        const answer = reflection_response?.[`q${i}`];
        return !answer || (typeof answer === 'string' && !answer.trim());
      });

      if (missingAnswers) {
        return new Response(
          JSON.stringify({ error: 'All reflection questions must be answered before completing this lesson' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // For discovery flow lessons, verify a completed discovery flow session exists on or after unlock date
    const lessonFull = await supabase
      .from('challenge_lessons')
      .select('is_discovery_flow')
      .eq('id', lesson_id)
      .single();

    if (lessonFull.data?.is_discovery_flow) {
      const { data: discoveryTemplate } = await supabase
        .from('flow_templates')
        .select('id')
        .eq('slug', 'discovery')
        .single();

      if (discoveryTemplate) {
        // Calculate the lesson unlock date (business day N from start_date)
        let bDay = 0;
        const unlockCalc = new Date(assignment.start_date);
        while (bDay < lesson.day_number) {
          const dow = unlockCalc.getDay();
          if (dow !== 0 && dow !== 6) {
            bDay++;
          }
          if (bDay < lesson.day_number) {
            unlockCalc.setDate(unlockCalc.getDate() + 1);
          }
        }
        const lessonUnlockDate = new Date(unlockCalc);
        lessonUnlockDate.setHours(0, 0, 0, 0);

        const { data: flowSession } = await supabase
          .from('staff_flow_sessions')
          .select('id')
          .eq('staff_user_id', staffUserId)
          .eq('flow_template_id', discoveryTemplate.id)
          .eq('status', 'completed')
          .gte('completed_at', lessonUnlockDate.toISOString())
          .limit(1)
          .maybeSingle();

        if (!flowSession) {
          return new Response(
            JSON.stringify({ error: 'You must complete a Discovery Flow before marking this lesson as complete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Get existing progress record
    const { data: existingProgress, error: progressError } = await supabase
      .from('challenge_progress')
      .select('id, status, started_at')
      .eq('assignment_id', assignment_id)
      .eq('lesson_id', lesson_id)
      .single();

    if (progressError || !existingProgress) {
      return new Response(
        JSON.stringify({ error: 'Progress record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update progress record to completed
    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      status: 'completed',
      completed_at: now,
    };

    // Set started_at if not already set
    if (!existingProgress.started_at) {
      updateData.started_at = now;
    }

    // Store reflection response if provided
    if (reflection_response && typeof reflection_response === 'object') {
      updateData.reflection_response = reflection_response;
    }

    // Store video tracking if provided
    if (typeof video_watched_seconds === 'number') {
      updateData.video_watched_seconds = video_watched_seconds;
    }
    if (typeof video_completed === 'boolean') {
      updateData.video_completed = video_completed;
    }

    const { data: updatedProgress, error: updateError } = await supabase
      .from('challenge_progress')
      .update(updateData)
      .eq('id', existingProgress.id)
      .select()
      .single();

    if (updateError) {
      console.error('Progress update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update progress' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate updated progress statistics
    const { data: allProgress, error: statsError } = await supabase
      .from('challenge_progress')
      .select('status')
      .eq('assignment_id', assignment_id);

    const totalLessons = allProgress?.length || 0;
    const completedLessons = allProgress?.filter(p => p.status === 'completed').length || 0;
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Check if all lessons are completed
    if (completedLessons === totalLessons && totalLessons > 0) {
      // Update assignment status to completed
      await supabase
        .from('challenge_assignments')
        .update({ status: 'completed' })
        .eq('id', assignment_id);
    }

    // --- AI Feedback + Owner Email (non-blocking: failures don't affect lesson completion) ---
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const hasReflections = reflection_response && typeof reflection_response === 'object' && Object.keys(reflection_response).length > 0;

    if (hasReflections && openaiApiKey) {
      try {
        // Get staff user display name
        const { data: staffUser } = await supabase
          .from('staff_users')
          .select('display_name')
          .eq('id', staffUserId)
          .single();

        const staffName = staffUser?.display_name || 'Team Member';

        // Extract module context from the joined lesson query
        const moduleData = lesson.challenge_modules as { name: string; description: string | null } | null;
        const moduleName = moduleData?.name || 'Training';
        const moduleDescription = moduleData?.description || '';

        // Build Q&A pairs from questions + reflection_response
        const questions = (lesson.questions || []) as Array<string | { text: string }>;
        const qaPairs = questions.map((q, i) => {
          const questionText = typeof q === 'string' ? q : q.text;
          const answer = reflection_response[`q${i}`] || reflection_response[i.toString()] || '';
          return `Q: "${questionText}"\nA: "${answer}"`;
        }).join('\n\n');

        // Generate AI feedback via OpenAI
        console.log('[challenge-complete-lesson] Generating AI feedback for lesson:', lesson.title);
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a coaching assistant analyzing a team member's reflection responses for a training lesson. You have two jobs:

1. VALIDATE: Are the answers thoughtful, specific, and relevant to the lesson topic?
2. COACH: Provide a brief coaching summary for their manager.

=== LESSON CONTEXT ===
Week Theme: ${moduleName}${moduleDescription ? ` — ${moduleDescription}` : ''}
Lesson: ${lesson.title}
${lesson.preview_text ? `Topic Summary: ${lesson.preview_text}` : ''}

=== QUALITY STANDARDS ===
- If answers are specific, personal, and connect to the lesson topic: praise and highlight their best insight.
- If answers are vague or generic (e.g., "it was good", "I'll try harder"): push back. Name what's missing and ask a specific follow-up question.
- If answers are completely off-topic or clearly low-effort: call it out directly. The team member needs to understand this is for their growth, not a checkbox.

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "headline": "5-8 word summary of their engagement level",
  "coaching_summary": "2-3 sentences for their manager about what this person took away and their commitment level",
  "relevance_score": "high" or "medium" or "low",
  "pushback": null if answers are solid, otherwise a specific challenge/question to dig deeper (string),
  "highlight": "Their best insight or commitment" or null if low-effort
}`,
              },
              {
                role: 'user',
                content: `Here are ${staffName}'s reflection responses:\n\n${qaPairs}`,
              },
            ],
            max_tokens: 400,
            temperature: 0.7,
          }),
        });

        if (openaiResponse.ok) {
          const aiData = await openaiResponse.json();
          const rawContent = aiData.choices?.[0]?.message?.content;

          if (rawContent) {
            let aiFeedback;
            try {
              aiFeedback = JSON.parse(rawContent);
            } catch {
              console.error('[challenge-complete-lesson] Failed to parse AI response as JSON:', rawContent);
              aiFeedback = { headline: 'Feedback generated', coaching_summary: rawContent, relevance_score: 'medium', pushback: null, highlight: null };
            }

            // Save AI feedback to progress record
            await supabase
              .from('challenge_progress')
              .update({ ai_feedback: aiFeedback })
              .eq('id', existingProgress.id);

            console.log('[challenge-complete-lesson] AI feedback saved, relevance:', aiFeedback.relevance_score);

            // Send owner email notification
            if (resendApiKey && assignment.agency_id) {
              try {
                const { BRAND, buildEmailHtml, EmailComponents } = await import('../_shared/email-template.ts');

                // Find agency owner
                const { data: agencyOwners } = await supabase
                  .from('profiles')
                  .select('id, agency_id')
                  .eq('agency_id', assignment.agency_id);

                if (agencyOwners && agencyOwners.length > 0) {
                  const ownerId = agencyOwners[0].id;
                  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(ownerId);

                  if (authUser?.email) {
                    // Get agency name
                    const { data: agency } = await supabase
                      .from('agencies')
                      .select('name')
                      .eq('id', assignment.agency_id)
                      .single();

                    const agencyName = agency?.name || '';
                    const baseUrl = Deno.env.get('SITE_URL') || 'https://myagencybrain.com';
                    const progressUrl = `${baseUrl}/training/challenge/progress`;

                    // Build Q&A HTML for email (escape user-supplied content)
                    const qaHtml = questions.map((q, i) => {
                      const questionText = typeof q === 'string' ? q : q.text;
                      const answer = reflection_response[`q${i}`] || reflection_response[i.toString()] || '';
                      if (!answer) return '';
                      return `
                        <div style="margin-bottom: 12px;">
                          <p style="margin: 0 0 4px 0; font-weight: 600; color: #64748b; font-size: 13px;">Q: ${escapeHtml(questionText)}</p>
                          <p style="margin: 0; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; font-size: 14px; color: #1e293b;">${escapeHtml(answer)}</p>
                        </div>
                      `;
                    }).filter(Boolean).join('');

                    // Build AI feedback section based on relevance score
                    const isHighRelevance = aiFeedback.relevance_score === 'high';
                    const feedbackBorderColor = isHighRelevance ? '#22c55e' : '#fbbf24';
                    const feedbackBgColor = isHighRelevance ? '#f0fdf4' : '#fffbeb';
                    const feedbackLabelColor = isHighRelevance ? '#166534' : '#92400e';
                    const feedbackLabel = isHighRelevance ? 'AI Coaching Summary' : 'AI Coaching Summary — Needs Attention';

                    const feedbackHtml = `
                      <div style="background: ${feedbackBgColor}; padding: 16px; border-radius: 8px; border-left: 4px solid ${feedbackBorderColor}; margin: 16px 0;">
                        <p style="margin: 0 0 8px 0; font-weight: 600; color: ${feedbackLabelColor}; font-size: 14px;">${feedbackLabel}</p>
                        <p style="margin: 0 0 4px 0; font-weight: 600; color: #1e293b;">${escapeHtml(aiFeedback.headline || '')}</p>
                        <p style="margin: 0; color: #334155; font-size: 14px;">${escapeHtml(aiFeedback.coaching_summary || '')}</p>
                        ${aiFeedback.highlight ? `<p style="margin: 8px 0 0 0; color: ${feedbackLabelColor}; font-size: 13px;"><strong>Highlight:</strong> ${escapeHtml(aiFeedback.highlight)}</p>` : ''}
                        ${aiFeedback.pushback ? `<p style="margin: 8px 0 0 0; color: #92400e; font-size: 13px;"><strong>Follow-up needed:</strong> ${escapeHtml(aiFeedback.pushback)}</p>` : ''}
                      </div>
                    `;

                    // Build lesson info box
                    const safeModuleName = escapeHtml(moduleName);
                    const safeModuleDesc = moduleDescription ? escapeHtml(moduleDescription) : '';
                    const safeLessonTitle = escapeHtml(lesson.title);
                    const safeStaffName = escapeHtml(staffName);
                    const lessonInfoHtml = `
                      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${BRAND.colors.primary};">
                        <p style="margin: 0 0 4px 0; color: #64748b; font-size: 13px;">${safeModuleName}${safeModuleDesc ? ` — ${safeModuleDesc}` : ''}</p>
                        <p style="margin: 0; font-weight: 600; font-size: 16px; color: #1e293b;">Day ${lesson.day_number}: ${safeLessonTitle}</p>
                      </div>
                    `;

                    const bodyContent = `
                      ${EmailComponents.paragraph(`<strong>${safeStaffName}</strong> just completed a challenge lesson and submitted their reflections.`)}
                      ${lessonInfoHtml}
                      <h3 style="margin: 20px 0 12px 0; font-size: 16px; color: #1e293b;">Reflection Responses</h3>
                      ${qaHtml}
                      ${feedbackHtml}
                      ${EmailComponents.button('View Team Progress', progressUrl)}
                    `;

                    const emailHtml = buildEmailHtml({
                      title: 'Lesson Completed!',
                      subtitle: `${safeStaffName} finished Day ${lesson.day_number}`,
                      bodyContent,
                      footerAgencyName: agencyName,
                    });

                    const emailResponse = await fetch('https://api.resend.com/emails', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        from: BRAND.fromEmail,
                        to: [authUser.email],
                        subject: `${staffName} completed Day ${lesson.day_number}: ${lesson.title}`,
                        html: emailHtml,
                        text: `${staffName} just completed Day ${lesson.day_number}: ${lesson.title}\n\nWeek Theme: ${moduleName}\n\n${questions.map((q, i) => {
                          const questionText = typeof q === 'string' ? q : q.text;
                          const answer = reflection_response[`q${i}`] || reflection_response[i.toString()] || '';
                          return `Q: ${questionText}\nA: ${answer}`;
                        }).join('\n\n')}\n\nAI Coaching Summary: ${aiFeedback.coaching_summary}\n\nView progress: ${progressUrl}`,
                      }),
                    });

                    if (emailResponse.ok) {
                      console.log('[challenge-complete-lesson] Owner email sent to:', authUser.email);
                    } else {
                      const errData = await emailResponse.json();
                      console.error('[challenge-complete-lesson] Resend error:', errData);
                    }
                  }
                }
              } catch (emailErr) {
                console.error('[challenge-complete-lesson] Email send error:', emailErr);
              }
            }
          }
        } else {
          console.error('[challenge-complete-lesson] OpenAI API error:', openaiResponse.status, await openaiResponse.text());
        }
      } catch (aiErr) {
        console.error('[challenge-complete-lesson] AI feedback error:', aiErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        progress: updatedProgress,
        stats: {
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          progress_percent: progressPercent,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Complete lesson error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to complete lesson' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
