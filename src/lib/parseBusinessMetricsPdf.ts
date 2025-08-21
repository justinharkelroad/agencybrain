export type ParsedPdf = {
  uploadedMonth: number;     // 1..12 (user selects or infer from file/date field if embedded)
  ytdItemsTotal?: number;    // preferred if the file contains YTD
  currentMonthItemsTotal?: number; // from "Current Month New" total row
  perLineCurrent?: Record<string, number>; // optional; not used for math in v1
};

export async function parseBusinessMetricsPdf(file: File): Promise<ParsedPdf> {
  try {
    // Read the file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Try to extract text from PDF (basic implementation)
    // For now, we'll return a structure that requires manual override
    // In a full implementation, this would parse the PDF content
    
    // Try to infer month from filename or current date
    const currentMonth = new Date().getMonth() + 1;
    let uploadedMonth = currentMonth;
    
    // Basic filename parsing for month
    const filename = file.name.toLowerCase();
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                       'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    for (let i = 0; i < monthNames.length; i++) {
      if (filename.includes(monthNames[i])) {
        uploadedMonth = i + 1;
        break;
      }
    }
    
    // For now, we cannot reliably extract YTD from PDF without proper PDF parsing
    // Return structure that will trigger manual override
    return {
      uploadedMonth,
      ytdItemsTotal: undefined, // Will trigger manual override input
      currentMonthItemsTotal: undefined, // Could be extracted in full implementation
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