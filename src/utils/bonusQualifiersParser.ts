import Tesseract from 'tesseract.js';

export interface BonusTier {
  pgPointTarget: number;
  bonusPercentage: number;
}

export interface BonusQualifiersExtraction {
  autoHomeTiers: BonusTier[];
  splTiers: BonusTier[];
}

interface RawTierData {
  target: number;
  percentage: number;
}

function parsePercentage(text: string): number {
  // Handle formats like "0.05%", "3.0%", "3%"
  const match = text.match(/(\d+\.?\d*)\s*%?/);
  if (match) {
    const value = parseFloat(match[1]);
    // If value is already small (like 0.05), it's already a percentage
    // If value is large (like 3), it's already a percentage
    return value;
  }
  return 0;
}

function parseTarget(text: string): number {
  // Handle formats like "1,000", "1000", "10,000"
  const cleaned = text.replace(/,/g, '').trim();
  return parseInt(cleaned, 10) || 0;
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

function extractTiersFromText(text: string, sectionKeywords: string[]): RawTierData[] {
  const tiers: RawTierData[] = [];
  
  // Split into lines
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Find section start
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    if (sectionKeywords.some(kw => lineLower.includes(kw.toLowerCase()))) {
      sectionStart = i;
      break;
    }
  }
  
  if (sectionStart === -1) {
    // Try to extract from entire text if section not found
    sectionStart = 0;
  }
  
  // Extract number pairs (target, percentage)
  // Pattern: look for lines with a large number followed by a small percentage
  const tierPattern = /(\d{1,3}(?:,\d{3})*)\s+(\d+\.?\d*)\s*%?/g;
  
  const textToSearch = lines.slice(sectionStart).join('\n');
  let match;
  
  while ((match = tierPattern.exec(textToSearch)) !== null) {
    const target = parseTarget(match[1]);
    const percentage = parsePercentage(match[2]);
    
    // Validate: target should be reasonable (500-100000), percentage should be 0-10
    if (target >= 500 && target <= 100000 && percentage >= 0.01 && percentage <= 10) {
      tiers.push({ target, percentage });
    }
  }
  
  // Also try alternative pattern: percentage first, then target
  const altPattern = /(\d+\.?\d*)\s*%\s+(\d{1,3}(?:,\d{3})*)/g;
  while ((match = altPattern.exec(textToSearch)) !== null) {
    const percentage = parsePercentage(match[1]);
    const target = parseTarget(match[2]);
    
    if (target >= 500 && target <= 100000 && percentage >= 0.01 && percentage <= 10) {
      // Check if we already have this tier
      if (!tiers.some(t => t.target === target && t.percentage === percentage)) {
        tiers.push({ target, percentage });
      }
    }
  }
  
  return tiers;
}

function normalizeTiers(rawTiers: RawTierData[]): BonusTier[] {
  // Sort by percentage ascending
  const sorted = [...rawTiers].sort((a, b) => a.percentage - b.percentage);
  
  // Remove duplicates
  const unique: RawTierData[] = [];
  for (const tier of sorted) {
    if (!unique.some(t => Math.abs(t.percentage - tier.percentage) < 0.01)) {
      unique.push(tier);
    }
  }
  
  // Take up to 7 tiers
  const finalTiers = unique.slice(0, 7);
  
  return finalTiers.map(t => ({
    pgPointTarget: t.target,
    bonusPercentage: t.percentage / 100, // Convert to decimal (0.05% -> 0.0005)
  }));
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
    console.log('OCR text preview:', text.substring(0, 500));
    
    // Extract Auto/Home tiers
    const autoHomeKeywords = ['auto, home', 'auto home', 'afs', 'auto/home'];
    const autoHomeRaw = extractTiersFromText(text, autoHomeKeywords);
    
    // Extract SPL tiers
    const splKeywords = ['other personal lines', 'specialty', 'spl', 'opl'];
    const splRaw = extractTiersFromText(text, splKeywords);
    
    // If we couldn't separate, try to split the tiers in half
    if (autoHomeRaw.length >= 7 && splRaw.length === 0) {
      // Assume first half is auto/home, second half is SPL
      const midpoint = Math.ceil(autoHomeRaw.length / 2);
      return {
        autoHomeTiers: normalizeTiers(autoHomeRaw.slice(0, midpoint)),
        splTiers: normalizeTiers(autoHomeRaw.slice(midpoint)),
      };
    }
    
    return {
      autoHomeTiers: normalizeTiers(autoHomeRaw),
      splTiers: normalizeTiers(splRaw.length > 0 ? splRaw : autoHomeRaw),
    };
  } catch (error) {
    console.error('Error parsing bonus qualifiers image:', error);
    return null;
  }
}

export async function parseBonusQualifiersPDF(file: File): Promise<BonusQualifiersExtraction | null> {
  try {
    // Dynamic import to avoid bundling issues
    const pdfjsLib = await import('pdfjs-dist');
    
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
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
    
    // If we got enough text, use it directly
    if (fullText.replace(/\s/g, '').length > 100) {
      const autoHomeRaw = extractTiersFromText(fullText, ['auto, home', 'auto home', 'afs']);
      const splRaw = extractTiersFromText(fullText, ['other personal lines', 'specialty', 'spl']);
      
      if (autoHomeRaw.length > 0) {
        return {
          autoHomeTiers: normalizeTiers(autoHomeRaw),
          splTiers: normalizeTiers(splRaw.length > 0 ? splRaw : autoHomeRaw),
        };
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
    
    const autoHomeRaw = extractTiersFromText(text, ['auto, home', 'auto home', 'afs']);
    const splRaw = extractTiersFromText(text, ['other personal lines', 'specialty', 'spl']);
    
    return {
      autoHomeTiers: normalizeTiers(autoHomeRaw),
      splTiers: normalizeTiers(splRaw.length > 0 ? splRaw : autoHomeRaw),
    };
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
