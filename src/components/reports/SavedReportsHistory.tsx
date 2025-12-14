import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FileText, Trash2, Calculator, Users, ChevronDown, ChevronRight, BarChart3, Mail, PhoneCall } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSavedReports, SavedReport } from '@/hooks/useSavedReports';
import { toast } from 'sonner';
import { StaffROIInputs, StaffROIResults } from '@/utils/staffROICalculator';
import StaffROIReportCard from '@/components/tools/StaffROIReportCard';
import { DataLeadReportCard } from '@/components/tools/DataLeadReportCard';
import { MailerReportCard } from '@/components/tools/MailerReportCard';
import { LiveTransferReportCard } from '@/components/tools/LiveTransferReportCard';
import { MarketingInputs, MarketingDerived, MailerInputs, MailerDerived, TransferInputs, TransferDerived } from '@/utils/marketingCalculator';

type ReportFilter = 'all' | 'staff_roi' | 'vendor_verifier' | 'data_lead' | 'mailer' | 'live_transfer';

export function SavedReportsHistory() {
  const [filter, setFilter] = useState<ReportFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { reports, isLoading, error, deleteReport } = useSavedReports(
    filter === 'all' ? undefined : filter
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    const success = await deleteReport(deleteId);
    if (success) {
      toast.success('Report deleted');
    } else {
      toast.error('Failed to delete report');
    }
    setDeleteId(null);
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'staff_roi':
        return <Users className="h-4 w-4" />;
      case 'vendor_verifier':
        return <Calculator className="h-4 w-4" />;
      case 'data_lead':
        return <BarChart3 className="h-4 w-4" />;
      case 'mailer':
        return <Mail className="h-4 w-4" />;
      case 'live_transfer':
        return <PhoneCall className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getReportTypeBadge = (type: string) => {
    switch (type) {
      case 'staff_roi':
        return <Badge variant="secondary">Staff ROI</Badge>;
      case 'vendor_verifier':
        return <Badge variant="outline">Vendor Verifier</Badge>;
      case 'data_lead':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Data Lead</Badge>;
      case 'mailer':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Mailer</Badge>;
      case 'live_transfer':
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Live Transfer</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const renderExpandedReport = (report: SavedReport) => {
    if (report.report_type === 'staff_roi') {
      return (
        <div className="mt-4 border-t border-border/20 pt-4">
          <StaffROIReportCard
            inputs={report.input_data as unknown as StaffROIInputs}
            results={report.results_data as unknown as StaffROIResults}
            isReadOnly={true}
          />
        </div>
      );
    }

    if (report.report_type === 'data_lead') {
      return (
        <div className="mt-4 border-t border-border/20 pt-4">
          <DataLeadReportCard
            inputs={report.input_data as unknown as MarketingInputs}
            derived={report.results_data as unknown as MarketingDerived}
            isReadOnly={true}
          />
        </div>
      );
    }

    if (report.report_type === 'mailer') {
      return (
        <div className="mt-4 border-t border-border/20 pt-4">
          <MailerReportCard
            inputs={report.input_data as unknown as MailerInputs}
            derived={report.results_data as unknown as MailerDerived}
            isReadOnly={true}
          />
        </div>
      );
    }

    if (report.report_type === 'live_transfer') {
      return (
        <div className="mt-4 border-t border-border/20 pt-4">
          <LiveTransferReportCard
            inputs={report.input_data as unknown as TransferInputs}
            derived={report.results_data as unknown as TransferDerived}
            isReadOnly={true}
          />
        </div>
      );
    }

    // Vendor Verifier and others - show basic data for now
    return (
      <div className="mt-4 border-t border-border/20 pt-4">
        <pre className="text-xs bg-muted/30 p-4 rounded-lg overflow-auto max-h-64">
          {JSON.stringify({ input: report.input_data, results: report.results_data }, null, 2)}
        </pre>
      </div>
    );
  };

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="pt-6">
          <p className="text-destructive text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Saved Reports</h2>
        <Select value={filter} onValueChange={(v) => setFilter(v as ReportFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reports</SelectItem>
            <SelectItem value="staff_roi">Staff ROI</SelectItem>
            <SelectItem value="vendor_verifier">Vendor Verifier</SelectItem>
            <SelectItem value="data_lead">Data Lead</SelectItem>
            <SelectItem value="mailer">Mailer</SelectItem>
            <SelectItem value="live_transfer">Live Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : reports.length === 0 ? (
        <Card className="bg-muted/20">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No saved reports yet</p>
              <p className="text-sm mt-1">
                Save reports from the Tools menu to view them here
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card 
              key={report.id} 
              className="bg-card/50 hover:bg-card/70 transition-colors"
            >
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {expandedId === report.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {getReportIcon(report.report_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {report.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(report.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    {getReportTypeBadge(report.report_type)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(report.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {expandedId === report.id && (
                <CardContent className="pt-0 px-4 pb-4">
                  {renderExpandedReport(report)}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SavedReportsHistory;
