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

// Mailer Forecaster types
export type MailerInputs = {
  mailSource?: string;
  spend: number; // currency
  costPerPiece: number; // cost per mail piece
  responseRatePct: number; // 0-100
  quotedPctOfInboundPct: number; // 0-100
  closeRatePct: number; // 0-100
  avgItemsPerHH: number; // can be decimal
  avgItemValue: number; // currency
  commissionPct: number; // 0-100
};

export type MailerDerived = {
  totalMailersSent: number; // rounded count
  inboundCalls: number; // rounded count
  quotedHH: number; // rounded count
  costPerQuotedHH: number | null; // null when not computable
  closedHH: number; // rounded count
  soldItems: number; // rounded count
  soldPremium: number; // currency number
  totalComp: number; // currency number
};

export function computeMailerMetrics(raw: MailerInputs): MailerDerived {
  const spend = nonNegative(raw.spend);
  const cpp = nonNegative(raw.costPerPiece);
  const responseRate = clampPercent(raw.responseRatePct) / 100;
  const quotedPct = clampPercent(raw.quotedPctOfInboundPct) / 100;
  const closeRate = clampPercent(raw.closeRatePct) / 100;
  const avgItems = nonNegative(raw.avgItemsPerHH);
  const avgItemValue = nonNegative(raw.avgItemValue);
  const commissionRate = clampPercent(raw.commissionPct) / 100;

  const totalMailersSent = cpp > 0 ? roundCount(spend / cpp) : 0;
  const inboundCalls = roundCount(totalMailersSent * responseRate);
  const quotedHH = roundCount(inboundCalls * quotedPct);
  const costPerQuotedHH = quotedHH > 0 ? spend / quotedHH : null;
  const closedHH = roundCount(quotedHH * closeRate);
  const soldItems = roundCount(closedHH * avgItems);
  const soldPremium = soldItems * avgItemValue;
  const totalComp = soldPremium * commissionRate;

  return {
    totalMailersSent,
    inboundCalls,
    quotedHH,
    costPerQuotedHH,
    closedHH,
    soldItems,
    soldPremium,
    totalComp,
  };
}

export const DEFAULT_MAILER_INPUTS: MailerInputs = {
  mailSource: "Postcard Campaign",
  spend: 5000,
  costPerPiece: 0.75,
  responseRatePct: 1.5,
  quotedPctOfInboundPct: 65,
  closeRatePct: 25,
  avgItemsPerHH: 2,
  avgItemValue: 900,
  commissionPct: 22,
};

// Live Transfer Forecaster types
export type TransferInputs = {
  liveTransferSource?: string;
  spend: number; // currency
  costPerTransfer: number; // cost per live transfer
  quotedPctOfInboundPct: number; // 0-100
  closeRatePct: number; // 0-100
  avgItemsPerHH: number; // can be decimal
  avgItemValue: number; // currency
  commissionPct: number; // 0-100
};

export type TransferDerived = {
  totalTransfers: number; // rounded count
  quotedHH: number; // rounded count
  costPerQuotedHH: number | null; // null when not computable
  closedHH: number; // rounded count
  soldItems: number; // rounded count
  soldPremium: number; // currency number
  totalComp: number; // currency number
};

export function computeTransferMetrics(raw: TransferInputs): TransferDerived {
  const spend = nonNegative(raw.spend);
  const cpt = nonNegative(raw.costPerTransfer);
  const quotedPct = clampPercent(raw.quotedPctOfInboundPct) / 100;
  const closeRate = clampPercent(raw.closeRatePct) / 100;
  const avgItems = nonNegative(raw.avgItemsPerHH);
  const avgItemValue = nonNegative(raw.avgItemValue);
  const commissionRate = clampPercent(raw.commissionPct) / 100;

  const totalTransfers = cpt > 0 ? roundCount(spend / cpt) : 0;
  const quotedHH = roundCount(totalTransfers * quotedPct);
  const costPerQuotedHH = quotedHH > 0 ? spend / quotedHH : null;
  const closedHH = roundCount(quotedHH * closeRate);
  const soldItems = roundCount(closedHH * avgItems);
  const soldPremium = soldItems * avgItemValue;
  const totalComp = soldPremium * commissionRate;

  return {
    totalTransfers,
    quotedHH,
    costPerQuotedHH,
    closedHH,
    soldItems,
    soldPremium,
    totalComp,
  };
}

export const DEFAULT_TRANSFER_INPUTS: TransferInputs = {
  liveTransferSource: "Call Vendor",
  spend: 4000,
  costPerTransfer: 45,
  quotedPctOfInboundPct: 80,
  closeRatePct: 30,
  avgItemsPerHH: 1.8,
  avgItemValue: 950,
  commissionPct: 22,
};
