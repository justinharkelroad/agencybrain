import { format } from "date-fns";
import { History, Eye, Loader2, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ReportHistoryProps {
  onSelectReport: (reportId: string) => void;
}

const getMonthName = (month: number) => {
  return format(new Date(2024, month - 1, 1), "MMM");
};

const formatCurrency = (cents: number | null) => {
  if (cents === null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
};

export function ReportHistory({ onSelectReport }: ReportHistoryProps) {
  const queryClient = useQueryClient();
  // Fetch agencyId from profile first
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile-for-history'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .maybeSingle();
      return data;
    },
  });

  const agencyId = profile?.agency_id;

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['comp-reports', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comp_comparison_reports')
        .select(`
          id,
          discrepancies_found,
          potential_underpayment_cents,
          created_at,
          prior_upload:prior_upload_id(statement_month, statement_year),
          current_upload:current_upload_id(statement_month, statement_year)
        `)
        .eq('agency_id', agencyId!)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!agencyId,
  });

  const handleDeleteReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('comp_comparison_reports')
        .delete()
        .eq('id', reportId);
      
      if (error) throw error;
      
      toast.success("Report deleted");
      queryClient.invalidateQueries({ queryKey: ['comp-reports', agencyId] });
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("Failed to delete report");
    }
  };

  if (profileLoading || reportsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No Reports Yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and compare statements to generate your first report.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report History</CardTitle>
        <CardDescription>
          View and manage your previous compensation comparison reports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prior Period</TableHead>
              <TableHead>Current Period</TableHead>
              <TableHead>Generated</TableHead>
              <TableHead className="text-right">Discrepancies</TableHead>
              <TableHead className="text-right">Potential Impact</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => {
              const priorUpload = report.prior_upload as { statement_month: number; statement_year: number } | null;
              const currentUpload = report.current_upload as { statement_month: number; statement_year: number } | null;
              
              return (
                <TableRow key={report.id}>
                  <TableCell>
                    {priorUpload
                      ? `${getMonthName(priorUpload.statement_month)} ${priorUpload.statement_year}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {currentUpload
                      ? `${getMonthName(currentUpload.statement_month)} ${currentUpload.statement_year}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(report.created_at!), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    {report.discrepancies_found ?? 0}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(report.potential_underpayment_cents)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectReport(report.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Report?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this comparison report. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteReport(report.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
