import { useState, useMemo } from "react";
import { FileSpreadsheet, Upload, FileText, History, Settings, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SidebarLayout } from "@/components/SidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompSettingsForm } from "@/components/compensation/CompSettingsForm";
import { StatementUploader } from "@/components/compensation/StatementUploader";
import { ReportHistory } from "@/components/compensation/ReportHistory";
import { DiscrepancyResults } from "@/components/allstate-analyzer/DiscrepancyResults";
import { ValidationResult } from "@/lib/allstate-analyzer/rate-validator";
import { supabase } from "@/integrations/supabase/client";

export default function CompensationAnalyzer() {
  const [activeTab, setActiveTab] = useState("upload");
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [settingsVersion, setSettingsVersion] = useState(0);

  // Fetch full report data when a report is selected
  const { data: currentReport, isLoading: reportLoading } = useQuery({
    queryKey: ['comp-report-detail', currentReportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comp_comparison_reports')
        .select(`
          *,
          prior_upload:prior_upload_id(statement_month, statement_year, filename),
          current_upload:current_upload_id(statement_month, statement_year, filename)
        `)
        .eq('id', currentReportId!)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentReportId,
  });

  return (
    <SidebarLayout>
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Compensation Statement Analyzer</h1>
          </div>
          <p className="text-muted-foreground">
            Upload your Allstate compensation statements to verify rates, compare year-over-year, and identify potential discrepancies.
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload & Compare</span>
              <span className="sm:hidden">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-2" disabled={!currentReportId}>
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Current Report</span>
              <span className="sm:hidden">Report</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Report History</span>
              <span className="sm:hidden">History</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Upload & Compare Tab */}
          <TabsContent value="upload" className="space-y-6">
            <StatementUploader
              key={settingsVersion}
              onReportGenerated={(reportId) => {
                setCurrentReportId(reportId);
                setActiveTab("report");
              }}
            />
          </TabsContent>

          {/* Current Report Tab */}
          <TabsContent value="report" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Comparison Report</CardTitle>
                <CardDescription>
                  {currentReport ? (
                    <>
                      Comparing {(currentReport.prior_upload as any)?.statement_month}/{(currentReport.prior_upload as any)?.statement_year} 
                      {" → "}
                      {(currentReport.current_upload as any)?.statement_month}/{(currentReport.current_upload as any)?.statement_year}
                    </>
                  ) : (
                    "View your compensation analysis report."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reportLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : currentReport ? (
                  <div className="space-y-6">
                    {/* Check if validation data exists in comparison_data */}
                    {(currentReport.comparison_data as any)?.validation ? (
                      <DiscrepancyResults 
                        results={(currentReport.comparison_data as any).validation as ValidationResult} 
                      />
                    ) : (
                      <>
                        {/* Legacy display for old reports without validation data */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 border rounded-lg">
                            <p className="text-sm text-muted-foreground">Discrepancies Found</p>
                            <p className="text-2xl font-bold">{currentReport.discrepancies_found ?? 0}</p>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <p className="text-sm text-muted-foreground">Potential Underpayment</p>
                            <p className="text-2xl font-bold text-destructive">
                              ${((currentReport.potential_underpayment_cents ?? 0) / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-lg font-semibold mb-2">Summary Data</h3>
                          <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64">
                            {JSON.stringify(currentReport.summary_data, null, 2)}
                          </pre>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4" />
                    <p className="text-lg font-medium mb-2">No report selected</p>
                    <p className="text-sm">
                      Upload and compare statements or select a report from history.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Report History Tab */}
          <TabsContent value="history" className="space-y-6">
            <ReportHistory
              onSelectReport={(reportId) => {
                setCurrentReportId(reportId);
                setActiveTab("report");
              }}
            />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <CompSettingsForm onSettingsSaved={() => setSettingsVersion(v => v + 1)} />
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
