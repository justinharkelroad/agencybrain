/**
 * Staff-safe API for scorecards operations.
 * Uses edge function for staff mode, direct Supabase for owner mode.
 */
import { supabase } from '@/lib/supabaseClient';
import { fetchWithAuth, hasStaffToken } from '@/lib/staffRequest';

export interface FormTemplate {
  id: string;
  name: string;
  slug: string;
  role: string;
  schema_json: any;
  settings_json: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormLink {
  id: string;
  form_template_id: string;
  token: string;
  enabled: boolean;
  created_at: string;
  expires_at?: string;
}

export interface KPIData {
  id: string;
  agency_id: string;
  key: string;
  label: string;
  type: 'number' | 'currency' | 'percentage' | 'integer';
  color?: string;
  is_active: boolean;
  role?: string;
}

export interface Target {
  metric_key: string;
  value_number: number;
  team_member_id?: string | null;
}

export interface ScorecardRules {
  id?: string;
  agency_id: string;
  role: string;
  selected_metrics?: string[];
  ring_metrics?: string[];
  n_required?: number;
  weights?: any;
  counted_days?: string[];
  count_weekend_if_submitted?: boolean;
  backfill_days?: number;
}

// Helper to call the scorecards_admin edge function
async function callScorecardsApi(action: string, params: Record<string, any> = {}): Promise<any> {
  const response = await fetchWithAuth('scorecards_admin', {
    method: 'POST',
    body: { action, ...params },
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `API error: ${response.status}`);
  }
  
  return data;
}

// ==================== FORMS ====================

export async function listForms(staffAgencyId?: string): Promise<FormTemplate[]> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('forms_list');
    return data.forms || [];
  }
  
  // Owner mode - direct Supabase
  const { data, error } = await supabase
    .from('form_templates')
    .select('*')
    .eq('agency_id', staffAgencyId!)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function createForm(params: {
  name: string;
  slug: string;
  role: string;
  schema_json?: any;
  settings_json?: any;
}): Promise<FormTemplate> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('form_create', params);
    return data.form;
  }
  
  throw new Error('Form creation not supported in owner mode via this API');
}

export async function updateForm(formId: string, patch: Partial<FormTemplate>): Promise<FormTemplate> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('form_update', { formId, patch });
    return data.form;
  }
  
  throw new Error('Form update not supported in owner mode via this API');
}

export async function toggleFormActive(formId: string, is_active: boolean, agencyId?: string): Promise<boolean> {
  if (hasStaffToken()) {
    await callScorecardsApi('form_toggle_active', { formId, is_active });
    return true;
  }
  
  // Owner mode - direct Supabase
  const { error } = await supabase
    .from('form_templates')
    .update({ is_active })
    .eq('id', formId);
  
  if (error) throw error;
  return true;
}

// ==================== FORM LINKS ====================

export async function getFormLink(formTemplateId: string): Promise<FormLink | null> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('form_link_get', { formTemplateId });
    return data.link;
  }
  
  const { data, error } = await supabase
    .from('form_links')
    .select('*')
    .eq('form_template_id', formTemplateId)
    .eq('enabled', true)
    .maybeSingle();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createFormLink(formTemplateId: string): Promise<FormLink> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('form_link_create', { formTemplateId });
    return data.link;
  }
  
  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from('form_links')
    .insert({
      form_template_id: formTemplateId,
      token,
      enabled: true,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function toggleFormLink(formTemplateId: string, enabled: boolean): Promise<boolean> {
  if (hasStaffToken()) {
    await callScorecardsApi('form_link_toggle', { formTemplateId, enabled });
    return true;
  }
  
  const { error } = await supabase
    .from('form_links')
    .update({ enabled })
    .eq('form_template_id', formTemplateId);
  
  if (error) throw error;
  return true;
}

// ==================== SCORECARD RULES ====================

export async function getScorecardRules(role: string, agencyId?: string): Promise<ScorecardRules | null> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('scorecard_rules_get', { role });
    return data.rules;
  }
  
  const { data, error } = await supabase
    .from('scorecard_rules')
    .select('*')
    .eq('agency_id', agencyId!)
    .eq('role', role)
    .maybeSingle();
  
  if (error) throw error;
  return data;
}

