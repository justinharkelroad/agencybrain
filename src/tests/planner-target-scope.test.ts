import { describe, expect, it } from "vitest";
import { buildHouseholdFocusSaveRequest } from "@/components/staff/plannerSaveScope";

const target = {
  mode: "items" as const,
  target_items: 120,
  target_commission: 18240,
  close_rate: 29,
  avg_items_per_household: 2,
  avg_policies_per_household: 1.4,
  avg_value_per_item: 950,
};

describe("Household Focus save scope", () => {
  it("uses team_default scope only when manager is saving Entire Team", () => {
    const request = buildHouseholdFocusSaveRequest({
      isManager: true,
      viewingTeam: true,
      viewAs: "team",
      staffMemberId: null,
      target,
    });

    expect(request).toEqual({
      action: "save",
      scope: "team_default",
      target,
    });
  });

  it("uses member scope when manager saves a specific team member", () => {
    const request = buildHouseholdFocusSaveRequest({
      isManager: true,
      viewingTeam: false,
      viewAs: "member-123",
      staffMemberId: null,
      target,
    });

    expect(request).toEqual({
      action: "save",
      scope: "member",
      team_member_id: "member-123",
      target,
    });
  });

  it("uses member scope for staff personal saves", () => {
    const request = buildHouseholdFocusSaveRequest({
      isManager: false,
      viewingTeam: false,
      viewAs: "team",
      staffMemberId: "staff-member-456",
      target,
    });

    expect(request).toEqual({
      action: "save",
      scope: "member",
      team_member_id: "staff-member-456",
      target,
    });
  });

  it("throws when staff member id is missing for a personal save", () => {
    expect(() =>
      buildHouseholdFocusSaveRequest({
        isManager: false,
        viewingTeam: false,
        viewAs: "team",
        staffMemberId: null,
        target,
      })
    ).toThrow("Missing member id for member target save");
  });
});
