import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;
    
    if (!file) {
      throw new Error('No file provided');
    }

    const fileType = file.name.split('.').pop()?.toLowerCase();
    let parsedData: any = null;
    let detectedColumns: string[] = [];

    if (fileType === 'csv') {
      // Parse CSV file
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        // Get headers from first line
        detectedColumns = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
        
        // Parse a few sample rows for preview
        const sampleRows = lines.slice(1, 6).map(line => {
          const values = line.split(',').map(val => val.trim().replace(/"/g, ''));
          const row: any = {};
          detectedColumns.forEach((col, index) => {
            row[col] = values[index] || '';
          });
          return row;
        });
        
        parsedData = {
          headers: detectedColumns,
          sampleData: sampleRows,
          totalRows: lines.length - 1
        };
      }
    } else if (fileType === 'xlsx' || fileType === 'xls') {
      // For Excel files, we'll need to use a library on the client side
      // Return file info for client-side processing
      parsedData = {
        fileType: fileType,
        fileName: file.name,
        fileSize: file.size,
        requiresClientProcessing: true
      };
    } else if (fileType === 'pdf') {
      // Basic PDF text extraction (OCR would need additional services)
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Simple text extraction from PDF
      let extractedText = '';
      try {
        // Convert binary to string and look for text patterns
        const binaryString = Array.from(uint8Array)
          .map(byte => String.fromCharCode(byte))
          .join('');
        
        // Look for text content between stream/endstream markers
        const textMatches = binaryString.match(/stream\s*(.*?)\s*endstream/gs);
        if (textMatches) {
          extractedText = textMatches.map(match => 
            match.replace(/stream\s*/, '').replace(/\s*endstream/, '')
          ).join(' ');
        }
        
        // Clean up extracted text
        extractedText = extractedText
          .replace(/[^\x20-\x7E\n]/g, ' ') // Remove non-printable characters
          .replace(/\s+/g, ' ')
          .trim();
          
      } catch (error) {
        console.error('PDF parsing error:', error);
        extractedText = 'Unable to extract text from PDF. Consider using OCR services for better results.';
      }
      
      parsedData = {
        fileType: 'pdf',
        fileName: file.name,
        extractedText: extractedText.substring(0, 1000), // Limit to first 1000 chars
        requiresOCR: extractedText.length < 100 // Suggest OCR if little text found
      };
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Suggest column mappings based on category and detected columns
    const suggestedMappings = generateColumnMappings(detectedColumns, category);

    return new Response(JSON.stringify({
      success: true,
      fileInfo: {
        name: file.name,
        type: fileType,
        size: file.size,
        category: category
      },
      parsedData,
      detectedColumns,
      suggestedMappings
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing file:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateColumnMappings(columns: string[], category: string): any {
  const mappings: any = {};
  
  // Standard field mappings by category
  const standardFields = {
    sales: [
      'premium', 'policies', 'commission', 'quote_count', 'conversion_rate',
      'new_policies', 'renewed_policies', 'cancelled_policies'
    ],
    marketing: [
      'total_spend', 'leads_generated', 'cost_per_lead', 'conversion_rate',
      'website_visits', 'social_media_engagement', 'email_opens'
    ],
    operations: [
      'staff_count', 'training_hours', 'customer_service_calls', 'response_time',
      'processing_time', 'error_rate', 'efficiency_score'
    ],
    retention: [
      'retention_rate', 'churn_rate', 'customer_satisfaction', 'complaints',
      'renewals', 'referrals', 'loyalty_score'
    ],
    cash_flow: [
      'revenue', 'expenses', 'net_profit', 'operating_costs', 'commission_paid',
      'accounts_receivable', 'accounts_payable'
    ],
    qualitative: [
      'comments', 'feedback', 'notes', 'observations', 'improvements',
      'challenges', 'opportunities'
    ]
  };

  const categoryFields = standardFields[category as keyof typeof standardFields] || [];
  
  // Try to match detected columns to standard fields
  columns.forEach(column => {
    const normalizedColumn = column.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Look for exact or partial matches
    const match = categoryFields.find(field => {
      const normalizedField = field.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalizedColumn.includes(normalizedField) || 
             normalizedField.includes(normalizedColumn) ||
             normalizedColumn === normalizedField;
    });
    
    if (match) {
      mappings[column] = match;
    } else {
      // Common pattern matching
      if (normalizedColumn.includes('amount') || normalizedColumn.includes('value') || normalizedColumn.includes('total')) {
        mappings[column] = 'amount';
      } else if (normalizedColumn.includes('count') || normalizedColumn.includes('number')) {
        mappings[column] = 'count';
      } else if (normalizedColumn.includes('rate') || normalizedColumn.includes('percent')) {
        mappings[column] = 'rate';
      } else if (normalizedColumn.includes('date') || normalizedColumn.includes('time')) {
        mappings[column] = 'date';
      } else {
        mappings[column] = 'custom';
      }
    }
  });
  
  return mappings;
}