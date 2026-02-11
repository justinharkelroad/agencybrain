import { toPng, toBlob } from 'html-to-image';
import jsPDF from 'jspdf';

export async function exportScorecardAsPNG(element: HTMLElement, filename: string): Promise<boolean> {
  try {
    const dataUrl = await toPng(element, {
      quality: 1,
      pixelRatio: 3, // CRITICAL: 3x resolution for print quality
      backgroundColor: '#ffffff',
    });

    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
    return true;
  } catch (error) {
    console.error('PNG export failed:', error);
    return false;
  }
}

export async function exportScorecardAsPDF(element: HTMLElement, filename: string): Promise<boolean> {
  try {
    const blob = await toBlob(element, {
      quality: 1,
      pixelRatio: 3, // CRITICAL: 3x resolution for print quality
      backgroundColor: '#ffffff',
    });

    if (!blob) return false;

    const img = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.drawImage(img, 0, 0);
    const imgData = canvas.toDataURL('image/png');

    // Letter size: 8.5" x 11" at 72 DPI = 612 x 792 points
    const pdf = new jsPDF({
      orientation: img.width > img.height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'letter'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Calculate scaling to fit page while maintaining aspect ratio
    const imgAspect = img.width / img.height;
    const pdfAspect = pdfWidth / pdfHeight;

    let finalWidth, finalHeight;
    if (imgAspect > pdfAspect) {
      // Image is wider - fit to width
      finalWidth = pdfWidth;
      finalHeight = pdfWidth / imgAspect;
    } else {
      // Image is taller - fit to height
      finalHeight = pdfHeight;
      finalWidth = pdfHeight * imgAspect;
    }

    pdf.addImage(imgData, 'PNG', 0, 0, finalWidth, finalHeight);
    pdf.save(`${filename}.pdf`);

    return true;
  } catch (error) {
    console.error('PDF export failed:', error);
    return false;
  }
}
