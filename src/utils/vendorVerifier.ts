export type VendorVerifierFormInputs = {
  vendorName?: string
  dateStart?: string // YYYY-MM-DD
  dateEnd?: string // YYYY-MM-DD
  amountSpent?: number
  quotedHH?: number
  closedHH?: number
  policiesSold?: number
  premiumSold?: number
  commissionPct?: number
}

export type VendorVerifierDerived = {
  costPerQuotedHH: number | null
  policyCloseRate: number | null // fraction 0–1
  cpa: number | null
  projectedCommissionAmount: number | null
}

export function computeVendorVerifierDerived(input: VendorVerifierFormInputs): VendorVerifierDerived {
  const spend = toNum(input.amountSpent)
  const quoted = toNum(input.quotedHH)
  const closed = toNum(input.closedHH)
  const premium = toNum(input.premiumSold)
  const commissionPct = toNum(input.commissionPct)

  const costPerQuotedHH = quoted > 0 ? spend / quoted : null
  const policyCloseRate = quoted > 0 ? (closed / quoted) : null
  const cpa = closed > 0 ? spend / closed : null
  const projectedCommissionAmount = (premium > 0 && commissionPct > 0)
    ? premium * (normalizePercent(commissionPct) / 100)
    : null

  return { costPerQuotedHH, policyCloseRate, cpa, projectedCommissionAmount }
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
      premiumSold: input.premiumSold,
    }),
    derived: pickDefined({
      cpa: derived.cpa,
      costPerQuotedHH: derived.costPerQuotedHH,
      policyCloseRate: derived.policyCloseRate,
      projectedCommissionAmount: derived.projectedCommissionAmount,
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
