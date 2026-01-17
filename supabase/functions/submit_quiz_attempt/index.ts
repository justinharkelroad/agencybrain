import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PASSING_SCORE = 70; // Hardcoded since no column exists

// Helper to get accountability style instructions
function getAccountabilityStyleInstructions(style: string | null): string {
  if (style === 'direct_challenge') {
    return `ACCOUNTABILITY STYLE = Direct Challenge:
- Speak the hard truth, but root it in their potential
- Example: "You know you're capable of better. Here's the gap..."`;
  } else if (style === 'gentle_nudge') {
    return `ACCOUNTABILITY STYLE = Gentle Nudge:
- Wrap the truth in grace. Validate first, then offer insight
- Lead with acknowledgment before the challenge`;
  } else if (style === 'questions_discover') {
    return `ACCOUNTABILITY STYLE = Questions to Discover:
- Use the Socratic approach
- Ask questions that help them discover insights themselves`;
  }
  return '';
}

// Helper to get feedback preference instructions
function getFeedbackPreferenceInstructions(pref: string | null): string {
  if (pref === 'blunt_truth') {
    return `FEEDBACK PREFERENCE = Blunt Truth:
- Get to the point quickly without sugarcoating
- Keep empathy high but cut the fluff`;
  } else if (pref === 'encouragement_then_truth') {
    return `FEEDBACK PREFERENCE = Encouragement then Truth:
- Acknowledge what they did well before challenging them
- Sandwich growth points between affirmation and future vision`;
  } else if (pref === 'questions_to_discover') {
    return `FEEDBACK PREFERENCE = Socratic Approach:
- Frame insights as questions that help them discover truth themselves
- Weight the provocative questions heavily`;
  }
  return '';
}

