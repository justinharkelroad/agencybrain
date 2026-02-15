import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedSaleData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
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

const SINGLE_ITEM_PRODUCT_TYPES = new Set([
  'Personal Umbrella',
  'Landlord Package',
  'Homeowners',
  'Renters',
  'Condo',
  'North Light Homeowners',
  'North Light Condo',
]);

function normalizeProductType(rawProductType: string | undefined | null): string {
  const value = (rawProductType || '').toLowerCase().trim();
  if (!value) return 'Unknown';

  const mapped: Array<[RegExp, string]> = [
    [/(^|\b)(personal )?(umbrella|pup)(\b|$)/i, 'Personal Umbrella'],
    [/(^|\b)(llp|landlord|landlord package)(\b|$)/i, 'Landlord Package'],
    [/(^|\b)(motorcycle|mc)(\b|$)/i, 'Motorcycle'],
    [/(^|\b)(boat|watercraft|boatowners)(\b|$)/i, 'Boatowners'],
    [/(^|\b)(off[- ]?road|atv|utv|recreational vehicle)(\b|$)/i, 'Off-Road Vehicle'],
    [/(^|\b)(condo|h06|ho6)(\b|$)/i, 'Condo'],
    [/(^|\b)(renters|tenant|ho4|h04)(\b|$)/i, 'Renters'],
    [/(^|\b)(north light condo)(\b|$)/i, 'North Light Condo'],
    [/(^|\b)(north light homeowners)(\b|$)/i, 'North Light Homeowners'],
    [/(^|\b)(homeowner|homeowners|dwelling|landlord dwelling|ho3|h03)(\b|$)/i, 'Homeowners'],
    [/(^|\b)(non[- ]?standard auto)(\b|$)/i, 'Non-Standard Auto'],
    [/(^|\b)(specialty auto)(\b|$)/i, 'Specialty Auto'],
    [/(^|\b)(auto|vehicle)(\b|$)/i, 'Standard Auto'],
  ];

  for (const [pattern, normalized] of mapped) {
    if (pattern.test(value)) return normalized;
  }

  return rawProductType || 'Unknown';
}

function normalizePhone(rawPhone: string | undefined | null): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return '';
}

function normalizeEmail(rawEmail: string | undefined | null): string {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email) return '';
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return isValid ? email : '';
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
            content: `You are a document parser that extracts structured data from insurance purchase confirmation and application PDFs.
These can include auto, motorcycle, umbrella (PUP), landlord package (LLP), home, renters, condo, boat, and off-road policies.

Extract the following fields precisely:
- Named Insured(s) → customerName
- Email address (if present) → customerEmail
- Phone number (if present) → customerPhone
- Address → extract the ZIP code only → customerZip  
- Policy number → policyNumber (numbers only, remove spaces)
- Effective date → effectiveDate (format as YYYY-MM-DD)
- Expiration date → expirationDate (format as YYYY-MM-DD)
- Premium → premium (numeric value only, no $ or commas)
- Determine product type from context (examples: "PUP"/"umbrella", "LLP"/"landlord package", "motorcycle", "auto", "homeowners") → productType
- Count insured units for multi-unit products:
  - Auto / Motorcycle / Boat / Off-Road: count listed units (vehicles, bikes, boats, etc.)
  - Umbrella / LLP / Homeowners / Renters / Condo: ALWAYS itemCount = 1 unless document explicitly states multiple separate insured units on the same policy number
- List vehicle or unit descriptions (if present) → vehicles array

Return ONLY valid JSON matching this structure exactly:
{
  "customerName": "string",
  "customerEmail": "string",
  "customerPhone": "string",
  "customerZip": "string",
  "policyNumber": "string",
  "effectiveDate": "YYYY-MM-DD",
  "expirationDate": "YYYY-MM-DD",
  "premium": number,
  "productType": "Standard Auto" | "Non-Standard Auto" | "Specialty Auto" | "Motorcycle" | "Homeowners" | "North Light Homeowners" | "Renters" | "Condo" | "North Light Condo" | "Personal Umbrella" | "Landlord Package" | "Boatowners" | "Off-Road Vehicle" | "Unknown",
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
        customerEmail: '',
        customerPhone: '',
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
    extractedData.productType = normalizeProductType(extractedData.productType);
    extractedData.customerEmail = normalizeEmail(extractedData.customerEmail);
    extractedData.customerPhone = normalizePhone(extractedData.customerPhone);

    if (!extractedData.itemCount || extractedData.itemCount < 1) {
      extractedData.itemCount = 1;
    }
    if (SINGLE_ITEM_PRODUCT_TYPES.has(extractedData.productType)) {
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to parse PDF' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
