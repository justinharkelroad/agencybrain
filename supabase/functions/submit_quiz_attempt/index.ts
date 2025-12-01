import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PASSING_SCORE = 70; // Hardcoded since no column exists

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
      console.error('Session verification failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffUserId = session.staff_user_id;

    // Fetch quiz separately
    const { data: quiz, error: quizError } = await supabase
      .from('training_quizzes')
      .select('id, agency_id, lesson_id, name')
      .eq('id', quiz_id)
      .single();

    if (quizError || !quiz) {
      console.error('Quiz not found:', quizError);
      return new Response(
        JSON.stringify({ error: 'Quiz not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch questions with options
    const { data: questions, error: questionsError } = await supabase
      .from('training_quiz_questions')
      .select(`
        id,
        question_text,
        question_type,
        sort_order,
        training_quiz_options (
          id,
          option_text,
          is_correct,
          sort_order
        )
      `)
      .eq('quiz_id', quiz_id)
      .order('sort_order', { ascending: true });

    if (questionsError || !questions) {
      console.error('Failed to fetch questions:', questionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch quiz questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate score - handle text_response separately
    let correctCount = 0;
    let gradableCount = 0;
    const detailedResults = [];

    for (const question of questions) {
      const userAnswer = answers[question.id];
      
      // Handle text_response questions - store but don't grade
      if (question.question_type === 'text_response') {
        detailedResults.push({
          question_id: question.id,
          question_text: question.question_text,
          user_answer: userAnswer || '',
          is_correct: null,
          type: 'text_response'
        });
        continue;
      }

      // Find correct option for gradable questions
      const options = question.training_quiz_options || [];
      const correctOption = options.find((opt: any) => opt.is_correct);
      
      if (!correctOption) {
        console.warn(`No correct answer for question ${question.id}`);
        continue;
      }

      // Find the selected option - check both ID match (new) and text match (old/fallback)
      const selectedOption = options.find((opt: any) => 
        opt.id === userAnswer || opt.option_text === userAnswer
      );
      
      // Check if answer is correct - support both ID and text comparison
      const isCorrect = userAnswer === correctOption.id || userAnswer === correctOption.option_text;
      
      console.log(`Question ${question.id}: userAnswer="${userAnswer}", correctId="${correctOption.id}", correctText="${correctOption.option_text}", isCorrect=${isCorrect}`);
      
      if (isCorrect) {
        correctCount++;
      }
      gradableCount++;

      detailedResults.push({
        question_id: question.id,
        question_text: question.question_text,
        user_answer: selectedOption?.option_text || 'No answer provided',
        correct_answer: correctOption.id,
        correct_answer_text: correctOption.option_text,
        is_correct: isCorrect,
        type: question.question_type
      });
    }

    const scorePercentage = gradableCount > 0 ? Math.round((correctCount / gradableCount) * 100) : 0;
    const passed = scorePercentage >= PASSING_SCORE;

    console.log(`Quiz scoring: ${correctCount}/${gradableCount} correct (${scorePercentage}%), passed: ${passed}`);

    // Store attempt with correct column names
    const { data: attempt, error: attemptError } = await supabase
      .from('training_quiz_attempts')
      .insert({
        quiz_id: quiz_id,
        agency_id: quiz.agency_id,
        staff_user_id: staffUserId,
        score_percent: scorePercentage,
        total_questions: questions.length,
        correct_answers: correctCount,
        answers_json: answers,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Failed to store quiz attempt:', attemptError);
      return new Response(
        JSON.stringify({ error: 'Failed to store quiz attempt', details: attemptError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate AI coaching feedback
    let aiFeedback = null;
    try {
      // Fetch lesson and module context
      const { data: lesson, error: lessonError } = await supabase
        .from('training_lessons')
        .select('name, description, content_html, module_id')
        .eq('id', quiz.lesson_id)
        .single();

      let moduleName = 'Unknown Module';
      if (lesson?.module_id) {
        const { data: module } = await supabase
          .from('training_modules')
          .select('name')
          .eq('id', lesson.module_id)
          .single();
        if (module) moduleName = module.name;
      }

      // Extract reflection answers
      const reflectionAnswers = {
        reflection_1: answers['reflection_1'] || '',
        reflection_2: answers['reflection_2'] || ''
      };
      const reflection1 = reflectionAnswers.reflection_1 || '';
      const reflection2 = reflectionAnswers.reflection_2 || '';

      // Only generate AI feedback if we have reflection answers
      if (reflection1 || reflection2) {
        // Build context parts conditionally
        let contextParts = [
          `Module: ${moduleName}`,
          `Lesson: ${lesson?.name || 'Unknown Lesson'}`
        ];

        if (lesson?.description) {
          contextParts.push(`Lesson Description: ${lesson.description}`);
        }

        // Only include content if it exists and is not empty
        if (lesson?.content_html && lesson.content_html.trim()) {
          const contentText = lesson.content_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (contentText) {
            contextParts.push(`Lesson Content: ${contentText.substring(0, 500)}...`);
          }
        }

        const lessonContext = contextParts.join('\n');

        const prompt = `You are a professional sales coach with an encouraging, therapeutic tone. A team member just completed a training lesson and answered reflection questions.

LESSON CONTEXT:
${lessonContext}

THEIR REFLECTION ANSWERS:
1. Main Takeaway: ${reflection1}
2. Why It's Important: ${reflection2}

YOUR TASK:
Provide coaching feedback that:
1. Acknowledges what they shared (show you heard them)
2. Reinforces strong takeaways or gently redirects weak ones
3. Evaluates if their takeaway is ACTIONABLE — can they actually DO something with it?
4. If not actionable, coach them on how to make it actionable
5. Provide 1-2 clear, specific action items they should implement

FORMAT:
- Write in sales letter style — short sentences, each on its own line
- Add a blank line between sentences for easy scanning
- One paragraph acknowledging their response
- One paragraph evaluating if the takeaway is actionable
- Numbered action items at the end (1-2 specific items)
- Keep total response under 200 words
- Be encouraging but direct when something needs improvement`;

        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (OPENAI_API_KEY) {
          console.log('Calling OpenAI for coaching feedback...');
          const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 500,
              temperature: 0.7
            })
          });

          if (openAIResponse.ok) {
            const openAIData = await openAIResponse.json();
            aiFeedback = openAIData.choices?.[0]?.message?.content || null;
            console.log('AI feedback generated successfully');

            // Update the attempt with AI feedback
            if (aiFeedback) {
              await supabase
                .from('training_quiz_attempts')
                .update({ ai_feedback: aiFeedback })
                .eq('id', attempt.id);
            }
          } else {
            console.error('OpenAI API error:', openAIResponse.status, await openAIResponse.text());
          }
        } else {
          console.warn('OPENAI_API_KEY not configured, skipping AI feedback');
        }
      }
    } catch (aiError) {
      console.error('Error generating AI feedback:', aiError);
      // Continue without AI feedback - don't fail the quiz submission
    }

    // If passed, update lesson progress
    if (passed) {
      const { error: progressError } = await supabase
        .from('staff_lesson_progress')
        .upsert({
          staff_user_id: staffUserId,
          lesson_id: quiz.lesson_id,
          completed: true,
          completed_at: new Date().toISOString()
        }, {
          onConflict: 'staff_user_id,lesson_id'
        });

      if (progressError) {
        console.error('Failed to update lesson progress:', progressError);
      } else {
        console.log(`✅ Successfully marked lesson ${quiz.lesson_id} as complete for staff user ${staffUserId}`);
      }
    }

    console.log(`Quiz attempt submitted: user=${staffUserId}, quiz=${quiz_id}, score=${scorePercentage}%, passed=${passed}`);

    return new Response(
      JSON.stringify({
        attempt_id: attempt.id,
        score: scorePercentage,
        passed: passed,
        correct_count: correctCount,
        total_questions: questions.length,
        gradable_questions: gradableCount,
        passing_score: PASSING_SCORE,
        detailed_results: detailedResults,
        reflection_answers: reflectionAnswers,
        ai_feedback: aiFeedback
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Submit quiz attempt error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
