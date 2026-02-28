import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyRequest, isVerifyError } from "../_shared/verifyRequest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session",
};

type GoalMode = "items" | "commission";

interface TargetPayload {
  mode: GoalMode;
  target_items: number;
  target_commission: number;
  close_rate: number;
  avg_items_per_household: number;
  avg_policies_per_household: number;
  avg_value_per_item: number;
}

function bad(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePayload(payload: Partial<TargetPayload>): TargetPayload {
  const mode: GoalMode = payload.mode === "commission" ? "commission" : "items";
  const targetItems = Number(payload.target_items ?? 0);
  const targetCommission = Number(payload.target_commission ?? 0);
  const closeRate = Number(payload.close_rate ?? 0);
  const avgItems = Number(payload.avg_items_per_household ?? 0);
  const avgPolicies = Number(payload.avg_policies_per_household ?? 0);
  const avgValue = Number(payload.avg_value_per_item ?? 0);

  if (!Number.isFinite(targetItems) || targetItems < 1) throw new Error("target_items must be >= 1");
  if (!Number.isFinite(targetCommission) || targetCommission < 0) throw new Error("target_commission must be >= 0");
  if (!Number.isFinite(closeRate) || closeRate < 0 || closeRate > 100) throw new Error("close_rate must be between 0 and 100");
  if (!Number.isFinite(avgItems) || avgItems <= 0) throw new Error("avg_items_per_household must be > 0");
  if (!Number.isFinite(avgPolicies) || avgPolicies <= 0) throw new Error("avg_policies_per_household must be > 0");
  if (!Number.isFinite(avgValue) || avgValue < 0) throw new Error("avg_value_per_item must be >= 0");

  return {
    mode,
    target_items: Math.round(targetItems),
    target_commission: Math.round(targetCommission),
    close_rate: Number(closeRate.toFixed(2)),
    avg_items_per_household: Number(avgItems.toFixed(2)),
    avg_policies_per_household: Number(avgPolicies.toFixed(2)),
    avg_value_per_item: Math.round(avgValue),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const verified = await verifyRequest(req);
  if (isVerifyError(verified)) {
    return bad(verified.error, verified.status);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "get");

    if (action === "get") {
      const { data: rows, error } = await supabase
        .from("household_focus_targets")
        .select("agency_id, team_member_id, mode, target_items, target_commission, close_rate, avg_items_per_household, avg_policies_per_household, avg_value_per_item, updated_at")
        .eq("agency_id", verified.agencyId);

      if (error) {
        console.error("[household_focus_targets] get error", error);
        return bad("Failed to load household focus targets", 500);
      }

      const teamDefault = rows?.find((r) => r.team_member_id === null) ?? null;
      const allOverrides = (rows || [])
        .filter((r) => r.team_member_id !== null);

      const overridesForResponse = verified.mode === "staff" && !verified.isManager
        ? allOverrides.filter((r) => String(r.team_member_id) === String(verified.staffMemberId || ""))
        : allOverrides;

      const overrides = overridesForResponse
        .reduce<Record<string, unknown>>((acc, r) => {
          acc[String(r.team_member_id)] = r;
          return acc;
        }, {});

      const currentMemberOverride = verified.staffMemberId
        ? allOverrides.find((r) => String(r.team_member_id) === String(verified.staffMemberId))
        : null;

      return ok({
        success: true,
        team_default: teamDefault,
        member_overrides: overrides,
        current_member_id: verified.staffMemberId ?? null,
        current_member_override: currentMemberOverride ?? null,
      });
    }

    if (action === "save") {
      const scope = String(body?.scope || "");
      const payload = normalizePayload(body?.target || {});

      if (scope !== "team_default" && scope !== "member") {
        return bad("scope must be 'team_default' or 'member'");
      }

      if (scope === "team_default") {
        if (verified.mode === "staff" && !verified.isManager) {
          return bad("Manager access required to update team default", 403);
        }

        const baseRow = {
          agency_id: verified.agencyId,
          team_member_id: null,
          ...payload,
        };

        const { data: existingTeamDefault } = await supabase
          .from("household_focus_targets")
          .select("id")
          .eq("agency_id", verified.agencyId)
          .is("team_member_id", null)
          .maybeSingle();

        const { data: saved, error } = existingTeamDefault?.id
          ? await supabase
              .from("household_focus_targets")
              .update(baseRow)
              .eq("id", existingTeamDefault.id)
              .select("agency_id, team_member_id, mode, target_items, target_commission, close_rate, avg_items_per_household, avg_policies_per_household, avg_value_per_item, updated_at")
              .single()
          : await supabase
              .from("household_focus_targets")
              .insert(baseRow)
              .select("agency_id, team_member_id, mode, target_items, target_commission, close_rate, avg_items_per_household, avg_policies_per_household, avg_value_per_item, updated_at")
              .single();

        if (error) {
          console.error("[household_focus_targets] save team default error", error);
          return bad("Failed to save team default", 500);
        }

        return ok({ success: true, scope, target: saved });
      }

      const memberId = String(body?.team_member_id || "");
      if (!memberId) return bad("team_member_id required for member scope");

      // Staff users can only edit self unless manager
      if (verified.mode === "staff" && !verified.isManager && verified.staffMemberId !== memberId) {
        return bad("You can only update your own target", 403);
      }

      // Ensure target member belongs to agency
      const { data: member, error: memberErr } = await supabase
        .from("team_members")
        .select("id")
        .eq("id", memberId)
        .eq("agency_id", verified.agencyId)
        .maybeSingle();

      if (memberErr || !member) {
        return bad("Invalid team_member_id for agency", 400);
      }

      const baseRow = {
        agency_id: verified.agencyId,
        team_member_id: memberId,
        ...payload,
      };

      const { data: existingMemberTarget } = await supabase
        .from("household_focus_targets")
        .select("id")
        .eq("agency_id", verified.agencyId)
        .eq("team_member_id", memberId)
        .maybeSingle();

      const { data: saved, error } = existingMemberTarget?.id
        ? await supabase
            .from("household_focus_targets")
            .update(baseRow)
            .eq("id", existingMemberTarget.id)
            .select("agency_id, team_member_id, mode, target_items, target_commission, close_rate, avg_items_per_household, avg_policies_per_household, avg_value_per_item, updated_at")
            .single()
        : await supabase
            .from("household_focus_targets")
            .insert(baseRow)
            .select("agency_id, team_member_id, mode, target_items, target_commission, close_rate, avg_items_per_household, avg_policies_per_household, avg_value_per_item, updated_at")
            .single();

      if (error) {
        console.error("[household_focus_targets] save member error", error);
        return bad("Failed to save member target", 500);
      }

      return ok({ success: true, scope, target: saved });
    }

    if (action === "reset_member") {
      const memberId = String(body?.team_member_id || "");
      if (!memberId) return bad("team_member_id required");

      if (verified.mode === "staff" && !verified.isManager) {
        if (!verified.staffMemberId || verified.staffMemberId !== memberId) {
          return bad("You can only reset your own target", 403);
        }
      }

      const { error } = await supabase
        .from("household_focus_targets")
        .delete()
        .eq("agency_id", verified.agencyId)
        .eq("team_member_id", memberId);

      if (error) {
        console.error("[household_focus_targets] reset member error", error);
        return bad("Failed to reset member target", 500);
      }

      return ok({ success: true, action, team_member_id: memberId });
    }

    return bad("Unsupported action", 400);
  } catch (error) {
    console.error("[household_focus_targets] unexpected error", error);
    return bad(error instanceof Error ? error.message : "Unexpected error", 500);
  }
});
