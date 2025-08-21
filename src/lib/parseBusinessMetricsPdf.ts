export type ParsedPdf = {
  uploadedMonth: number;     // 1..12 (user selects or infer from file/date field if embedded)
  ytdItemsTotal?: number;    // preferred if the file contains YTD
  currentMonthItemsTotal?: number; // from "Current Month New" total row
  perLineCurrent?: Record<string, number>; // optional; not used for math in v1
};

export async function parseBusinessMetricsPdf(file: File): Promise<ParsedPdf> {
  try {
    // Import pdf-parse dynamically to handle browser environment
    const pdfParse = await import('pdf-parse');
    
    // Read the file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Parse PDF text content
    const pdfData = await pdfParse.default(uint8Array);
    const textContent = pdfData.text;
    
    console.log('PDF Text extracted:', textContent.substring(0, 500)); // Debug log
    
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
    
    // Extract YTD totals from text
    let ytdItemsTotal: number | undefined = undefined;
    let currentMonthItemsTotal: number | undefined = undefined;
    
    // Common patterns for YTD values
    const ytdPatterns = [
      /YTD\s*:?\s*(\d{1,6})/i,
      /Year\s*to\s*Date\s*:?\s*(\d{1,6})/i,
      /YTD\s*Total\s*:?\s*(\d{1,6})/i,
      /YTD\s*Items\s*:?\s*(\d{1,6})/i,
      /Cumulative\s*:?\s*(\d{1,6})/i,
    ];
    
    // Current month patterns  
    const currentMonthPatterns = [
      /Current\s*Month\s*New\s*:?\s*(\d{1,6})/i,
      /This\s*Month\s*:?\s*(\d{1,6})/i,
      /Month\s*Total\s*:?\s*(\d{1,6})/i,
    ];
    
    // Try to extract YTD
    for (const pattern of ytdPatterns) {
      const match = textContent.match(pattern);
      if (match && match[1]) {
        const value = parseInt(match[1]);
        if (value > 0 && value < 999999) { // Reasonable bounds
          ytdItemsTotal = value;
          console.log('Found YTD:', value, 'with pattern:', pattern);
          break;
        }
      }
    }
    
    // Try to extract current month
    for (const pattern of currentMonthPatterns) {
      const match = textContent.match(pattern);
      if (match && match[1]) {
        const value = parseInt(match[1]);
        if (value > 0 && value < 99999) { // Reasonable bounds
          currentMonthItemsTotal = value;
          console.log('Found Current Month:', value, 'with pattern:', pattern);
          break;
        }
      }
    }
    
    // Fallback: look for large numbers that might be YTD
    if (!ytdItemsTotal) {
      const numberMatches = textContent.match(/\b(\d{3,6})\b/g);
      if (numberMatches) {
        // Look for the largest reasonable number (likely YTD)
        const numbers = numberMatches.map(n => parseInt(n)).filter(n => n >= 100 && n <= 999999);
        if (numbers.length > 0) {
          ytdItemsTotal = Math.max(...numbers);
          console.log('Using largest number as YTD fallback:', ytdItemsTotal);
        }
      }
    }
    
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