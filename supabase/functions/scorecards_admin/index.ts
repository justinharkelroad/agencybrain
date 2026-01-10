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
