export type VendorVerifierFormInputs = {
  vendorName?: string
  dateStart?: string // YYYY-MM-DD
  dateEnd?: string // YYYY-MM-DD
  amountSpent?: number
  quotedHH?: number
  closedHH?: number
  policiesSold?: number
  policiesQuoted?: number
  itemsQuoted?: number
  itemsSold?: number
  premiumSold?: number
  commissionPct?: number
  inboundCalls?: number
}

export type VendorVerifierDerived = {
  costPerQuotedHH: number | null
  policyCloseRate: number | null // fraction 0–1 (policiesSold / policiesQuoted)
  averageItemValue: number | null
  averagePolicyValue: number | null
  avgCostPerCall: number | null
  costPerQuotedPolicy: number | null
  costPerQuotedItem: number | null
  costPerSoldItem: number | null
  costPerSoldPolicy: number | null
  projectedCommissionAmount: number | null
  cpa: number | null
  costPerItem: number | null
}

export function computeVendorVerifierDerived(input: VendorVerifierFormInputs): VendorVerifierDerived {
  const spend = toNum(input.amountSpent)
  const quoted = toNum(input.quotedHH)
  const closed = toNum(input.closedHH)
  const premium = toNum(input.premiumSold)
  const commissionPct = toNum(input.commissionPct)
  const itemsSold = toNum(input.itemsSold)
  const policiesSold = toNum(input.policiesSold)
  const inboundCalls = toNum(input.inboundCalls)
  const policiesQuoted = toNum(input.policiesQuoted)
  const itemsQuoted = toNum(input.itemsQuoted)

  const costPerQuotedHH = quoted > 0 ? spend / quoted : null
  const policyCloseRate = policiesQuoted > 0 ? (policiesSold / policiesQuoted) : null
  const cpa = closed > 0 ? spend / closed : null
  const projectedCommissionAmount = (premium > 0 && commissionPct > 0)
    ? premium * (normalizePercent(commissionPct) / 100)
    : null
  const averageItemValue = itemsSold > 0 ? premium / itemsSold : null
  const averagePolicyValue = policiesSold > 0 ? premium / policiesSold : null
  const avgCostPerCall = inboundCalls > 0 ? spend / inboundCalls : null
  const costPerQuotedPolicy = policiesQuoted > 0 ? spend / policiesQuoted : null
  const costPerQuotedItem = itemsQuoted > 0 ? spend / itemsQuoted : null
  const costPerSoldItem = itemsSold > 0 ? spend / itemsSold : null
  const costPerSoldPolicy = policiesSold > 0 ? spend / policiesSold : null
  const costPerItem = itemsSold > 0 ? spend / itemsSold : null

  return { costPerQuotedHH, policyCloseRate, averageItemValue, averagePolicyValue, avgCostPerCall, costPerQuotedPolicy, costPerQuotedItem, costPerSoldItem, costPerSoldPolicy, projectedCommissionAmount, cpa, costPerItem }
}

export function buildVendorVerifierJson(input: VendorVerifierFormInputs, derived: VendorVerifierDerived) {
  return {
    meta: pickDefined({
      vendorName: input.vendorName,
      dateStart: input.dateStart,
      dateEnd: input.dateEnd,
    }),
    spend: pickDefined({ amountSpent: input.amountSpent }),
    outcomes: pickDefined({
      quotedHH: input.quotedHH,
      closedHH: input.closedHH,
      policiesSold: input.policiesSold,
      policiesQuoted: input.policiesQuoted,
      itemsQuoted: input.itemsQuoted,
      itemsSold: input.itemsSold,
      premiumSold: input.premiumSold,
      inboundCalls: input.inboundCalls,
    }),
    derived: pickDefined({
      costPerQuotedHH: derived.costPerQuotedHH,
      policyCloseRate: derived.policyCloseRate,
      averageItemValue: derived.averageItemValue,
      averagePolicyValue: derived.averagePolicyValue,
      avgCostPerCall: derived.avgCostPerCall,
      costPerQuotedPolicy: derived.costPerQuotedPolicy,
      costPerQuotedItem: derived.costPerQuotedItem,
      costPerSoldItem: derived.costPerSoldItem,
      costPerSoldPolicy: derived.costPerSoldPolicy,
      projectedCommissionAmount: derived.projectedCommissionAmount,
      cpa: derived.cpa,
      costPerItem: derived.costPerItem,
    }),
    commission: pickDefined({ commissionPct: input.commissionPct }),
  }
}

function toNum(v: unknown): number {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

function normalizePercent(v: number): number {
  // allow 0-1 or 0-100 input; convert to 0-100
  if (!isFinite(v)) return 0
  return v > 0 && v <= 1 ? v * 100 : v
}

function pickDefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const k in obj) {
    const val = obj[k]
    if (val !== undefined) out[k] = val
  }
  return out
}
