import React from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { enableSaveToReport } from "@/lib/featureFlags"
import {
  canSaveVendorReport,
  saveVendorVerifierReport,
  type VendorVerifierInputShape,
  type VendorVerifierDerivedShape,
} from "@/utils/vendorVerifierReport"

export type SaveVendorReportButtonProps = {
  input: VendorVerifierInputShape
  derived: VendorVerifierDerivedShape
  data: unknown
  className?: string
}

export function SaveVendorReportButton({ input, derived, data, className }: SaveVendorReportButtonProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = React.useState(false)

  if (!enableSaveToReport) return null

  const disabled = isSaving || !canSaveVendorReport(input, derived)

  const onClick = async () => {
    try {
      setIsSaving(true)
      await saveVendorVerifierReport(input, derived, data)
      toast({ title: "Saved to Report." })
    } catch (e) {
      console.error(e)
      toast({ title: "Couldn't save. Try again.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Button
      type="button"
      variant="gradient-glow"
      className={className}
      disabled={disabled}
      aria-disabled={disabled}
      onClick={onClick}
    >
      {isSaving ? "Saving..." : "Save to Report"}
    </Button>
  )
}

export default SaveVendorReportButton