// Build the therapeutic coaching prompt
function buildCoachingPrompt(
  profile: any,
  categoryName: string,
  moduleName: string,
  lessonName: string,
  lessonDescription: string,
  lessonContent: string,
  reflection1: string,
  reflection2: string
): string {
  // Build user profile context
  let profileContext = '';
  if (profile) {
    const parts = [];
    if (profile.preferred_name) parts.push(`Name: ${profile.preferred_name}`);
    if (profile.life_roles?.length) parts.push(`Life Roles: ${profile.life_roles.join(', ')}`);
    if (profile.core_values?.length) parts.push(`Core Values: ${profile.core_values.join(', ')}`);
    if (profile.current_goals) parts.push(`Current Focus: ${profile.current_goals}`);
    if (profile.current_challenges) parts.push(`Challenges: ${profile.current_challenges}`);
    if (profile.growth_edge) parts.push(`Growth Edge: ${profile.growth_edge}`);
    if (profile.spiritual_beliefs) parts.push(`Spiritual Context: ${profile.spiritual_beliefs}`);

    if (parts.length > 0) {
      profileContext = `
=== USER PROFILE CONTEXT ===
${parts.join('\n')}
`;
    }
  }

  // Build response calibration
  let responseCalibration = '';
  if (profile?.accountability_style || profile?.feedback_preference) {
    const calibrationParts = [];
    if (profile.accountability_style) {
      calibrationParts.push(getAccountabilityStyleInstructions(profile.accountability_style));
    }
    if (profile.feedback_preference) {
      calibrationParts.push(getFeedbackPreferenceInstructions(profile.feedback_preference));
    }
    if (calibrationParts.length > 0) {
      responseCalibration = `
=== RESPONSE CALIBRATION ===
${calibrationParts.join('\n\n')}
`;
    }
  }

  return `You are Agency Brain — a wise, empathetic, and spiritually grounded training coach.

Your goal is to provide personalized coaching feedback that helps this team member integrate what they've learned and take action.
${profileContext}
=== TRAINING CONTEXT ===
Category: ${categoryName}
Module: ${moduleName}
Lesson: ${lessonName}
${lessonDescription ? `Description: ${lessonDescription}` : ''}
${lessonContent ? `Key Content: ${lessonContent.substring(0, 1500)}...` : ''}

=== THEIR REFLECTION ANSWERS ===
1. Most valuable insight: "${reflection1}"
2. How they'll apply it: "${reflection2}"

=== THERAPEUTIC FRAMEWORK: VALIDATE → REFRAME → ANCHOR ===

A. VALIDATE: Make them feel SEEN
   - Acknowledge the SPECIFIC insight they captured
   - Show you understand WHY this resonated with them
   - Don't just say "good job" — name what was meaningful

B. REFRAME: Connect to their bigger picture
   ${profile?.core_values?.length ? `- How does this lesson connect to their core values (${profile.core_values.join(', ')})?` : '- How does this lesson connect to their professional growth?'}
   ${profile?.current_goals ? `- How does it support their current focus: ${profile.current_goals}?` : '- How does it support their career development?'}
   ${profile?.growth_edge ? `- What does mastering this enable for their growth edge (${profile.growth_edge})?` : '- What does mastering this skill unlock?'}

C. ANCHOR: Create a memorable takeaway
   - Give this insight a name or metaphor they'll remember
   ${profile?.spiritual_beliefs ? `- If relevant, weave in a principle from their spiritual context` : ''}
   - Connect to ACTION — what's the ONE thing they should do this week?
${responseCalibration}
=== OUTPUT REQUIREMENTS ===

Write your response in sales letter style:
- Short sentences, each on its own line
- Blank lines between sentences for easy scanning
- One paragraph validating their specific takeaway (show you HEARD them)
- One paragraph connecting to their profile/goals (make it personal)
- 2-3 specific action items they should implement THIS WEEK
- One sentence anchoring the insight to their values or identity

Keep total response under 250 words.
Be encouraging but direct — if their takeaway could be stronger, coach them on how.
Never be generic — every sentence should reference something SPECIFIC they said.`;
}


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

    // Fetch lesson, module, and category for snapshot columns
    let lessonName = 'Unknown Lesson';
    let moduleName = 'Unknown Module';
    let categoryName = 'Unknown Category';
    let lesson: any = null;

    const { data: lessonData, error: lessonError } = await supabase
      .from('training_lessons')
      .select('id, name, description, content_html, module_id')
      .eq('id', quiz.lesson_id)
      .single();

    if (lessonData) {
      lesson = lessonData;
      lessonName = lessonData.name;

      if (lessonData.module_id) {
        const { data: moduleData } = await supabase
          .from('training_modules')
          .select('id, name, category_id')
          .eq('id', lessonData.module_id)
          .single();

        if (moduleData) {
          moduleName = moduleData.name;

          if (moduleData.category_id) {
            const { data: categoryData } = await supabase
              .from('training_categories')
              .select('name')
              .eq('id', moduleData.category_id)
              .single();

            if (categoryData) {
              categoryName = categoryData.name;
            }
          }
        }
      }
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

    // Store attempt with snapshot columns for historical preservation
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
        completed_at: new Date().toISOString(),
        // Snapshot columns - preserved even if training content is deleted
        quiz_name: quiz.name,
        lesson_name: lessonName,
        module_name: moduleName,
        category_name: categoryName
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

    // Extract reflection answers (needed for both AI feedback and response)
    const reflectionAnswers = {
      reflection_1: answers['reflection_1'] || '',
      reflection_2: answers['reflection_2'] || ''
    };

    // Generate AI coaching feedback with therapeutic framework
    let aiFeedback = null;
    try {
      const reflection1 = reflectionAnswers.reflection_1 || '';
      const reflection2 = reflectionAnswers.reflection_2 || '';

      // Only generate AI feedback if we have reflection answers
      if (reflection1 || reflection2) {
        // Fetch user profile for personalization
        // Try to get flow_profile via staff_users -> team_members -> profiles -> flow_profiles chain
        let userProfile = null;

        // First get the staff user's team_member link
        const { data: staffUser } = await supabase
          .from('staff_users')
          .select('team_member_id, agency_id, display_name')
          .eq('id', staffUserId)
          .single();

        if (staffUser?.agency_id) {
          // Try to find associated flow profile via agency's profiles
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, user_id')
            .eq('agency_id', staffUser.agency_id);

          if (profiles?.length) {
            // Get flow profiles for any of these profiles
            for (const profile of profiles) {
              const { data: flowProfile } = await supabase
                .from('flow_profiles')
                .select('*')
                .eq('user_id', profile.user_id)
                .single();

              if (flowProfile) {
                userProfile = flowProfile;
                break;
              }
            }
          }
        }

        // Extract lesson content (more content for better context - 2000 chars)
        const lessonContent = lesson?.content_html
          ? lesson.content_html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          : '';

        // Build the therapeutic coaching prompt
        const prompt = buildCoachingPrompt(
          userProfile,
          categoryName,
          moduleName,
          lessonName,
          lesson?.description || '',
          lessonContent,
          reflection1,
          reflection2
        );

        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (OPENAI_API_KEY) {
          console.log('Calling OpenAI for therapeutic coaching feedback...');
          console.log('User profile available:', !!userProfile);

          const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 700,
              temperature: 0.7
            })
          });

          if (openAIResponse.ok) {
            const openAIData = await openAIResponse.json();
            aiFeedback = openAIData.choices?.[0]?.message?.content || null;
            console.log('Therapeutic AI feedback generated successfully');

            // Update the attempt with AI feedback
            if (aiFeedback) {
              await supabase
                .from('training_quiz_attempts')
                .update({
                  ai_feedback: aiFeedback,
                  reflection_answers_final: reflectionAnswers
                })
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

    // If passed, update lesson progress with snapshot columns
    if (passed) {
      const { error: progressError } = await supabase
        .from('staff_lesson_progress')
        .upsert({
          staff_user_id: staffUserId,
          lesson_id: quiz.lesson_id,
          completed: true,
          completed_at: new Date().toISOString(),
          // Snapshot columns for historical preservation
          lesson_name: lessonName,
          module_name: moduleName
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
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});