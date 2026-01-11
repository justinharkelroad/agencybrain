import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const STAN_SYSTEM_PROMPT = `You are Stan, the friendly AI assistant for Agency Brain - an insurance agency management platform.

PERSONALITY:
- Warm, helpful, and encouraging - like a knowledgeable coworker
- Keep responses concise (2-4 sentences unless more detail is genuinely needed)
- Use "you" and "your" to be personal
- Be empathetic when users seem frustrated

CRITICAL RULES - FOLLOW THESE EXACTLY:

1. NEVER HALLUCINATE OR MAKE THINGS UP
   - ONLY provide information that is in the FAQ knowledge base provided below
   - If no FAQ matches the user's question, say: "I don't have specific information about that yet. You can email info@standardplaybook.com for help, or I can try to answer a different question!"
   - Do NOT invent features, locations, or instructions

2. TIER RESTRICTIONS ARE ABSOLUTE - THIS IS THE MOST IMPORTANT RULE
   - The user's membership tier is shown in USER CONTEXT below
   - 1:1 Coaching-only features: Bonus Grid, Snapshot Planner, Roleplay Bot/AI Sales Bot, Theta Talk Track, Qualitative sections
   - If the user is "Boardroom" tier and asks about ANY of these features, tell them it's NOT available to them
   - NEVER tell a Boardroom user they "have access" or "can use" 1:1-only features
   - When you see an FAQ marked as "Tier Restriction: 1:1 Coaching" and the user is Boardroom, that feature is NOT available to them

3. ROLE RESTRICTIONS
   - Staff members cannot access: Bonus Grid, Snapshot Planner, Agency Management, full Analytics, The Exchange
   - If a staff member asks about owner-only features, explain kindly that these are for agency owners

4. USE FAQ DATA AS SOURCE OF TRUTH
   - Base your answers on the FAQ entries provided
   - Rephrase naturally but don't add information that isn't there
   - If the FAQ says a feature is tier-restricted, enforce that restriction
   - Pay close attention to the "Tier Restriction" field in each FAQ

RESPONSE GUIDELINES:
- Point users to the right page/tab when relevant (e.g., "Head over to Agency → Team tab")
- Use **bold** for navigation items
- Keep responses focused and actionable
- When unsure, be honest and offer the support email`;

// Common stop words to filter out of search
const STOP_WORDS = ['the', 'and', 'for', 'that', 'this', 'with', 'how', 'what', 'where', 'why', 'can', 'does', 'have', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'did', 'doing', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'will', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'from', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'own', 'same', 'than', 'too', 'very', 'just', 'also', 'use'];

