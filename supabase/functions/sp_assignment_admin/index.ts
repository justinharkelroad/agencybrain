import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';
import { BRAND, buildEmailHtml } from '../_shared/email-template.ts';

interface AuthContext {
  mode: 'jwt' | 'staff';
  agencyId: string;
  userId?: string;       // JWT user
  staffUserId?: string;  // Staff user
  isManager: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Auth: prefer staff session header, fall back to JWT ──
    const staffSessionToken = req.headers.get('x-staff-session');
    const authHeader = req.headers.get('authorization');
    let auth: AuthContext | null = null;

    // Path 1: Staff session (manager)
    if (staffSessionToken) {
      const { data: sessionData, error: sessionError } = await supabase
        .from('staff_sessions')
        .select(`
          id,
          staff_user_id,
          expires_at,
          staff_users!inner (
            id,
            agency_id,
            team_member_id,
            team_members (
              role
            )
          )
        `)
        .eq('session_token', staffSessionToken)
        .eq('is_valid', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (sessionError || !sessionData) {
        console.error('[sp_assignment_admin] Staff session validation failed:', sessionError);
        return new Response(
          JSON.stringify({ error: 'Invalid or expired session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const staffUser = sessionData.staff_users as any;
      const teamMemberRole = staffUser.team_members?.role;

      auth = {
        mode: 'staff',
        agencyId: staffUser.agency_id,
        staffUserId: staffUser.id,
        isManager: teamMemberRole === 'Manager' || teamMemberRole === 'Owner',
      };
    }

    // Path 2: JWT (owner/admin)
    if (!auth && authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.replace('Bearer ', '');
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await userClient.auth.getUser(jwt);
      if (user && !userError) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .single();

        if (profile?.agency_id) {
          auth = {
            mode: 'jwt',
            agencyId: profile.agency_id,
            userId: user.id,
            isManager: true, // owners always have manager-level access
          };
        }
      }
    }

    if (!auth) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { agencyId, userId, staffUserId, mode } = auth;

    const body = await req.json();
    const { action, ...params } = body;

    // Staff-facing actions any staff user can call (for banner)
    const staffSelfActions = ['mark_seen', 'unseen_count'];

    // Admin actions require owner (JWT) or manager (staff)
    if (!staffSelfActions.includes(action) && auth.mode === 'staff' && !auth.isManager) {
      return new Response(
        JSON.stringify({ error: 'Manager access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sp_assignment_admin] Action: ${action}, Agency: ${agencyId}, Mode: ${mode}`);

    let result: any = null;

    switch (action) {
      // ============ LIST ASSIGNMENTS ============
      case 'list': {
        const { data, error } = await supabase
          .from('sp_assignments')
          .select(`
            *,
            staff_users!sp_assignments_staff_user_id_fkey(id, display_name, username),
            sp_categories(id, name, slug),
            sp_modules(id, name, slug, category_id),
            sp_lessons(id, name, slug, module_id)
          `)
          .eq('agency_id', agencyId)
          .order('assigned_at', { ascending: false });

        if (error) throw error;

        // Calculate status for each assignment (branching by level)
        const assignmentsWithStatus = await Promise.all(
          (data || []).map(async (assignment: any) => {
            const level = assignment.sp_category_id ? 'category'
              : assignment.sp_module_id ? 'module' : 'lesson';

            const status = await calculateAssignmentStatus(
              supabase,
              assignment.staff_user_id,
              assignment,
              level,
              assignment.due_date
            );
            return { ...assignment, status, level };
          })
        );

        result = { assignments: assignmentsWithStatus };
        break;
      }

      // ============ BULK CREATE ============
      case 'bulk_create': {
        const { staff_user_ids, items, category_ids, due_date } = params;

        if (!staff_user_ids?.length) {
          throw new Error('staff_user_ids required');
        }

        // Backward-compat: old callers send category_ids, new callers send items
        const resolvedItems: Array<{ sp_category_id?: string; sp_module_id?: string; sp_lesson_id?: string }> =
          items?.length ? items
          : category_ids?.length ? category_ids.map((id: string) => ({ sp_category_id: id }))
          : [];

        if (resolvedItems.length === 0) {
          throw new Error('items or category_ids required');
        }

        // Group by level for separate upserts (different onConflict columns)
        const catRecords: any[] = [];
        const modRecords: any[] = [];
        const lessonRecords: any[] = [];

        for (const suId of staff_user_ids) {
          for (const item of resolvedItems) {
            const base = {
              agency_id: agencyId,
              staff_user_id: suId,
              due_date: due_date || null,
              assigned_by_user_id: mode === 'jwt' ? userId : null,
              assigned_by_staff_id: mode === 'staff' ? staffUserId : null,
              assigned_at: new Date().toISOString(),
              seen_at: null,
            };
            if (item.sp_category_id) {
              catRecords.push({ ...base, sp_category_id: item.sp_category_id });
            } else if (item.sp_module_id) {
              modRecords.push({ ...base, sp_module_id: item.sp_module_id });
            } else if (item.sp_lesson_id) {
              lessonRecords.push({ ...base, sp_lesson_id: item.sp_lesson_id });
            }
          }
        }

        const allResults: any[] = [];
        const selectCols = `
          *,
          staff_users!sp_assignments_staff_user_id_fkey(id, display_name, username, email),
          sp_categories(id, name, slug),
          sp_modules(id, name, slug, category_id),
          sp_lessons(id, name, slug, module_id)
        `;

        if (catRecords.length > 0) {
          const { data, error } = await supabase
            .from('sp_assignments')
            .upsert(catRecords, { onConflict: 'staff_user_id,sp_category_id' })
            .select(selectCols);
          if (error) throw error;
          allResults.push(...(data || []));
        }
        if (modRecords.length > 0) {
          const { data, error } = await supabase
            .from('sp_assignments')
            .upsert(modRecords, { onConflict: 'staff_user_id,sp_module_id' })
            .select(selectCols);
          if (error) throw error;
          allResults.push(...(data || []));
        }
        if (lessonRecords.length > 0) {
          const { data, error } = await supabase
            .from('sp_assignments')
            .upsert(lessonRecords, { onConflict: 'staff_user_id,sp_lesson_id' })
            .select(selectCols);
          if (error) throw error;
          allResults.push(...(data || []));
        }

        // Send email notifications
        let emailWarning: string | undefined;
        try {
          await sendAssignmentEmails(allResults, agencyId, supabase);
        } catch (emailErr) {
          console.error('[sp_assignment_admin] Email send failed:', emailErr);
          emailWarning = 'Assignments created but email notification failed';
        }

        result = { assignments: allResults, emailWarning };
        break;
      }

      // ============ UPDATE (due date) ============
      case 'update': {
        const { id, due_date } = params;

        const { data: existing } = await supabase
          .from('sp_assignments')
          .select('agency_id')
          .eq('id', id)
          .single();

        if (existing?.agency_id !== agencyId) {
          throw new Error('Assignment not found');
        }

        const { data, error } = await supabase
          .from('sp_assignments')
          .update({ due_date: due_date || null })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        result = { assignment: data };
        break;
      }

      // ============ DELETE ============
      case 'delete': {
        const { id } = params;

        const { data: existing } = await supabase
          .from('sp_assignments')
          .select('agency_id')
          .eq('id', id)
          .single();

        if (existing?.agency_id !== agencyId) {
          throw new Error('Assignment not found');
        }

        const { error } = await supabase
          .from('sp_assignments')
          .delete()
          .eq('id', id);

        if (error) throw error;
        result = { success: true };
        break;
      }

      // ============ LIST ACCESSIBLE CATEGORIES ============
      case 'list_categories': {
        const { data: agency } = await supabase
          .from('agencies')
          .select('membership_tier')
          .eq('id', agencyId)
          .single();

        const tier = agency?.membership_tier || 'staff';

        const { data: categories, error } = await supabase
          .from('sp_categories')
          .select('id, name, slug, description, icon, access_tiers')
          .eq('is_published', true)
          .order('display_order', { ascending: true });

        if (error) throw error;

        const accessible = (categories || []).filter((cat: any) => {
          const tiers = cat.access_tiers || [];
          if (tiers.includes('staff')) return true;
          if (tier === 'manager' && tiers.includes('manager')) return true;
          if (mode === 'jwt') return true;
          if (auth.isManager && tiers.includes('manager')) return true;
          return false;
        });

        result = { categories: accessible };
        break;
      }

      // ============ LIST CONTENT TREE (for drill-down picker) ============
      case 'list_content': {
        const { data: agency } = await supabase
          .from('agencies')
          .select('membership_tier')
          .eq('id', agencyId)
          .single();

        const tier = agency?.membership_tier || 'staff';

        const { data: categories, error: catErr } = await supabase
          .from('sp_categories')
          .select(`
            id, name, slug, description, icon, access_tiers,
            sp_modules(
              id, name, slug, display_order, is_published,
              sp_lessons(id, name, slug, display_order, is_published)
            )
          `)
          .eq('is_published', true)
          .order('display_order', { ascending: true });

        if (catErr) throw catErr;

        // Filter by tier access
        const accessible = (categories || []).filter((cat: any) => {
          const tiers = cat.access_tiers || [];
          if (tiers.includes('staff')) return true;
          if (tier === 'manager' && tiers.includes('manager')) return true;
          if (mode === 'jwt') return true;
          if (auth.isManager && tiers.includes('manager')) return true;
          return false;
        }).map((cat: any) => ({
          ...cat,
          sp_modules: (cat.sp_modules || [])
            .filter((mod: any) => mod.is_published !== false)
            .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
            .map((mod: any) => ({
              ...mod,
              sp_lessons: (mod.sp_lessons || [])
                .filter((l: any) => l.is_published !== false)
                .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)),
            })),
        }));

        result = { tree: accessible };
        break;
      }

      // ============ MARK SEEN ============
      case 'mark_seen': {
        const targetStaffId = mode === 'staff' ? staffUserId : params.staff_user_id;

        if (!targetStaffId) {
          throw new Error('staff_user_id required');
        }

        const { data, error } = await supabase
          .from('sp_assignments')
          .update({ seen_at: new Date().toISOString() })
          .eq('staff_user_id', targetStaffId)
          .eq('agency_id', agencyId)
          .is('seen_at', null)
          .select('id');

        if (error) throw error;
        result = { updated: data?.length || 0 };
        break;
      }

      // ============ GET UNSEEN COUNT (for banner) ============
      case 'unseen_count': {
        const targetStaffId = mode === 'staff' ? staffUserId : params.staff_user_id;

        if (!targetStaffId) {
          throw new Error('staff_user_id required');
        }

        const { data: unseenData, error } = await supabase
          .from('sp_assignments')
          .select(`
            id, sp_category_id, sp_module_id, sp_lesson_id,
            sp_categories(slug, name),
            sp_modules(slug, name, category_id, sp_categories:sp_categories!sp_modules_category_id_fkey(slug)),
            sp_lessons(slug, name, module_id, sp_modules:sp_modules!sp_lessons_module_id_fkey(slug, sp_categories:sp_categories!sp_modules_category_id_fkey(slug)))
          `)
          .eq('staff_user_id', targetStaffId)
          .eq('agency_id', agencyId)
          .is('seen_at', null);

        if (error) throw error;

        const assignments = (unseenData || []).map((a: any) => {
          if (a.sp_category_id) {
            return {
              level: 'category',
              sp_category_id: a.sp_category_id,
              category_slug: a.sp_categories?.slug,
              category_name: a.sp_categories?.name,
              target_name: a.sp_categories?.name,
            };
          }
          if (a.sp_module_id) {
            return {
              level: 'module',
              sp_module_id: a.sp_module_id,
              category_slug: a.sp_modules?.sp_categories?.slug,
              module_slug: a.sp_modules?.slug,
              target_name: a.sp_modules?.name,
            };
          }
          // lesson
          const lessonMod = a.sp_lessons?.sp_modules;
          return {
            level: 'lesson',
            sp_lesson_id: a.sp_lesson_id,
            category_slug: lessonMod?.sp_categories?.slug,
            module_slug: lessonMod?.slug,
            lesson_slug: a.sp_lessons?.slug,
            target_name: a.sp_lessons?.name,
          };
        });

        result = { count: assignments.length, assignments };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[sp_assignment_admin] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============ HELPERS ============

async function calculateAssignmentStatus(
  supabase: any,
  staffUserId: string,
  assignment: any,
  level: 'category' | 'module' | 'lesson',
  dueDate: string | null
): Promise<string> {
  if (level === 'lesson') {
    // Single lesson: check sp_progress_staff row
    const { data: progress } = await supabase
      .from('sp_progress_staff')
      .select('quiz_passed')
      .eq('staff_user_id', staffUserId)
      .eq('lesson_id', assignment.sp_lesson_id)
      .eq('quiz_passed', true)
      .maybeSingle();

    if (progress) return 'Completed';
    if (dueDate && new Date(dueDate) < new Date()) return 'Overdue';
    return 'Not Started';
  }

  if (level === 'module') {
    // All published lessons in the module
    const { data: lessons } = await supabase
      .from('sp_lessons')
      .select('id')
      .eq('module_id', assignment.sp_module_id)
      .eq('is_published', true);

    const lessonIds = (lessons || []).map((l: any) => l.id);
    if (lessonIds.length === 0) return 'Not Started';

    const { data: progress } = await supabase
      .from('sp_progress_staff')
      .select('lesson_id')
      .eq('staff_user_id', staffUserId)
      .eq('quiz_passed', true)
      .in('lesson_id', lessonIds);

    const completedCount = progress?.length || 0;
    if (completedCount >= lessonIds.length) return 'Completed';
    if (completedCount > 0) return 'In Progress';
    if (dueDate && new Date(dueDate) < new Date()) return 'Overdue';
    return 'Not Started';
  }

  // category level (existing logic)
  const { data: modules } = await supabase
    .from('sp_modules')
    .select('id, sp_lessons(id, is_published)')
    .eq('category_id', assignment.sp_category_id)
    .eq('is_published', true);

  let totalLessons = 0;
  const lessonIds: string[] = [];
  (modules || []).forEach((mod: any) => {
    (mod.sp_lessons || []).filter((l: any) => l.is_published).forEach((lesson: any) => {
      totalLessons++;
      lessonIds.push(lesson.id);
    });
  });

  if (totalLessons === 0) return 'Not Started';

  const { data: progress } = await supabase
    .from('sp_progress_staff')
    .select('lesson_id')
    .eq('staff_user_id', staffUserId)
    .eq('quiz_passed', true)
    .in('lesson_id', lessonIds);

  const completedCount = progress?.length || 0;

  if (completedCount >= totalLessons) return 'Completed';
  if (completedCount > 0) return 'In Progress';
  if (dueDate && new Date(dueDate) < new Date()) return 'Overdue';
  return 'Not Started';
}

function getItemName(assignment: any): string {
  if (assignment.sp_categories?.name) return assignment.sp_categories.name;
  if (assignment.sp_modules?.name) return assignment.sp_modules.name;
  if (assignment.sp_lessons?.name) return assignment.sp_lessons.name;
  return 'Training Item';
}

async function sendAssignmentEmails(
  assignments: any[],
  agencyId: string,
  supabase: any
): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.warn('[sp_assignment_admin] No RESEND_API_KEY, skipping email');
    return;
  }

  // Get agency name
  const { data: agency } = await supabase
    .from('agencies')
    .select('name, slug')
    .eq('id', agencyId)
    .single();

  const agencyName = agency?.name || 'Your Agency';

  // Group assignments by staff user
  const grouped = new Map<string, { email: string; name: string; itemNames: string[]; dueDate: string | null }>();

  for (const a of assignments) {
    const staff = a.staff_users;
    if (!staff?.email) continue;

    const key = staff.id;
    if (!grouped.has(key)) {
      grouped.set(key, {
        email: staff.email,
        name: staff.display_name || staff.username || 'Team Member',
        itemNames: [],
        dueDate: a.due_date,
      });
    }
    grouped.get(key)!.itemNames.push(getItemName(a));
  }

  if (grouped.size === 0) return;

  // Build batch emails
  const emails: any[] = [];
  const staffPortalUrl = `https://app.agencybrain.io/staff/training/standard`;

  for (const [, info] of grouped) {
    const itemList = info.itemNames.map(c => `<li style="margin: 4px 0;">${c}</li>`).join('');
    const dueDateLine = info.dueDate
      ? `<p style="margin: 16px 0 0 0; color: ${BRAND.colors.gray};">Due date: <strong>${new Date(info.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></p>`
      : '';

    const subject = info.itemNames.length === 1
      ? `New Training Assignment: ${info.itemNames[0]}`
      : `${info.itemNames.length} New Training Assignments`;

    const bodyContent = `
      <p>Hi ${info.name},</p>
      <p>You've been assigned new Standard Playbook training:</p>
      <ul style="margin: 12px 0; padding-left: 20px;">
        ${itemList}
      </ul>
      ${dueDateLine}
      <div style="margin: 24px 0;">
        <a href="${staffPortalUrl}" style="display: inline-block; background-color: ${BRAND.colors.primary}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Start Training &rarr;
        </a>
      </div>
    `;

    const html = buildEmailHtml({
      title: 'New Training Assignment',
      subtitle: agencyName,
      bodyContent,
      footerAgencyName: agencyName,
    });

    emails.push({
      from: BRAND.fromEmail,
      to: [info.email],
      subject,
      html,
    });
  }

  // Use Resend batch API
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emails),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[sp_assignment_admin] Resend batch failed:', res.status, errBody);
    throw new Error(`Email send failed: ${res.status}`);
  }

  console.log(`[sp_assignment_admin] Sent ${emails.length} assignment email(s)`);
}
