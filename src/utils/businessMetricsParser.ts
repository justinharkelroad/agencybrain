import * as XLSX from 'xlsx';

export interface BusinessMetricsExtraction {
  estimatedYearEndPremium: number;
  autoItemsInForce: number;
  autoPremiumWritten: number;
  autoRetention: number;
  homeItemsInForce: number;
  homePremiumWritten: number;
  homeRetention: number;
  splItemsInForce: number;
  splPremiumWritten: number;
  splRetention: number;
  newBusinessRetention: number;
}

// Row keywords for matching
const ROW_KEYWORDS = {
  standardAuto: ['standard auto'],
  homeowners: ['homeowners'],
  specialtyAuto: ['specialty auto'],
  renters: ['renters'],
  condo: ['condo'],
  otherSpecialty: ['other specialty property'],
  totalPC: ['total property & casualty', 'total p&c'],
  yearEndPremium: ['written in advance premium', '12-month mover'],
} as const;

// Column keywords for matching
const COLUMN_KEYWORDS = {
  currentMonth: ['current month', 'curr month'],
  ytd: ['year-to-date', 'ytd', 'year to date'],
  netRetention: ['net retention', 'retention %', 'retention'],
  newBizRetention: ['0-2', 'zero to two', '0 to 2'],
  yearEndTotal: ['12-month', '12 month', 'total'],
} as const;

function normalizeText(text: string): string {
  return text?.toString().toLowerCase().trim() || '';
}

function matchesKeyword(text: string, keywords: readonly string[]): boolean {
  const normalized = normalizeText(text);
  return keywords.some(kw => normalized.includes(kw));
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  
  // Remove currency symbols, commas, percentage signs
  const cleaned = value.replace(/[$,%\s]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function findColumnIndex(headers: string[], keywords: readonly string[]): number {
  return headers.findIndex(h => matchesKeyword(h, keywords));
}

export async function parseBusinessMetricsXLSX(file: File): Promise<BusinessMetricsExtraction | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Try first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (data.length < 2) {
      console.error('XLSX has insufficient data');
      return null;
    }
    
    // Find header row (row with most keyword matches)
    let headerRowIndex = 0;
    let maxMatches = 0;
    
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i] as string[];
      if (!row) continue;
      
      const matches = row.filter(cell => 
        matchesKeyword(String(cell), COLUMN_KEYWORDS.currentMonth) ||
        matchesKeyword(String(cell), COLUMN_KEYWORDS.ytd) ||
        matchesKeyword(String(cell), COLUMN_KEYWORDS.netRetention)
      ).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        headerRowIndex = i;
      }
    }
    
    const headers = (data[headerRowIndex] as string[]).map(h => String(h || ''));
    
    // Find column indices
    const currentMonthCol = findColumnIndex(headers, COLUMN_KEYWORDS.currentMonth);
    const ytdCol = findColumnIndex(headers, COLUMN_KEYWORDS.ytd);
    const retentionCol = findColumnIndex(headers, COLUMN_KEYWORDS.netRetention);
    const newBizRetentionCol = findColumnIndex(headers, COLUMN_KEYWORDS.newBizRetention);
    const yearEndCol = findColumnIndex(headers, COLUMN_KEYWORDS.yearEndTotal);
    
    // Initialize extraction
    const extraction: BusinessMetricsExtraction = {
      estimatedYearEndPremium: 0,
      autoItemsInForce: 0,
      autoPremiumWritten: 0,
      autoRetention: 0,
      homeItemsInForce: 0,
      homePremiumWritten: 0,
      homeRetention: 0,
      splItemsInForce: 0,
      splPremiumWritten: 0,
      splRetention: 0,
      newBusinessRetention: 0,
    };
    
    // SPL components
    let splComponents = {
      items: 0,
      premium: 0,
      retentionSum: 0,
      retentionCount: 0,
    };
    
    // Process data rows
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i] as unknown[];
      if (!row || row.length === 0) continue;
      
      const rowLabel = String(row[0] || '');
      
      // Standard Auto
      if (matchesKeyword(rowLabel, ROW_KEYWORDS.standardAuto)) {
        if (currentMonthCol >= 0) extraction.autoItemsInForce = parseNumber(row[currentMonthCol]);
        if (ytdCol >= 0) extraction.autoPremiumWritten = parseNumber(row[ytdCol]);
        if (retentionCol >= 0) extraction.autoRetention = parseNumber(row[retentionCol]);
      }
      
      // Homeowners
      if (matchesKeyword(rowLabel, ROW_KEYWORDS.homeowners)) {
        if (currentMonthCol >= 0) extraction.homeItemsInForce = parseNumber(row[currentMonthCol]);
        if (ytdCol >= 0) extraction.homePremiumWritten = parseNumber(row[ytdCol]);
        if (retentionCol >= 0) extraction.homeRetention = parseNumber(row[retentionCol]);
      }
      
      // SPL components
      const isSplLine = 
        matchesKeyword(rowLabel, ROW_KEYWORDS.specialtyAuto) ||
        matchesKeyword(rowLabel, ROW_KEYWORDS.renters) ||
        matchesKeyword(rowLabel, ROW_KEYWORDS.condo) ||
        matchesKeyword(rowLabel, ROW_KEYWORDS.otherSpecialty);
      
      if (isSplLine) {
        if (currentMonthCol >= 0) splComponents.items += parseNumber(row[currentMonthCol]);
        if (ytdCol >= 0) splComponents.premium += parseNumber(row[ytdCol]);
        if (retentionCol >= 0) {
          const ret = parseNumber(row[retentionCol]);
          if (ret > 0) {
            splComponents.retentionSum += ret;
            splComponents.retentionCount++;
          }
        }
      }
      
      // Total P&C (for new business retention)
      if (matchesKeyword(rowLabel, ROW_KEYWORDS.totalPC)) {
        if (newBizRetentionCol >= 0) {
          extraction.newBusinessRetention = parseNumber(row[newBizRetentionCol]);
        }
      }
      
      // Year-end premium
      if (matchesKeyword(rowLabel, ROW_KEYWORDS.yearEndPremium)) {
        if (yearEndCol >= 0) {
          extraction.estimatedYearEndPremium = parseNumber(row[yearEndCol]);
        } else {
          // Try last numeric column
          for (let j = row.length - 1; j >= 0; j--) {
            const val = parseNumber(row[j]);
            if (val > 100000) { // Reasonable premium threshold
              extraction.estimatedYearEndPremium = val;
              break;
            }
          }
        }
      }
    }
    
    // Aggregate SPL
    extraction.splItemsInForce = splComponents.items;
    extraction.splPremiumWritten = splComponents.premium;
    extraction.splRetention = splComponents.retentionCount > 0 
      ? splComponents.retentionSum / splComponents.retentionCount 
      : 0;
    
    return extraction;
  } catch (error) {
    console.error('Error parsing XLSX:', error);
    return null;
  }
}

