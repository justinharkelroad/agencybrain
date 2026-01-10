import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyRequest, isVerifyError } from '../_shared/verifyRequest.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Verify request (supports both Supabase JWT and staff session)
    const authResult = await verifyRequest(req);
    if (isVerifyError(authResult)) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { mode, agencyId, agencySlug, isManager, userId, staffUserId } = authResult;

    // Authorization: staff must be manager/owner, Supabase users are assumed authorized
    if (mode === 'staff' && !isManager) {
      return new Response(
        JSON.stringify({ error: 'Manager access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { action, ...params } = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for all DB operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let result: any;

    switch (action) {
      // ==================== FORMS ====================
      case 'forms_list': {
        const { data, error } = await supabase
          .from('form_templates')
          .select('*')
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        result = { forms: data };
        break;
      }

      case 'form_get': {
        const { form_id } = params.params || params;
        
        if (!form_id) {
          return new Response(
            JSON.stringify({ error: 'form_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('form_templates')
          .select('*')
          .eq('id', form_id)
          .eq('agency_id', agencyId)
          .single();

        if (error) throw error;
        result = data; // Return the form directly
        break;
      }

      case 'form_create': {
        const { name, slug, role, schema_json, settings_json } = params;
        
        if (!name || !slug || !role) {
          return new Response(
            JSON.stringify({ error: 'name, slug, and role are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('form_templates')
          .insert({
            agency_id: agencyId,
            name,
            slug,
            role,
            schema_json: schema_json || {},
            settings_json: settings_json || {},
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        result = { form: data };
        break;
      }

      case 'form_update': {
        const { formId, patch } = params;
        
        if (!formId) {
          return new Response(
            JSON.stringify({ error: 'formId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('form_templates')
          .update(patch)
          .eq('id', formId)
          .eq('agency_id', agencyId) // Ensure agency ownership
          .select()
          .single();

        if (error) throw error;
        result = { form: data };
        break;
      }

      case 'form_toggle_active': {
        const { formId, is_active } = params;
        
        const { data, error } = await supabase
          .from('form_templates')
          .update({ is_active })
          .eq('id', formId)
          .eq('agency_id', agencyId)
          .select()
          .single();

        if (error) throw error;
        result = { form: data };
        break;
      }

      case 'form_duplicate': {
        const { sourceFormId } = params;
        
        if (!sourceFormId) {
          return new Response(
            JSON.stringify({ error: 'sourceFormId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch source form with agency validation
        const { data: sourceForm, error: fetchError } = await supabase
          .from('form_templates')
          .select('*')
          .eq('id', sourceFormId)
          .eq('agency_id', agencyId)
          .single();

        if (fetchError || !sourceForm) {
          return new Response(
            JSON.stringify({ error: 'Form not found or access denied' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate unique slug
        const baseSlug = sourceForm.slug + '-copy';
        let slug = baseSlug;
        
        const { data: existingForms } = await supabase
          .from('form_templates')
          .select('slug')
          .eq('agency_id', agencyId)
          .like('slug', `${baseSlug}%`);

        if (existingForms && existingForms.length > 0) {
          const existingSlugs = new Set(existingForms.map((f: any) => f.slug));
          let counter = 2;
          while (existingSlugs.has(slug)) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          }
        }

        // Insert duplicated form
        const { data: newForm, error: insertError } = await supabase
          .from('form_templates')
          .insert({
            agency_id: agencyId,
            name: sourceForm.name + ' (Copy)',
            slug: slug,
            role: sourceForm.role,
            schema_json: sourceForm.schema_json || {},
            settings_json: sourceForm.settings_json || {},
            field_mappings: sourceForm.field_mappings || {},
            is_active: true,
            status: 'draft',
          })
          .select()
          .single();

        if (insertError) throw insertError;
        result = { form: newForm };
        break;
      }

      // ==================== FORM LINKS ====================
      case 'form_link_get': {
        const { formTemplateId } = params;

        const { data, error } = await supabase
          .from('form_links')
          .select('*')
          .eq('form_template_id', formTemplateId)
          .eq('enabled', true)
          .maybeSingle();

        if (error) throw error;
        result = { link: data };
        break;
      }

      case 'form_link_create': {
        const { formTemplateId } = params;
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
        result = { link: data };
        break;
      }

      case 'form_link_toggle': {
        const { formTemplateId, enabled } = params;

        const { error } = await supabase
          .from('form_links')
          .update({ enabled })
          .eq('form_template_id', formTemplateId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      // ==================== SCORECARD RULES ====================
      case 'scorecard_rules_get': {
        const { role } = params;

        const { data, error } = await supabase
          .from('scorecard_rules')
          .select('*')
          .eq('agency_id', agencyId)
          .eq('role', role)
          .maybeSingle();

        if (error) throw error;
        result = { rules: data };
        break;
      }

      case 'scorecard_rules_upsert': {
        const { role, selected_metrics, ring_metrics, n_required, weights, counted_days, count_weekend_if_submitted, backfill_days } = params;

        // Check if rules exist
        const { data: existing } = await supabase
          .from('scorecard_rules')
          .select('id')
          .eq('agency_id', agencyId)
          .eq('role', role)
          .maybeSingle();

        let data, error;
        if (existing) {
          ({ data, error } = await supabase
            .from('scorecard_rules')
            .update({
              selected_metrics,
              ring_metrics,
              n_required,
              weights,
              counted_days,
              count_weekend_if_submitted,
              backfill_days,
            })
            .eq('id', existing.id)
            .select()
            .single());
        } else {
          ({ data, error } = await supabase
            .from('scorecard_rules')
            .insert({
              agency_id: agencyId,
              role,
              selected_metrics,
              ring_metrics,
              n_required,
              weights,
              counted_days,
              count_weekend_if_submitted,
              backfill_days,
            })
            .select()
            .single());
        }

        if (error) throw error;
        result = { rules: data };
        break;
      }

      // ==================== KPIs ====================
      case 'kpis_list': {
        const { role } = params;

        let query = supabase
          .from('kpis')
          .select('*')
          .eq('agency_id', agencyId)
          .eq('is_active', true);
        
        // If role is provided, filter by role or null
        if (role) {
          query = query.or(`role.eq.${role},role.is.null`);
        }
        
        const { data, error } = await query.order('label');

        if (error) throw error;
        result = { kpis: data };
        break;
      }

      case 'kpi_create': {
        const { role, label, type = 'number' } = params;
        const key = `custom_${Date.now()}`;

        const { data, error } = await supabase
          .from('kpis')
          .insert({
            agency_id: agencyId,
            key,
            label: label || 'New Custom KPI',
            type,
            is_active: true,
            role,
          })
          .select()
          .single();

        if (error) throw error;
        result = { kpi: data };
        break;
      }

      case 'kpi_update_label': {
        const { kpiId, label } = params;

        const { data, error } = await supabase
          .from('kpis')
          .update({ label })
          .eq('id', kpiId)
          .eq('agency_id', agencyId)
          .select()
          .single();

        if (error) throw error;
        result = { kpi: data };
        break;
      }

      case 'kpi_delete': {
        const { kpi_key } = params;
        
        // Use the existing delete_kpi_transaction RPC
        const actorId = userId || staffUserId;
        const { data, error } = await supabase.rpc('delete_kpi_transaction', {
          p_agency_id: agencyId,
          p_kpi_key: kpi_key,
          p_actor_id: actorId,
        });

        if (error) throw error;
        result = { success: true, impact: data };
        break;
      }

      // ==================== TARGETS ====================
      case 'targets_get': {
        const { metric_keys } = params;

        let query = supabase
          .from('targets')
          .select('*')
          .eq('agency_id', agencyId)
          .is('team_member_id', null);

        if (metric_keys && metric_keys.length > 0) {
          query = query.in('metric_key', metric_keys);
        }

        const { data, error } = await query;
        if (error) throw error;
        result = { targets: data };
        break;
      }

      case 'targets_upsert': {
        const { targets } = params; // Array of { metric_key, value_number }

        if (!targets || !Array.isArray(targets)) {
          return new Response(
            JSON.stringify({ error: 'targets array is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete existing agency-level targets for these keys
        const metricKeys = targets.map((t: any) => t.metric_key);
        await supabase
          .from('targets')
          .delete()
          .eq('agency_id', agencyId)
          .is('team_member_id', null)
          .in('metric_key', metricKeys);

        // Insert new targets
        const toInsert = targets.map((t: any) => ({
          agency_id: agencyId,
          metric_key: t.metric_key,
          value_number: t.value_number,
          team_member_id: null,
        }));

        const { error } = await supabase
          .from('targets')
          .insert(toInsert);

        if (error) throw error;
        result = { success: true };
        break;
      }

      // ==================== AGENCY GOALS ====================
      case 'agency_goals_get': {
        const { data, error } = await supabase
          .from('agencies')
          .select('daily_quoted_households_target, daily_sold_items_target')
          .eq('id', agencyId)
          .single();

        if (error) throw error;
        result = { goals: data };
        break;
      }

      case 'agency_goals_update': {
        const { daily_quoted_households_target, daily_sold_items_target } = params;

        const { error } = await supabase
          .from('agencies')
          .update({
            daily_quoted_households_target,
            daily_sold_items_target,
          })
          .eq('id', agencyId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      // ==================== SUBMISSIONS ====================
      case 'submissions_list': {
        const { page = 0, pageSize = 50 } = params;

        const { data, error } = await supabase
          .from('submissions')
          .select(`
            id,
            work_date,
            submission_date,
            submitted_at,
            final,
            late,
            payload_json,
            form_templates!inner(id, name, slug, role, agency_id),
            team_members!inner(id, name, email)
          `)
          .eq('form_templates.agency_id', agencyId)
          .order('submission_date', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        // Also get metrics view data
        const submissionIds = (data || []).map((s: any) => s.id);
        let metrics: any[] = [];
        if (submissionIds.length > 0) {
          const { data: metricsData } = await supabase
            .from('vw_submission_metrics')
            .select('*')
            .in('submission_id', submissionIds);
          metrics = metricsData || [];
        }

        result = { submissions: data, metrics };
        break;
      }

      // ==================== TEAM RINGS DATA ====================
      case 'team_rings_data': {
        const { role, date } = params;

        if (!role || !date) {
          return new Response(
            JSON.stringify({ error: 'role and date are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get scorecard rules - include selected_metrics
        const { data: rules } = await supabase
          .from('scorecard_rules')
          .select('ring_metrics, selected_metrics, n_required')
          .eq('agency_id', agencyId)
          .eq('role', role)
          .single();

        // Get team metrics using the RPC
        const { data: teamMetrics } = await supabase
          .rpc('get_dashboard_daily', {
            p_agency_slug: agencySlug,
            p_role: role,
            p_start: date,
            p_end: date,
          });

        // Get targets
        const { data: targets } = await supabase
          .from('targets')
          .select('team_member_id, metric_key, value_number')
          .eq('agency_id', agencyId);

        // Get KPI labels for display
        const { data: kpiData } = await supabase
          .from('kpis')
          .select('key, label')
          .eq('agency_id', agencyId)
          .eq('is_active', true);

        const kpiLabels: Record<string, string> = {};
        (kpiData || []).forEach((kpi: any) => {
          kpiLabels[kpi.key] = kpi.label;
        });

        result = {
          rules,
          teamMetrics,
          targets,
          kpiLabels,
        };
        break;
      }

      // ==================== MEETING FRAME ====================
      case 'meeting_frame_list': {
        // Get team members
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('id, name, role')
          .eq('agency_id', agencyId)
          .eq('status', 'active')
          .order('name');

        // Get KPIs
        const { data: kpis } = await supabase
          .from('kpis')
          .select('id, key, label, type')
          .eq('agency_id', agencyId)
          .eq('is_active', true)
          .order('label');

        // Get meeting frame history
        const { data: history } = await supabase
          .from('meeting_frames')
          .select(`*, team_members (name, role)`)
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false })
          .limit(50);

        result = { teamMembers, kpis, history };
        break;
      }

      case 'meeting_frame_generate': {
        const { team_member_id, start_date, end_date } = params;

        if (!team_member_id || !start_date || !end_date) {
          return new Response(
            JSON.stringify({ error: 'team_member_id, start_date, and end_date are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: metricsData, error: metricsError } = await supabase
          .from('metrics_daily')
          .select('*')
          .eq('team_member_id', team_member_id)
          .gte('date', start_date)
          .lte('date', end_date);

        if (metricsError) throw metricsError;
        result = { metricsData };
        break;
      }

      case 'meeting_frame_create': {
        const { team_member_id, start_date, end_date, kpi_totals, call_log_data, quoted_data, sold_data, call_scoring_data, meeting_notes } = params;

        if (!team_member_id || !start_date || !end_date) {
          return new Response(
            JSON.stringify({ error: 'team_member_id, start_date, and end_date are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('meeting_frames')
          .insert({
            agency_id: agencyId,
            team_member_id,
            created_by: staffUserId || userId,  // Use staffUserId for staff, userId for regular users
            start_date,
            end_date,
            kpi_totals: kpi_totals || {},
            call_log_data: call_log_data || {},
            quoted_data: quoted_data || {},
            sold_data: sold_data || {},
            call_scoring_data: call_scoring_data || [],
            meeting_notes: meeting_notes || null,
          })
          .select()
          .single();

        if (error) throw error;
        result = { frame: data };
        break;
      }

      case 'meeting_frame_delete': {
        const { frame_id } = params;

        if (!frame_id) {
          return new Response(
            JSON.stringify({ error: 'frame_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('meeting_frames')
          .delete()
          .eq('id', frame_id)
          .eq('agency_id', agencyId);  // Security: ensure frame belongs to agency

        if (error) throw error;
        result = { success: true };
        break;
      }

      // ==================== MEETING FRAME CALL SCORING ====================
      case 'meeting_frame_call_submissions': {
        const { team_member_id, start_date, end_date } = params;

        if (!team_member_id || !start_date || !end_date) {
          return new Response(
            JSON.stringify({ error: 'team_member_id, start_date, and end_date are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('agency_calls')
          .select('id, original_filename, status, overall_score, potential_rank, created_at, call_duration_seconds, call_type')
          .eq('team_member_id', team_member_id)
          .eq('agency_id', agencyId)  // Security: ensure calls belong to agency
          .gte('created_at', start_date)
          .lte('created_at', end_date + 'T23:59:59')
          .order('created_at', { ascending: false });

        if (error) throw error;
        result = { submissions: data };
        break;
      }

      case 'meeting_frame_call_details': {
        const { call_id } = params;

        if (!call_id) {
          return new Response(
            JSON.stringify({ error: 'call_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('agency_calls')
          .select('*')
          .eq('id', call_id)
          .eq('agency_id', agencyId)  // Security: ensure call belongs to agency
          .single();

        if (error) throw error;
        result = { call: data };
        break;
      }

      // ==================== GET AGENCY PROFILE ====================
      case 'agency_profile_get': {
        const { data, error } = await supabase
          .from('agencies')
          .select('id, name, slug')
          .eq('id', agencyId)
          .single();

        if (error) throw error;
        result = { agency: data };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Scorecards admin error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
