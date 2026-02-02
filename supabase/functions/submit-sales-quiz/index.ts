import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

async function generateAIFeedback(
  lessonTitle: string,
  lessonContent: string | null,
  questions: any[],
  gradedAnswers: any[],
  scorePercent: number
): Promise<string> {
  if (!anthropicApiKey) {
    // Fallback to template-based feedback
    if (scorePercent >= 80) {
      return `Great job! You scored ${scorePercent}% on this quiz. You've demonstrated a solid understanding of the material.`;
    } else if (scorePercent >= 60) {
      return `Good effort! You scored ${scorePercent}%. Consider reviewing the areas where you missed questions.`;
    } else {
      return `You scored ${scorePercent}%. We recommend reviewing the lesson content and trying again.`;
    }
  }

  try {
    // Build context about the questions and answers
    const qaContext = gradedAnswers.map((a, i) => {
      const q = questions.find(q => q.id === a.question_id);
      return `Question ${i + 1}: ${a.question}
Staff Answer: ${a.user_answer}
${a.is_correct !== undefined ? `Correct: ${a.is_correct ? 'Yes' : 'No'}` : '(Open-ended)'}`;
    }).join('\n\n');

    const prompt = `You are a supportive sales coach providing feedback on a quiz submission.

Lesson: ${lessonTitle}
${lessonContent ? `Lesson Content Summary: ${lessonContent.substring(0, 500)}...` : ''}

Quiz Results (Score: ${scorePercent}%):
${qaContext}

Provide brief, encouraging feedback (2-3 sentences) that:
1. Acknowledges their effort and score
2. Highlights what they understood well OR areas to review
3. Connects back to the practical sales application

Keep it conversational and motivating. Don't list every question - focus on overall understanding.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Anthropic API error:', await response.text());
      return `You scored ${scorePercent}%. ${scorePercent >= 70 ? 'Good work!' : 'Keep practicing!'}`;
    }

    const data = await response.json();
    return data.content?.[0]?.text || `You scored ${scorePercent}%.`;
  } catch (error) {
    console.error('AI feedback error:', error);
    return `You scored ${scorePercent}%. ${scorePercent >= 70 ? 'Good work!' : 'Keep practicing!'}`;
  }
}

interface QuizAnswer {
  question_id: string;
  answer: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'open_ended';
  options?: string[];
  correct_answer?: string;
  points: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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

    // Parse request body
    const { lesson_id, answers } = await req.json() as {
      lesson_id: string;
      answers: QuizAnswer[];
    };

    if (!lesson_id || !answers || !Array.isArray(answers)) {
      return new Response(
        JSON.stringify({ error: 'Missing lesson_id or answers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate staff session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select(`
        staff_user_id,
        expires_at,
        staff_users (
          id,
          agency_id,
          display_name,
          email,
          team_member_id,
          team_members (
            agency_id
          )
        )
      `)
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

    const staffUser = session.staff_users as any;
    const staffUserId = staffUser.id;
    const agencyId = staffUser.team_members?.agency_id || staffUser.agency_id;

    // Get assignment for this agency
    const { data: assignment, error: assignmentError } = await supabase
      .from('sales_experience_assignments')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('status', 'active')
      .single();

    if (assignmentError || !assignment) {
      return new Response(
        JSON.stringify({ error: 'No active assignment found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get lesson with quiz questions
    const { data: lesson, error: lessonError } = await supabase
      .from('sales_experience_lessons')
      .select('*, sales_experience_modules!inner(week_number)')
      .eq('id', lesson_id)
      .eq('is_staff_visible', true)
      .single();

    if (lessonError || !lesson) {
      return new Response(
        JSON.stringify({ error: 'Lesson not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const quizQuestions = lesson.quiz_questions as QuizQuestion[] || [];
    if (quizQuestions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'This lesson has no quiz' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if lesson is unlocked for this staff member
    const moduleWeek = lesson.sales_experience_modules.week_number;
    const today = new Date();
    const startDate = new Date(assignment.start_date);
    let businessDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= today) {
      const dow = currentDate.getDay();
      if (dow !== 0 && dow !== 6) {
        businessDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const currentWeek = Math.min(8, Math.max(1, Math.ceil(businessDays / 5)));
    const dayInWeek = ((businessDays - 1) % 5) + 1;

    // Time-gating check
    const isUnlocked =
      moduleWeek < currentWeek ||
      (moduleWeek === currentWeek && dayInWeek >= lesson.day_of_week);

    if (!isUnlocked) {
      return new Response(
        JSON.stringify({ error: 'This lesson is not yet available' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate score
    let totalPoints = 0;
    let earnedPoints = 0;
    const gradedAnswers: any[] = [];

    quizQuestions.forEach((question) => {
      totalPoints += question.points || 1;
      const userAnswer = answers.find((a) => a.question_id === question.id);

      if (question.type === 'multiple_choice' && question.correct_answer) {
        const isCorrect =
          userAnswer?.answer?.toLowerCase() === question.correct_answer?.toLowerCase();
        if (isCorrect) {
          earnedPoints += question.points || 1;
        }
        gradedAnswers.push({
          question_id: question.id,
          question: question.question,
          user_answer: userAnswer?.answer || '',
          correct_answer: question.correct_answer,
          is_correct: isCorrect,
          points: isCorrect ? (question.points || 1) : 0,
        });
      } else {
        // Open-ended questions - give full points for non-empty answers
        const hasAnswer = userAnswer?.answer && userAnswer.answer.trim().length > 0;
        if (hasAnswer) {
          earnedPoints += question.points || 1;
        }
        gradedAnswers.push({
          question_id: question.id,
          question: question.question,
          user_answer: userAnswer?.answer || '',
          is_open_ended: true,
          points: hasAnswer ? (question.points || 1) : 0,
        });
      }
    });

    const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    // Get previous attempt count
    const { count: attemptCount } = await supabase
      .from('sales_experience_quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_id', assignment.id)
      .eq('staff_user_id', staffUserId)
      .eq('lesson_id', lesson_id);

    const attemptNumber = (attemptCount || 0) + 1;

    // Generate AI feedback using Claude
    const feedbackAi = await generateAIFeedback(
      lesson.title,
      lesson.content_html,
      quizQuestions,
      gradedAnswers,
      scorePercent
    );

    // Record the quiz attempt
    const { error: attemptError } = await supabase
      .from('sales_experience_quiz_attempts')
      .insert({
        assignment_id: assignment.id,
        staff_user_id: staffUserId,
        lesson_id,
        attempt_number: attemptNumber,
        answers_json: gradedAnswers,
        score_percent: scorePercent,
        feedback_ai: feedbackAi,
        completed_at: new Date().toISOString(),
      });

    if (attemptError) {
      console.error('Quiz attempt error:', attemptError);
    }

    // Update staff progress with quiz results
    const { error: progressError } = await supabase
      .from('sales_experience_staff_progress')
      .upsert({
        assignment_id: assignment.id,
        staff_user_id: staffUserId,
        lesson_id,
        status: 'completed',
        quiz_score_percent: scorePercent,
        quiz_feedback_ai: feedbackAi,
        quiz_completed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }, {
        onConflict: 'assignment_id,staff_user_id,lesson_id',
      });

    if (progressError) {
      console.error('Progress update error:', progressError);
    }

    // Queue email notification to agency owner
    try {
      // Get agency owner's email
      const { data: agencyOwner } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('agency_id', agencyId)
        .eq('role', 'owner')
        .single();

      if (agencyOwner?.email) {
        // Queue email to owner
        await supabase.from('sales_experience_email_queue').insert({
          assignment_id: assignment.id,
          recipient_email: agencyOwner.email,
          recipient_name: agencyOwner.full_name,
          email_type: 'quiz_completed',
          subject: `${staffUser.display_name || 'Team Member'} completed a quiz`,
          body_html: `
            <p>Hi ${agencyOwner.full_name || 'there'},</p>
            <p><strong>${staffUser.display_name || 'A team member'}</strong> just completed a quiz in the 8 Week Sales Experience.</p>
            <p><strong>Lesson:</strong> ${lesson.title}</p>
            <p><strong>Score:</strong> ${scorePercent}%</p>
            <p>Log in to see their progress and detailed results.</p>
          `,
          scheduled_for: new Date().toISOString(),
          status: 'pending',
        });
      }

      // Also queue confirmation email to staff member
      if (staffUser.email) {
        await supabase.from('sales_experience_email_queue').insert({
          assignment_id: assignment.id,
          recipient_email: staffUser.email,
          recipient_name: staffUser.display_name,
          email_type: 'quiz_result',
          subject: `Your quiz results: ${lesson.title}`,
          body_html: `
            <p>Hi ${staffUser.display_name || 'there'},</p>
            <p>You scored <strong>${scorePercent}%</strong> on the quiz for "${lesson.title}".</p>
            <p><strong>Feedback:</strong></p>
            <p>${feedbackAi}</p>
            <p>Keep up the great work with your sales training!</p>
          `,
          scheduled_for: new Date().toISOString(),
          status: 'pending',
        });
      }
    } catch (emailError) {
      console.error('Email queue error:', emailError);
      // Don't fail the request if email queueing fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        score_percent: scorePercent,
        earned_points: earnedPoints,
        total_points: totalPoints,
        attempt_number: attemptNumber,
        feedback_ai: feedbackAi,
        graded_answers: gradedAnswers,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Submit sales quiz error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to submit quiz' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
