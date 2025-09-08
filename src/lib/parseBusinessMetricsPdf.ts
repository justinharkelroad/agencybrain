export type ParsedPdf = {
  uploadedMonth: number;     // 1..12 (user selects or infer from file/date field if embedded)
  ytdItemsTotal?: number;    // preferred if the file contains YTD
  currentMonthItemsTotal?: number; // from "Current Month New" total row
  perLineCurrent?: Record<string, number>; // optional; not used for math in v1
};

export async function parseBusinessMetricsPdf(file: File): Promise<ParsedPdf> {
  try {
    // Use the Supabase Edge Function for server-side PDF parsing
    const { supabase } = await import('@/integrations/supabase/client');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'sales'); // Category for business metrics
    
    const { data, error } = await supabase.functions.invoke('process-file', {
      body: formData
    });
    
    if (error) {
      console.error('Edge function error:', error);
      throw new Error('Failed to process PDF on server');
    }
    
    if (!data?.success) {
      throw new Error(data?.error || 'PDF processing failed');
    }
    
    const parsedData = data.parsedData;
    console.log('Server-side PDF parsing result:', parsedData);
    
    // Extract business metrics from server response
    const uploadedMonth = parsedData.uploadedMonth || new Date().getMonth() + 1;
    const ytdItemsTotal = parsedData.ytdItemsTotal;
    const currentMonthItemsTotal = parsedData.currentMonthItemsTotal;
    
    return {
      uploadedMonth,
      ytdItemsTotal,
      currentMonthItemsTotal,
      perLineCurrent: {}
    };
    
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF. Please try uploading again or enter values manually.');
  }
}

export function getMonthName(month: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[month - 1] || 'Unknown';
}