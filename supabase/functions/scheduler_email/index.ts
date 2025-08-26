// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailSG } from "../_shared/sendgrid.ts";

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

serve(async (req) => {
  try {
    if (req.method !== "POST") return json(405, { code: "METHOD" });
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Flush any unsent email_outbox rows where scheduled_at <= now()
    const now = new Date().toISOString();
    const { data: queue } = await supa
      .from("email_outbox")
      .select("id, agency_id, kind, to_email, cc_owner, subject, body_text, body_html, meta, scheduled_at, sent_at")
      .is("sent_at", null)
      .lte("scheduled_at", now)
      .limit(200);

    for (const row of queue || []) {
      // add CC owner if requested
      let cc: string[] = [];
      if (row.cc_owner) {
        const { data: ownerUser } = await supa
          .from("profiles")
          .select("id")
          .eq("agency_id", row.agency_id)
          .order("created_at")
          .limit(1)
          .maybeSingle();
        
        if (ownerUser?.id) {
          // Get email from auth.users - need to use a different approach
          // For now, we'll skip CC to owner in this implementation
          // In production, you'd store owner email in profiles or agencies table
        }
      }

      try {
        await sendEmailSG({ 
          to: row.to_email, 
          subject: row.subject, 
          text: row.body_text, 
          html: row.body_html ?? undefined, 
          cc 
        });
        await supa.from("email_outbox").update({ sent_at: new Date().toISOString() }).eq("id", row.id);
      } catch (e) {
        await supa.from("email_outbox").update({ error: String(e).slice(0, 1000) }).eq("id", row.id);
      }
    }

    // 2) Generate new reminder events (same-day + next-day) for forms needing reminders
    const { data: forms } = await supa
      .from("form_templates")
      .select("id, agency_id, settings_json, status")
      .eq("status", "published");

    for (const f of forms || []) {
      const s = f.settings_json || {};
      const rem = s.reminders || {};
      const role = s.role || 'Sales';
      
      const { data: ag } = await supa
        .from("agencies")
        .select("timezone, reminder_times_json")
        .eq("id", f.agency_id)
        .maybeSingle();
      
      const tz = ag?.timezone || "America/New_York";
      
      // Parse reminder times from agency settings (format: [{"time":"16:45","type":"same_day"}])
      const reminderTimes = ag?.reminder_times_json || [];
      const sameDayTimes: string[] = reminderTimes
        .filter((r: any) => r.type === 'same_day')
        .map((r: any) => r.time);
      const nextDayTimes: string[] = reminderTimes
        .filter((r: any) => r.type === 'next_day')
        .map((r: any) => r.time);

      // resolve agency date "today" and "yesterday" using DB for tz correctness
      const { data: tzz } = await supa.rpc("get_agency_dates_now", { p_agency_id: f.agency_id });
      const today = tzz?.today as string;
      const yesterday = tzz?.yesterday as string;

      // team members by role
      const { data: team } = await supa
        .from("team_members")
        .select("id,name,email,role")
        .eq("agency_id", f.agency_id)
        .eq("role", role);
      
      if (!team?.length) continue;

      // SAME-DAY reminders: schedule if now is within the minute of HH:MM and no final submission for that Work Date
      for (const hhmm of sameDayTimes) {
        const { data: nowFlag } = await supa.rpc("is_now_agency_time", { 
          p_agency_id: f.agency_id, 
          p_hhmm: hhmm 
        });
        if (!nowFlag?.ok) continue;

        for (const tm of team) {
          // suppression: final exists for today?
          const { data: sub } = await supa
            .from("submissions")
            .select("id")
            .eq("form_template_id", f.id)
            .eq("team_member_id", tm.id)
            .eq("final", true)
            .or(`work_date.eq.${today},and(work_date.is.null,submission_date.eq.${today})`)
            .limit(1);
          
          if (sub && sub.length) continue;

          // queue a reminder if not already queued for this slot
          const subject = `Reminder: submit ${role} scorecard for ${today}`;
          const text = `Hi ${tm.name || "Rep"},\n\nPlease submit your ${role} scorecard for ${today}.\nLink: (provided in your portal)\n\n— AgencyBrain`;
          
          const { error } = await supa.from("email_outbox").upsert({
            agency_id: f.agency_id,
            kind: 'reminder_same_day',
            to_email: tm.email,
            cc_owner: true,
            subject, 
            body_text: text,
            meta: { teamMemberId: tm.id, workDate: today, formId: f.id, hhmm },
            scheduled_at: new Date().toISOString()
          });
          
          if (error) console.log("Error upserting same-day reminder:", error);
        }
      }

      // NEXT-DAY reminders for yesterday
      for (const hhmm of nextDayTimes) {
        const { data: nowFlag } = await supa.rpc("is_now_agency_time", { 
          p_agency_id: f.agency_id, 
          p_hhmm: hhmm 
        });
        if (!nowFlag?.ok) continue;

        for (const tm of team) {
          const { data: sub } = await supa
            .from("submissions")
            .select("id")
            .eq("form_template_id", f.id)
            .eq("team_member_id", tm.id)
            .eq("final", true)
            .or(`work_date.eq.${yesterday},and(work_date.is.null,submission_date.eq.${yesterday})`)
            .limit(1);
          
          if (sub && sub.length) continue;

          const subject = `Reminder: yesterday's ${role} scorecard (${yesterday}) is due`;
          const text = `Hi ${tm.name || "Rep"},\n\nPlease submit your ${role} scorecard for ${yesterday}.\n\n— AgencyBrain`;
          
          const { error } = await supa.from("email_outbox").upsert({
            agency_id: f.agency_id,
            kind: 'reminder_next_day',
            to_email: tm.email,
            cc_owner: true,
            subject, 
            body_text: text,
            meta: { teamMemberId: tm.id, workDate: yesterday, formId: f.id, hhmm },
            scheduled_at: new Date().toISOString()
          });
          
          if (error) console.log("Error upserting next-day reminder:", error);
        }
      }
    }

    // 3) Owner rollup for prior day at agency-defined rollup time
    const { data: agencies } = await supa.from("agencies").select("id, timezone, owner_rollup_time");
    for (const ag of agencies || []) {
      const { data: rollTimeFlag } = await supa.rpc("is_now_agency_time", { 
        p_agency_id: ag.id, 
        p_hhmm: ag.owner_rollup_time || "08:00" 
      });
      if (!rollTimeFlag?.ok) continue;

      // Determine yesterday in agency tz
      const { data: tzz } = await supa.rpc("get_agency_dates_now", { p_agency_id: ag.id });
      const yesterday = tzz?.yesterday as string;

      // Collect summary for each published form by role
      const { data: forms } = await supa
        .from("form_templates")
        .select("id, settings_json, status")
        .eq("agency_id", ag.id)
        .eq("status", "published");
      
      if (!forms?.length) continue;

      // Simple rollup: counts of submitted vs missing by role
      let body = `Daily rollup for ${yesterday}\n\n`;
      for (const f of forms) {
        const role = f.settings_json?.role || 'Sales';
        const { data: team } = await supa
          .from("team_members")
          .select("id,name,email")
          .eq("agency_id", ag.id)
          .eq("role", role);
        
        const total = team?.length || 0;
        let submitted = 0;
        for (const tm of team || []) {
          const { data: sub } = await supa
            .from("submissions")
            .select("id")
            .eq("form_template_id", f.id)
            .eq("team_member_id", tm.id)
            .eq("final", true)
            .or(`work_date.eq.${yesterday},and(work_date.is.null,submission_date.eq.${yesterday})`)
            .limit(1);
          if (sub && sub.length) submitted++;
        }
        body += `${role}: ${submitted}/${total} submitted\n`;
      }
      body += `\n— AgencyBrain`;

      // Determine owner email (profiles table)
      const { data: ownerUser } = await supa
        .from("profiles")
        .select("id")
        .eq("agency_id", ag.id)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      
      if (ownerUser?.id) {
        // For now, skip owner rollup as we need email from auth.users
        // In production, store owner email in profiles or agencies table
        console.log(`Would send owner rollup to agency ${ag.id} for ${yesterday}`);
      }
    }

    return json(200, { ok: true });
  } catch (e) {
    console.error("Scheduler error:", e);
    return json(500, { code: "SERVER_ERROR", detail: String(e) });
  }
});