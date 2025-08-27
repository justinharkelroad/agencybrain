import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, BarChart3, Users, Target, FileText, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useScorecardForms } from "@/hooks/useScorecardForms";
import FormTemplateCard from "@/components/scorecards/FormTemplateCard";
import { SubmissionsList } from "@/components/scorecards/SubmissionsList";
import MetricsDashboard from "@/pages/MetricsDashboard";
import Explorer from "@/pages/Explorer";
import { GeneralSettingsDialog } from "@/components/dialogs/GeneralSettingsDialog";
import { KPIConfigDialog } from "@/components/dialogs/KPIConfigDialog";

export default function ScorecardForms() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("metrics");
  const { forms, loading } = useScorecardForms();

  return (
    <div className="min-h-screen bg-background">      
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
                <CardTitle>Performance Targets</CardTitle>
                <CardDescription>
                  Set and manage KPI targets for your team members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Sales Targets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <KPIConfigDialog title="Configure Sales KPIs" type="sales">
                        <Button variant="outline" className="w-full">
                          <Target className="h-4 w-4 mr-2" />
                          Configure Sales KPIs
                        </Button>
                      </KPIConfigDialog>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Service Targets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <KPIConfigDialog title="Configure Service KPIs" type="service">
                        <Button variant="outline" className="w-full">
                          <Target className="h-4 w-4 mr-2" />
                          Configure Service KPIs
                        </Button>
                      </KPIConfigDialog>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>
                    Configure basic agency settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <GeneralSettingsDialog title="Timezone Settings">
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Timezone Settings
                    </Button>
                  </GeneralSettingsDialog>
                  <GeneralSettingsDialog title="Notification Preferences">
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Notification Preferences
                    </Button>
                  </GeneralSettingsDialog>
                  <GeneralSettingsDialog title="Default Form Settings">
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Default Form Settings
                    </Button>
                  </GeneralSettingsDialog>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Scoring Rules</CardTitle>
                  <CardDescription>
                    Configure pass/fail criteria and scoring
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <KPIConfigDialog title="Sales Scoring Rules" type="sales">
                    <Button variant="outline" className="w-full justify-start">
                      <Target className="h-4 w-4 mr-2" />
                      Sales Scoring Rules
                    </Button>
                  </KPIConfigDialog>
                  <KPIConfigDialog title="Service Scoring Rules" type="service">
                    <Button variant="outline" className="w-full justify-start">
                      <Target className="h-4 w-4 mr-2" />
                      Service Scoring Rules
                    </Button>
                  </KPIConfigDialog>
                  <GeneralSettingsDialog title="Contest Settings">
                    <Button variant="outline" className="w-full justify-start">
                      <Award className="h-4 w-4 mr-2" />
                      Contest Settings
                    </Button>
                  </GeneralSettingsDialog>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}