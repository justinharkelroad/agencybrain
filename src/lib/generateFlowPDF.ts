import jsPDF from 'jspdf';
import { FlowSession, FlowTemplate, FlowQuestion, FlowAnalysis } from '@/types/flows';
import { format } from 'date-fns';
import { isHtmlContent } from '@/components/flows/ChatBubble';

interface GeneratePDFParams {
  session: FlowSession;
  template: FlowTemplate;
  questions: FlowQuestion[];
  analysis: FlowAnalysis | null;
  userName?: string;
}

const LOGO_URL = 'https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png';

async function getLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch(LOGO_URL);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to fetch logo:', error);
    return null;
  }
}

// Strip HTML tags and decode common entities for plain-text contexts (e.g. PDF)
function stripHtml(html: string): string {
  // Use DOMParser when available (browser), otherwise regex fallback
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  }
  // Fallback: strip tags, then decode entities
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Strip emojis from text since jsPDF doesn't support them
function stripEmojis(text: string): string {
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
    .replace(/[\u{231A}-\u{231B}]/gu, '')   // Watch, Hourglass
    .replace(/[\u{23E9}-\u{23F3}]/gu, '')   // Various symbols
    .replace(/[\u{23F8}-\u{23FA}]/gu, '')   // Various symbols
    .replace(/[\u{25AA}-\u{25AB}]/gu, '')   // Squares
    .replace(/[\u{25B6}]/gu, '')            // Play button
    .replace(/[\u{25C0}]/gu, '')            // Reverse button
    .replace(/[\u{25FB}-\u{25FE}]/gu, '')   // Squares
    .replace(/[\u{2614}-\u{2615}]/gu, '')   // Umbrella, Hot Beverage
    .replace(/[\u{2648}-\u{2653}]/gu, '')   // Zodiac
    .replace(/[\u{267F}]/gu, '')            // Wheelchair
    .replace(/[\u{2693}]/gu, '')            // Anchor
    .replace(/[\u{26A1}]/gu, '')            // High Voltage
    .replace(/[\u{26AA}-\u{26AB}]/gu, '')   // Circles
    .replace(/[\u{26BD}-\u{26BE}]/gu, '')   // Soccer, Baseball
    .replace(/[\u{26C4}-\u{26C5}]/gu, '')   // Snowman, Sun
    .replace(/[\u{26CE}]/gu, '')            // Ophiuchus
    .replace(/[\u{26D4}]/gu, '')            // No Entry
    .replace(/[\u{26EA}]/gu, '')            // Church
    .replace(/[\u{26F2}-\u{26F3}]/gu, '')   // Fountain, Golf
    .replace(/[\u{26F5}]/gu, '')            // Sailboat
    .replace(/[\u{26FA}]/gu, '')            // Tent
    .replace(/[\u{26FD}]/gu, '')            // Fuel Pump
    .replace(/[\u{2702}]/gu, '')            // Scissors
    .replace(/[\u{2705}]/gu, '')            // Check Mark
    .replace(/[\u{2708}-\u{270D}]/gu, '')   // Airplane to Writing Hand
    .replace(/[\u{270F}]/gu, '')            // Pencil
    .replace(/[\u{2712}]/gu, '')            // Black Nib
    .replace(/[\u{2714}]/gu, '')            // Check Mark
    .replace(/[\u{2716}]/gu, '')            // X Mark
    .replace(/[\u{271D}]/gu, '')            // Latin Cross
    .replace(/[\u{2721}]/gu, '')            // Star of David
    .replace(/[\u{2728}]/gu, '')            // Sparkles
    .replace(/[\u{2733}-\u{2734}]/gu, '')   // Eight Spoked Asterisk
    .replace(/[\u{2744}]/gu, '')            // Snowflake
    .replace(/[\u{2747}]/gu, '')            // Sparkle
    .replace(/[\u{274C}]/gu, '')            // Cross Mark
    .replace(/[\u{274E}]/gu, '')            // Cross Mark
    .replace(/[\u{2753}-\u{2755}]/gu, '')   // Question Marks
    .replace(/[\u{2757}]/gu, '')            // Exclamation Mark
    .replace(/[\u{2763}-\u{2764}]/gu, '')   // Heart Exclamation, Heart
    .replace(/[\u{2795}-\u{2797}]/gu, '')   // Plus, Minus, Divide
    .replace(/[\u{27A1}]/gu, '')            // Right Arrow
    .replace(/[\u{27B0}]/gu, '')            // Curly Loop
    .replace(/[\u{27BF}]/gu, '')            // Double Curly Loop
    .replace(/[\u{2934}-\u{2935}]/gu, '')   // Arrows
    .replace(/[\u{2B05}-\u{2B07}]/gu, '')   // Arrows
    .replace(/[\u{2B1B}-\u{2B1C}]/gu, '')   // Squares
    .replace(/[\u{2B50}]/gu, '')            // Star
    .replace(/[\u{2B55}]/gu, '')            // Circle
    .replace(/[\u{3030}]/gu, '')            // Wavy Dash
    .replace(/[\u{303D}]/gu, '')            // Part Alternation Mark
    .replace(/[\u{3297}]/gu, '')            // Circled Ideograph Congratulation
    .replace(/[\u{3299}]/gu, '')            // Circled Ideograph Secret
    .trim();
}

