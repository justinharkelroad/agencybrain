import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  canSaveVendorReport,
  saveVendorVerifierReport,
  formatVendorVerifierTitle,
  type VendorVerifierInputShape,
  type VendorVerifierDerivedShape,
} from "./vendorVerifierReport"

const baseInput: VendorVerifierInputShape = {
  vendorName: "Acme Leads",
  dateStart: "2025-01-01",
  dateEnd: "2025-01-31",
  amountSpent: 1000,
  policiesSold: 10,
  premiumSold: 0,
}

const baseDerived: VendorVerifierDerivedShape = {
  cpa: 100,
  projectedCommissionAmount: 2500,
  policyCloseRate: 0.2,
}

describe("vendorVerifierReport utils", () => {
  beforeEach(() => {
    // reset localStorage
    localStorage.clear()
    ;(globalThis as any).reportsClient = undefined
  })

  it("canSaveVendorReport passes only with vendor, dates, amountSpent, and at least one outcome", () => {
    expect(canSaveVendorReport(baseInput, baseDerived)).toBe(true)

    const noVendor = { ...baseInput, vendorName: "" }
    expect(canSaveVendorReport(noVendor, baseDerived)).toBe(false)

    const noDates = { ...baseInput, dateStart: undefined }
    expect(canSaveVendorReport(noDates, baseDerived)).toBe(false)

    const noAmount = { ...baseInput, amountSpent: undefined }
    expect(canSaveVendorReport(noAmount, baseDerived)).toBe(false)

    const noOutcome = { ...baseInput, policiesSold: 0, premiumSold: 0 }
    expect(canSaveVendorReport(noOutcome, baseDerived)).toBe(false)
  })

  it("formatVendorVerifierTitle formats correctly", () => {
    expect(formatVendorVerifierTitle(baseInput)).toBe(
      "Vendor Verifier — Acme Leads (2025-01-01 → 2025-01-31)"
    )

    const unknown = { vendorName: undefined, dateStart: undefined, dateEnd: undefined } as VendorVerifierInputShape
    expect(formatVendorVerifierTitle(unknown)).toBe(
      "Vendor Verifier — Unknown Vendor (— → —)"
    )
  })

  it("saveVendorVerifierReport falls back to localStorage when client absent", async () => {
    const entry = await saveVendorVerifierReport(baseInput, baseDerived, { foo: "bar" })

    const raw = localStorage.getItem("reports.vendor_verifier")
    expect(raw).toBeTruthy()
    const list = JSON.parse(raw!) as typeof entry[]
    expect(list[0].id).toBe(entry.id)
    expect(list[0].title).toBe("Vendor Verifier — Acme Leads (2025-01-01 → 2025-01-31)")
    expect(list[0].data).toEqual({ foo: "bar" })
  })

  it("saveVendorVerifierReport uses reportsClient.save when present", async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as any).reportsClient = { save }

    const entry = await saveVendorVerifierReport(baseInput, baseDerived, { ok: true })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0]).toMatchObject({ id: entry.id, type: "vendor_verifier" })

    // Should not have written to localStorage in this path
    expect(localStorage.getItem("reports.vendor_verifier")).toBeNull()
  })

  it("saveVendorVerifierReport propagates client errors", async () => {
    const save = vi.fn().mockRejectedValue(new Error("boom"))
    ;(globalThis as any).reportsClient = { save }

    await expect(
      saveVendorVerifierReport(baseInput, baseDerived, { ok: false })
    ).rejects.toThrowError(/boom/)
  })
})
