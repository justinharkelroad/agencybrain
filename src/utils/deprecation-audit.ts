import { supabase } from "@/lib/supabaseClient";

/**
 * DEPRECATION AUDIT UTILITY
 * Created: 2025-01-29
 *
 * Public form links have been deprecated in favor of the authenticated Staff Portal.
 * Staff now submit scorecards through /staff/submit with proper authentication.
 *
 * This utility helps audit public link usage before/after deprecation.
 * Run from browser console: import('./utils/deprecation-audit').then(m => m.auditPublicLinkUsage().then(console.log))
 */
export async function auditPublicLinkUsage() {
  const { data: links, error: linksError } = await supabase
    .from('form_links')
    .select(`
      id,
      token,
      enabled,
      created_at,
      expires_at,
      form_template_id,
      form_templates!inner(name, slug, agency_id, agencies!inner(name, slug))
    `)
    .eq('enabled', true);

  if (linksError) {
    console.error('Audit error:', linksError);
    return { error: linksError.message };
  }

  const summary = {
    auditDate: new Date().toISOString(),
    activeLinks: links?.length || 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    linkDetails: links?.map((link: any) => ({
      linkId: link.id,
      formName: link.form_templates?.name,
      agencyName: link.form_templates?.agencies?.name,
      createdAt: link.created_at,
      expiresAt: link.expires_at
    })) || [],
    recommendation: (links?.length || 0) > 0
      ? 'HAS_ACTIVE_LINKS - Monitor for complaints after deprecation'
      : 'SAFE_TO_DEPRECATE'
  };

  console.table(summary.linkDetails);
  return summary;
}

/**
 * Get recent form submissions via public links
 * Helps determine if public links are still being actively used
 */
export async function auditRecentPublicSubmissions(daysPast: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysPast);

  const { data: submissions, error } = await supabase
    .from('form_submissions')
    .select(`
      id,
      submitted_at,
      form_template_id,
      form_templates!inner(name, agency_id)
    `)
    .gte('submitted_at', cutoffDate.toISOString())
    .is('submitted_by', null); // Public submissions have no authenticated user

  if (error) {
    console.error('Submission audit error:', error);
    return { error: error.message };
  }

  return {
    auditDate: new Date().toISOString(),
    period: `Last ${daysPast} days`,
    publicSubmissions: submissions?.length || 0,
    details: submissions || []
  };
}
