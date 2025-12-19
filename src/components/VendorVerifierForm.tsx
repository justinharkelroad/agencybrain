import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import { VendorVerifierFormInputs, VendorVerifierDerived, computeVendorVerifierDerived, buildVendorVerifierJson } from "@/utils/vendorVerifier"
import { clampPercent, formatCurrency, formatInteger } from "@/utils/marketingCalculator"
import SaveVendorReportButton from "@/components/SaveVendorReportButton"
import VendorReportCard from "@/components/VendorReportCard"
import { HelpVideoButton } from "@/components/HelpVideoButton"
import { cn } from "@/lib/utils"
import { Calendar as CalendarIcon, Sparkles } from "lucide-react"
import { format } from "date-fns"

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
  const [showReport, setShowReport] = useState(false)

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

  const toYmd = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : undefined)
  const fromYmd = (s?: string) => (s ? new Date(`${s}T00:00:00`) : undefined)
  const startDate = fromYmd(values.dateStart)
  const endDate = fromYmd(values.dateEnd)

  

  const derived: VendorVerifierDerived = useMemo(() => computeVendorVerifierDerived({
    vendorName: values.vendorName,
    dateStart: values.dateStart,
    dateEnd: values.dateEnd,
    amountSpent: num(values.amountSpent),
    quotedHH: num(values.quotedHH),
    closedHH: num(values.closedHH),
    policiesSold: num(values.policiesSold),
    policiesQuoted: num(values.policiesQuoted),
    itemsQuoted: num(values.itemsQuoted),
    itemsSold: num(values.itemsSold),
    premiumSold: num(values.premiumSold),
    commissionPct: num(values.commissionPct),
    inboundCalls: num(values.inboundCalls),
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
      policiesQuoted: undefined as any,
      itemsQuoted: undefined as any,
      itemsSold: undefined as any,
      premiumSold: undefined as any,
      commissionPct: undefined as any,
      inboundCalls: undefined as any,
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
      `Policies Quoted: ${fmtInt(values.policiesQuoted)}`,
      `Items Quoted: ${fmtInt(values.itemsQuoted)}`,
      `Items: ${fmtInt(values.itemsSold)}`,
      `Inbound Calls: ${fmtInt(values.inboundCalls)}`,
      `Premium Sold: ${formatCurrency(num(values.premiumSold))}`,
      `Commission %: ${isNum(values.commissionPct) ? clampPercent(num(values.commissionPct)) : 0}%`,
      `Cost per Quoted HH: ${derived.costPerQuotedHH == null ? "—" : formatCurrency(derived.costPerQuotedHH)}`,
      `Policy Close Rate: ${derived.policyCloseRate == null ? "—" : `${(derived.policyCloseRate * 100).toFixed(2)}%`}`,
      `Average Item Value: ${derived.averageItemValue == null ? "—" : formatCurrency(derived.averageItemValue)}`,
      `Average Policy Value: ${derived.averagePolicyValue == null ? "—" : formatCurrency(derived.averagePolicyValue)}`,
      `Average Cost Per Transfer/Call: ${derived.avgCostPerCall == null ? "—" : formatCurrency(derived.avgCostPerCall)}`,
      `Cost Per Quoted Policy: ${derived.costPerQuotedPolicy == null ? "—" : formatCurrency(derived.costPerQuotedPolicy)}`,
      `Cost Per Quoted Item: ${derived.costPerQuotedItem == null ? "—" : formatCurrency(derived.costPerQuotedItem)}`,
      `Cost Per Sold Item: ${derived.costPerSoldItem == null ? "—" : formatCurrency(derived.costPerSoldItem)}`,
      `Cost Per Sold Policy: ${derived.costPerSoldPolicy == null ? "—" : formatCurrency(derived.costPerSoldPolicy)}`,
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
          <HelpVideoButton videoKey="Vendor_Verifier" />
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
            <Label htmlFor="inboundCalls"># of Inbound Calls</Label>
            <Input id="inboundCalls" type="number" step="1" min={0} {...register("inboundCalls", { min: { value: 0, message: "Must be non-negative" } })} />
            <p className="text-xs text-muted-foreground mt-1">(If Vendor is Mailers/Transfers)</p>
          </div>

          <div>
            <Label htmlFor="amountSpent">Amount Spent</Label>
            <InputAffix prefix="$">
              <Input id="amountSpent" type="number" step="0.01" min={0} className="pl-7"
                aria-invalid={!!errors.amountSpent}
                {...register("amountSpent", { min: { value: 0, message: "Must be non-negative" } })}
              />
            </InputAffix>
          </div>

          <div>
            <Label htmlFor="dateStart">Period Start</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start font-normal", !startDate && "text-muted-foreground")}> 
                  {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => {
                    if (!d) return
                    const ymd = toYmd(d)
                    setValue("dateStart", ymd as any, { shouldDirty: true })
                    if (values.dateEnd && fromYmd(values.dateEnd)! < d) {
                      setValue("dateEnd", ymd as any, { shouldDirty: true })
                    }
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="dateEnd">Period End</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start font-normal", !endDate && "text-muted-foreground")}> 
                  {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => {
                    if (!d) return
                    const ymd = toYmd(d)
                    // ensure end >= start
                    const s = startDate
                    if (s && d < s) {
                      setValue("dateEnd", toYmd(s) as any, { shouldDirty: true })
                    } else {
                      setValue("dateEnd", ymd as any, { shouldDirty: true })
                    }
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Outcomes</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div>
            <Label htmlFor="quotedHH">Quoted HH</Label>
            <Input id="quotedHH" type="number" step="1" min={0} {...register("quotedHH", { min: { value: 0, message: "Must be non-negative" } })} />
          </div>
          <div>
            <Label htmlFor="closedHH">Closed HH</Label>
            <Input id="closedHH" type="number" step="1" min={0} {...register("closedHH", { min: { value: 0, message: "Must be non-negative" } })} />
          </div>
          <div>
            <Label htmlFor="policiesSold">Policies Sold</Label>
            <Input id="policiesSold" type="number" step="1" min={0} {...register("policiesSold", { min: { value: 0, message: "Must be non-negative" } })} />
          </div>
          <div>
            <Label htmlFor="itemsSold">Items</Label>
            <Input id="itemsSold" type="number" step="1" min={0} {...register("itemsSold", { min: { value: 0, message: "Must be non-negative" } })} />
          </div>
          <div>
            <Label htmlFor="premiumSold">Premium Sold</Label>
            <InputAffix prefix="$">
              <Input id="premiumSold" type="number" step="0.01" min={0} className="pl-7" {...register("premiumSold", { min: { value: 0, message: "Must be non-negative" } })} />
            </InputAffix>
          </div>
          <div>
            <Label htmlFor="commissionPct">Commission %</Label>
            <InputAffix suffix="%">
              <Input id="commissionPct" type="number" step="0.01" min={0} max={100} className="pr-7"
                onBlur={(e) => {
                  const v = Number(e.currentTarget.value)
                  const normalized = v > 0 && v <= 1 ? v * 100 : v
                  const c = clampPercent(normalized)
                  if (c !== v) setValue("commissionPct", c, { shouldValidate: true, shouldDirty: true })
                }}
                {...register("commissionPct", { min: { value: 0, message: "Must be 0-100" }, max: { value: 100, message: "Must be 0-100" } })}
              />
            </InputAffix>
          </div>
          <div>
            <Label htmlFor="policiesQuoted">Policies Quoted</Label>
            <Input id="policiesQuoted" type="number" step="1" min={0} {...register("policiesQuoted", { min: { value: 0, message: "Must be non-negative" } })} />
          </div>
          <div>
            <Label htmlFor="itemsQuoted">Items Quoted</Label>
            <Input id="itemsQuoted" type="number" step="1" min={0} {...register("itemsQuoted", { min: { value: 0, message: "Must be non-negative" } })} />
          </div>
        </div>
      </section>

      {/* Generate Report Button */}
      <Button 
        onClick={() => setShowReport(true)}
        disabled={!(values.vendorName?.trim() && num(values.amountSpent) > 0 && (num(values.policiesSold) > 0 || num(values.premiumSold) > 0 || num(values.closedHH) > 0))}
        className="w-full mt-6"
        size="lg"
      >
        <Sparkles className="h-5 w-5 mr-2" />
        Generate Vendor Report Card
      </Button>

      {/* Action Buttons */}
      <div className="mt-2 flex items-center justify-between">
        <Button variant="secondary" onClick={() => { handleReset(); setShowReport(false); }}>Reset</Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={loadLast}>Load last inputs</Button>
          <Button variant="flat" onClick={handleCopy}>Copy results</Button>
        </div>
      </div>

      {/* Visual Report Card */}
      {showReport && (
        <VendorReportCard 
          inputs={{
            vendorName: values.vendorName,
            dateStart: values.dateStart,
            dateEnd: values.dateEnd,
            amountSpent: num(values.amountSpent),
            quotedHH: num(values.quotedHH),
            closedHH: num(values.closedHH),
            policiesSold: num(values.policiesSold),
            policiesQuoted: num(values.policiesQuoted),
            itemsSold: num(values.itemsSold),
            itemsQuoted: num(values.itemsQuoted),
            premiumSold: num(values.premiumSold),
            commissionPct: num(values.commissionPct),
            inboundCalls: num(values.inboundCalls),
          }}
          derived={derived}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}

export default VendorVerifierForm

function isNum(v: unknown): v is number { return typeof v === "number" && isFinite(v as number) }
function num(v: unknown): number { const n = Number(v); return isFinite(n) ? n : 0 }
function fmtInt(v: unknown): string { const n = Number(v); return isFinite(n) ? formatInteger(n) : "0" }
