import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const exportScorecardAsPNG = async (
  element: HTMLElement,
  filename: string
): Promise<boolean> => {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0a0a0b',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return true;
  } catch (error) {
    console.error('PNG export error:', error);
    return false;
  }
};

export const exportScorecardAsPDF = async (
  element: HTMLElement,
  filename: string
): Promise<boolean> => {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0a0a0b',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${filename}.pdf`);
    return true;
  } catch (error) {
    console.error('PDF export error:', error);
    return false;
  }
};
