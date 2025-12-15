import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Save, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveReportToDatabase } from '@/hooks/useSavedReports';
import type { CallEfficiencyResults } from '@/utils/callEfficiencyCalculator';

interface SaveCallEfficiencyReportButtonProps {
  fileName: string;
  thresholdMinutes: number;
  dateFilter: { start: Date; end: Date } | null;
  results: CallEfficiencyResults;
  disabled?: boolean;
}

export function SaveCallEfficiencyReportButton({
  fileName,
  thresholdMinutes,
  dateFilter,
  results,
  disabled = false,
}: SaveCallEfficiencyReportButtonProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (isSaving || saved) return;

    setIsSaving(true);
    try {
      const title = `Call Efficiency - ${fileName}`;
      
      const inputData = {
        fileName,
        thresholdMinutes,
        dateFilter: dateFilter ? {
          start: dateFilter.start.toISOString(),
          end: dateFilter.end.toISOString(),
        } : null,
      };

      const resultsData = {
        thresholdMinutes: results.thresholdMinutes,
        totals: results.totals,
        userCount: results.users.length,
        users: results.users,
        dateRange: {
          start: results.dateRange.start.toISOString(),
          end: results.dateRange.end.toISOString(),
        },
      };

      await saveReportToDatabase('call_efficiency', title, inputData, resultsData);
      
      setSaved(true);
      toast.success('Report saved successfully');
    } catch (error) {
      console.error('Failed to save report:', error);
      toast.error('Failed to save report');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button
      onClick={handleSave}
      disabled={disabled || isSaving || saved}
      variant="outline"
      size="sm"
    >
      {isSaving ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : saved ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Saved
        </>
      ) : (
        <>
          <Save className="h-4 w-4 mr-2" />
          Save to Reports
        </>
      )}
    </Button>
  );
}
