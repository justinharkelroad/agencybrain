// Utility helpers for scoring safety-net
export type MetricKey =
  | "outbound_calls"
  | "talk_minutes"
  | "quoted_count"
  | "sold_items"
  | "sold_policies"
  | "cross_sells_uncovered"
  | "mini_reviews";

export const METRIC_KEYS: MetricKey[] = [
  "outbound_calls",
  "talk_minutes",
  "quoted_count",
  "sold_items",
  "sold_policies",
  "cross_sells_uncovered",
  "mini_reviews",
];

export type Weights = Partial<Record<MetricKey, number>>;

export const DEFAULT_WEIGHTS: Weights = {
  outbound_calls: 10,
  talk_minutes: 20,
  quoted_count: 30,
  sold_items: 40,
  cross_sells_uncovered: 25,
  mini_reviews: 25,
};

export type TargetsMap = {
  defaults: Partial<Record<MetricKey, number>>;
  byMember: Record<string, Partial<Record<MetricKey, number>>>;
};

export function buildTargetsMap(
  rows: { team_member_id: string | null; metric_key: string; value_number: number }[]
): TargetsMap {
  const map: TargetsMap = { defaults: {}, byMember: {} };
  for (const r of rows || []) {
    const key = r.metric_key as MetricKey;
    if (!METRIC_KEYS.includes(key)) continue;
    if (r.team_member_id) {
      map.byMember[r.team_member_id] ||= {};
      map.byMember[r.team_member_id][key] = Number(r.value_number ?? 0);
      // Alias sold_policies to sold_items for ring compatibility
      if (key === "sold_items" && !map.byMember[r.team_member_id]["sold_policies"]) {
        map.byMember[r.team_member_id]["sold_policies"] = Number(r.value_number ?? 0);
      }
      if (key === "sold_policies" && !map.byMember[r.team_member_id]["sold_items"]) {
        map.byMember[r.team_member_id]["sold_items"] = Number(r.value_number ?? 0);
      }
    } else {
      map.defaults[key] = Number(r.value_number ?? 0);
      // Alias sold_policies to sold_items for ring compatibility
      if (key === "sold_items" && !map.defaults["sold_policies"]) {
        map.defaults["sold_policies"] = Number(r.value_number ?? 0);
      }
      if (key === "sold_policies" && !map.defaults["sold_items"]) {
        map.defaults["sold_items"] = Number(r.value_number ?? 0);
      }
    }
  }
  return map;
}

export function computeWeightedScore(
  row: { team_member_id?: string; [k: string]: any },
  weights: Weights,
  targets: TargetsMap
): { hits: number; score: number } {
  let hits = 0;
  let score = 0;
  const memberId = row.team_member_id ?? "";
  for (const key of METRIC_KEYS) {
    const actual = Number(row[key] ?? 0);
    const target =
      (targets.byMember[memberId]?.[key] ?? targets.defaults[key] ?? 0) as number;
    // Only count as a hit if a positive target exists and actual >= target
    if (target > 0 && actual >= target) {
      hits += 1;
      score += Number(weights[key] ?? 0);
    }
  }
  return { hits, score };
}
