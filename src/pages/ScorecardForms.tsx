import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, BarChart3, Users, Target, FileText, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import { useScorecardForms } from "@/hooks/useScorecardForms";
import FormTemplateCard from "@/components/scorecards/FormTemplateCard";
import { SubmissionsList } from "@/components/scorecards/SubmissionsList";
import MetricsDashboard from "@/pages/MetricsDashboard";
import Explorer from "@/pages/Explorer";
import { UnifiedSettingsDialog } from "@/components/dialogs/UnifiedSettingsDialog";
import { EnhancedKPIConfigDialog } from "@/components/dialogs/EnhancedKPIConfigDialog";

export default function ScorecardForms() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("metrics");
  const { forms, loading, agencyId } = useScorecardForms();

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Metrics</h1>
            <p className="text-muted-foreground mt-2">
              View performance analytics and manage KPI tracking forms
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="forms" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Forms
            </TabsTrigger>
            <TabsTrigger value="submissions" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Submissions
            </TabsTrigger>
            <TabsTrigger value="explorer" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Explorer
            </TabsTrigger>
            <TabsTrigger value="targets" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Targets
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-6">
            <MetricsDashboard />
          </TabsContent>

          <TabsContent value="forms" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Form Templates</h2>
              <Button onClick={() => navigate("/metrics/builder")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Form
              </Button>
            </div>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading forms...</p>
              </div>
            ) : forms.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {forms.map((form) => (
                  <FormTemplateCard key={form.id} form={form} />
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-2 border-dashed border-muted hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Sales Scorecard
                    </CardTitle>
                    <CardDescription>
                      Create a daily KPI tracking form for sales team members
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate("/metrics/builder?role=sales")}
                    >
                      Create Sales Form
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-dashed border-muted hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Service Scorecard
                    </CardTitle>
                    <CardDescription>
                      Create a daily KPI tracking form for service team members
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate("/metrics/builder?role=service")}
                    >
                      Create Service Form
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="submissions" className="space-y-6">
            <SubmissionsList />
          </TabsContent>

          <TabsContent value="explorer" className="space-y-6">
            <div className="bg-background rounded-lg">
              <Explorer />
            </div>
          </TabsContent>

          <TabsContent value="targets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Targets & Scoring</CardTitle>
                <CardDescription>
                  Set KPI targets and configure scoring rules for your team members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Sales Targets & Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <EnhancedKPIConfigDialog title="Configure Sales KPIs" type="sales" agencyId={agencyId}>
                        <Button variant="outline" className="w-full">
                          <Target className="h-4 w-4 mr-2" />
                          Configure Sales KPIs
                        </Button>
                      </EnhancedKPIConfigDialog>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => navigate("/scorecard-settings?role=sales")}
                      >
                        <Award className="h-4 w-4 mr-2" />
                        Sales Scoring Rules
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Service Targets & Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <EnhancedKPIConfigDialog title="Configure Service KPIs" type="service" agencyId={agencyId}>
                        <Button variant="outline" className="w-full">
                          <Target className="h-4 w-4 mr-2" />
                          Configure Service KPIs
                        </Button>
                      </EnhancedKPIConfigDialog>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => navigate("/scorecard-settings?role=service")}
                      >
                        <Award className="h-4 w-4 mr-2" />
                        Service Scoring Rules
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure basic agency settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UnifiedSettingsDialog title="General Settings">
                  <div className="w-full">
                    {/* Settings form content will be displayed directly here instead of behind a button */}
                  </div>
                </UnifiedSettingsDialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}