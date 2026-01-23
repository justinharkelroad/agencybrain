import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ENGAGEMENT_THRESHOLD = 7; // Score needed to pass (out of 10)

interface EngagementEvaluation {
  engagement_score: number;
  passed: boolean;
  issues: string[];
  specific_guidance: string;
  lesson_highlights: string[];
  revision_count?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_token, quiz_id, reflection_1, reflection_2, revision_count = 0 } = await req.json();

    if (!session_token || !quiz_id) {
      return new Response(
        JSON.stringify({ error: 'Session token and quiz_id required' }),
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

    // Fetch quiz and lesson context
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

    // Fetch lesson with full content
    let lessonName = 'Unknown Lesson';
    let moduleName = 'Unknown Module';
    let categoryName = 'Unknown Category';
    let lessonContent = '';
    let lessonDescription = '';

    const { data: lessonData } = await supabase
      .from('training_lessons')
      .select('id, name, description, content_html, module_id')
      .eq('id', quiz.lesson_id)
      .single();

    if (lessonData) {
      lessonName = lessonData.name || 'Unknown Lesson';
      lessonDescription = lessonData.description || '';

      // Extract clean text from HTML (up to 2000 chars for better context)
      if (lessonData.content_html) {
        lessonContent = lessonData.content_html
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 2000);
      }

      if (lessonData.module_id) {
        const { data: moduleData } = await supabase
          .from('training_modules')
          .select('id, name, category_id')
          .eq('id', lessonData.module_id)
          .single();

        if (moduleData) {
          moduleName = moduleData.name || 'Unknown Module';

          if (moduleData.category_id) {
            const { data: categoryData } = await supabase
              .from('training_categories')
              .select('name')
              .eq('id', moduleData.category_id)
              .single();

            if (categoryData) {
              categoryName = categoryData.name || 'Unknown Category';
            }
          }
        }
      }
    }

    // If no reflections provided, auto-fail
    if (!reflection_1?.trim() && !reflection_2?.trim()) {
      return new Response(
        JSON.stringify({
          engagement_score: 0,
          passed: false,
          issues: ['No reflection answers provided'],
          specific_guidance: 'Please provide your reflections on what you learned from this lesson.',
          lesson_highlights: [],
          revision_count
        } as EngagementEvaluation),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // After 2 revisions, allow through (prevent infinite loop)
    if (revision_count >= 2) {
      console.log(`User has revised ${revision_count} times, allowing through`);
      return new Response(
        JSON.stringify({
          engagement_score: 7,
          passed: true,
          issues: [],
          specific_guidance: '',
          lesson_highlights: [],
          revision_count
        } as EngagementEvaluation),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build engagement evaluation prompt
    const prompt = `You are a training quality evaluator. Your job is to determine if this staff member actually engaged with the training content based on their reflection answers.

=== LESSON CONTEXT ===
Category: ${categoryName}
Module: ${moduleName}
Lesson: ${lessonName}
${lessonDescription ? `Description: ${lessonDescription}` : ''}

=== LESSON CONTENT ===
${lessonContent || 'No content available'}

=== USER'S REFLECTION ANSWERS ===
1. Most valuable insight from the lesson: "${reflection_1 || '(not provided)'}"
2. How they will apply what they learned: "${reflection_2 || '(not provided)'}"

=== EVALUATION CRITERIA ===

1. SPECIFICITY (0-3 points):
   - Does the reflection reference specific concepts, terms, techniques, or examples FROM the lesson?
   - Generic responses like "this was helpful" or "I'll be better" score 0
   - Specific mentions of lesson content score 2-3

2. COMPREHENSION (0-3 points):
   - Does the takeaway demonstrate understanding of the lesson's core message?
   - Did they capture the main point or just surface-level observations?
   - Misunderstanding or completely off-topic content scores 0

3. ACTIONABILITY (0-2 points):
   - Is the application concrete and measurable?
   - "I'll be better at sales" = 0 points
   - "When a customer objects to price, I'll use the acknowledge-clarify-redirect technique from this lesson" = 2 points

4. ALIGNMENT (0-2 points):
   - Does the reflection actually match what the lesson taught?
   - Are they reflecting on THIS lesson or giving a generic response that could apply to anything?

=== SCORING GUIDELINES ===
Total possible: 10 points
- 7-10: PASS - Shows genuine engagement
- 4-6: BORDERLINE - Could be improved but shows some engagement
- 0-3: FAIL - Generic, off-topic, or clearly didn't engage with content

=== YOUR RESPONSE ===
Respond ONLY with valid JSON in this exact format:
{
  "engagement_score": <number 1-10>,
  "passed": <true if score >= 7, false otherwise>,
  "issues": [
    <array of 1-3 specific issues with their reflection, or empty if passed>
  ],
  "specific_guidance": "<If NOT passed, provide 2-3 sentences explaining what they should address. Reference specific content from the lesson they should mention. If passed, leave empty string>",
  "lesson_highlights": [
    <array of 2-4 key concepts from the lesson they could reference to improve their reflection. Only include if NOT passed, otherwise empty array>
  ]
}

Do not include any text outside the JSON object. Be strict but fair - the goal is to ensure they actually read and processed the training content.`;

    // Call OpenAI for evaluation
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      // If no API key, pass through (don't block training)
      return new Response(
        JSON.stringify({
          engagement_score: 7,
          passed: true,
          issues: [],
          specific_guidance: '',
          lesson_highlights: [],
          revision_count
        } as EngagementEvaluation),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling OpenAI for engagement evaluation...');
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Fast and cheap for evaluation
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.3 // Lower temperature for more consistent evaluation
      })
    });

    if (!openAIResponse.ok) {
      console.error('OpenAI API error:', openAIResponse.status, await openAIResponse.text());
      // On API error, pass through
      return new Response(
        JSON.stringify({
          engagement_score: 7,
          passed: true,
          issues: [],
          specific_guidance: '',
          lesson_highlights: [],
          revision_count
        } as EngagementEvaluation),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIData = await openAIResponse.json();
    const aiContent = openAIData.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error('No AI content in response');
      return new Response(
        JSON.stringify({
          engagement_score: 7,
          passed: true,
          issues: [],
          specific_guidance: '',
          lesson_highlights: [],
          revision_count
        } as EngagementEvaluation),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse AI response
    let evaluation: EngagementEvaluation;
    try {
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) ||
                        aiContent.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : aiContent;
      evaluation = JSON.parse(jsonString.trim());
      evaluation.revision_count = revision_count;
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Raw:', aiContent);
      // On parse error, pass through
      evaluation = {
        engagement_score: 7,
        passed: true,
        issues: [],
        specific_guidance: '',
        lesson_highlights: [],
        revision_count
      };
    }

    console.log(`Engagement evaluation: score=${evaluation.engagement_score}, passed=${evaluation.passed}`);

    return new Response(
      JSON.stringify(evaluation),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Evaluate quiz engagement error:', error);
    // On any error, pass through to not block training
    return new Response(
      JSON.stringify({
        engagement_score: 7,
        passed: true,
        issues: [],
        specific_guidance: '',
        lesson_highlights: []
      } as EngagementEvaluation),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
