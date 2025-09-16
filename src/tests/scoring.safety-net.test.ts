import { describe, it, expect } from "vitest";
import { computeWeightedScore, DEFAULT_WEIGHTS, buildTargetsMap } from "@/utils/scoring";

describe("computeWeightedScore safety net", () => {
  it("awards 10 points for outbound_calls when target is met", () => {
    const row = {
      team_member_id: "m1",
      outbound_calls: 122,
      talk_minutes: 0,
      quoted_count: 0,
      sold_items: 0,
      cross_sells_uncovered: 0,
      mini_reviews: 0,
    };

    const targets = buildTargetsMap([
      { team_member_id: null, metric_key: "outbound_calls", value_number: 100 },
      { team_member_id: null, metric_key: "talk_minutes", value_number: 180 },
      { team_member_id: null, metric_key: "quoted_count", value_number: 5 },
      { team_member_id: null, metric_key: "sold_items", value_number: 2 },
    ]);

    const { hits, score } = computeWeightedScore(row, DEFAULT_WEIGHTS, targets);
    expect(hits).toBe(1);
    expect(score).toBe(10);
  });
});
