/*
  Vendor Verifier Report Utilities
  - Feature-agnostic save helper with localStorage fallback
*/

export type VendorVerifierInputShape = {
  vendorName?: string | null
  dateStart?: string | null // YYYY-MM-DD
  dateEnd?: string | null   // YYYY-MM-DD
  amountSpent?: number | null
  policiesSold?: number | null
  premiumSold?: number | null
}

export type VendorVerifierDerivedShape = {
  cpa?: number | null
  projectedCommissionAmount?: number | null
  policyCloseRate?: number | null
}

export type ReportEntry<TData = unknown> = {
  id: string
  type: "vendor_verifier"
  title: string
  createdAt: string // ISO
  input: VendorVerifierInputShape
  derived: VendorVerifierDerivedShape
  data: TData
}

export function formatVendorVerifierTitle(input: VendorVerifierInputShape): string {
  const name = (input.vendorName?.trim() || "Unknown Vendor")
  const start = input.dateStart?.trim() || "—"
  const end = input.dateEnd?.trim() || "—"
  return `Vendor Verifier — ${name} (${start} → ${end})`
}

export function canSaveVendorReport(
  i: VendorVerifierInputShape,
  d: VendorVerifierDerivedShape
): boolean {
  const hasVendor = !!i.vendorName && i.vendorName.trim().length > 0
  const hasDates = !!i.dateStart && !!i.dateEnd
  const spentOk = typeof i.amountSpent === "number" && isFinite(i.amountSpent) && i.amountSpent! >= 0

  const policies = typeof i.policiesSold === "number" ? i.policiesSold! : 0
  const premium = typeof i.premiumSold === "number" ? i.premiumSold! : 0
  const hasOutcome = (policies > 0) || (premium > 0)

  return hasVendor && hasDates && spentOk && hasOutcome
}

function uuid(): string {
  // lightweight uuid v4-ish
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function saveVendorVerifierReport<TData>(
  input: VendorVerifierInputShape,
  derived: VendorVerifierDerivedShape,
  data: TData
): Promise<ReportEntry<TData>> {
  const entry: ReportEntry<TData> = {
    id: uuid(),
    type: "vendor_verifier",
    title: formatVendorVerifierTitle(input),
    createdAt: new Date().toISOString(),
    input,
    derived,
    data,
  }

  // Try database first
  try {
    const { saveReportToDatabase } = await import("@/hooks/useSavedReports")
    await saveReportToDatabase(
      "vendor_verifier",
      entry.title,
      { ...input, derived } as unknown as Record<string, unknown>,
      data as unknown as Record<string, unknown>
    )
    return entry
  } catch (err) {
    console.warn("Database save failed, falling back to localStorage:", err)
  }

  // localStorage fallback stub
  const key = "reports.vendor_verifier"
  try {
    const raw = globalThis.localStorage?.getItem(key)
    const arr = raw ? (JSON.parse(raw) as ReportEntry[]) : []
    arr.unshift(entry)
    globalThis.localStorage?.setItem(key, JSON.stringify(arr))
  } catch {
    // ignore storage errors in stub mode
  }

  return entry
}
