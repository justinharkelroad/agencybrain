import React from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { enableSaveToReport } from "@/lib/featureFlags"
import {
  canSaveStaffROIReport,
  saveStaffROIReport,
} from "@/utils/staffROIReport"
import type { StaffROIInputs, StaffROIResults } from "@/utils/staffROICalculator"

export type SaveStaffROIReportButtonProps = {
  input: StaffROIInputs
  results: StaffROIResults | null
  className?: string
}

export function SaveStaffROIReportButton({ input, results, className }: SaveStaffROIReportButtonProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = React.useState(false)

  if (!enableSaveToReport) return null

  const disabled = isSaving || !canSaveStaffROIReport(input, results)

  const onClick = async () => {
    if (!results) return
    try {
      setIsSaving(true)
      await saveStaffROIReport(input, results)
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
      variant="outline"
      className={className}
      disabled={disabled}
      aria-disabled={disabled}
      onClick={onClick}
    >
      {isSaving ? "Saving..." : "Save to Report"}
    </Button>
  )
}

export default SaveStaffROIReportButton
