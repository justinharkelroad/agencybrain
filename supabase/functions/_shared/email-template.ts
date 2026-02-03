// Shared email template for Agency Brain
// Update branding here and it applies to ALL emails

export const BRAND = {
  colors: {
    primary: '#1e283a',      // Dark gray blue
    secondary: '#020817',    // Dark blue
    gray: '#60626c',
    red: '#af0000',          // Vivid red (for errors/misses)
    green: '#22c55e',        // Success green
    yellow: '#fbbf24',       // Warning yellow
    lightBg: '#f1f5f9',      // Light background
    white: '#ffffff',
  },
  logo: 'https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png',
  name: 'Agency Brain',
  fromEmail: 'Agency Brain <info@agencybrain.standardplaybook.com>',
};

export interface EmailTemplateOptions {
  title: string;
  subtitle?: string;
  bodyContent: string;
  footerAgencyName?: string;
}

export function buildEmailHtml(options: EmailTemplateOptions): string {
  const { title, subtitle, bodyContent, footerAgencyName } = options;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${BRAND.colors.primary}, ${BRAND.colors.secondary}); color: white; padding: 24px; border-radius: 8px 8px 0 0;">
      <img src="${BRAND.logo}" alt="${BRAND.name}" style="width: 180px; max-width: 100%; height: auto; margin-bottom: 16px; display: block;">
      <h1 style="margin: 0; font-size: 24px;">${title}</h1>
      ${subtitle ? `<p style="margin: 8px 0 0 0; opacity: 0.9;">${subtitle}</p>` : ''}
    </div>

    <!-- Body -->
    <div style="background: ${BRAND.colors.white}; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
      ${bodyContent}
    </div>

    <!-- Footer -->
    <div style="text-align: center; color: ${BRAND.colors.gray}; font-size: 12px; margin-top: 20px; padding: 10px;">
      Powered by ${BRAND.name}${footerAgencyName ? ` • ${footerAgencyName}` : ''}
    </div>

  </div>
</body>
</html>`;
}

// Pre-built components for common sections
export const EmailComponents = {

  // Summary box
  summaryBox: (text: string) => `
    <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
      <strong>${text}</strong>
    </div>
  `,

  // AI Feedback section
  aiFeedback: (feedback: string) => feedback ? `
    <div style="background: ${BRAND.colors.lightBg}; padding: 16px; border-radius: 8px; border-left: 4px solid ${BRAND.colors.primary}; margin-top: 16px;">
      <strong style="color: ${BRAND.colors.primary};">🧠 Agency Brain Coaching:</strong>
      <div style="margin-top: 8px; white-space: pre-line; color: #334155;">${feedback}</div>
    </div>
  ` : '',

  // Stats table with discrepancy support
  statsTable: (rows: Array<{
    metric: string;
    actual: number;
    target: number;
    passed: boolean;
    percentage: number;
    hasDiscrepancy?: boolean;
    discrepancyNote?: string;
  }>) => {
    const rowsHtml = rows.map(p => {
      const icon = p.passed ? '✅' : '❌';
      const color = p.passed ? BRAND.colors.green : BRAND.colors.red;
      // Add asterisk indicator for discrepancy
      const indicator = p.hasDiscrepancy ? '*' : '';
      return `<tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">${p.metric}${indicator}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${p.actual}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${p.target}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${color}; font-weight: 600;">${icon} ${p.percentage}%</td>
      </tr>`;
    }).join('');

    // Build discrepancy footnotes if any exist
    const discrepancies = rows.filter(d => d.hasDiscrepancy && d.discrepancyNote);
    const footnote = discrepancies.length > 0 ? `
      <div style="margin-top: 16px; padding: 12px; background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e; font-size: 13px;">
          ⚠ Tracking Gaps Detected
        </p>
        <ul style="margin: 0; padding-left: 16px; color: #a16207; font-size: 12px;">
          ${discrepancies.map(d => `<li>* ${d.metric}: ${d.discrepancyNote}</li>`).join('')}
        </ul>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #a16207;">
          Add households via Dashboard for complete tracking.
        </p>
      </div>
    ` : '';

    return `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="background: #f3f4f6; padding: 12px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Metric</th>
            <th style="background: #f3f4f6; padding: 12px 8px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Actual</th>
            <th style="background: #f3f4f6; padding: 12px 8px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Target</th>
            <th style="background: #f3f4f6; padding: 12px 8px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Result</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      ${footnote}
    `;
  },

  // Button
  button: (text: string, url: string) => `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${url}" style="background: ${BRAND.colors.primary}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">${text}</a>
    </div>
  `,

  // Info text
  infoText: (text: string) => `
    <p style="color: #64748b; font-size: 14px; margin: 16px 0;">${text}</p>
  `,

  // Paragraph
  paragraph: (text: string) => `
    <p style="margin: 16px 0;">${text}</p>
  `,

  // Warning box for discrepancies or other alerts
  warningBox: (title: string, items: string[], footer?: string) => `
    <div style="margin-top: 16px; padding: 12px; background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #92400e; font-size: 13px;">
        ⚠ ${title}
      </p>
      <ul style="margin: 0; padding-left: 16px; color: #a16207; font-size: 12px;">
        ${items.map(item => `<li>${item}</li>`).join('')}
      </ul>
      ${footer ? `<p style="margin: 8px 0 0 0; font-size: 11px; color: #a16207;">${footer}</p>` : ''}
    </div>
  `,
};