export async function upsertScorecardRules(params: Omit<ScorecardRules, 'id' | 'agency_id'>): Promise<ScorecardRules> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('scorecard_rules_upsert', params);
    return data.rules;
  }
  
  throw new Error('Scorecard rules upsert not supported in owner mode via this API');
}

// ==================== KPIs ====================

export async function listKpis(role: string, agencyId?: string): Promise<KPIData[]> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('kpis_list', { role });
    return data.kpis || [];
  }
  
  const { data, error } = await supabase
    .from('kpis')
    .select('*')
    .eq('agency_id', agencyId!)
    .eq('is_active', true)
    .or(`role.eq.${role},role.is.null`)
    .order('label');
  
  if (error) throw error;
  return data || [];
}

export async function createKpi(params: { role: string; label?: string; type?: string }): Promise<KPIData> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('kpi_create', params);
    return data.kpi;
  }
  
  throw new Error('KPI creation not supported in owner mode via this API');
}

export async function updateKpiLabel(kpiId: string, label: string, agencyId?: string): Promise<KPIData> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('kpi_update_label', { kpiId, label });
    return data.kpi;
  }
  
  const { data, error } = await supabase
    .from('kpis')
    .update({ label })
    .eq('id', kpiId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteKpi(agencyId: string, kpi_key: string): Promise<any> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('kpi_delete', { kpi_key });
    return data;
  }
  
  // Owner mode - call edge function with Supabase auth
  const { data, error } = await supabase.functions.invoke('delete_kpi', {
    body: { agency_id: agencyId, kpi_key },
  });
  
  if (error) throw error;
  return data;
}

// ==================== TARGETS ====================

export async function getTargets(metricKeys?: string[], agencyId?: string): Promise<Target[]> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('targets_get', { metric_keys: metricKeys });
    return data.targets || [];
  }
  
  let query = supabase
    .from('targets')
    .select('*')
    .eq('agency_id', agencyId!)
    .is('team_member_id', null);
  
  if (metricKeys && metricKeys.length > 0) {
    query = query.in('metric_key', metricKeys);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function upsertTargets(targets: { metric_key: string; value_number: number }[], agencyId?: string): Promise<boolean> {
  if (hasStaffToken()) {
    await callScorecardsApi('targets_upsert', { targets });
    return true;
  }
  
  // Owner mode - delete and insert
  const metricKeys = targets.map(t => t.metric_key);
  await supabase
    .from('targets')
    .delete()
    .eq('agency_id', agencyId!)
    .is('team_member_id', null)
    .in('metric_key', metricKeys);
  
  const toInsert = targets.map(t => ({
    agency_id: agencyId!,
    metric_key: t.metric_key,
    value_number: t.value_number,
    team_member_id: null,
  }));
  
  const { error } = await supabase
    .from('targets')
    .insert(toInsert);
  
  if (error) throw error;
  return true;
}

// ==================== AGENCY GOALS ====================

export async function getAgencyGoals(agencyId?: string): Promise<{ daily_quoted_households_target: number | null; daily_sold_items_target: number | null }> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('agency_goals_get');
    return data.goals;
  }
  
  const { data, error } = await supabase
    .from('agencies')
    .select('daily_quoted_households_target, daily_sold_items_target')
    .eq('id', agencyId!)
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateAgencyGoals(goals: { daily_quoted_households_target: number; daily_sold_items_target: number }, agencyId?: string): Promise<boolean> {
  if (hasStaffToken()) {
    await callScorecardsApi('agency_goals_update', goals);
    return true;
  }
  
  const { error } = await supabase
    .from('agencies')
    .update(goals)
    .eq('id', agencyId!);
  
  if (error) throw error;
  return true;
}

