export type LeadSourceExtended = {
  id?: string;
  name: string;
  spend: number;
  soldPremium?: number;
  commissionRate?: number; // decimal 0..1
};

export function normalizeCommissionRate(input?: number | string): number | undefined {
  if (input == null || input === "") return undefined;
  const n = typeof input === "string" ? parseFloat(input.replace("%", "").trim()) : input;
  if (Number.isNaN(n)) return undefined;
  const decimal = n > 1 ? n / 100 : n;
  const clamped = Math.max(0, Math.min(1, decimal));
  return clamped;
}

export function computeEstimatedCommissionPerRow(source: Pick<LeadSourceExtended, "soldPremium" | "commissionRate">): number {
  const premium = typeof source.soldPremium === "number" && source.soldPremium > 0 ? source.soldPremium : 0;
  const rate = typeof source.commissionRate === "number" && source.commissionRate > 0 ? source.commissionRate : 0;
  const est = premium * rate;
  // round to 2 decimals for display purposes
  return Math.round(est * 100) / 100;
}

export function computeTotals(leadSources: LeadSourceExtended[]) {
  const totals = leadSources.reduce(
    (acc, ls) => {
      const rowEst = computeEstimatedCommissionPerRow(ls);
      acc.totalRevenueFromLeadSources += Math.max(0, ls.soldPremium ?? 0);
      acc.totalEstimatedCommission += rowEst;
      return acc;
    },
    { totalRevenueFromLeadSources: 0, totalEstimatedCommission: 0 }
  );
  // normalize rounding
  totals.totalRevenueFromLeadSources = Math.round(totals.totalRevenueFromLeadSources * 100) / 100;
  totals.totalEstimatedCommission = Math.round(totals.totalEstimatedCommission * 100) / 100;
  return totals;
}
