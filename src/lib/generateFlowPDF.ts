import jsPDF from 'jspdf';
import { FlowSession, FlowTemplate, FlowQuestion, FlowAnalysis } from '@/types/flows';
import { format } from 'date-fns';

interface GeneratePDFParams {
  session: FlowSession;
  template: FlowTemplate;
  questions: FlowQuestion[];
  analysis: FlowAnalysis | null;
  userName?: string;
}

const LOGO_URL = 'https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/AGENCYBRAIN%20LOGO.png';

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
    
    const lines = doc.splitTextToSize(text, maxWidth);
    let currentY = y;
    
    lines.forEach((line: string) => {
      checkPageBreak(lineHeight);
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
          result = result.replace(match, session.responses_json[sourceQuestion.id]);
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
  
  // Flow icon and type (left side)
  doc.setFontSize(11);
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'normal');
  doc.text(`${template.icon || '📝'} ${template.name} Flow`, margin, 14);
  
  // Flow title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(session.title || 'Untitled Flow', contentWidth - 45);
  doc.text(titleLines, margin, 26);
  
  // Date and user
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#94a3b8');
  const metaParts = [format(new Date(session.created_at), 'MMMM d, yyyy')];
  if (session.domain) metaParts.push(session.domain);
  if (userName) metaParts.push(`by ${userName}`);
  doc.text(metaParts.join('  •  '), margin, 36);
  
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
    doc.text('✨ AI Insights', margin + 3, yPosition + 5.5);
    yPosition += 15;

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
          `• ${connection}`,
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

    // Themes
    if (analysis.themes && analysis.themes.length > 0) {
      checkPageBreak(15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(mutedColor);
      doc.text('Themes: ', margin, yPosition);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor);
      doc.text(analysis.themes.join(', '), margin + 18, yPosition);
      yPosition += 8;
    }

    // Suggested Action
    if (analysis.suggested_action) {
      checkPageBreak(25);
      
      // Green box background
      doc.setFillColor('#dcfce7');
      const actionLines = doc.splitTextToSize(analysis.suggested_action, contentWidth - 12);
      const actionHeight = actionLines.length * 5 + 14;
      doc.roundedRect(margin, yPosition, contentWidth, actionHeight, 2, 2, 'F');
      
      // Green left border
      doc.setFillColor('#22c55e');
      doc.rect(margin, yPosition, 3, actionHeight, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#166534');
      doc.text('💡 Suggested Action', margin + 6, yPosition + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.text(actionLines, margin + 6, yPosition + 12);
      yPosition += actionHeight + 5;
    }

    // Divider after analysis
    yPosition += 5;
    doc.setDrawColor(lightBg);
    doc.setLineWidth(0.5);
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
  doc.text('📝 Your Responses', margin + 3, yPosition + 5.5);
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
    doc.setTextColor(brandDark);
    yPosition = addWrappedText(
      `${questionNumber}. ${interpolatedPrompt}`,
      margin,
      yPosition,
      contentWidth,
      4.5,
      9,
      'bold',
      mutedColor
    );
    yPosition += 2;

    // Answer
    yPosition = addWrappedText(
      response,
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
  
  const safeTitle = (session.title || 'Untitled').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const filename = `${template.name}_Flow_${safeTitle}_${format(new Date(session.created_at), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}
