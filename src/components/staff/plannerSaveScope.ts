type GoalMode = "commission" | "items";

export type SaveTargetPayload = {
  mode: GoalMode;
  target_items: number;
  target_commission: number;
  close_rate: number;
  avg_items_per_household: number;
  avg_policies_per_household: number;
  avg_value_per_item: number;
};

export type SaveRequestBody =
  | { action: "save"; scope: "team_default"; target: SaveTargetPayload }
  | { action: "save"; scope: "member"; team_member_id: string; target: SaveTargetPayload };

export function buildHouseholdFocusSaveRequest(params: {
  isManager: boolean;
  viewingTeam: boolean;
  viewAs: string;
  staffMemberId: string | null;
  target: SaveTargetPayload;
}): SaveRequestBody {
  const { isManager, viewingTeam, viewAs, staffMemberId, target } = params;

  if (isManager && viewingTeam) {
    return { action: "save", scope: "team_default", target };
  }

  const memberId = isManager ? viewAs : staffMemberId;
  if (!memberId || memberId === "team") {
    throw new Error("Missing member id for member target save");
  }

  return {
    action: "save",
    scope: "member",
    team_member_id: memberId,
    target,
  };
}