// 1:1 Coaching only features that Boardroom users cannot access
const COACHING_ONLY_FEATURES = ['roleplay', 'sales bot', 'ai sales', 'bonus grid', 'snapshot planner', 'theta talk', 'qualitative'];

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      message, 
      conversation_history = [],
      context 
    } = await req.json();

    const {
      portal = 'brain',
      current_page = '/dashboard',
      user_role = 'owner',
      membership_tier = 'all',
      user_id = null,
      staff_user_id = null,
      agency_id = null
    } = context || {};

    console.log('Stan chat request:', { message, portal, current_page, user_role, membership_tier });

    // ============ STEP 1: Search relevant FAQs ============

    // Extract keywords from the user's message
    const messageWords = message.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word: string) => word.length > 2 && !STOP_WORDS.includes(word));

    console.log('Search keywords:', messageWords);

    // Check if user is asking about a 1:1-only feature while on Boardroom tier
    const messageLower = message.toLowerCase();
    const isAskingAboutCoachingFeature = COACHING_ONLY_FEATURES.some(f => messageLower.includes(f));
    const isBoardroomUser = membership_tier === 'Boardroom';

    // Get ALL active FAQs and score them (more comprehensive search)
    const { data: allFaqs, error: faqError } = await supabase
      .from('chatbot_faqs')
      .select('question, answer, category, keywords, applies_to_roles, applies_to_tiers, page_context')
      .eq('is_active', true);

    if (faqError) {
      console.error('FAQ search error:', faqError);
    }

    // Score and rank FAQs by relevance
    const scoredFaqs = (allFaqs || []).map(faq => {
      let score = 0;
      
      // Keyword matching in FAQ keywords array
      const faqKeywords = (faq.keywords || []).map((k: string) => k.toLowerCase());
      const faqQuestion = faq.question.toLowerCase();
      const faqAnswer = faq.answer.toLowerCase();
      
      for (const word of messageWords) {
        // Exact keyword match (highest value)
        if (faqKeywords.includes(word)) score += 5;
        // Partial keyword match
        if (faqKeywords.some((k: string) => k.includes(word) || word.includes(k))) score += 3;
        // Question contains word
        if (faqQuestion.includes(word)) score += 2;
        // Answer contains word
        if (faqAnswer.includes(word)) score += 1;
      }
      
      // Page context bonus
      const pageContexts = faq.page_context || [];
      if (pageContexts.some((p: string) => current_page.startsWith(p))) score += 3;
      
      // CRITICAL: Tier-specific FAQ boosting
      const tiers = faq.applies_to_tiers || [];
      
      // If Boardroom user asking about 1:1 feature, HEAVILY boost Boardroom-specific FAQs
      if (isBoardroomUser && isAskingAboutCoachingFeature) {
        if (tiers.includes('Boardroom')) {
          score += 20; // Massively boost Boardroom-specific FAQs about restricted features
        }
        // Deprioritize 1:1 Coaching FAQs for Boardroom users
        if (tiers.includes('1:1 Coaching') && !tiers.includes('all') && !tiers.includes('Boardroom')) {
          score -= 10;
        }
      } else {
        // Normal tier matching
        if (tiers.includes(membership_tier)) score += 2;
        if (tiers.includes('all')) score += 1;
      }
      
      // Check role relevance
      const roles = faq.applies_to_roles || [];
      if (roles.includes(user_role)) score += 1;
      
      return { ...faq, score };
    })
    .filter(faq => faq.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8); // Get top 8 matches for better context

    console.log('FAQs found:', scoredFaqs.length, 'Top scores:', scoredFaqs.slice(0, 3).map(f => ({ q: f.question.slice(0, 40), score: f.score })));

    // ============ STEP 2: Build context for OpenAI ============
    
    // Add tier enforcement reminder if user is Boardroom asking about 1:1 features
    let tierWarning = '';
    if (isBoardroomUser && isAskingAboutCoachingFeature) {
      tierWarning = `\n\n⚠️ IMPORTANT: This user is a BOARDROOM member asking about a 1:1 Coaching-only feature. They do NOT have access. Tell them kindly that this feature is not available on their plan and suggest contacting info@standardplaybook.com to upgrade.`;
    }

    const faqContext = scoredFaqs.length > 0
      ? `\n\nRELEVANT FAQ KNOWLEDGE (use ONLY this information):${tierWarning}\n${scoredFaqs.map((faq, i) => 
          `${i + 1}. Q: ${faq.question}\n   A: ${faq.answer}\n   Tier Restriction: ${(faq.applies_to_tiers || []).join(', ')}`
        ).join('\n\n')}`
      : `\n\nNO MATCHING FAQs FOUND.${tierWarning} Tell the user you don\'t have specific information about their question and suggest emailing info@standardplaybook.com. Do NOT make up an answer.`;

    const userContext = `
USER CONTEXT:
- Portal: ${portal === 'staff' ? 'Staff Portal' : 'Brain Portal (Main App)'}
- Current Page: ${current_page}
- Role: ${user_role}
- Membership Tier: ${membership_tier}${membership_tier === 'Boardroom' ? ' (DOES NOT have access to: Roleplay Bot, AI Sales Bot, Bonus Grid, Snapshot Planner, Theta Talk Track, Qualitative sections)' : ''}`;

    // Build messages array for OpenAI
    const messages: any[] = [
      { role: 'system', content: STAN_SYSTEM_PROMPT + userContext + faqContext }
    ];

    // Add conversation history (last 6 messages max)
    const recentHistory = conversation_history.slice(-6);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'stan' ? 'assistant' : 'user',
        content: msg.content
      });
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // ============ STEP 3: Call OpenAI ============
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const stanResponse = openaiData.choices[0]?.message?.content || 
      "I'm having trouble thinking right now. Please try again or email info@standardplaybook.com for help!";

    console.log('Stan response generated successfully');

    // ============ STEP 4: Save conversation (optional) ============
    
    if (agency_id && (user_id || staff_user_id)) {
      try {
        // Check for existing conversation today
        const today = new Date().toISOString().split('T')[0];
        const { data: existingConvo } = await supabase
          .from('chatbot_conversations')
          .select('id, messages')
          .eq(user_id ? 'user_id' : 'staff_user_id', user_id || staff_user_id)
          .gte('created_at', today)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const newMessages = [
          ...conversation_history,
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'stan', content: stanResponse, timestamp: new Date().toISOString() }
        ];

        if (existingConvo) {
          // Update existing conversation
          await supabase
            .from('chatbot_conversations')
            .update({ 
              messages: newMessages,
              current_page,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingConvo.id);
        } else {
          // Create new conversation
          await supabase
            .from('chatbot_conversations')
            .insert({
              user_id: user_id || null,
              staff_user_id: staff_user_id || null,
              agency_id,
              portal,
              messages: newMessages,
              current_page
            });
        }
      } catch (saveError) {
        console.error('Error saving conversation:', saveError);
        // Don't fail the response if save fails
      }
    }

    return new Response(
      JSON.stringify({ 
        response: stanResponse,
        faqs_used: scoredFaqs.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Stan chat error:', error);
    return new Response(
      JSON.stringify({ 
        response: "I'm having a moment! Please try again, or reach out to info@standardplaybook.com if this keeps happening.",
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
