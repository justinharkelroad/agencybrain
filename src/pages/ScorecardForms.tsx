import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, BarChart3, Users, Target, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import { useScorecardForms } from "@/hooks/useScorecardForms";
import FormTemplateCard from "@/components/scorecards/FormTemplateCard";

export default function ScorecardForms() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("forms");
  const { forms, loading } = useScorecardForms();

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Scorecard Forms</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage daily KPI tracking forms for your team
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
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
            <TabsTrigger value="dashboards" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboards
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forms" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Form Templates</h2>
              <Button onClick={() => navigate("/scorecard-forms/builder")}>
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
                      onClick={() => navigate("/scorecard-forms/builder?role=sales")}
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
                      onClick={() => navigate("/scorecard-forms/builder?role=service")}
                    >
                      Create Service Form
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="submissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Submissions</CardTitle>
                <CardDescription>
                  View and manage form submissions from your team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  No submissions yet. Create a form to start collecting data.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="explorer" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Data Explorer</CardTitle>
                <CardDescription>
                  Search and analyze quoted household details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  No data to explore yet. Submissions will appear here once forms are created.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="targets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Targets</CardTitle>
                <CardDescription>
                  Set and manage KPI targets for your team members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  No targets configured. Set targets to enable pass/fail scoring.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboards" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Sales Dashboard</CardTitle>
                  <CardDescription>
                    View sales team performance and metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" disabled>
                    View Sales Dashboard
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service Dashboard</CardTitle>
                  <CardDescription>
                    View service team performance and metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" disabled>
                    View Service Dashboard
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agency Settings</CardTitle>
                <CardDescription>
                  Configure scorecard settings for your agency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Settings will be available here to configure timezones, reminders, and scoring rules.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}