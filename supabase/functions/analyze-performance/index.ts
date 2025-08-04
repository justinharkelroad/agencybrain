import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      periodData, 
      uploads, 
      agencyName, 
      promptCategory, 
      customPrompt 
    } = await req.json();

    // Build context from period data and uploads
    let context = `Agency: ${agencyName}\n\n`;
    
    if (periodData) {
      context += `Performance Data:\n`;
      if (periodData.sales) {
        context += `Sales: ${JSON.stringify(periodData.sales, null, 2)}\n`;
      }
      if (periodData.marketing) {
        context += `Marketing: ${JSON.stringify(periodData.marketing, null, 2)}\n`;
      }
      if (periodData.operations) {
        context += `Operations: ${JSON.stringify(periodData.operations, null, 2)}\n`;
      }
      if (periodData.retention) {
        context += `Retention: ${JSON.stringify(periodData.retention, null, 2)}\n`;
      }
      if (periodData.cashFlow) {
        context += `Cash Flow: ${JSON.stringify(periodData.cashFlow, null, 2)}\n`;
      }
      if (periodData.qualitative) {
        context += `Qualitative: ${JSON.stringify(periodData.qualitative, null, 2)}\n`;
      }
    }

    if (uploads && uploads.length > 0) {
      context += `\nUploaded Files:\n`;
      uploads.forEach((upload: any) => {
        context += `- ${upload.original_name} (${upload.category})\n`;
      });
    }

    // Default prompts by category
    const defaultPrompts = {
      performance: `Analyze the insurance agency's performance data and provide specific insights on:
1. Sales performance trends and areas for improvement
2. Marketing effectiveness and ROI opportunities  
3. Operational efficiency recommendations
4. Key performance indicators that need attention
5. Actionable next steps for the next 30-day period

Be specific, data-driven, and provide concrete recommendations.`,

      growth: `Focus on growth opportunities for this insurance agency:
1. Identify untapped market segments or product lines
2. Analyze customer acquisition and retention patterns
3. Suggest marketing strategies to increase market share
4. Recommend operational improvements to support growth
5. Provide a prioritized action plan for sustainable growth

Base recommendations on the data provided and industry best practices.`,

      efficiency: `Evaluate operational efficiency and cost optimization opportunities:
1. Analyze workflow and process efficiency indicators
2. Identify areas where technology could improve operations
3. Review cost structure and suggest optimization strategies
4. Assess resource allocation and productivity metrics
5. Recommend specific efficiency improvements with expected impact

Focus on practical, implementable solutions.`,

      retention: `Analyze customer retention and relationship management:
1. Evaluate current retention rates and trends
2. Identify factors contributing to customer churn
3. Assess customer satisfaction and engagement levels
4. Recommend strategies to improve customer lifetime value
5. Suggest specific retention programs or initiatives

Provide actionable insights to strengthen customer relationships.`,

      competitive: `Provide competitive analysis and market positioning insights:
1. Assess the agency's competitive position based on performance data
2. Identify competitive advantages and weaknesses
3. Analyze market trends affecting the agency
4. Recommend strategies to differentiate from competitors
5. Suggest ways to capitalize on market opportunities

Focus on strategic positioning and competitive advantage.`
    };

    const systemPrompt = customPrompt || defaultPrompts[promptCategory as keyof typeof defaultPrompts] || defaultPrompts.performance;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { 
            role: 'system', 
            content: `You are an expert insurance agency performance coach and analyst. ${systemPrompt}` 
          },
          { 
            role: 'user', 
            content: `Please analyze the following agency data and provide insights:\n\n${context}` 
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API error');
    }

    const analysis = data.choices[0].message.content;

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-performance function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});