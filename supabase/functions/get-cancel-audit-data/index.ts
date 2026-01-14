import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session-token",
};

const CONTACT_ACTIVITY_TYPES = [
  "attempted_call",
  "voicemail_left",
  "text_sent",
  "email_sent",
  "spoke_with_client",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create service role client (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get staff session token from header
    const sessionToken = req.headers.get("x-staff-session-token");
    
    if (!sessionToken) {
      console.error("[get-cancel-audit-data] Missing staff session token");
      return new Response(
        JSON.stringify({ error: "Missing staff session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Verify staff session
    const { data: session, error: sessionError } = await supabase
      .from("staff_sessions")
      .select("staff_user_id, expires_at, is_valid")
      .eq("session_token", sessionToken)
      .eq("is_valid", true)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionError || !session) {
      console.error("[get-cancel-audit-data] Invalid or expired session:", sessionError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get staff user details (agency_id, team_member_id)
    const { data: staffUser, error: staffError } = await supabase
      .from("staff_users")
      .select("id, agency_id, team_member_id")
      .eq("id", session.staff_user_id)
      .single();

    if (staffError || !staffUser) {
      console.error("[get-cancel-audit-data] Staff user not found:", staffError);
      return new Response(
        JSON.stringify({ error: "Staff user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agencyId = staffUser.agency_id;
    const teamMemberId = staffUser.team_member_id;

    // Get the operation type from request body
    const body = await req.json();
    const { operation, params } = body;

    console.log(`[get-cancel-audit-data] Operation: ${operation}, Agency: ${agencyId}`);

    let result;

    switch (operation) {
      case "get_records":
        result = await getRecords(supabase, agencyId, params);
        break;
      case "get_stats":
        result = await getStats(supabase, agencyId, params);
        break;
      case "get_counts":
        result = await getCounts(supabase, agencyId);
        break;
      case "get_activities":
        result = await getActivities(supabase, agencyId, params);
        break;
      case "log_activity":
        result = await logActivity(supabase, agencyId, teamMemberId, params);
        break;
      case "update_status":
        result = await updateStatus(supabase, agencyId, params);
        break;
      case "upload_records":
        result = await uploadRecords(supabase, agencyId, teamMemberId, params);
        break;
      case "get_hero_stats":
        result = await getHeroStats(supabase, agencyId, params);
        break;
      default:
        console.error(`[get-cancel-audit-data] Unknown operation: ${operation}`);
        return new Response(
          JSON.stringify({ error: "Unknown operation" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[get-cancel-audit-data] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Get records with filtering
async function getRecords(supabase: any, agencyId: string, params: any) {
  const { viewMode, reportTypeFilter, searchQuery, sortBy } = params || {};

  let query = supabase
    .from("cancel_audit_records")
    .select("*, cancel_audit_activities(id, created_at)")
    .eq("agency_id", agencyId);

  if (viewMode === "needs_attention") {
    query = query.eq("is_active", true).in("status", ["new", "in_progress"]);
  }

  if (reportTypeFilter && reportTypeFilter !== "all") {
    query = query.eq("report_type", reportTypeFilter);
  }

  if (searchQuery?.trim()) {
    const search = searchQuery.trim();
    query = query.or(
      `insured_first_name.ilike.%${search}%,insured_last_name.ilike.%${search}%,policy_number.ilike.%${search}%`
    );
  }

  if (sortBy === "urgency") {
    query = query
      .order("pending_cancel_date", { ascending: true, nullsFirst: false })
      .order("cancel_date", { ascending: true, nullsFirst: false });
  } else if (sortBy === "name") {
    query = query
      .order("insured_last_name", { ascending: true })
      .order("insured_first_name", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  // Calculate household policy counts
  const householdCounts = new Map<string, number>();
  (data || []).forEach((r: any) => {
    const count = householdCounts.get(r.household_key) || 0;
    householdCounts.set(r.household_key, count + 1);
  });

  // Transform data to include activity count and household policy count
  return (data || []).map((record: any) => {
    const activities = record.cancel_audit_activities || [];
    const sortedActivities = [...activities].sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const { cancel_audit_activities, ...cleanRecord } = record;

    return {
      ...cleanRecord,
      activity_count: activities.length,
      last_activity_at: sortedActivities[0]?.created_at || null,
      household_policy_count: householdCounts.get(record.household_key) || 1,
      is_active: record.is_active,
    };
  });
}

// Get weekly stats
async function getStats(supabase: any, agencyId: string, params: any) {
  const { weekOffset, weekStart: clientWeekStart, weekEnd: clientWeekEnd } = params || { weekOffset: 0 };

  let weekStartStr: string;
  let weekEndStr: string;
  let weekStartISO: string;
  let weekEndISO: string;

  // Use client-provided dates if available (timezone-safe)
  if (clientWeekStart && clientWeekEnd) {
    weekStartStr = clientWeekStart;
    weekEndStr = clientWeekEnd;
    weekStartISO = `${clientWeekStart}T00:00:00.000Z`;
    weekEndISO = `${clientWeekEnd}T23:59:59.999Z`;
    console.log(`[getStats] Using client dates: ${weekStartStr} to ${weekEndStr}`);
  } else {
    // Fallback to server-side calculation (UTC)
    const today = new Date();
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    weekStartStr = weekStart.toISOString().split("T")[0];
    weekEndStr = weekEnd.toISOString().split("T")[0];
    weekStartISO = weekStart.toISOString();
    weekEndISO = weekEnd.toISOString();
    console.log(`[getStats] Using server dates (fallback): ${weekStartStr} to ${weekEndStr}`);
  }

  // Fetch all records for the agency
  const { data: records, error: recordsError } = await supabase
    .from("cancel_audit_records")
    .select("id, household_key, report_type, premium_cents, status, is_active")
    .eq("agency_id", agencyId);

  if (recordsError) throw recordsError;

  // Filter for active records only for actionable stats
  const activeRecords = records?.filter((r: any) => r.is_active) || [];
  const needsAttentionRecords = activeRecords.filter((r: any) =>
    ["new", "in_progress"].includes(r.status)
  );

  // Fetch activities for this week
  const { data: activities, error: activitiesError } = await supabase
    .from("cancel_audit_activities")
    .select("id, activity_type, household_key, record_id, user_display_name, created_at")
    .eq("agency_id", agencyId)
    .gte("created_at", weekStartISO)
    .lte("created_at", weekEndISO);

  if (activitiesError) throw activitiesError;

  // Calculate stats
  const totalRecords = records?.length || 0;
  const activeCount = activeRecords.length;
  const needsAttentionCount = needsAttentionRecords.length;
  const pendingCancelCount = needsAttentionRecords.filter((r: any) => r.report_type === "pending_cancel").length;
  const cancellationCount = needsAttentionRecords.filter((r: any) => r.report_type === "cancellation").length;

  // Contact activities
  const contactActivities = activities?.filter((a: any) =>
    CONTACT_ACTIVITY_TYPES.includes(a.activity_type)
  ) || [];

  const totalContacts = contactActivities.length;
  const uniqueHouseholdsContacted = new Set(contactActivities.map((a: any) => a.household_key)).size;
  const totalUniqueHouseholds = new Set(needsAttentionRecords.map((r: any) => r.household_key)).size;

  // Wins
  const paymentsMade = activities?.filter((a: any) => a.activity_type === "payment_made").length || 0;
  const paymentsPromised = activities?.filter((a: any) => a.activity_type === "payment_promised").length || 0;

  // Premium recovered
  const recordsWithPayment = new Set(
    activities?.filter((a: any) => a.activity_type === "payment_made").map((a: any) => a.record_id) || []
  );
  const premiumRecovered = records
    ?.filter((r: any) => recordsWithPayment.has(r.id))
    .reduce((sum: number, r: any) => sum + (r.premium_cents || 0), 0) || 0;

  // Coverage percent
  const coveragePercent = totalUniqueHouseholds > 0
    ? Math.round((uniqueHouseholdsContacted / totalUniqueHouseholds) * 100)
    : 0;

  // By team member
  const teamMemberMap = new Map<string, { contacts: number; paymentsMade: number }>();
  activities?.forEach((activity: any) => {
    const name = activity.user_display_name;
    if (!teamMemberMap.has(name)) {
      teamMemberMap.set(name, { contacts: 0, paymentsMade: 0 });
    }
    const stats = teamMemberMap.get(name)!;
    if (CONTACT_ACTIVITY_TYPES.includes(activity.activity_type)) {
      stats.contacts++;
    }
    if (activity.activity_type === "payment_made") {
      stats.paymentsMade++;
    }
  });

  const byTeamMember = Array.from(teamMemberMap.entries())
    .map(([name, stats]: [string, any]) => ({ name, ...stats }))
    .sort((a, b) => b.contacts - a.contacts);

  return {
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    totalRecords,
    activeRecords: activeCount,
    needsAttentionCount,
    pendingCancelCount,
    cancellationCount,
    totalContacts,
    uniqueHouseholdsContacted,
    paymentsMade,
    paymentsPromised,
    premiumRecovered,
    coveragePercent,
    byTeamMember,
  };
}

// Get counts for view toggle
async function getCounts(supabase: any, agencyId: string) {
  const { count: needsAttention } = await supabase
    .from("cancel_audit_records")
    .select("*", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("is_active", true)
    .in("status", ["new", "in_progress"]);

  const { count: all } = await supabase
    .from("cancel_audit_records")
    .select("*", { count: "exact", head: true })
    .eq("agency_id", agencyId);

  const { count: pendingCancel } = await supabase
    .from("cancel_audit_records")
    .select("*", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("is_active", true)
    .eq("report_type", "pending_cancel")
    .in("status", ["new", "in_progress"]);

  const { count: cancellation } = await supabase
    .from("cancel_audit_records")
    .select("*", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("is_active", true)
    .eq("report_type", "cancellation")
    .in("status", ["new", "in_progress"]);

  return {
    needsAttention: needsAttention || 0,
    all: all || 0,
    activeByType: {
      pending_cancel: pendingCancel || 0,
      cancellation: cancellation || 0,
    },
  };
}

// Get activities for a record or household
async function getActivities(supabase: any, agencyId: string, params: any) {
  const { householdKey, recordId } = params || {};

  let query = supabase
    .from("cancel_audit_activities")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (householdKey) {
    query = query.eq("household_key", householdKey);
  } else if (recordId) {
    query = query.eq("record_id", recordId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Log an activity
async function logActivity(supabase: any, agencyId: string, teamMemberId: string, params: any) {
  const { recordId, householdKey, activityType, notes, userDisplayName } = params;

  // Get team member name if not provided
  let displayName = userDisplayName;
  if (!displayName) {
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("name")
      .eq("id", teamMemberId)
      .single();
    displayName = teamMember?.name || "Staff Member";
  }

  // Insert activity
  const { data, error } = await supabase
    .from("cancel_audit_activities")
    .insert({
      agency_id: agencyId,
      record_id: recordId,
      household_key: householdKey,
      activity_type: activityType,
      notes: notes || null,
      staff_member_id: teamMemberId,
      user_display_name: displayName,
    })
    .select()
    .single();

  if (error) throw error;

  // Update status based on activity type
  if (activityType === "payment_made") {
    await supabase
      .from("cancel_audit_records")
      .update({ status: "resolved", updated_at: new Date().toISOString() })
      .eq("agency_id", agencyId)
      .eq("household_key", householdKey);
  } else if (activityType === "payment_promised") {
    await supabase
      .from("cancel_audit_records")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("agency_id", agencyId)
      .eq("household_key", householdKey)
      .in("status", ["new"]);
  } else if (CONTACT_ACTIVITY_TYPES.includes(activityType)) {
    await supabase
      .from("cancel_audit_records")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("agency_id", agencyId)
      .eq("household_key", householdKey)
      .eq("status", "new");
  }

  return data;
}

// Update record status
async function updateStatus(supabase: any, agencyId: string, params: any) {
  const { recordId, status, cleanupActivities } = params;

  // If reverting from resolved, delete payment_made activities
  if (status !== 'resolved') {
    // Get current record status first
    const { data: currentRecord } = await supabase
      .from("cancel_audit_records")
      .select("status")
      .eq("id", recordId)
      .eq("agency_id", agencyId)
      .single();

    if (currentRecord?.status === 'resolved') {
      // Delete payment_made activities for this record
      const { error: deleteError } = await supabase
        .from("cancel_audit_activities")
        .delete()
        .eq("record_id", recordId)
        .eq("activity_type", "payment_made");
      
      if (deleteError) {
        console.error("[updateStatus] Failed to delete payment_made activities:", deleteError);
      } else {
        console.log("[updateStatus] Deleted payment_made activities for record:", recordId);
      }
    }
  }

  const { data, error } = await supabase
    .from("cancel_audit_records")
    .update({ status })
    .eq("id", recordId)
    .eq("agency_id", agencyId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Upload records (for staff users)
async function uploadRecords(supabase: any, agencyId: string, teamMemberId: string, params: any) {
  const { records, reportType, fileName, displayName } = params;
  const BATCH_SIZE = 50;
  
  console.log(`[upload_records] Starting upload: ${records.length} records, type: ${reportType}`);

  const errors: string[] = [];
  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsDeactivated = 0;

  // 1. Create upload record
  const { data: uploadData, error: uploadError } = await supabase
    .from("cancel_audit_uploads")
    .insert({
      agency_id: agencyId,
      uploaded_by_staff_id: teamMemberId,
      uploaded_by_name: displayName || "Staff Member",
      report_type: reportType,
      file_name: fileName,
      records_processed: records.length,
      records_created: 0,
      records_updated: 0,
    })
    .select("id")
    .single();

  if (uploadError) {
    console.error("[upload_records] Failed to create upload record:", uploadError);
    throw new Error(`Failed to create upload record: ${uploadError.message}`);
  }

  const uploadId = uploadData.id;
  console.log(`[upload_records] Created upload record: ${uploadId}`);

  // 2. Deactivate all existing records of this report type
  const { data: deactivatedData, error: deactivateError } = await supabase
    .from("cancel_audit_records")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("agency_id", agencyId)
    .eq("report_type", reportType)
    .eq("is_active", true)
    .select("id");

  if (deactivateError) {
    console.error("[upload_records] Failed to deactivate old records:", deactivateError);
    throw deactivateError;
  }

  recordsDeactivated = deactivatedData?.length || 0;
  console.log(`[upload_records] Deactivated ${recordsDeactivated} old records`);

  // 3. Process records in batches using RPC function
  const totalBatches = Math.ceil(records.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const start = batchIdx * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, records.length);
    const batch = records.slice(start, end);

    for (const record of batch) {
      const { data, error: rpcError } = await supabase.rpc("upsert_cancel_audit_record", {
        p_agency_id: agencyId,
        p_policy_number: record.policy_number,
        p_household_key: record.household_key,
        p_insured_first_name: record.insured_first_name,
        p_insured_last_name: record.insured_last_name,
        p_insured_email: record.insured_email,
        p_insured_phone: record.insured_phone,
        p_insured_phone_alt: record.insured_phone_alt,
        p_agent_number: record.agent_number,
        p_product_name: record.product_name,
        p_premium_cents: record.premium_cents,
        p_no_of_items: record.no_of_items,
        p_account_type: record.account_type,
        p_report_type: record.report_type,
        p_amount_due_cents: record.amount_due_cents,
        p_cancel_date: record.cancel_date,
        p_renewal_effective_date: record.renewal_effective_date,
        p_pending_cancel_date: record.pending_cancel_date,
        p_last_upload_id: uploadId,
      });

      if (rpcError) {
        errors.push(`Policy ${record.policy_number}: ${rpcError.message}`);
      } else if (data && data[0]) {
        if (data[0].was_created) {
          recordsCreated++;
        } else {
          recordsUpdated++;
        }
      }
    }
  }

  console.log(`[upload_records] Processed: created=${recordsCreated}, updated=${recordsUpdated}, errors=${errors.length}`);

  // 4. Update upload record with final counts
  const { error: updateError } = await supabase
    .from("cancel_audit_uploads")
    .update({
      records_created: recordsCreated,
      records_updated: recordsUpdated,
    })
    .eq("id", uploadId);

  if (updateError) {
    console.error("[upload_records] Failed to update upload record counts:", updateError);
  }

  return {
    success: errors.length === 0,
    uploadId,
    recordsProcessed: records.length,
    recordsCreated,
    recordsUpdated,
    recordsDeactivated,
    errors,
  };
}

// Get hero stats for dashboard
async function getHeroStats(supabase: any, agencyId: string, params: any) {
  const { currentWeekStart, currentWeekEnd, priorWeekStart, priorWeekEnd } = params;

  // Fetch ALL active records for working list and at risk
  const { data: allRecords, error: allError } = await supabase
    .from("cancel_audit_records")
    .select("id, status, premium_cents")
    .eq("agency_id", agencyId)
    .eq("is_active", true);

  if (allError) {
    console.error("[getHeroStats] Error fetching all records:", allError);
    throw allError;
  }

  // Calculate working list (records not resolved or lost)
  const workingList = (allRecords || []).filter((r: any) => r.status !== 'resolved' && r.status !== 'lost');
  const workingListCount = workingList.length;
  const atRiskPremium = workingList.reduce((sum: number, r: any) => sum + (r.premium_cents || 0), 0);

  // Fetch current week records for week-over-week comparison
  const { data: currentWeekRecords } = await supabase
    .from("cancel_audit_records")
    .select("id, status, premium_cents")
    .eq("agency_id", agencyId)
    .eq("is_active", true)
    .gte("created_at", `${currentWeekStart}T00:00:00.000Z`)
    .lte("created_at", `${currentWeekEnd}T23:59:59.999Z`);

  // Fetch prior week records
  const { data: priorWeekRecords } = await supabase
    .from("cancel_audit_records")
    .select("id, status, premium_cents")
    .eq("agency_id", agencyId)
    .eq("is_active", true)
    .gte("created_at", `${priorWeekStart}T00:00:00.000Z`)
    .lte("created_at", `${priorWeekEnd}T23:59:59.999Z`);

  // Fetch current week payment_made activities for saved calculation
  const { data: currentWeekActivities } = await supabase
    .from("cancel_audit_activities")
    .select("id, record_id")
    .eq("agency_id", agencyId)
    .eq("activity_type", "payment_made")
    .gte("created_at", `${currentWeekStart}T00:00:00.000Z`)
    .lte("created_at", `${currentWeekEnd}T23:59:59.999Z`);

  // Fetch prior week payment_made activities
  const { data: priorWeekActivities } = await supabase
    .from("cancel_audit_activities")
    .select("id, record_id")
    .eq("agency_id", agencyId)
    .eq("activity_type", "payment_made")
    .gte("created_at", `${priorWeekStart}T00:00:00.000Z`)
    .lte("created_at", `${priorWeekEnd}T23:59:59.999Z`);

  // Calculate saved premium for current week
  let savedPremium = 0;
  if (currentWeekActivities && currentWeekActivities.length > 0) {
    const recordIds = [...new Set(currentWeekActivities.map((a: any) => a.record_id))];
    const { data: savedRecords } = await supabase
      .from("cancel_audit_records")
      .select("id, premium_cents")
      .in("id", recordIds);
    savedPremium = (savedRecords || []).reduce((sum: number, r: any) => sum + (r.premium_cents || 0), 0);
  }

  // Calculate saved premium for prior week
  let priorSavedPremium = 0;
  if (priorWeekActivities && priorWeekActivities.length > 0) {
    const recordIds = [...new Set(priorWeekActivities.map((a: any) => a.record_id))];
    const { data: savedRecords } = await supabase
      .from("cancel_audit_records")
      .select("id, premium_cents")
      .in("id", recordIds);
    priorSavedPremium = (savedRecords || []).reduce((sum: number, r: any) => sum + (r.premium_cents || 0), 0);
  }

  // Calculate week-over-week changes
  const calcChange = (current: number, prior: number) => {
    if (prior === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prior) / prior) * 100);
  };

  const currentCount = currentWeekRecords?.length || 0;
  const priorCount = priorWeekRecords?.length || 0;

  const currentAtRisk = (currentWeekRecords || [])
    .filter((r: any) => r.status !== 'resolved' && r.status !== 'lost')
    .reduce((sum: number, r: any) => sum + (r.premium_cents || 0), 0);
  const priorAtRisk = (priorWeekRecords || [])
    .filter((r: any) => r.status !== 'resolved' && r.status !== 'lost')
    .reduce((sum: number, r: any) => sum + (r.premium_cents || 0), 0);

  return {
    workingListCount,
    atRiskPremium,
    savedPremium,
    workingListChange: calcChange(currentCount, priorCount),
    atRiskChange: calcChange(currentAtRisk, priorAtRisk),
    savedChange: calcChange(savedPremium, priorSavedPremium),
  };
}
