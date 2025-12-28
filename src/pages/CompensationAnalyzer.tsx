import { useState } from "react";
import { FileSpreadsheet, Upload, FileText, History, Settings } from "lucide-react";
import { SidebarLayout } from "@/components/SidebarLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompSettingsForm } from "@/components/compensation/CompSettingsForm";
import { StatementUploader } from "@/components/compensation/StatementUploader";
import { ReportHistory } from "@/components/compensation/ReportHistory";

export default function CompensationAnalyzer() {
  const [activeTab, setActiveTab] = useState("upload");
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);

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
              onReportGenerated={(priorUploadId, currentUploadId) => {
                // Store pending report info - actual report generation is Phase 3
                setCurrentReportId(`pending-${priorUploadId}-${currentUploadId}`);
                setActiveTab("report");
              }}
            />
          </TabsContent>

          {/* Current Report Tab */}
          <TabsContent value="report" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Report</CardTitle>
                <CardDescription>
                  View your most recent compensation analysis report.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium mb-2">
                    {currentReportId ? "Report generation coming in Phase 3" : "No report available"}
                  </p>
                  <p className="text-sm">
                    {currentReportId
                      ? "Your statements have been uploaded. Report analysis will be available soon."
                      : "Upload and compare statements to generate a report."}
                  </p>
                </div>
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
            <CompSettingsForm />
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
}
