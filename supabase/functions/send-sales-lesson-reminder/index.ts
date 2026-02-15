import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// DST-aware local hour using Intl (same pattern as send-morning-digest)
function getLocalHour(timezone: string): number {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    return parseInt(hour, 10);
  } catch {
    const fallbackHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    return parseInt(fallbackHour, 10);
  }
}

// Get today's local date string (YYYY-MM-DD) for a timezone
function getLocalDateStr(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // en-CA = YYYY-MM-DD
}

// Get local day of week (0=Sun, 1=Mon, ..., 6=Sat)
function getLocalDayOfWeek(timezone: string): number {
  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(new Date());
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[dayStr] ?? new Date().getDay();
}

// Map day_of_week (1=Mon, 3=Wed, 5=Fri) to display name
function getDayName(dayOfWeek: number): string {
  const names: Record<number, string> = { 1: 'Monday', 3: 'Wednesday', 5: 'Friday' };
  return names[dayOfWeek] || 'Unknown';
}

interface Assignment {
  id: string;
  agency_id: string;
  start_date: string;
  timezone: string;
  status: string;
}

interface Lesson {
  id: string;
  title: string;
  day_of_week: number;
  module: { week_number: number };
}

interface Recipient {
  email: string;
  name: string;
  type: 'staff' | 'owner' | 'key_employee' | 'manager';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[send-sales-lesson-reminder] Starting');