export async function generateFlowPDF({
  session,
  template,
  questions,
  analysis,
  userName,
}: GeneratePDFParams): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Brand Colors
  const brandDark = '#1e283a';
  const textColor = '#1f2937';
  const mutedColor = '#6b7280';
  const lightBg = '#f3f4f6';

  // Helper function to add new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 25) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to wrap text
  const addWrappedText = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    fontSize: number,
    fontStyle: 'normal' | 'bold' = 'normal',
    color: string = textColor
  ): number => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);
    doc.setTextColor(color);
    
    // Strip emojis before rendering
    const cleanText = stripEmojis(text);
    const lines = doc.splitTextToSize(cleanText, maxWidth);
    let currentY = y;
    
    lines.forEach((line: string) => {
      if (currentY + lineHeight > pageHeight - 25) {
        doc.addPage();
        currentY = margin;
      }
      doc.text(line, x, currentY);
      currentY += lineHeight;
    });
    
    return currentY;
  };

  // Interpolate prompt with responses
  const interpolatePrompt = (prompt: string): string => {
    let result = prompt;
    const matches = prompt.match(/\{([^}]+)\}/g);
    
    if (matches && session.responses_json) {
      matches.forEach(match => {
        const key = match.slice(1, -1);
        const sourceQuestion = questions.find(
          q => q.interpolation_key === key || q.id === key
        );
        if (sourceQuestion && session.responses_json[sourceQuestion.id]) {
          const val = session.responses_json[sourceQuestion.id];
          // Strip HTML if the interpolated value is rich text
          result = result.replace(match, isHtmlContent(val) ? stripHtml(val) : val);
        }
      });
    }
    
    return result;
  };

  // ==================
  // HEADER WITH LOGO
  // ==================
  
  // Title bar background
  doc.setFillColor(brandDark);
  doc.rect(0, 0, pageWidth, 42, 'F');
  
  // Add logo (top right of header)
  try {
    const logoBase64 = await getLogoBase64();
    
    if (logoBase64) {
      const logoWidth = 32;
      const logoHeight = 13;
      const logoX = pageWidth - margin - logoWidth;
      const logoY = 5;
      
      doc.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight);
    }
  } catch (err) {
    console.error('Failed to add logo to PDF:', err);
  }
  
  // Flow type (left side) - no emoji
  doc.setFontSize(11);
  doc.setTextColor('#94a3b8');
  doc.setFont('helvetica', 'normal');
  doc.text(`${stripEmojis(template.name)} Flow`, margin, 14);
  
  // Flow title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor('#ffffff');
  const titleLines = doc.splitTextToSize(stripEmojis(session.title || 'Untitled Flow'), contentWidth - 45);
  doc.text(titleLines, margin, 26);
  
  // Date and user
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#94a3b8');
  const metaParts = [format(new Date(session.created_at), 'MMMM d, yyyy')];
  if (session.domain) metaParts.push(session.domain);
  if (userName) metaParts.push(`by ${userName}`);
  doc.text(metaParts.join('  |  '), margin, 36);
  
  yPosition = 52;

  // ==================
  // AI ANALYSIS (if exists)
  // ==================
  
  if (analysis) {
    // Section header
    doc.setFillColor(lightBg);
    doc.roundedRect(margin, yPosition, contentWidth, 8, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor);
    doc.text('AI Insights', margin + 4, yPosition + 5.5);
    yPosition += 15;

    // Headline
    if (analysis.headline) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textColor);
      doc.text(stripEmojis(analysis.headline), margin, yPosition);
      yPosition += 8;
    }

    // Congratulations
    if (analysis.congratulations) {
      yPosition = addWrappedText(
        analysis.congratulations,
        margin,
        yPosition,
        contentWidth,
        5,
        10,
        'normal',
        textColor
      );
      yPosition += 5;
    }

    // Deep Dive Insight
    if (analysis.deep_dive_insight) {
      checkPageBreak(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(mutedColor);
      doc.text('Deep Dive:', margin, yPosition);
      yPosition += 6;

      yPosition = addWrappedText(
        analysis.deep_dive_insight,
        margin,
        yPosition,
        contentWidth,
        5,
        9,
        'normal',
        textColor
      );
      yPosition += 5;
    }

    // Connections
    if (analysis.connections && analysis.connections.length > 0) {
      checkPageBreak(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(mutedColor);
      doc.text('Key Connections:', margin, yPosition);
      yPosition += 6;

      analysis.connections.forEach(connection => {
        checkPageBreak(10);
        yPosition = addWrappedText(
          `- ${connection}`,
          margin + 3,
          yPosition,
          contentWidth - 6,
          5,
          9,
          'normal',
          textColor
        );
        yPosition += 2;
      });
      yPosition += 3;
    }

    // Themes - with proper wrapping
    if (analysis.themes && analysis.themes.length > 0) {
      checkPageBreak(15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(mutedColor);
      doc.text('Themes:', margin, yPosition);
      yPosition += 5;
      
      // Wrap themes text properly
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor);
      const themesText = analysis.themes.join(', ');
      const themesLines = doc.splitTextToSize(themesText, contentWidth);
      themesLines.forEach((line: string) => {
        doc.text(line, margin, yPosition);
        yPosition += 5;
      });
      yPosition += 3;
    }

    // Provocative Question
    if (analysis.provocative_question) {
      checkPageBreak(25);
      
      // Calculate box height based on text
      doc.setFontSize(9);
      const questionText = stripEmojis(analysis.provocative_question);
      const questionLines = doc.splitTextToSize(questionText, contentWidth - 16);
      const questionHeight = questionLines.length * 4.5 + 16;
      
      // Amber/indigo box background
      doc.setFillColor('#fef3c7'); // amber-100
      doc.roundedRect(margin, yPosition, contentWidth, questionHeight, 2, 2, 'F');
      
      // Left border
      doc.setFillColor('#f59e0b'); // amber-500
      doc.rect(margin, yPosition, 3, questionHeight, 'F');
      
      // Header
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#92400e'); // amber-800
      doc.text('Question to Consider', margin + 8, yPosition + 6);
      
      // Question text
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor('#78350f'); // amber-900
      let questionY = yPosition + 12;
      questionLines.forEach((line: string) => {
        doc.text(line, margin + 8, questionY);
        questionY += 4.5;
      });
      
      yPosition += questionHeight + 5;
    }

    // Suggested Action
    if (analysis.suggested_action) {
      checkPageBreak(25);
      
      // Calculate box height based on text
      doc.setFontSize(9);
      const actionText = stripEmojis(analysis.suggested_action);
      const actionLines = doc.splitTextToSize(actionText, contentWidth - 16);
      const actionHeight = actionLines.length * 4.5 + 16;
      
      // Green box background
      doc.setFillColor('#dcfce7');
      doc.roundedRect(margin, yPosition, contentWidth, actionHeight, 2, 2, 'F');
      
      // Green left border
      doc.setFillColor('#22c55e');
      doc.rect(margin, yPosition, 3, actionHeight, 'F');
      
      // Header
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#166534');
      doc.text('Micro-Step', margin + 8, yPosition + 6);
      
      // Action text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      let actionY = yPosition + 12;
      actionLines.forEach((line: string) => {
        doc.text(line, margin + 8, actionY);
        actionY += 4.5;
      });
      
      yPosition += actionHeight + 8;
    }

    // Divider after analysis
    yPosition += 2;
    doc.setDrawColor('#e5e7eb');
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
  }

  // ==================
  // Q&A RESPONSES
  // ==================
  
  // Section header
  checkPageBreak(20);
  doc.setFillColor(lightBg);
  doc.roundedRect(margin, yPosition, contentWidth, 8, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor);
  doc.text('Your Responses', margin + 4, yPosition + 5.5);
  yPosition += 15;

  // Questions and Answers
  let questionNumber = 0;
  questions.forEach((question) => {
    const response = session.responses_json?.[question.id];
    if (!response) return;
    
    questionNumber++;
    checkPageBreak(30);

    // Question
    const interpolatedPrompt = interpolatePrompt(question.prompt);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(mutedColor);
    
    const questionText = `${questionNumber}. ${stripEmojis(interpolatedPrompt)}`;
    const questionLines = doc.splitTextToSize(questionText, contentWidth);
    questionLines.forEach((line: string) => {
      if (yPosition > pageHeight - 25) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += 4.5;
    });
    yPosition += 2;

    // Answer — convert HTML to plain text for PDF rendering
    const plainResponse = isHtmlContent(response) ? stripHtml(response) : response;
    yPosition = addWrappedText(
      plainResponse,
      margin,
      yPosition,
      contentWidth,
      5,
      10,
      'normal',
      textColor
    );
    yPosition += 10;
  });

  // ==================
  // FOOTER ON ALL PAGES
  // ==================
  
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Footer line
    doc.setDrawColor('#e5e7eb');
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    // Footer text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(mutedColor);
    doc.text('Agency Brain Flows', margin, pageHeight - 8);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  // ==================
  // SAVE PDF
  // ==================
  
  const safeTitle = stripEmojis(session.title || 'Untitled').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const safeName = stripEmojis(template.name);
  const filename = `${safeName}_Flow_${safeTitle}_${format(new Date(session.created_at), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}
