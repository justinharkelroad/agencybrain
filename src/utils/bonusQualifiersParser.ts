import Tesseract from 'tesseract.js';

export interface BonusTier {
  pgPointTarget: number;
  bonusPercentage: number;
}

export interface BonusQualifiersExtraction {
  autoHomeTiers: BonusTier[];
  splTiers: BonusTier[];
}

async function performOCR(imageSource: string | File): Promise<string> {
  const result = await Tesseract.recognize(imageSource, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  return result.data.text;
}

/**
 * Parse the 4-column row structure from OCR text
 * Each row: [Auto/Home Goal] [Auto/Home %] [SPL Goal] [SPL %]
 * Example: "254 0.0500% 482 0.0500%"
 */
function parseOCRText(text: string): BonusQualifiersExtraction | null {
  const autoHomeTiers: BonusTier[] = [];
  const splTiers: BonusTier[] = [];
  
  // Split into lines
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  console.log('Parsing OCR lines:', lines);
  
  // Find the data rows (lines with 4-column pattern)
  for (const line of lines) {
    // Pattern: [number] [percentage%] [number] [percentage%]
    // Example: "254 0.0500% 482 0.0500%" or "1226 0.5000% 588 0.1500%"
    // Handle OCR errors like "15000%" which should be "1.5000%"
    const fourColumnPattern = /^(\d[\d,]*)\s+(\d+\.?\d*)\s*%\s+(\d[\d,]*)\s+(\d+\.?\d*)\s*%$/;
    const match = line.match(fourColumnPattern);
    
    if (match) {
      const ahGoal = parseInt(match[1].replace(/,/g, ''), 10);
      let ahPercent = parseFloat(match[2]);
      const splGoal = parseInt(match[3].replace(/,/g, ''), 10);
      let splPercent = parseFloat(match[4]);
      
      // Fix OCR errors where decimal is missing (15000 should be 1.5000, 25000 should be 2.5000)
      if (ahPercent > 100) {
        ahPercent = ahPercent / 10000;
      }
      if (splPercent > 100) {
        splPercent = splPercent / 10000;
      }
      
      console.log(`Parsed row: AH=${ahGoal}/${ahPercent}%, SPL=${splGoal}/${splPercent}%`);
      
      // Validate ranges (goal: 100-100000, percentage: 0.01-10)
      if (ahGoal >= 100 && ahGoal <= 100000 && ahPercent >= 0.01 && ahPercent <= 10) {
        autoHomeTiers.push({
          pgPointTarget: ahGoal,
          bonusPercentage: ahPercent  // Already in correct format (0.05, 0.5, 1.0, etc.)
        });
      }
      
      if (splGoal >= 100 && splGoal <= 100000 && splPercent >= 0.01 && splPercent <= 10) {
        splTiers.push({
          pgPointTarget: splGoal,
          bonusPercentage: splPercent
        });
      }
    }
  }
  
  // Sort by bonus percentage ascending
  autoHomeTiers.sort((a, b) => a.bonusPercentage - b.bonusPercentage);
  splTiers.sort((a, b) => a.bonusPercentage - b.bonusPercentage);
  
  // Validate we got some data
  if (autoHomeTiers.length === 0 && splTiers.length === 0) {
    console.error('No valid tier data extracted from OCR text');
    return null;
  }
  
  // Log what was extracted for debugging
  console.log('Extracted Auto/Home tiers:', autoHomeTiers);
  console.log('Extracted SPL tiers:', splTiers);
  
  return {
    autoHomeTiers: normalizeTo7Tiers(autoHomeTiers),
    splTiers: normalizeTo7Tiers(splTiers)  // Don't copy from autoHome - return what we actually extracted
  };
}

// Helper to ensure we have at most 7 tiers
function normalizeTo7Tiers(tiers: BonusTier[]): BonusTier[] {
  // If we have more than 7, take the first 7 (already sorted by percentage)
  if (tiers.length > 7) {
    return tiers.slice(0, 7);
  }
  return tiers;
}

export async function parseBonusQualifiersImage(file: File): Promise<BonusQualifiersExtraction | null> {
  try {
    // Convert file to data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    console.log('Starting OCR on image...');
    const text = await performOCR(dataUrl);
    console.log('OCR completed, text length:', text.length);
    console.log('OCR raw text:', text);
    
    return parseOCRText(text);
  } catch (error) {
    console.error('Error parsing bonus qualifiers image:', error);
    return null;
  }
}

export async function parseBonusQualifiersPDF(file: File): Promise<BonusQualifiersExtraction | null> {
  try {
    console.log('Starting PDF parsing for bonus qualifiers...');
    
    // Dynamic import to avoid bundling issues
    const pdfjsLib = await import('pdfjs-dist');
    
    // Use import.meta.url for bundler-resolved worker path (most reliable)
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    
    const arrayBuffer = await file.arrayBuffer();
    console.log('PDF loaded, size:', arrayBuffer.byteLength);
    
    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log('PDF parsed, pages:', pdf.numPages);
    } catch (workerError: any) {
      console.error('PDF worker/document error:', workerError);
      throw new Error(`PDF processing failed: ${workerError?.message || 'Unknown error'}`);
    }
    
    // First try text extraction
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += pageText + '\n';
    }
    
    console.log('PDF text extracted:', fullText);
    
    // If we got enough text, try to parse it
    if (fullText.replace(/\s/g, '').length > 100) {
      const result = parseOCRText(fullText);
      if (result && (result.autoHomeTiers.length > 0 || result.splTiers.length > 0)) {
        return result;
      }
    }
    
    // Fall back to rendering first page and OCR
    const page = await pdf.getPage(1);
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
    
    const dataUrl = canvas.toDataURL('image/png');
    console.log('Rendered PDF page to image, starting OCR...');
    
    const text = await performOCR(dataUrl);
    console.log('OCR raw text:', text);
    
    return parseOCRText(text);
  } catch (error) {
    console.error('Error parsing bonus qualifiers PDF:', error);
    return null;
  }
}

export async function parseBonusQualifiers(file: File): Promise<BonusQualifiersExtraction | null> {
  const extension = file.name.toLowerCase().split('.').pop();
  
  if (extension === 'pdf') {
    return parseBonusQualifiersPDF(file);
  } else if (['png', 'jpg', 'jpeg', 'webp'].includes(extension || '')) {
    return parseBonusQualifiersImage(file);
  }
  
  return null;
}

export function validateBonusQualifiersExtraction(data: BonusQualifiersExtraction): {
  isValid: boolean;
  autoHomeTierCount: number;
  splTierCount: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  if (data.autoHomeTiers.length === 0) {
    warnings.push('No Auto/Home tiers extracted');
  } else if (data.autoHomeTiers.length < 7) {
    warnings.push(`Only ${data.autoHomeTiers.length} Auto/Home tiers found (expected 7)`);
  }
  
  if (data.splTiers.length === 0) {
    warnings.push('No SPL tiers extracted');
  } else if (data.splTiers.length < 7) {
    warnings.push(`Only ${data.splTiers.length} SPL tiers found (expected 7)`);
  }
  
  return {
    isValid: data.autoHomeTiers.length > 0 || data.splTiers.length > 0,
    autoHomeTierCount: data.autoHomeTiers.length,
    splTierCount: data.splTiers.length,
    warnings,
  };
}