  try {
    // Parse optional test params
    let forceTest = false;
    let testEmail: string | null = null;
    let testAgencyId: string | null = null;
    try {
      const body = await req.json();
      forceTest = body?.forceTest === true;
      testEmail = body?.testEmail || null;
      testAgencyId = body?.agencyId || null;

      if (forceTest && !testEmail) {
        return new Response(
          JSON.stringify({ error: 'forceTest mode requires testEmail parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (forceTest) {
        console.log(`[send-sales-lesson-reminder] FORCE TEST MODE: sending ONLY to ${testEmail}`, testAgencyId ? `for agency ${testAgencyId}` : '');
      }
    } catch {
      // No body or invalid JSON — normal cron invocation
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch active assignments
    let assignmentQuery = supabase
      .from('sales_experience_assignments')
      .select('id, agency_id, start_date, timezone, status')
      .eq('status', 'active');

    if (forceTest && testAgencyId) {
      assignmentQuery = assignmentQuery.eq('agency_id', testAgencyId);
    }

    const { data: assignments, error: assignErr } = await assignmentQuery;

    if (assignErr) {
      console.error('[send-sales-lesson-reminder] Assignment fetch error:', assignErr);
      throw assignErr;
    }

    if (!assignments || assignments.length === 0) {
      console.log('[send-sales-lesson-reminder] No active assignments found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active assignments', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-sales-lesson-reminder] Found ${assignments.length} active assignments`);

    // Pre-fetch all lessons with their module info
    const { data: allLessons, error: lessonsErr } = await supabase
      .from('sales_experience_lessons')
      .select('id, title, day_of_week, is_staff_visible, module:sales_experience_modules!inner(week_number)')
      .order('day_of_week');

    if (lessonsErr) {
      console.error('[send-sales-lesson-reminder] Lessons fetch error:', lessonsErr);
      throw lessonsErr;
    }

    // Sort lessons chronologically: by week_number then day_of_week
    // PostgREST can't sort by nested column, so sort in JS
    const sortedLessons = (allLessons || []).sort((a: any, b: any) => {
      const offsetA = ((a.module?.week_number || 0) - 1) * 7 + (a.day_of_week - 1);
      const offsetB = ((b.module?.week_number || 0) - 1) * 7 + (b.day_of_week - 1);
      return offsetA - offsetB;
    });

    // Fetch the lesson_available email template
    const { data: template } = await supabase
      .from('sales_experience_email_templates')
      .select('subject_template, body_template')
      .eq('template_key', 'lesson_available')
      .eq('is_active', true)
      .single();

    if (!template) {
      console.error('[send-sales-lesson-reminder] lesson_available template not found or inactive');
      return new Response(
        JSON.stringify({ error: 'Email template not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { agency_id: string; status: string; lesson?: string; recipients?: number; error?: string }[] = [];

    // 2. Process each assignment
    for (const assignment of assignments as Assignment[]) {
      try {
        const timezone = assignment.timezone || 'America/New_York';
        const localHour = getLocalHour(timezone);
        const localDow = getLocalDayOfWeek(timezone); // 0=Sun..6=Sat
        const localDateStr = getLocalDateStr(timezone);

        console.log(`[send-sales-lesson-reminder] Assignment ${assignment.id}: tz=${timezone}, localHour=${localHour}, localDow=${localDow}, localDate=${localDateStr}`);

        // Gate: only send at 7 AM local
        if (!forceTest && localHour !== 7) {
          console.log(`[send-sales-lesson-reminder] Skipping ${assignment.id} — not 7 AM local`);
          results.push({ agency_id: assignment.agency_id, status: 'skipped - not 7AM' });
          continue;
        }

        // Gate: only Mon(1)/Wed(3)/Fri(5)
        if (!forceTest && ![1, 3, 5].includes(localDow)) {
          console.log(`[send-sales-lesson-reminder] Skipping ${assignment.id} — not Mon/Wed/Fri`);
          results.push({ agency_id: assignment.agency_id, status: 'skipped - not lesson day' });
          continue;
        }

        // 3. Determine which lesson unlocks today
        // start_date is a Monday. Lessons are scheduled:
        //   Week W, Day D → start_date + (W-1)*7 + (D-1) days
        //   where D is 1(Mon), 3(Wed), 5(Fri)
        const startDate = new Date(assignment.start_date + 'T00:00:00');
        const localDate = new Date(localDateStr + 'T00:00:00');
        const daysDiff = Math.round((localDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff < 0) {
          console.log(`[send-sales-lesson-reminder] Skipping ${assignment.id} — hasn't started yet (daysDiff=${daysDiff})`);
          results.push({ agency_id: assignment.agency_id, status: 'skipped - not started' });
          continue;
        }

        // Find the lesson that matches today
        let todaysLesson: Lesson | null = null;
        for (const lesson of sortedLessons as any[]) {
          if (!lesson.is_staff_visible) continue;
          const weekNum = lesson.module?.week_number;
          if (!weekNum) continue;
          const lessonOffset = (weekNum - 1) * 7 + (lesson.day_of_week - 1);
          if (lessonOffset === daysDiff) {
            todaysLesson = {
              id: lesson.id,
              title: lesson.title,
              day_of_week: lesson.day_of_week,
              module: { week_number: weekNum },
            };
            break;
          }
        }

        if (!todaysLesson) {
          // If forceTest, pick the next upcoming lesson instead
          if (forceTest) {
            for (const lesson of sortedLessons as any[]) {
              if (!lesson.is_staff_visible) continue;
              const weekNum = lesson.module?.week_number;
              if (!weekNum) continue;
              const lessonOffset = (weekNum - 1) * 7 + (lesson.day_of_week - 1);
              if (lessonOffset >= daysDiff) {
                todaysLesson = {
                  id: lesson.id,
                  title: lesson.title,
                  day_of_week: lesson.day_of_week,
                  module: { week_number: weekNum },
                };
                break;
              }
            }
          }
          if (!todaysLesson) {
            console.log(`[send-sales-lesson-reminder] Skipping ${assignment.id} — no lesson matches today (daysDiff=${daysDiff})`);
            results.push({ agency_id: assignment.agency_id, status: 'skipped - no lesson today' });
            continue;
          }
        }

        console.log(`[send-sales-lesson-reminder] Lesson for ${assignment.id}: "${todaysLesson.title}" (Week ${todaysLesson.module.week_number}, ${getDayName(todaysLesson.day_of_week)})`);

        // 4. Gather ALL agency recipients (deduplicated by email)
        const recipientMap = new Map<string, Recipient>();

        if (forceTest && testEmail) {
          recipientMap.set(testEmail, { email: testEmail, name: 'Test User', type: 'staff' });
        } else {
          // Staff users (active, with valid email, scoped to this agency)
          const { data: staffUsers } = await supabase
            .from('staff_users')
            .select('id, display_name, team_member:team_members!inner(email, name, agency_id)')
            .eq('is_active', true)
            .eq('team_members.agency_id', assignment.agency_id);

          for (const su of (staffUsers || []) as any[]) {
            const email = su.team_member?.email;
            if (!email || email.endsWith('@staff.placeholder')) continue;
            recipientMap.set(email.toLowerCase(), {
              email,
              name: su.display_name || su.team_member?.name || 'Team Member',
              type: 'staff',
            });
          }

          // Agency owners
          const { data: owners } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('agency_id', assignment.agency_id)
            .eq('role', 'agency_owner')
            .eq('is_active', true)
            .not('email', 'is', null);

          for (const o of (owners || []) as any[]) {
            if (!o.email) continue;
            recipientMap.set(o.email.toLowerCase(), {
              email: o.email,
              name: o.full_name || 'Agency Owner',
              type: 'owner',
            });
          }

          // Key employees (only those with active profiles)
          const { data: keyEmps } = await supabase
            .from('key_employees')
            .select('id, profile:profiles!inner(email, full_name, is_active)')
            .eq('agency_id', assignment.agency_id);

          for (const ke of (keyEmps || []) as any[]) {
            const email = (ke as any).profile?.email;
            if (!email || (ke as any).profile?.is_active === false) continue;
            recipientMap.set(email.toLowerCase(), {
              email,
              name: (ke as any).profile?.full_name || 'Key Employee',
              type: 'key_employee',
            });
          }

          // Managers (team_members with role = 'Manager')
          const { data: managers } = await supabase
            .from('team_members')
            .select('email, name')
            .eq('agency_id', assignment.agency_id)
            .eq('role', 'Manager')
            .not('email', 'is', null);

          for (const m of (managers || []) as any[]) {
            if (!m.email || m.email.endsWith('@staff.placeholder')) continue;
            if (!recipientMap.has(m.email.toLowerCase())) {
              recipientMap.set(m.email.toLowerCase(), {
                email: m.email,
                name: m.name || 'Manager',
                type: 'manager',
              });
            }
          }
        }

        const recipients = Array.from(recipientMap.values());

        if (recipients.length === 0) {
          console.log(`[send-sales-lesson-reminder] No recipients for assignment ${assignment.id}`);
          results.push({ agency_id: assignment.agency_id, status: 'skipped - no recipients' });
          continue;
        }

        console.log(`[send-sales-lesson-reminder] ${recipients.length} recipients for assignment ${assignment.id}`);

        // 5. Queue emails (dedup index prevents re-inserts)
        const dayName = getDayName(todaysLesson.day_of_week);
        const weekNum = todaysLesson.module.week_number;
        let queued = 0;

        for (const recipient of recipients) {
          // Build lesson URL based on recipient type
          const lessonUrl = recipient.type === 'staff'
            ? `https://app.agencybrain.io/staff/sales-training/week/${weekNum}`
            : `https://app.agencybrain.io/sales-experience/week/${weekNum}`;

          const subject = template.subject_template.replace('{{lesson_title}}', todaysLesson.title);

          const variables = {
            staff_name: recipient.name,
            lesson_title: todaysLesson.title,
            week_number: String(weekNum),
            day_name: dayName,
            lesson_url: lessonUrl,
          };

          const { error: insertErr } = await supabase
            .from('sales_experience_email_queue')
            .insert({
              assignment_id: assignment.id,
              lesson_id: todaysLesson.id,
              template_key: 'lesson_available',
              recipient_email: recipient.email,
              recipient_name: recipient.name,
              recipient_type: recipient.type,
              scheduled_for: new Date().toISOString(), // Send now — we're already at 7 AM local
              email_subject: subject,
              variables_json: variables,
              status: 'pending',
            });

          if (insertErr) {
            // Unique constraint violation = already queued (expected for dedup)
            if (insertErr.code === '23505') {
              console.log(`[send-sales-lesson-reminder] Already queued: ${recipient.email} for lesson ${todaysLesson.id}`);
            } else {
              console.error(`[send-sales-lesson-reminder] Queue insert error for ${recipient.email}:`, insertErr);
            }
          } else {
            queued++;
          }
        }

        console.log(`[send-sales-lesson-reminder] Queued ${queued} new emails for assignment ${assignment.id}`);
        results.push({
          agency_id: assignment.agency_id,
          status: 'queued',
          lesson: todaysLesson.title,
          recipients: queued,
        });

      } catch (assignmentErr) {
        console.error(`[send-sales-lesson-reminder] Error processing assignment ${assignment.id}:`, assignmentErr);
        results.push({
          agency_id: assignment.agency_id,
          status: 'error',
          error: assignmentErr instanceof Error ? assignmentErr.message : 'Unknown error',
        });
      }
    }

    // 6. Trigger the queue processor to send the emails we just queued
    const queuedCount = results.filter(r => r.status === 'queued').reduce((sum, r) => sum + (r.recipients || 0), 0);
    if (queuedCount > 0) {
      console.log(`[send-sales-lesson-reminder] Triggering process-sales-experience-emails for ${queuedCount} queued emails`);
      try {
        const processResp = await fetch(`${supabaseUrl}/functions/v1/process-sales-experience-emails`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        });
        const processResult = await processResp.json();
        console.log('[send-sales-lesson-reminder] Processor result:', JSON.stringify(processResult));
      } catch (procErr) {
        console.error('[send-sales-lesson-reminder] Failed to trigger processor:', procErr);
        // Non-fatal — emails stay in queue and processor runs on its own schedule too
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[send-sales-lesson-reminder] Complete in ${duration}ms`, JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, results, duration_ms: duration }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-sales-lesson-reminder] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to process lesson reminders' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