export async function parseBusinessMetricsPDF(file: File): Promise<BusinessMetricsExtraction | null> {
  try {
    // Dynamic import to avoid bundling issues
    const pdfjsLib = await import('pdfjs-dist');
    
    // Use unpkg CDN which is more reliable for pdfjs-dist versions
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
    
    let pdf;
    try {
      const arrayBuffer = await file.arrayBuffer();
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (workerError) {
      console.error('PDF worker error:', workerError);
      // Re-throw with a clear message - DON'T say "image-based" for worker errors
      throw new Error(`PDF processing failed: ${workerError.message}`);
    }
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += pageText + '\n';
    }
    
    // NOW check if it's actually image-based (no text extracted)
    if (fullText.replace(/\s/g, '').length < 100) {
      console.warn('PDF has < 100 chars of text, likely image-based');
      return null; // Will trigger "image-based" message
    }
    
    // Simple text-based extraction (less reliable than XLSX)
    // Try to find key numbers using patterns
    const extraction: BusinessMetricsExtraction = {
      estimatedYearEndPremium: 0,
      autoItemsInForce: 0,
      autoPremiumWritten: 0,
      autoRetention: 0,
      homeItemsInForce: 0,
      homePremiumWritten: 0,
      homeRetention: 0,
      splItemsInForce: 0,
      splPremiumWritten: 0,
      splRetention: 0,
      newBusinessRetention: 0,
    };
    
    // Extract numbers near keywords using regex
    const extractNumberNear = (text: string, keywords: string[]): number => {
      for (const kw of keywords) {
        const regex = new RegExp(`${kw}[^\\d]*([\\d,]+\\.?\\d*)`, 'gi');
        const match = regex.exec(text);
        if (match) {
          return parseNumber(match[1]);
        }
      }
      return 0;
    };
    
    // Try to extract values (this is approximate for PDF)
    extraction.estimatedYearEndPremium = extractNumberNear(fullText, ['12-month mover', 'written in advance']);
    
    console.log('PDF text extraction completed, but XLSX is recommended for accuracy');
    return extraction;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return null;
  }
}

export async function parseBusinessMetrics(file: File): Promise<BusinessMetricsExtraction | null> {
  const extension = file.name.toLowerCase().split('.').pop();
  
  if (extension === 'xlsx' || extension === 'xls') {
    return parseBusinessMetricsXLSX(file);
  } else if (extension === 'pdf') {
    return parseBusinessMetricsPDF(file);
  }
  
  return null;
}

export function validateBusinessMetricsExtraction(data: BusinessMetricsExtraction): { 
  isValid: boolean; 
  missingFields: string[];
  extractedCount: number;
} {
  const fields = [
    { key: 'estimatedYearEndPremium', label: 'Year End Premium' },
    { key: 'autoItemsInForce', label: 'Auto Items' },
    { key: 'autoPremiumWritten', label: 'Auto Premium' },
    { key: 'autoRetention', label: 'Auto Retention' },
    { key: 'homeItemsInForce', label: 'Home Items' },
    { key: 'homePremiumWritten', label: 'Home Premium' },
    { key: 'homeRetention', label: 'Home Retention' },
    { key: 'splItemsInForce', label: 'SPL Items' },
    { key: 'splPremiumWritten', label: 'SPL Premium' },
    { key: 'splRetention', label: 'SPL Retention' },
    { key: 'newBusinessRetention', label: 'New Business Retention' },
  ] as const;
  
  const missingFields: string[] = [];
  let extractedCount = 0;
  
  for (const field of fields) {
    const value = data[field.key];
    if (value > 0) {
      extractedCount++;
    } else {
      missingFields.push(field.label);
    }
  }
  
  return {
    isValid: extractedCount >= 6, // At least half populated
    missingFields,
    extractedCount,
  };
}
