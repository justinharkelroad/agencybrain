import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedSaleData {
  customerName: string;
  customerZip: string;
  policyNumber: string;
  effectiveDate: string;
  expirationDate: string;
  premium: number;
  productType: string;
  itemCount: number;
  vehicles?: string[];
  confidence: 'high' | 'medium' | 'low';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, filename } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'PDF content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[parse-sale-pdf] Processing PDF:', filename);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Call Lovable AI Gateway with the PDF as a document
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a document parser that extracts structured data from Allstate Purchase Confirmation PDFs. 
Extract the following fields precisely:
- Named Insured(s) → customerName
- Address → extract the ZIP code only → customerZip  
- Policy number → policyNumber (numbers only, remove spaces)
- Effective date → effectiveDate (format as YYYY-MM-DD)
- Expiration date → expirationDate (format as YYYY-MM-DD)
- Premium → premium (numeric value only, no $ or commas)
- Determine product type from context like "Your auto policy" or "Your home policy" → productType
- Count vehicles if auto policy (look for bullet points like "• 2018 Honda Pilot") → itemCount
- List vehicle descriptions → vehicles array

Return ONLY valid JSON matching this structure exactly:
{
  "customerName": "string",
  "customerZip": "string",
  "policyNumber": "string",
  "effectiveDate": "YYYY-MM-DD",
  "expirationDate": "YYYY-MM-DD",
  "premium": number,
  "productType": "Standard Auto" | "Homeowners" | "Renters" | "Condo" | "Personal Umbrella" | "Boatowners" | "Unknown",
  "itemCount": number,
  "vehicles": ["string"],
  "confidence": "high" | "medium" | "low"
}

Set confidence based on how many fields were successfully extracted:
- high: all core fields found (name, policy, dates, premium, type)
- medium: missing 1-2 non-critical fields
- low: missing critical fields or parsing issues`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract sale data from this Allstate Purchase Confirmation PDF:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add funds to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('[parse-sale-pdf] AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('[parse-sale-pdf] AI response received');

    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response from the AI
    let extractedData: ExtractedSaleData;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      extractedData = JSON.parse(jsonStr);
      console.log('[parse-sale-pdf] Extracted data:', extractedData);
    } catch (parseError) {
      console.error('[parse-sale-pdf] Failed to parse AI response:', content);
      // Return a low-confidence empty result
      extractedData = {
        customerName: '',
        customerZip: '',
        policyNumber: '',
        effectiveDate: '',
        expirationDate: '',
        premium: 0,
        productType: 'Unknown',
        itemCount: 1,
        confidence: 'low'
      };
    }

    // Validate and normalize the data
    if (!extractedData.itemCount || extractedData.itemCount < 1) {
      extractedData.itemCount = 1;
    }

    // Ensure confidence is set
    if (!extractedData.confidence) {
      const hasCore = extractedData.customerName && 
                      extractedData.policyNumber && 
                      extractedData.effectiveDate && 
                      extractedData.premium > 0;
      extractedData.confidence = hasCore ? 'medium' : 'low';
    }

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[parse-sale-pdf] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to parse PDF' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
