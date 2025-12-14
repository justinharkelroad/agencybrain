/*
  Staff ROI Report Utilities
  - Feature-agnostic save helper with localStorage fallback
*/

import type { StaffROIInputs, StaffROIResults } from "./staffROICalculator"

export type StaffROIReportEntry = {
  id: string
  type: "staff_roi"
  title: string
  createdAt: string // ISO
  input: StaffROIInputs
  results: StaffROIResults
}

export function formatStaffROITitle(input: StaffROIInputs): string {
  const period = input.autoRenewalPeriod === "6months" ? "6-Month" : "Annual"
  const autoPremium = input.autoPremium?.toLocaleString() || "0"
  const homePremium = input.homePremium?.toLocaleString() || "0"
  return `Staff ROI — ${period} | Auto $${autoPremium} / Home $${homePremium}`
}

export function canSaveStaffROIReport(
  input: StaffROIInputs,
  results: StaffROIResults | null
): boolean {
  if (!results) return false
  
  const hasAutoPremium = typeof input.autoPremium === "number" && input.autoPremium > 0
  const hasHomePremium = typeof input.homePremium === "number" && input.homePremium > 0
  const hasPremium = hasAutoPremium || hasHomePremium
  
  const hasBaseSalary = typeof input.baseSalary === "number" && input.baseSalary >= 0
  
  return hasPremium && hasBaseSalary
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function saveStaffROIReport(
  input: StaffROIInputs,
  results: StaffROIResults
): Promise<StaffROIReportEntry> {
  const entry: StaffROIReportEntry = {
    id: uuid(),
    type: "staff_roi",
    title: formatStaffROITitle(input),
    createdAt: new Date().toISOString(),
    input,
    results,
  }

  const w = (globalThis as any) as { reportsClient?: { save?: (e: StaffROIReportEntry) => Promise<any> } }
  const client = w?.reportsClient

  if (client?.save) {
    await client.save(entry)
    return entry
  }

  // localStorage fallback
  const key = "reports.staff_roi"
  try {
    const raw = globalThis.localStorage?.getItem(key)
    const arr = raw ? (JSON.parse(raw) as StaffROIReportEntry[]) : []
    arr.unshift(entry)
    globalThis.localStorage?.setItem(key, JSON.stringify(arr))
  } catch {
    // ignore storage errors in stub mode
  }

  return entry
}

export function getStaffROIReports(): StaffROIReportEntry[] {
  const key = "reports.staff_roi"
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw ? (JSON.parse(raw) as StaffROIReportEntry[]) : []
  } catch {
    return []
  }
}
