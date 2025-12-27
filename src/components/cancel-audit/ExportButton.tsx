import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportRecordsToCSV, exportSummaryReport } from '@/hooks/useCancelAuditExport';

interface ExportButtonProps {
  agencyId: string;
  viewMode: 'needs_attention' | 'all';
  reportTypeFilter: 'all' | 'cancellation' | 'pending_cancel';
  searchQuery: string;
  weekStart: string;
  weekEnd: string;
  recordCount: number;
}

export function ExportButton({
  agencyId,
  viewMode,
  reportTypeFilter,
  searchQuery,
  weekStart,
  weekEnd,
  recordCount,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async (includeActivities: boolean) => {
    setIsExporting(true);
    try {
      const csv = await exportRecordsToCSV({
        agencyId,
        viewMode,
        reportTypeFilter,
        searchQuery,
        includeActivities,
      });
      
      const dateStr = new Date().toISOString().split('T')[0];
      const filterStr = reportTypeFilter === 'all' ? 'all' : reportTypeFilter.replace('_', '-');
      downloadFile(csv, `cancel-audit-${filterStr}-${dateStr}.csv`, 'text/csv');
      
      toast.success('Export complete', {
        description: `${recordCount} records exported to CSV`,
      });
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSummary = async () => {
    setIsExporting(true);
    try {
      const report = await exportSummaryReport(agencyId, weekStart, weekEnd);
      
      const dateStr = new Date().toISOString().split('T')[0];
      downloadFile(report, `cancel-audit-summary-${dateStr}.txt`, 'text/plain');
      
      toast.success('Summary report exported');
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => handleExportCSV(false)} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          <div className="flex flex-col">
            <span>Export Records (CSV)</span>
            <span className="text-xs text-muted-foreground">
              Current filter: {recordCount} records
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExportCSV(true)} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          <div className="flex flex-col">
            <span>Export with Activity Count</span>
            <span className="text-xs text-muted-foreground">
              Includes contact counts
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportSummary} className="gap-2">
          <FileText className="h-4 w-4" />
          <div className="flex flex-col">
            <span>Weekly Summary Report</span>
            <span className="text-xs text-muted-foreground">
              Team stats & wins
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
