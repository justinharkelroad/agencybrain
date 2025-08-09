export type MarketingInputs = {
  leadSource?: string;
  spend: number; // currency
  cpl: number; // cost per lead
  quoteRatePct: number; // 0-100
  closeRatePct: number; // 0-100
  avgItemValue: number; // currency
  avgItemsPerHH: number; // can be decimal
  commissionPct: number; // 0-100
};

export type MarketingDerived = {
  totalLeads: number; // rounded count
  quotedHH: number; // rounded count
  costPerQuotedHH: number | null; // null when not computable
  closedHH: number; // rounded count
  soldItems: number; // rounded count
  soldPremium: number; // currency number
  totalComp: number; // currency number
};

export function clampPercent(p: number): number {
  if (!isFinite(p)) return 0;
  if (p < 0) return 0;
  if (p > 100) return 100;
  return p;
}

export function nonNegative(n: number): number {
  if (!isFinite(n)) return 0;
  return n < 0 ? 0 : n;
}

export function roundCount(n: number): number {
  // .5 rounds up by Math.round by spec
  if (!isFinite(n)) return 0;
  return Math.round(n);
}

export function computeMetrics(raw: MarketingInputs): MarketingDerived {
  const spend = nonNegative(raw.spend);
  const cpl = nonNegative(raw.cpl);
  const quoteRate = clampPercent(raw.quoteRatePct) / 100;
  const closeRate = clampPercent(raw.closeRatePct) / 100;
  const avgItemValue = nonNegative(raw.avgItemValue);
  const avgItemsPerHH = nonNegative(raw.avgItemsPerHH);
  const commissionRate = clampPercent(raw.commissionPct) / 100;

  const totalLeads = cpl > 0 ? roundCount(spend / cpl) : 0;
  const quotedHH = roundCount(totalLeads * quoteRate);
  const costPerQuotedHH = quotedHH > 0 ? spend / quotedHH : null;
  const closedHH = roundCount(quotedHH * closeRate);
  const soldItems = roundCount(closedHH * avgItemsPerHH);
  const soldPremium = soldItems * avgItemValue;
  const totalComp = soldPremium * commissionRate;

  return {
    totalLeads,
    quotedHH,
    costPerQuotedHH,
    closedHH,
    soldItems,
    soldPremium,
    totalComp,
  };
}

export function formatCurrency(n: number | null, locale = undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatInteger(n: number): string {
  if (!isFinite(n)) return "0";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

export function buildSummary(inputs: MarketingInputs, d: MarketingDerived): string {
  return [
    `ROI Forecaster Results${inputs.leadSource ? ` for ${inputs.leadSource}` : ""}`,
    `Spend: $${inputs.spend}`,
    `CPL: $${inputs.cpl}`,
    `Quote Rate: ${clampPercent(inputs.quoteRatePct)}%`,
    `Close Rate: ${clampPercent(inputs.closeRatePct)}%`,
    `Avg Item Value: $${inputs.avgItemValue}`,
    `Avg Items/HH: ${inputs.avgItemsPerHH}`,
    `Commission: ${clampPercent(inputs.commissionPct)}%`,
    `Total Leads: ${formatInteger(d.totalLeads)}`,
    `Quoted HH: ${formatInteger(d.quotedHH)}`,
    `Cost per Quoted HH: ${d.costPerQuotedHH == null ? "—" : formatCurrency(d.costPerQuotedHH)}`,
    `Closed HH: ${formatInteger(d.closedHH)}`,
    `Sold Items: ${formatInteger(d.soldItems)}`,
    `Sold Premium: ${formatCurrency(d.soldPremium)}`,
    `Total Compensation: ${formatCurrency(d.totalComp)}`,
  ].join("\n");
}

export const DEFAULT_INPUTS: MarketingInputs = {
  leadSource: "EverQuote",
  spend: 10000,
  cpl: 9,
  quoteRatePct: 4,
  closeRatePct: 15,
  avgItemValue: 987,
  avgItemsPerHH: 2.1,
  commissionPct: 22,
};
