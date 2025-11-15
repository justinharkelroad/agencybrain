import jsPDF from 'jspdf';
import type { QuarterlyTargets } from '@/hooks/useQuarterlyTargets';

// Month ordering by quarter
const QUARTER_MONTHS = {
  'Q1': ['January', 'February', 'March'],
  'Q2': ['April', 'May', 'June'],
  'Q3': ['July', 'August', 'September'],
  'Q4': ['October', 'November', 'December'],
};

const DOMAINS = [
  { key: 'body', label: 'Body' },
  { key: 'being', label: 'Being' },
  { key: 'balance', label: 'Balance' },
  { key: 'business', label: 'Business' }
];

export function exportLifeTargetsPDF(
  targets: QuarterlyTargets,
  selectedDailyActions: Record<string, string[]>,
  quarter: string
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Helper to check if we need a new page
  const checkPageBreak = (requiredSpace: number = 30) => {
    if (yPosition > doc.internal.pageSize.getHeight() - requiredSpace) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // Cover Page
  doc.setFontSize(20);
  doc.text('Quarterly Life Targets Plan', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  doc.setFontSize(14);
  const quarterMatch = quarter.match(/Q[1-4]/);
  const quarterKey = quarterMatch?.[0] || 'Q1';
  const monthRange = QUARTER_MONTHS[quarterKey as keyof typeof QUARTER_MONTHS]?.join(' - ') || '';
  doc.text(`${quarter}: ${monthRange}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(10);
  const generatedDate = new Date().toLocaleDateString();
  doc.text(`Generated: ${generatedDate}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setFontSize(12);
  doc.text('Your 90-Day Holistic Growth Plan', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  // Render each domain
  DOMAINS.forEach((domain) => {
    const primaryIsTarget1 = targets[`${domain.key}_primary_is_target1` as keyof QuarterlyTargets] ?? true;
    const primaryTarget = primaryIsTarget1
      ? targets[`${domain.key}_target` as keyof QuarterlyTargets]
      : targets[`${domain.key}_target2` as keyof QuarterlyTargets];
    const primaryNarrative = primaryIsTarget1
      ? targets[`${domain.key}_narrative` as keyof QuarterlyTargets]
      : targets[`${domain.key}_narrative2` as keyof QuarterlyTargets];

    // Get monthly missions
    const monthlyAll = targets[`${domain.key}_monthly_missions` as keyof QuarterlyTargets] as any;
    const missions = monthlyAll ? (primaryIsTarget1 ? monthlyAll.target1 : monthlyAll.target2) : null;

    // Get daily actions
    const dailyActions = selectedDailyActions[domain.key] || [];

    // Skip if no target
    if (!primaryTarget) return;

    checkPageBreak(40);

    // Domain Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(domain.label.toUpperCase(), 20, yPosition);
    yPosition += 2;
    doc.setLineWidth(0.5);
    doc.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 10;

    // Quarterly Target
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Quarterly Target:', 20, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const targetLines = doc.splitTextToSize(primaryTarget as string, 170);
    doc.text(targetLines, 20, yPosition);
    yPosition += targetLines.length * 5 + 6;

    // Why This Matters (Narrative)
    if (primaryNarrative) {
      checkPageBreak(20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Why This Matters:', 20, yPosition);
      yPosition += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const narrativeLines = doc.splitTextToSize(primaryNarrative as string, 170);
      doc.text(narrativeLines, 20, yPosition);
      yPosition += narrativeLines.length * 5 + 6;
    }

    // Monthly Missions
    if (missions && Object.keys(missions).length > 0) {
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Monthly Missions:', 20, yPosition);
      yPosition += 8;

      // Sort missions chronologically
      const monthOrder = QUARTER_MONTHS[quarterKey as keyof typeof QUARTER_MONTHS] || QUARTER_MONTHS.Q1;
      const sortedMissions = Object.entries(missions).sort(([monthA], [monthB]) => {
        return monthOrder.indexOf(monthA) - monthOrder.indexOf(monthB);
      });

      sortedMissions.forEach(([month, missionData]: [string, any]) => {
        checkPageBreak(15);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`${month}:`, 25, yPosition);
        yPosition += 5;

        if (missionData?.mission) {
          doc.setFont('helvetica', 'normal');
          const missionLines = doc.splitTextToSize(missionData.mission, 165);
          doc.text(missionLines, 30, yPosition);
          yPosition += missionLines.length * 5;
        }

        if (missionData?.why) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          const whyLines = doc.splitTextToSize(`Why: ${missionData.why}`, 165);
          doc.text(whyLines, 30, yPosition);
          yPosition += whyLines.length * 4.5 + 3;
        } else {
          yPosition += 3;
        }
      });

      yPosition += 4;
    }

    // Daily Actions
    if (dailyActions.length > 0) {
      checkPageBreak(20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Daily Actions:', 20, yPosition);
      yPosition += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      dailyActions.forEach((action) => {
        checkPageBreak(8);
        doc.text('☐', 25, yPosition);
        const actionLines = doc.splitTextToSize(action, 160);
        doc.text(actionLines, 32, yPosition);
        yPosition += actionLines.length * 5 + 2;
      });
    }

    yPosition += 10;
  });

  // Save PDF
  const filename = `Life-Targets-${quarter.replace(/:/g, '-')}.pdf`;
  doc.save(filename);
}
