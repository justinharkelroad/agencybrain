import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify staff session
    const verified = await verifyRequest(req);
    if (isVerifyError(verified)) {
      return new Response(JSON.stringify({ error: verified.error }), {
        status: verified.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agencyId = verified.agencyId;
    if (!agencyId) {
      return new Response(JSON.stringify({ error: "No agency ID found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { operation, params } = await req.json();

    // Create admin client to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let result: any;

    switch (operation) {
      case "get_settings": {
        const { data } = await supabase
          .from("winback_settings")
          .select("contact_days_before")
          .eq("agency_id", agencyId)
          .maybeSingle();

        result = { contact_days_before: data?.contact_days_before ?? 45 };
        break;
      }

      case "save_settings": {
        const { contact_days_before } = params;
        const { error } = await supabase
          .from("winback_settings")
          .upsert({
            agency_id: agencyId,
            contact_days_before,
          }, { onConflict: "agency_id" });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "list_team_members": {
        const { data, error } = await supabase
          .from("team_members")
          .select("id, name, email")
          .eq("agency_id", agencyId)
          .eq("status", "active")
          .order("name");

        if (error) throw error;
        result = { members: data || [] };
        break;
      }

      case "get_stats": {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + mondayOffset);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const [totalRes, untouchedRes, inProgressRes, wonBackRes, dismissedRes, teedUpRes] =
          await Promise.all([
            supabase
              .from("winback_households")
              .select("id", { count: "exact", head: true })
              .eq("agency_id", agencyId)
              .neq("status", "dismissed"),
            supabase
              .from("winback_households")
              .select("id", { count: "exact", head: true })
              .eq("agency_id", agencyId)
              .eq("status", "untouched"),
            supabase
              .from("winback_households")
              .select("id", { count: "exact", head: true })
              .eq("agency_id", agencyId)
              .eq("status", "in_progress"),
            supabase
              .from("winback_households")
              .select("id", { count: "exact", head: true })
              .eq("agency_id", agencyId)
              .eq("status", "won_back"),
            supabase
              .from("winback_households")
              .select("id", { count: "exact", head: true })
              .eq("agency_id", agencyId)
              .eq("status", "dismissed"),
            supabase
              .from("winback_households")
              .select("id", { count: "exact", head: true })
              .eq("agency_id", agencyId)
              .neq("status", "dismissed")
              .gte("earliest_winback_date", weekStart.toISOString())
              .lte("earliest_winback_date", weekEnd.toISOString()),
          ]);

        result = {
          totalHouseholds: totalRes.count || 0,
          untouched: untouchedRes.count || 0,
          inProgress: inProgressRes.count || 0,
          wonBack: wonBackRes.count || 0,
          dismissed: dismissedRes.count || 0,
          teedUpThisWeek: teedUpRes.count || 0,
        };
        break;
      }

      case "list_households": {
        const { activeTab, search, statusFilter, dateRange, sortColumn, sortDirection, currentPage, pageSize } = params;
        
        let query = supabase
          .from("winback_households")
          .select("*", { count: "exact" })
          .eq("agency_id", agencyId);

        // Tab filter
        if (activeTab === "dismissed") {
          query = query.eq("status", "dismissed");
        } else {
          query = query.neq("status", "dismissed");
          query = query.not("earliest_winback_date", "is", null);
        }

        // Status filter
        if (statusFilter && statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }

        // Date range filter
        if (dateRange?.from) {
          query = query.gte("earliest_winback_date", dateRange.from);
        }
        if (dateRange?.to) {
          query = query.lte("earliest_winback_date", dateRange.to);
        }

        // Search filter
        if (search) {
          const searchLower = search.toLowerCase();
          query = query.or(
            `first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%,phone.ilike.%${searchLower}%,email.ilike.%${searchLower}%`
          );
        }

        // Sorting
        const sortColumnMap: Record<string, string> = {
          name: "last_name",
          policy_count: "policy_count",
          total_premium_potential_cents: "total_premium_potential_cents",
          earliest_winback_date: "earliest_winback_date",
          status: "status",
          assigned_name: "assigned_to",
        };
        query = query.order(sortColumnMap[sortColumn] || "earliest_winback_date", { ascending: sortDirection === "asc" });

        // Pagination
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        result = { households: data || [], count: count || 0 };
        break;
      }

      case "get_household_details": {
        const { householdId } = params;

        // Verify household belongs to agency
        const { data: household } = await supabase
          .from("winback_households")
          .select("id")
          .eq("id", householdId)
          .eq("agency_id", agencyId)
          .single();

        if (!household) {
          return new Response(JSON.stringify({ error: "Household not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const [policiesRes, activitiesRes] = await Promise.all([
          supabase
            .from("winback_policies")
            .select("*")
            .eq("household_id", householdId)
            .order("calculated_winback_date", { ascending: true }),
          supabase
            .from("winback_activities")
            .select("*")
            .eq("household_id", householdId)
            .order("created_at", { ascending: false }),
        ]);

        result = {
          policies: policiesRes.data || [],
          activities: activitiesRes.data || [],
        };
        break;
      }

      case "log_activity": {
        const { householdId, activityType, notes } = params;

        // Verify household belongs to agency and get contact_id for mirroring
        const { data: household } = await supabase
          .from("winback_households")
          .select("id, contact_id")
          .eq("id", householdId)
          .eq("agency_id", agencyId)
          .single();

        if (!household) {
          return new Response(JSON.stringify({ error: "Household not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get team member name
        let userName = "Unknown";
        if (verified.staffMemberId) {
          const { data: member } = await supabase
            .from("team_members")
            .select("name")
            .eq("id", verified.staffMemberId)
            .single();
          if (member) userName = member.name;
        }

        const { error } = await supabase
          .from("winback_activities")
          .insert({
            household_id: householdId,
            agency_id: agencyId,
            activity_type: activityType,
            notes: notes || null,
            created_by_team_member_id: verified.staffMemberId || null,
            created_by_name: userName,
          });

        if (error) throw error;

        // Mirror to contact_activities for "Last Activity" display
        if (household.contact_id) {
          try {
            await supabase.rpc("insert_contact_activity", {
              p_contact_id: household.contact_id,
              p_agency_id: agencyId,
              p_source_module: "winback",
              p_activity_type: activityType,
              p_activity_subtype: null,
              p_source_record_id: householdId,
              p_notes: `Winback: ${activityType}${notes ? ` - ${notes}` : ""}`,
              p_created_by_display_name: userName,
            });
          } catch (mirrorError) {
            console.error("[log_activity] contact_activities mirror error:", mirrorError);
            // Don't fail - this is for display only
          }
        }

        result = { success: true };
        break;
      }

      case "update_household_status": {
        const { householdId, newStatus, oldStatus, currentUserTeamMemberId } = params;

        // Verify household belongs to agency
        const { data: household } = await supabase
          .from("winback_households")
          .select("id, assigned_to")
          .eq("id", householdId)
          .eq("agency_id", agencyId)
          .single();

        if (!household) {
          return new Response(JSON.stringify({ error: "Household not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const updateData: Record<string, any> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };

        // Auto-assign if going to in_progress and not assigned
        const teamMemberId = verified.staffMemberId || currentUserTeamMemberId;
        if (newStatus === "in_progress" && !household.assigned_to && teamMemberId) {
          updateData.assigned_to = teamMemberId;
        }

        const { error: updateError } = await supabase
          .from("winback_households")
          .update(updateData)
          .eq("id", householdId);

        if (updateError) throw updateError;

        // Log the status change
        let userName = "Unknown";
        if (teamMemberId) {
          const { data: member } = await supabase
            .from("team_members")
            .select("name")
            .eq("id", teamMemberId)
            .single();
          if (member) userName = member.name;
        }

        await supabase.from("winback_activities").insert({
          household_id: householdId,
          agency_id: agencyId,
          activity_type: "status_change",
          old_status: oldStatus,
          new_status: newStatus,
          created_by_team_member_id: teamMemberId || null,
          created_by_name: userName,
        });

        result = { success: true, assigned_to: updateData.assigned_to };
        break;
      }

      case "update_assignment": {
        const { householdId, assignedTo } = params;

        // Verify household belongs to agency
        const { data: household } = await supabase
          .from("winback_households")
          .select("id, status")
          .eq("id", householdId)
          .eq("agency_id", agencyId)
          .single();

        if (!household) {
          return new Response(JSON.stringify({ error: "Household not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const updateData: Record<string, any> = {
          assigned_to: assignedTo === "unassigned" ? null : assignedTo,
          updated_at: new Date().toISOString(),
        };

        // Auto-update status if assigning and currently untouched
        if (assignedTo && assignedTo !== "unassigned" && household.status === "untouched") {
          updateData.status = "in_progress";
        }

        const { error } = await supabase
          .from("winback_households")
          .update(updateData)
          .eq("id", householdId);

        if (error) throw error;
        result = { success: true, newStatus: updateData.status };
        break;
      }

      case "push_to_next_cycle": {
        const { householdId, contactDaysBefore = 45, currentUserTeamMemberId } = params;

        // Verify and get household policies
        const { data: household } = await supabase
          .from("winback_households")
          .select("id")
          .eq("id", householdId)
          .eq("agency_id", agencyId)
          .single();

        if (!household) {
          return new Response(JSON.stringify({ error: "Household not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: policies } = await supabase
          .from("winback_policies")
          .select("id, policy_term_months, termination_effective_date")
          .eq("household_id", householdId);

        if (!policies || policies.length === 0) {
          return new Response(JSON.stringify({ error: "No policies found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const policy of policies) {
          const terminationDate = new Date(policy.termination_effective_date);
          const policyTermMonths = policy.policy_term_months || 12;

          let competitorRenewalDate = new Date(terminationDate);
          competitorRenewalDate.setMonth(competitorRenewalDate.getMonth() + policyTermMonths);

          while (competitorRenewalDate <= today) {
            competitorRenewalDate.setMonth(competitorRenewalDate.getMonth() + policyTermMonths);
          }

          competitorRenewalDate.setMonth(competitorRenewalDate.getMonth() + policyTermMonths);

          const newWinbackDate = new Date(competitorRenewalDate);
          newWinbackDate.setDate(newWinbackDate.getDate() - contactDaysBefore);

          await supabase
            .from("winback_policies")
            .update({ calculated_winback_date: newWinbackDate.toISOString().split("T")[0] })
            .eq("id", policy.id);
        }

        // Try to recalculate aggregates
        const { error: rpcError } = await supabase.rpc("recalculate_winback_household_aggregates", {
          p_household_id: householdId,
        });

        if (rpcError) {
          // Fallback: manually update earliest_winback_date
          const { data: updatedPolicies } = await supabase
            .from("winback_policies")
            .select("calculated_winback_date")
            .eq("household_id", householdId)
            .order("calculated_winback_date", { ascending: true })
            .limit(1);

          if (updatedPolicies && updatedPolicies.length > 0) {
            await supabase
              .from("winback_households")
              .update({ earliest_winback_date: updatedPolicies[0].calculated_winback_date })
              .eq("id", householdId);
          }
        }

        // Reset status and assignment
        await supabase
          .from("winback_households")
          .update({
            status: "untouched",
            assigned_to: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", householdId);

        // Log the action
        const teamMemberId = verified.staffMemberId || currentUserTeamMemberId;
        let userName = "Unknown";
        if (teamMemberId) {
          const { data: member } = await supabase
            .from("team_members")
            .select("name")
            .eq("id", teamMemberId)
            .single();
          if (member) userName = member.name;
        }

        await supabase.from("winback_activities").insert({
          household_id: householdId,
          agency_id: agencyId,
          activity_type: "note",
          notes: "Pushed to next renewal cycle",
          created_by_team_member_id: teamMemberId || null,
          created_by_name: userName,
        });

        result = { success: true };
        break;
      }

      case "permanent_delete_household": {
        const { householdId } = params;

        // Verify household belongs to agency
        const { data: household } = await supabase
          .from("winback_households")
          .select("id")
          .eq("id", householdId)
          .eq("agency_id", agencyId)
          .single();

        if (!household) {
          return new Response(JSON.stringify({ error: "Household not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Delete policies
        await supabase
          .from("winback_policies")
          .delete()
          .eq("household_id", householdId);

        // Delete activities
        await supabase
          .from("winback_activities")
          .delete()
          .eq("household_id", householdId);

        // Clear renewal_records references
        await supabase
          .from("renewal_records")
          .update({ winback_household_id: null, sent_to_winback_at: null })
          .eq("winback_household_id", householdId);

        // Delete household
        const { error } = await supabase
          .from("winback_households")
          .delete()
          .eq("id", householdId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "get_activity_stats": {
        const { weekStart, weekEnd } = params;
        
        let query = supabase
          .from("winback_activities")
          .select("activity_type")
          .eq("agency_id", agencyId)
          .in("activity_type", ["called", "left_vm", "texted", "emailed", "quoted"]);

        if (weekStart) {
          query = query.gte("created_at", weekStart);
        }
        if (weekEnd) {
          query = query.lte("created_at", weekEnd);
        }

        const { data, error } = await query;

        if (error) throw error;

        const counts: Record<string, number> = {
          called: 0,
          left_vm: 0,
          texted: 0,
          emailed: 0,
          quoted: 0,
          total: 0,
        };

        data?.forEach((row) => {
          const type = row.activity_type;
          if (type in counts) {
            counts[type]++;
            counts.total++;
          }
        });

        result = counts;
        break;
      }

      case "get_weekly_won_back": {
        const { weekStart, weekEnd } = params;
        
        const { count, error } = await supabase
          .from("winback_households")
          .select("id", { count: "exact", head: true })
          .eq("agency_id", agencyId)
          .eq("status", "won_back")
          .gte("updated_at", weekStart)
          .lte("updated_at", weekEnd);

        if (error) throw error;
        result = { count: count || 0 };
        break;
      }

      case "get_activity_summary": {
        const { dateStr } = params;
        const selectedDate = new Date(dateStr);
        const localStart = new Date(selectedDate);
        localStart.setHours(0, 0, 0, 0);
        const localEnd = new Date(localStart);
        localEnd.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
          .from("winback_activities")
          .select("id, activity_type, created_by_name, new_status, created_at")
          .eq("agency_id", agencyId)
          .gte("created_at", localStart.toISOString())
          .lte("created_at", localEnd.toISOString());

        if (error) throw error;
        result = { activities: data || [] };
        break;
      }

      case "upload_terminations": {
        const { records, filename, contactDaysBefore } = params;

        interface ParsedRecord {
          firstName: string;
          lastName: string;
          zipCode: string;
          email?: string;
          phone?: string;
          policyNumber: string;
          agentNumber?: string;
          originalYear?: number;
          productCode?: string;
          productName?: string;
          policyTermMonths?: number;
          renewalEffectiveDate?: string;
          anniversaryEffectiveDate?: string;
          terminationEffectiveDate: string;
          terminationReason?: string;
          terminationType?: string;
          premiumNewCents?: number;
          premiumOldCents?: number;
          accountType?: string;
          companyCode?: string;
          isCancelRewrite?: boolean;
        }

        const stats = {
          processed: 0,
          newHouseholds: 0,
          newPolicies: 0,
          updated: 0,
          skipped: 0,
        };

        // Group by household key (firstName + lastName + zip5)
        const householdGroups = new Map<string, ParsedRecord[]>();
        for (const record of records) {
          const key = `${record.firstName?.toLowerCase()}-${record.lastName?.toLowerCase()}-${record.zipCode?.substring(0, 5)}`;
          if (!householdGroups.has(key)) {
            householdGroups.set(key, []);
          }
          householdGroups.get(key)!.push(record);
        }

        for (const [, groupRecords] of householdGroups) {
          const firstRecord = groupRecords[0];

          // Check if household exists
          const { data: existingHousehold } = await supabase
            .from("winback_households")
            .select("id")
            .eq("agency_id", agencyId)
            .ilike("first_name", firstRecord.firstName)
            .ilike("last_name", firstRecord.lastName)
            .filter("zip_code", "like", `${firstRecord.zipCode.substring(0, 5)}%`)
            .maybeSingle();

          let householdId: string;

          if (existingHousehold) {
            householdId = existingHousehold.id;
            // Update contact info
            const updateData: Record<string, string> = {};
            if (firstRecord.email) updateData.email = firstRecord.email;
            if (firstRecord.phone) updateData.phone = firstRecord.phone;

            if (Object.keys(updateData).length > 0) {
              await supabase
                .from("winback_households")
                .update(updateData)
                .eq("id", householdId);
            }
          } else {
            // Create new household
            const { data: newHousehold, error: householdError } = await supabase
              .from("winback_households")
              .insert({
                agency_id: agencyId,
                first_name: firstRecord.firstName,
                last_name: firstRecord.lastName,
                zip_code: firstRecord.zipCode,
                email: firstRecord.email || null,
                phone: firstRecord.phone || null,
                status: "untouched",
              })
              .select("id")
              .single();

            if (householdError) {
              stats.skipped += groupRecords.length;
              continue;
            }

            householdId = newHousehold.id;
            stats.newHouseholds++;
          }

          // Process each policy
          for (const record of groupRecords) {
            const termDate = new Date(record.terminationEffectiveDate);
            const termMonths = record.policyTermMonths || 12;

            // Calculate winback date
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let competitorRenewal = new Date(termDate);
            competitorRenewal.setMonth(competitorRenewal.getMonth() + termMonths);
            while (competitorRenewal <= today) {
              competitorRenewal.setMonth(competitorRenewal.getMonth() + termMonths);
            }
            const winbackDate = new Date(competitorRenewal);
            winbackDate.setDate(winbackDate.getDate() - (contactDaysBefore || 45));

            // Calculate premium change
            let premiumChangeCents: number | null = null;
            let premiumChangePercent: number | null = null;
            if (record.premiumNewCents != null && record.premiumOldCents != null && record.premiumOldCents > 0) {
              premiumChangeCents = record.premiumNewCents - record.premiumOldCents;
              premiumChangePercent = Math.round((premiumChangeCents / record.premiumOldCents) * 10000) / 100;
            }

            // Check if policy exists
            const { data: existingPolicy } = await supabase
              .from("winback_policies")
              .select("id")
              .eq("agency_id", agencyId)
              .eq("policy_number", record.policyNumber)
              .maybeSingle();

            if (existingPolicy) {
              await supabase
                .from("winback_policies")
                .update({
                  household_id: householdId,
                  termination_effective_date: termDate.toISOString().split("T")[0],
                  termination_reason: record.terminationReason || null,
                  termination_type: record.terminationType || null,
                  premium_new_cents: record.premiumNewCents || null,
                  premium_old_cents: record.premiumOldCents || null,
                  premium_change_cents: premiumChangeCents,
                  premium_change_percent: premiumChangePercent,
                  is_cancel_rewrite: record.isCancelRewrite || false,
                  calculated_winback_date: winbackDate.toISOString().split("T")[0],
                })
                .eq("id", existingPolicy.id);
              stats.updated++;
            } else {
              const { error: policyError } = await supabase
                .from("winback_policies")
                .insert({
                  household_id: householdId,
                  agency_id: agencyId,
                  policy_number: record.policyNumber,
                  agent_number: record.agentNumber || null,
                  original_year: record.originalYear || null,
                  product_code: record.productCode || null,
                  product_name: record.productName || null,
                  policy_term_months: record.policyTermMonths || 12,
                  renewal_effective_date: record.renewalEffectiveDate || null,
                  anniversary_effective_date: record.anniversaryEffectiveDate || null,
                  termination_effective_date: termDate.toISOString().split("T")[0],
                  termination_reason: record.terminationReason || null,
                  termination_type: record.terminationType || null,
                  premium_new_cents: record.premiumNewCents || null,
                  premium_old_cents: record.premiumOldCents || null,
                  premium_change_cents: premiumChangeCents,
                  premium_change_percent: premiumChangePercent,
                  account_type: record.accountType || null,
                  company_code: record.companyCode || null,
                  is_cancel_rewrite: record.isCancelRewrite || false,
                  calculated_winback_date: winbackDate.toISOString().split("T")[0],
                });

              if (policyError) {
                stats.skipped++;
              } else {
                stats.newPolicies++;
              }
            }

            stats.processed++;
          }

          // Recalculate household aggregates
          await supabase.rpc("recalculate_winback_household_aggregates", {
            p_household_id: householdId,
          });
        }

        // Record the upload
        const staffMemberId = verified.staffMemberId;
        const { data: uploadRecord } = await supabase.from("winback_uploads").insert({
          agency_id: agencyId,
          uploaded_by_staff_id: staffMemberId || null,
          filename: filename || "unknown",
          records_processed: stats.processed,
          records_new_households: stats.newHouseholds,
          records_new_policies: stats.newPolicies,
          records_updated: stats.updated,
          records_skipped: stats.skipped,
        }).select("id").single();

        // Stamp last_upload_id on all households created/updated in this upload
        if (uploadRecord?.id) {
          // Collect all household IDs that were processed
          const allHouseholdIds: string[] = [];
          for (const [, groupRecords] of householdGroups) {
            const firstRecord = groupRecords[0];
            const { data: hh } = await supabase
              .from("winback_households")
              .select("id")
              .eq("agency_id", agencyId)
              .ilike("first_name", firstRecord.firstName)
              .ilike("last_name", firstRecord.lastName)
              .filter("zip_code", "like", `${firstRecord.zipCode.substring(0, 5)}%`)
              .maybeSingle();
            if (hh) allHouseholdIds.push(hh.id);
          }
          if (allHouseholdIds.length > 0) {
            await supabase
              .from("winback_households")
              .update({ last_upload_id: uploadRecord.id })
              .in("id", allHouseholdIds);
          }
        }

        result = stats;
        break;
      }

      case "get_termination_team_members": {
        // Fetch team members with agent codes for mapping in termination analytics
        const { data, error } = await supabase
          .from("team_members")
          .select("id, name, agent_number, sub_producer_code")
          .eq("agency_id", agencyId);

        if (error) throw error;
        result = { members: data || [] };
        break;
      }

      case "get_termination_policies": {
        // Fetch termination policies for analytics
        const { dateFrom, dateTo } = params;

        let query = supabase
          .from("winback_policies")
          .select(`
            id,
            policy_number,
            agent_number,
            original_year,
            product_name,
            line_code,
            items_count,
            premium_new_cents,
            termination_effective_date,
            termination_reason,
            is_cancel_rewrite,
            household_id,
            winback_households!inner (
              first_name,
              last_name
            )
          `)
          .eq("agency_id", agencyId)
          .order("termination_effective_date", { ascending: false });

        if (dateFrom) {
          query = query.gte("termination_effective_date", dateFrom);
        }
        if (dateTo) {
          query = query.lte("termination_effective_date", dateTo);
        }

        const { data, error } = await query;
        if (error) throw error;
        result = { policies: data || [] };
        break;
      }

      case "transition_to_quoted": {
        const { householdId, currentUserTeamMemberId } = params;

        if (!householdId) {
          return new Response(JSON.stringify({ error: "householdId is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify household belongs to agency
        const { data: household } = await supabase
          .from("winback_households")
          .select("id, status")
          .eq("id", householdId)
          .eq("agency_id", agencyId)
          .single();

        if (!household) {
          return new Response(JSON.stringify({ error: "Household not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Active statuses that can transition to moved_to_quoted
        const activeStatuses = ["untouched", "in_progress", "declined", "no_contact"];

        if (!activeStatuses.includes(household.status)) {
          result = { success: false, error: "Household not in active status" };
          break;
        }

        const teamMemberId = verified.staffMemberId || currentUserTeamMemberId;

        // Update status to moved_to_quoted
        const { error: updateError } = await supabase
          .from("winback_households")
          .update({
            status: "moved_to_quoted",
            assigned_to: teamMemberId || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", householdId)
          .in("status", activeStatuses);

        if (updateError) throw updateError;

        // Log the status change
        let userName = "Unknown";
        if (teamMemberId) {
          const { data: member } = await supabase
            .from("team_members")
            .select("name")
            .eq("id", teamMemberId)
            .single();
          if (member) userName = member.name;
        }

        await supabase.from("winback_activities").insert({
          household_id: householdId,
          agency_id: agencyId,
          activity_type: "status_change",
          old_status: household.status,
          new_status: "moved_to_quoted",
          created_by_team_member_id: teamMemberId || null,
          created_by_name: userName,
        });

        result = { success: true };
        break;
      }

      case "winback_to_quoted": {
        // Full flow: find/create lead source, create LQS, update winback status, log activity
        const { householdId, contactId, firstName, lastName, zipCode, phones, email, currentUserTeamMemberId } = params;

        if (!householdId) {
          return new Response(JSON.stringify({ error: "householdId is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify household belongs to agency
        const { data: household } = await supabase
          .from("winback_households")
          .select("id, status")
          .eq("id", householdId)
          .eq("agency_id", agencyId)
          .single();

        if (!household) {
          return new Response(JSON.stringify({ error: "Household not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const activeStatuses = ["untouched", "in_progress", "declined", "no_contact"];
        if (!activeStatuses.includes(household.status)) {
          result = { success: false, error: "Household not in active status" };
          break;
        }

        const teamMemberId = verified.staffMemberId || currentUserTeamMemberId;

        // Step 1: Find or create "Winback" lead source
        let winbackLeadSourceId: string | null = null;

        const { data: existingSource } = await supabase
          .from("lead_sources")
          .select("id")
          .eq("agency_id", agencyId)
          .ilike("name", "winback")
          .limit(1)
          .maybeSingle();

        if (existingSource) {
          winbackLeadSourceId = existingSource.id;
        } else {
          const { data: newSource, error: createError } = await supabase
            .from("lead_sources")
            .insert({
              agency_id: agencyId,
              name: "Winback",
              is_active: true,
              is_self_generated: false,
              cost_type: "per_lead",
              cost_per_lead_cents: 0,
            })
            .select("id")
            .single();

          if (!createError && newSource) {
            winbackLeadSourceId = newSource.id;
          }
        }

        // Step 2: Create/update LQS record
        // Use canonical household_key format: LASTNAME_FIRSTNAME_ZIP (uppercase, underscores)
        const normalizedLast = (lastName || "UNKNOWN").toUpperCase().trim().replace(/[^A-Z]/g, "");
        const normalizedFirst = (firstName || "UNKNOWN").toUpperCase().trim().replace(/[^A-Z]/g, "");
        const normalizedZip = zipCode ? zipCode.substring(0, 5) : "NOZIP";
        const householdKey = `${normalizedLast}_${normalizedFirst}_${normalizedZip}`;
        const today = new Date().toISOString().split("T")[0];

        const { error: lqsError } = await supabase
          .from("lqs_households")
          .upsert({
            agency_id: agencyId,
            household_key: householdKey,
            first_name: (firstName || "").toUpperCase(),
            last_name: (lastName || "").toUpperCase(),
            zip_code: zipCode || "",
            contact_id: contactId || null,
            status: "quoted",
            lead_source_id: winbackLeadSourceId,
            team_member_id: teamMemberId || null,
            first_quote_date: today,
            lead_received_date: today,
            updated_at: new Date().toISOString(),
            phone: phones || [],
            email: email || null,
          }, {
            onConflict: "agency_id,household_key",
          });

        if (lqsError) {
          console.error("[winback_to_quoted] LQS upsert error:", lqsError);
          // Continue anyway - LQS creation is not critical
        }

        // Step 3: Update winback status to moved_to_quoted
        const { error: updateError } = await supabase
          .from("winback_households")
          .update({
            status: "moved_to_quoted",
            assigned_to: teamMemberId || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", householdId)
          .in("status", activeStatuses);

        if (updateError) throw updateError;

        // Step 4: Log the activity
        let userName = "Unknown";
        if (teamMemberId) {
          const { data: member } = await supabase
            .from("team_members")
            .select("name")
            .eq("id", teamMemberId)
            .single();
          if (member) userName = member.name;
        }

        // Log status change
        await supabase.from("winback_activities").insert({
          household_id: householdId,
          agency_id: agencyId,
          activity_type: "status_change",
          old_status: household.status,
          new_status: "moved_to_quoted",
          created_by_team_member_id: teamMemberId || null,
          created_by_name: userName,
        });

        // Log quoted activity
        await supabase.from("winback_activities").insert({
          household_id: householdId,
          agency_id: agencyId,
          activity_type: "quoted",
          notes: "Moved to Quoted Household",
          created_by_team_member_id: teamMemberId || null,
          created_by_name: userName,
        });

        // Mirror to contact_activities for "Last Activity" display on Contacts page
        if (contactId) {
          try {
            await supabase.rpc("insert_contact_activity", {
              p_contact_id: contactId,
              p_agency_id: agencyId,
              p_source_module: "winback",
              p_activity_type: "quoted",
              p_activity_subtype: null,
              p_source_record_id: householdId,
              p_notes: "Winback: Moved to Quoted Household",
              p_created_by_display_name: userName,
            });
          } catch (mirrorError) {
            console.error("[winback_to_quoted] contact_activities mirror error:", mirrorError);
            // Don't fail - this is for display only
          }
        }

        result = { success: true, leadSourceId: winbackLeadSourceId };
        break;
      }

      case "list_uploads": {
        const { data, error } = await supabase
          .from("winback_uploads")
          .select("*")
          .eq("agency_id", agencyId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        result = { uploads: data || [] };
        break;
      }

      case "bulk_delete_households": {
        const { householdIds } = params;
        if (!householdIds || householdIds.length === 0) {
          result = { success: true };
          break;
        }

        // Verify all households belong to agency
        const { data: validHouseholds } = await supabase
          .from("winback_households")
          .select("id")
          .eq("agency_id", agencyId)
          .in("id", householdIds);

        const validIds = (validHouseholds || []).map((h: any) => h.id);
        if (validIds.length === 0) {
          result = { success: true };
          break;
        }

        // Delete policies
        await supabase.from("winback_policies").delete().in("household_id", validIds);
        // Delete activities
        await supabase.from("winback_activities").delete().in("household_id", validIds);
        // Clear renewal_records references
        await supabase.from("renewal_records").update({ winback_household_id: null, sent_to_winback_at: null }).in("winback_household_id", validIds);
        // Delete households
        await supabase.from("winback_households").delete().in("id", validIds);

        result = { success: true, deleted: validIds.length };
        break;
      }

      case "delete_upload": {
        const { uploadId } = params;

        // Verify upload belongs to agency
        const { data: upload } = await supabase
          .from("winback_uploads")
          .select("id")
          .eq("id", uploadId)
          .eq("agency_id", agencyId)
          .single();

        if (!upload) {
          return new Response(JSON.stringify({ error: "Upload not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Find households linked to this upload
        const { data: households } = await supabase
          .from("winback_households")
          .select("id")
          .eq("last_upload_id", uploadId);

        const hhIds = (households || []).map((h: any) => h.id);

        if (hhIds.length > 0) {
          await supabase.from("winback_policies").delete().in("household_id", hhIds);
          await supabase.from("winback_activities").delete().in("household_id", hhIds);
          await supabase.from("renewal_records").update({ winback_household_id: null, sent_to_winback_at: null }).in("winback_household_id", hhIds);
          await supabase.from("winback_households").delete().in("id", hhIds);
        }

        // Delete upload record
        await supabase.from("winback_uploads").delete().eq("id", uploadId);

        result = { success: true, deleted: hhIds.length };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown operation" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[get_staff_winback] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
