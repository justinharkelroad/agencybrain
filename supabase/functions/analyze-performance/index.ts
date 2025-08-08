import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { 
      periodData, 
      uploads, 
      agencyName, 
      promptCategory, 
      customPrompt,
      followUpPrompt,
      originalAnalysis,
      userId,
      periodId,
      promptId
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
      console.log('Processing uploads:', uploads.map(u => ({ name: u.original_name, path: u.file_path })));
      
      // Fetch actual file contents from storage
      for (const upload of uploads) {
        try {
          console.log(`Attempting to download file: ${upload.original_name} from path: ${upload.file_path}`);
          
          const { data: fileData, error: fileError } = await supabase.storage
            .from('uploads')
            .download(upload.file_path);
            
          if (fileError) {
            console.error(`Error downloading file ${upload.original_name}:`, fileError);
            context += `- ${upload.original_name} (${upload.category}) - Error: ${fileError.message}\n`;
            continue;
          }
          
          if (!fileData) {
            console.error(`No data received for file ${upload.original_name}`);
            context += `- ${upload.original_name} (${upload.category}) - No data received\n`;
            continue;
          }
          
          console.log(`Successfully downloaded file: ${upload.original_name}, size: ${fileData.size} bytes`);
          
          // Handle different file types
          const fileName = upload.original_name.toLowerCase();
          if (fileName.endsWith('.csv')) {
            // Handle CSV files
            const fileText = await fileData.text();
            context += `\n--- File: ${upload.original_name} (${upload.category}) ---\n`;
            context += fileText;
            context += `\n--- End of ${upload.original_name} ---\n\n`;
          } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            // Handle Excel files
            try {
              const arrayBuffer = await fileData.arrayBuffer();
              const workbook = XLSX.read(arrayBuffer);
              
              context += `\n--- File: ${upload.original_name} (${upload.category}) ---\n`;
              
              // Process each sheet
              workbook.SheetNames.forEach((sheetName, index) => {
                const worksheet = workbook.Sheets[sheetName];
                const csvData = XLSX.utils.sheet_to_csv(worksheet);
                
                if (workbook.SheetNames.length > 1) {
                  context += `\n--- Sheet: ${sheetName} ---\n`;
                }
                context += csvData;
                if (workbook.SheetNames.length > 1) {
                  context += `\n--- End of Sheet: ${sheetName} ---\n`;
                }
              });
              
              context += `\n--- End of ${upload.original_name} ---\n\n`;
            } catch (excelError) {
              console.error(`Error parsing Excel file ${upload.original_name}:`, excelError);
              context += `\n--- File: ${upload.original_name} (${upload.category}) ---\n`;
              context += `Error parsing Excel file: ${excelError.message}\n`;
              context += `\n--- End of ${upload.original_name} ---\n\n`;
            }
          } else {
            // Try to read as text for other file types
            try {
              const fileText = await fileData.text();
              context += `\n--- File: ${upload.original_name} (${upload.category}) ---\n`;
              context += fileText;
              context += `\n--- End of ${upload.original_name} ---\n\n`;
            } catch (textError) {
              console.error(`Error reading file as text: ${upload.original_name}`, textError);
              context += `- ${upload.original_name} (${upload.category}) - Binary file, cannot read as text\n`;
            }
          }
          
        } catch (error) {
          console.error(`Error processing file ${upload.original_name}:`, error);
          context += `- ${upload.original_name} (${upload.category}) - Processing error: ${error.message}\n`;
        }
      }
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

    let messages;
    let systemPrompt = '';
    const isFollowUp = Boolean(followUpPrompt && originalAnalysis);
    
    if (isFollowUp) {
      // This is a follow-up conversation
      messages = [
        { 
          role: 'system', 
          content: 'You are an expert insurance agency performance coach and analyst. Answer follow-up questions about the analysis you previously provided. Use the provided data context to perform calculations and give specific, actionable answers.' 
        },
        { 
          role: 'assistant', 
          content: `Here is my previous analysis:\n\n${originalAnalysis}` 
        },
        { 
          role: 'user', 
          content: `Data context (period metrics and any uploaded files converted to text):\n\n${context}\n\nFollow-up question: ${followUpPrompt}` 
        }
      ];
    } else {
      // This is a new analysis
      systemPrompt = customPrompt || defaultPrompts[promptCategory as keyof typeof defaultPrompts] || defaultPrompts.performance;
      messages = [
        { 
          role: 'system', 
          content: `You are an expert insurance agency performance coach and analyst. ${systemPrompt}` 
        },
        { 
          role: 'user', 
          content: `Please analyze the following agency data and provide insights:\n\n${context}` 
        }
      ];
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API error');
    }

    const analysis = data.choices[0].message.content;

    // If this is a new analysis (not a follow-up), persist it
    if (!isFollowUp) {
      try {
        const selectedUploadsMeta = Array.isArray(uploads)
          ? uploads.map((u: any) => ({ id: u.id, original_name: u.original_name, category: u.category }))
          : null;

        const { data: inserted, error: insertError } = await supabase
          .from('ai_analysis')
          .insert([
            {
              analysis_result: analysis,
              analysis_type: promptCategory || 'performance',
              prompt_used: systemPrompt || '',
              selected_uploads: selectedUploadsMeta,
              user_id: userId ?? null,
              period_id: periodId ?? null,
              prompt_id: promptId ?? null,
              shared_with_client: false,
            },
          ])
          .select()
          .single();

        if (insertError) {
          console.error('Failed to insert ai_analysis:', insertError);
          // Continue to return analysis even if DB insert fails
          return new Response(
            JSON.stringify({ analysis, error: 'persist_failed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ analysis, analysisId: inserted.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e) {
        console.error('Unexpected error inserting ai_analysis:', e);
        return new Response(
          JSON.stringify({ analysis, error: 'persist_exception' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Follow-up: just return generated content
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