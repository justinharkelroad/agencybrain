import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token, quiz_id, answers } = await req.json();

    if (!session_token || !quiz_id || !answers) {
      return new Response(
        JSON.stringify({ error: 'Session token, quiz_id, and answers required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from('staff_sessions')
      .select('staff_user_id')
      .eq('session_token', session_token)
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

    // Fetch quiz with questions and correct answers
    const { data: quiz, error: quizError } = await supabase
      .from('training_quizzes')
      .select(`
        *,
        training_quiz_questions (
          id,
          question_text,
          question_type,
          correct_answer,
          options,
          order_index
        )
      `)
      .eq('id', quiz_id)
      .single();

    if (quizError || !quiz) {
      return new Response(
        JSON.stringify({ error: 'Quiz not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate score
    const questions = quiz.training_quiz_questions as any[];
    let correctCount = 0;
    const detailedResults = [];

    for (const question of questions) {
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correct_answer;
      
      if (isCorrect) {
        correctCount++;
      }

      detailedResults.push({
        question_id: question.id,
        question_text: question.question_text,
        user_answer: userAnswer,
        correct_answer: question.correct_answer,
        is_correct: isCorrect
      });
    }

    const totalQuestions = questions.length;
    const scorePercentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const passed = scorePercentage >= (quiz.passing_score || 70);

    // Store attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('training_quiz_attempts')
      .insert({
        quiz_id: quiz_id,
        staff_user_id: staffUserId,
        score: scorePercentage,
        passed: passed,
        answers_json: answers,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Failed to store quiz attempt:', attemptError);
      return new Response(
        JSON.stringify({ error: 'Failed to store quiz attempt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If passed, mark lesson as completed
    if (passed) {
      const { data: existingProgress } = await supabase
        .from('staff_training_progress')
        .select('id, completed_at')
        .eq('staff_user_id', staffUserId)
        .eq('lesson_id', quiz.lesson_id)
        .single();

      if (!existingProgress || !existingProgress.completed_at) {
        await supabase
          .from('staff_training_progress')
          .upsert({
            staff_user_id: staffUserId,
            lesson_id: quiz.lesson_id,
            status: 'completed',
            completed_at: new Date().toISOString(),
            progress_percentage: 100
          }, {
            onConflict: 'staff_user_id,lesson_id'
          });
      }
    }

    console.log(`Quiz attempt submitted: user=${staffUserId}, quiz=${quiz_id}, score=${scorePercentage}%, passed=${passed}`);

    return new Response(
      JSON.stringify({
        attempt_id: attempt.id,
        score: scorePercentage,
        passed: passed,
        correct_count: correctCount,
        total_questions: totalQuestions,
        passing_score: quiz.passing_score || 70,
        detailed_results: detailedResults
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Submit quiz attempt error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
