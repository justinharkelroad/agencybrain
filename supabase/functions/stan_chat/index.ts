import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const STAN_SYSTEM_PROMPT = `You are Stan, the friendly AI assistant for Agency Brain.

PERSONALITY: Warm, helpful, concise (2-4 sentences unless more detail needed).

=== CRITICAL RULES ===

1. PAGE CONTEXT IS YOUR PRIMARY SOURCE
   - You are given detailed info about the page the user is viewing
   - This describes EXACTLY what they see and what things mean on THAT page
   - ALWAYS use page context to answer questions about UI elements, scores, buttons

2. DO NOT CONFUSE PAGES
   - If user is on Flows and asks "what does the score mean", answer about FLOWS not Call Scoring
   - The page context tells you what is NOT on this page - respect that
   - If something is listed under "not_about", do not reference it

3. WHEN PAGE CONTEXT ANSWERS THE QUESTION
   - Use it directly, rephrase naturally
   - Do not search FAQs if page context already answers

4. WHEN PAGE CONTEXT DOES NOT ANSWER
   - Check FAQ knowledge provided
   - If neither has answer: "I don't have specific info about that. Email info@standardplaybook.com for help!"

5. TIER RESTRICTIONS
   - Boardroom CANNOT access: Bonus Grid, Snapshot Planner, Roleplay Bot, Theta Talk Track, Qualitative sections
   - Tell them these are 1:1 Coaching features if they ask`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { message, conversation_history = [], context } = await req.json();
    const {
      portal = 'brain', current_page = '/dashboard', user_role = 'owner',
      membership_tier = 'all', user_id = null, staff_user_id = null, agency_id = null
    } = context || {};

    console.log('Stan request:', { message, portal, current_page, membership_tier });

    // ============ STEP 1: LOAD PAGE CONTEXT ============
    let pageContext = null;
    
    // Try exact match first
    const { data: exactMatch } = await supabase
      .from('chatbot_page_contexts')
      .select('*')
      .eq('page_route', current_page)
      .eq('is_active', true)
      .single();
    
    if (exactMatch) {
      pageContext = exactMatch;
    } else {
      // Try prefix matching for nested routes
      const { data: prefixMatches } = await supabase
        .from('chatbot_page_contexts')
        .select('*')
        .eq('is_active', true);
      
      if (prefixMatches) {
        const sorted = prefixMatches
          .filter(p => current_page.startsWith(p.page_route))
          .sort((a, b) => b.page_route.length - a.page_route.length);
        if (sorted.length > 0) pageContext = sorted[0];
      }
    }

    let pageContextPrompt = '';
    let relatedCategories: string[] = ['general', 'troubleshooting'];
    
    if (pageContext) {
      const content = pageContext.content;
      relatedCategories = pageContext.related_faq_categories || relatedCategories;
      
      pageContextPrompt = `
=== CURRENT PAGE: ${pageContext.page_title} (${current_page}) ===

OVERVIEW: ${content.overview}

UI ELEMENTS ON THIS PAGE:
${(content.ui_elements || []).map((el: any) => `- **${el.name}** (${el.location}): ${el.description}`).join('\n')}

COMMON QUESTIONS FOR THIS PAGE:
${(content.common_questions || []).map((q: any) => `Q: "${q.question}"\nA: ${q.answer}`).join('\n\n')}

THIS PAGE IS NOT ABOUT (do not reference these):
${(content.not_about || []).map((item: string) => `- ${item}`).join('\n')}
`;
    } else {
      pageContextPrompt = `\n=== CURRENT PAGE: ${current_page} ===\nNo specific page context available. Use general knowledge and FAQs.\n`;
    }

    // ============ STEP 2: SEARCH FAQs (FILTERED BY RELATED CATEGORIES) ============
    const messageWords = message.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
      .filter((w: string) => w.length > 2 && !['the','and','for','that','this','with','how','what','where','why','can','does','have','mean','top','are','was','were'].includes(w));

    // Fetch FAQs filtered by related categories from page context
    const { data: filteredFaqs } = await supabase
      .from('chatbot_faqs')
      .select('question, answer, category, keywords, applies_to_tiers')
      .eq('is_active', true)
      .overlaps('category', relatedCategories);

    // If overlaps doesn't work, fallback to in()
    let faqsToScore = filteredFaqs;
    if (!filteredFaqs || filteredFaqs.length === 0) {
      const { data: fallbackFaqs } = await supabase
        .from('chatbot_faqs')
        .select('question, answer, category, keywords, applies_to_tiers')
        .eq('is_active', true)
        .in('category', relatedCategories);
      faqsToScore = fallbackFaqs;
    }

    const scoredFaqs = (faqsToScore || []).map(faq => {
      let score = 0;
      const faqKeywords = (faq.keywords || []).map((k: string) => k.toLowerCase());
      for (const word of messageWords) {
        if (faqKeywords.includes(word)) score += 5;
        if (faq.question.toLowerCase().includes(word)) score += 2;
      }
      const tiers = faq.applies_to_tiers || [];
      if (tiers.includes(membership_tier) || tiers.includes('all')) score += 1;
      return { ...faq, score };
    }).filter(f => f.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

    const faqContext = scoredFaqs.length > 0
      ? `\n\nADDITIONAL FAQ KNOWLEDGE (use if page context doesn't answer):\n${scoredFaqs.map((f, i) => `${i+1}. Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}`
      : '';

    console.log('Page context found:', !!pageContext, 'Page title:', pageContext?.page_title, 'FAQs:', scoredFaqs.length);

    // ============ STEP 3: CALL OPENAI ============
    const userContext = `\nUSER CONTEXT: Portal=${portal}, Role=${user_role}, Tier=${membership_tier}`;
    const tierWarning = membership_tier === 'Boardroom' && 
      ['bonus','grid','snapshot','roleplay','qualitative','theta'].some(k => message.toLowerCase().includes(k))
      ? '\n⚠️ BOARDROOM USER asking about 1:1 Coaching features - tell them these are not available on their plan.' : '';

    const messages: any[] = [
      { role: 'system', content: STAN_SYSTEM_PROMPT + userContext + tierWarning + pageContextPrompt + faqContext }
    ];
    
    // Add conversation history (last 6 messages)
    for (const msg of conversation_history.slice(-6)) {
      messages.push({ role: msg.role === 'stan' ? 'assistant' : 'user', content: msg.content });
    }
    messages.push({ role: 'user', content: message });

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 500, temperature: 0.7 }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const stanResponse = openaiData.choices?.[0]?.message?.content || 
      "I'm having trouble right now. Try again or email info@standardplaybook.com!";

    // ============ STEP 4: SAVE CONVERSATION (OPTIONAL) ============
    if (agency_id && (user_id || staff_user_id)) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase.from('chatbot_conversations')
          .select('id').eq(user_id ? 'user_id' : 'staff_user_id', user_id || staff_user_id)
          .gte('created_at', today).limit(1).single();
        
        const newMsgs = [...conversation_history, 
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'stan', content: stanResponse, timestamp: new Date().toISOString() }
        ];
        
        if (existing) {
          await supabase.from('chatbot_conversations').update({ messages: newMsgs, current_page }).eq('id', existing.id);
        } else {
          await supabase.from('chatbot_conversations').insert({
            user_id: user_id || null, staff_user_id: staff_user_id || null,
            agency_id, portal, messages: newMsgs, current_page
          });
        }
      } catch (saveError) {
        console.error('Error saving conversation:', saveError);
      }
    }

    return new Response(JSON.stringify({ 
      response: stanResponse, 
      page_context_used: !!pageContext,
      page_title: pageContext?.page_title || null,
      faqs_used: scoredFaqs.length 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Stan error:', error);
    return new Response(JSON.stringify({ 
      response: "I'm having a moment! Try again or email info@standardplaybook.com.", 
      error: error.message 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
});
