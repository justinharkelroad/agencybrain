import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { SubProducerMetrics } from "@/lib/allstate-analyzer/sub-producer-analyzer";

interface StatementReport {
  id: string;
  statement_month: number;
  statement_year: number;
  comparison_data: {
    subProducerData?: SubProducerMetrics[];
  };
  created_at: string;
}

interface StatementReportSelectorProps {
  agencyId: string | null;
  onSelect: (report: StatementReport | null) => void;
  selectedReportId?: string | null;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function StatementReportSelector({ agencyId, onSelect, selectedReportId }: StatementReportSelectorProps) {
  const { data: reports, isLoading } = useQuery({
    queryKey: ['statement-reports-for-payout', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comp_comparison_reports')
        .select(`
          id,
          comparison_data,
          created_at,
          current_upload:current_upload_id(statement_month, statement_year)
        `)
        .eq('agency_id', agencyId!)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Transform to include statement month/year from current_upload
      return (data || []).map(report => ({
        id: report.id,
        statement_month: (report.current_upload as any)?.statement_month,
        statement_year: (report.current_upload as any)?.statement_year,
        comparison_data: report.comparison_data as StatementReport['comparison_data'],
        created_at: report.created_at,
      })).filter(r => r.statement_month && r.statement_year) as StatementReport[];
    },
    enabled: !!agencyId,
  });

  const handleSelect = (reportId: string) => {
    if (reportId === "none") {
      onSelect(null);
      return;
    }
    const report = reports?.find(r => r.id === reportId);
    if (report) {
      onSelect(report);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading reports...</span>
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileSpreadsheet className="h-4 w-4" />
        <span className="text-sm">No statement reports available. Upload statements in the Compensation Analyzer first.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Select Statement Report</label>
      <Select value={selectedReportId || "none"} onValueChange={handleSelect}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select a statement report" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Select a report...</SelectItem>
          {reports.map((report) => (
            <SelectItem key={report.id} value={report.id}>
              {MONTHS[report.statement_month - 1]} {report.statement_year}
              {report.comparison_data?.subProducerData?.length 
                ? ` (${report.comparison_data.subProducerData.length} producers)` 
                : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
