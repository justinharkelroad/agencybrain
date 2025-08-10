import * as React from "react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { VendorVerifierFormInputs, VendorVerifierDerived, computeVendorVerifierDerived, buildVendorVerifierJson } from "@/utils/vendorVerifier"
import { clampPercent, formatCurrency, formatInteger } from "@/utils/marketingCalculator"
import SaveVendorReportButton from "@/components/SaveVendorReportButton"

function InputAffix({ children, prefix, suffix }: { children: React.ReactNode; prefix?: string; suffix?: string }) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground pointer-events-none">{prefix}</span>
      ) : null}
      {suffix ? (
        <span className="absolute inset-y-0 right-3 flex items-center text-muted-foreground pointer-events-none">{suffix}</span>
      ) : null}
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-medium text-muted-foreground mb-2">{children}</h4>
}

export function VendorVerifierForm({ onBack }: { onBack: () => void }) {
  const STORAGE_KEY = "vendorVerifier:inputs"
  const { register, watch, setValue, reset, formState: { errors } } = useForm<VendorVerifierFormInputs>({ mode: "onChange", defaultValues: {} as any })

  // persist
  useEffect(() => {
    const sub = watch((val) => {
      const t = setTimeout(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)) } catch {}
      }, 200)
      return () => clearTimeout(t)
    })
    return () => sub.unsubscribe()
  }, [watch])

  const loadLast = () => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return; reset(JSON.parse(raw)) } catch {}
  }

  const values = watch()

  // clamp percent to 0-100; also accept 0-1 input
  useEffect(() => {
    const cm = values.commissionPct
    if (typeof cm === "number" && isFinite(cm)) {
      const normalized = cm > 0 && cm <= 1 ? cm * 100 : cm
      const c = clampPercent(normalized)
      if (c !== cm) setValue("commissionPct", c, { shouldValidate: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.commissionPct])

  const derived: VendorVerifierDerived = useMemo(() => computeVendorVerifierDerived({
    vendorName: values.vendorName,
    dateStart: values.dateStart,
    dateEnd: values.dateEnd,
    amountSpent: num(values.amountSpent),
    quotedHH: num(values.quotedHH),
    closedHH: num(values.closedHH),
    policiesSold: num(values.policiesSold),
    premiumSold: num(values.premiumSold),
    commissionPct: num(values.commissionPct),
  }), [values])

  const handleReset = () => {
    reset({
      vendorName: "",
      dateStart: undefined as any,
      dateEnd: undefined as any,
      amountSpent: undefined as any,
      quotedHH: undefined as any,
      closedHH: undefined as any,
      policiesSold: undefined as any,
      premiumSold: undefined as any,
      commissionPct: undefined as any,
    })
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  const handleCopy = async () => {
    const lines = [
      `Vendor: ${values.vendorName || "—"}`,
      `Period: ${values.dateStart || "—"} → ${values.dateEnd || "—"}`,
      `Amount Spent: ${formatCurrency(num(values.amountSpent))}`,
      `Quoted HH: ${fmtInt(values.quotedHH)}`,
      `Closed HH: ${fmtInt(values.closedHH)}`,
      `Policies Sold: ${fmtInt(values.policiesSold)}`,
      `Premium Sold: ${formatCurrency(num(values.premiumSold))}`,
      `Commission %: ${isNum(values.commissionPct) ? clampPercent(num(values.commissionPct)) : 0}%`,
      `Cost per Quoted HH: ${derived.costPerQuotedHH == null ? "—" : formatCurrency(derived.costPerQuotedHH)}`,
      `Policy Close Rate: ${derived.policyCloseRate == null ? "—" : `${(derived.policyCloseRate * 100).toFixed(2)}%`}`,
      `CPA: ${derived.cpa == null ? "—" : formatCurrency(derived.cpa)}`,
      `Projected Commission: ${derived.projectedCommissionAmount == null ? "—" : formatCurrency(derived.projectedCommissionAmount)}`,
    ]
    try { await navigator.clipboard.writeText(lines.join("\n")) } catch {}
  }

  const saveInput = {
    vendorName: values.vendorName,
    dateStart: values.dateStart,
    dateEnd: values.dateEnd,
    amountSpent: isNum(values.amountSpent) ? num(values.amountSpent) : null,
    policiesSold: isNum(values.policiesSold) ? num(values.policiesSold) : null,
    premiumSold: isNum(values.premiumSold) ? num(values.premiumSold) : null,
  }

  const saveDerived = {
    cpa: derived.cpa ?? null,
    projectedCommissionAmount: derived.projectedCommissionAmount ?? null,
    policyCloseRate: derived.policyCloseRate ?? null,
  }

  const dataJson = useMemo(() => buildVendorVerifierJson(values, derived), [values, derived])

  return (
    <div className="space-y-4 animate-enter">
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to calculators">←</Button>
          <h3 className="text-base font-medium text-muted-foreground">Vendor Verifier</h3>
        </div>
      </div>

      <section>
        <SectionTitle>Vendor Basics</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <Label htmlFor="vendorName">Vendor Name</Label>
            <Input id="vendorName" {...register("vendorName", { required: false })} />
          </div>
          <div>
            <Label htmlFor="amountSpent">Amount Spent</Label>
            <InputAffix prefix="$">
              <Input id="amountSpent" type="number" step="any" min={0} className="pl-7"
                aria-invalid={!!errors.amountSpent}
                {...register("amountSpent", { min: { value: 0, message: "Must be non-negative" }, valueAsNumber: true })}
              />
            </InputAffix>
          </div>
          <div>
            <Label htmlFor="dateStart">Period Start</Label>
            <Input id="dateStart" type="date" {...register("dateStart")} />
          </div>
          <div>
            <Label htmlFor="dateEnd">Period End</Label>
            <Input id="dateEnd" type="date" {...register("dateEnd")} />
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Outcomes</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div>
            <Label htmlFor="quotedHH">Quoted HH</Label>
            <Input id="quotedHH" type="number" step="1" min={0} {...register("quotedHH", { valueAsNumber: true, min: { value: 0, message: "Must be non-negative" } })} />
          </div>
          <div>
            <Label htmlFor="closedHH">Closed HH</Label>
            <Input id="closedHH" type="number" step="1" min={0} {...register("closedHH", { valueAsNumber: true, min: { value: 0, message: "Must be non-negative" } })} />
          </div>
          <div>
            <Label htmlFor="policiesSold">Policies Sold</Label>
            <Input id="policiesSold" type="number" step="1" min={0} {...register("policiesSold", { valueAsNumber: true, min: { value: 0, message: "Must be non-negative" } })} />
          </div>
          <div>
            <Label htmlFor="premiumSold">Premium Sold</Label>
            <InputAffix prefix="$">
              <Input id="premiumSold" type="number" step="any" min={0} className="pl-7" {...register("premiumSold", { valueAsNumber: true, min: { value: 0, message: "Must be non-negative" } })} />
            </InputAffix>
          </div>
          <div>
            <Label htmlFor="commissionPct">Commission %</Label>
            <InputAffix suffix="%">
              <Input id="commissionPct" type="number" step="any" min={0} max={100} className="pr-7"
                onBlur={(e) => {
                  const v = Number(e.currentTarget.value)
                  const normalized = v > 0 && v <= 1 ? v * 100 : v
                  const c = clampPercent(normalized)
                  if (c !== v) setValue("commissionPct", c, { shouldValidate: true, shouldDirty: true })
                }}
                {...register("commissionPct", { valueAsNumber: true, min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
              />
            </InputAffix>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Derived Metrics</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <Label>Cost per Quoted HH</Label>
            <Input disabled value={derived.costPerQuotedHH == null ? "" : formatCurrency(derived.costPerQuotedHH)} />
          </div>
          <div>
            <Label>Policy Close Rate</Label>
            <Input disabled value={derived.policyCloseRate == null ? "" : `${(derived.policyCloseRate * 100).toFixed(2)}%`} />
          </div>
          <div>
            <Label>CPA</Label>
            <Input disabled value={derived.cpa == null ? "" : formatCurrency(derived.cpa)} />
          </div>
          <div>
            <Label>Projected Commission</Label>
            <Input disabled value={derived.projectedCommissionAmount == null ? "" : formatCurrency(derived.projectedCommissionAmount)} />
          </div>
        </div>
      </section>

      <div className="mt-2 flex items-center justify-between">
        <Button variant="secondary" onClick={handleReset}>Reset</Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={loadLast}>Load last inputs</Button>
          <Button variant="outline" onClick={handleCopy}>Copy results</Button>
          <SaveVendorReportButton input={saveInput as any} derived={saveDerived as any} data={dataJson} />
        </div>
      </div>
    </div>
  )
}

export default VendorVerifierForm

function isNum(v: unknown): v is number { return typeof v === "number" && isFinite(v as number) }
function num(v: unknown): number { const n = Number(v); return isFinite(n) ? n : 0 }
function fmtInt(v: unknown): string { const n = Number(v); return isFinite(n) ? formatInteger(n) : "0" }