// ==================== TEAM RINGS DATA ====================

export async function getTeamRingsData(role: string, date: string, agencyId?: string, agencySlug?: string): Promise<{
  rules: ScorecardRules | null;
  teamMetrics: any[];
  targets: Target[];
}> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('team_rings_data', { role, date });
    return data;
  }
  
  // Owner mode - direct queries
  const { data: rules } = await supabase
    .from('scorecard_rules')
    .select('*')
    .eq('agency_id', agencyId!)
    .eq('role', role)
    .maybeSingle();
  
  const { data: teamMetrics } = await supabase
    .rpc('get_dashboard_daily', {
      p_agency_slug: agencySlug,
      p_role: role,
      p_start: date,
      p_end: date,
    });
  
  const { data: targets } = await supabase
    .from('targets')
    .select('team_member_id, metric_key, value_number')
    .eq('agency_id', agencyId!);
  
  return {
    rules,
    teamMetrics: teamMetrics || [],
    targets: targets || [],
  };
}

// ==================== SUBMISSIONS ====================

export async function listSubmissions(agencyId?: string, page = 0, pageSize = 50): Promise<{ submissions: any[]; metrics: any[] }> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('submissions_list', { page, pageSize });
    return data;
  }
  
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      id,
      work_date,
      submission_date,
      is_final,
      is_late,
      payload_json,
      form_templates!inner(id, name, slug, role),
      team_members!inner(id, first_name, last_name, email)
    `)
    .eq('form_templates.agency_id', agencyId!)
    .order('submission_date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  
  if (error) throw error;
  
  const submissionIds = (data || []).map(s => s.id);
  let metrics: any[] = [];
  if (submissionIds.length > 0) {
    const { data: metricsData } = await supabase
      .from('vw_submission_metrics')
      .select('*')
      .in('submission_id', submissionIds);
    metrics = metricsData || [];
  }
  
  return { submissions: data || [], metrics };
}

// ==================== AGENCY PROFILE ====================

export async function getAgencyProfile(agencyId?: string): Promise<{ id: string; name: string; slug: string } | null> {
  if (hasStaffToken()) {
    const data = await callScorecardsApi('agency_profile_get');
    return data.agency;
  }
  
  const { data, error } = await supabase
    .from('agencies')
    .select('id, name, slug')
    .eq('id', agencyId!)
    .single();
  
  if (error) throw error;
  return data;
}

// ==================== NAMESPACED EXPORTS ====================

export const scorecardsApi = {
  // Convenience wrappers for dialog compatibility (with error handling)
  async scorecardRulesGet(role: string) {
    try {
      const rules = await getScorecardRules(role);
      // Also fetch targets for the role's metrics
      const selectedMetrics = rules?.selected_metrics || [];
      const targets = selectedMetrics.length > 0 ? await getTargets(selectedMetrics) : [];
      return { data: { ...rules, targets }, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  },
  
  async scorecardRulesUpsert(role: string, updates: Partial<ScorecardRules>) {
    try {
      const result = await upsertScorecardRules({ role, ...updates });
      return { data: result, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  },
  
  async kpisListForRole(role: string) {
    try {
      const kpis = await listKpis(role);
      return { data: kpis, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  },
  
  async kpisCreateCustom(role: string, label: string, type: string) {
    try {
      const kpi = await createKpi({ role, label, type });
      return { data: kpi, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  },
  
  async kpisUpdateLabel(kpiId: string, label: string) {
    try {
      const kpi = await updateKpiLabel(kpiId, label);
      return { data: kpi, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  },
  
  async targetsReplaceForRole(role: string, targets: { metric_key: string; value_number: number }[]) {
    try {
      await upsertTargets(targets);
      return { data: true, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  },
  
  async deleteKpi(kpiKey: string) {
    try {
      // Staff mode doesn't need agencyId - edge function gets it from session
      await callScorecardsApi('kpi_delete', { kpi_key: kpiKey });
      return { data: true, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  },
};
