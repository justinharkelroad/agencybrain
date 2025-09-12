import { useEffect, useState } from "react";
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
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function ScorecardForms() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("metrics");
const { forms, loading, agencyId, deleteForm, refetch } = useScorecardForms();

  // TEMP: Phase 3 Batch 1 CI Gate - KPI smoke test
  useEffect(() => {
    try {
      const FLAG = 'batch1_test_done';
      if (sessionStorage.getItem(FLAG)) return;

      const today = new Date().toISOString().slice(0, 10);

      const payload = {
        agencySlug: 'hfi-inc',
        formSlug: 'sales-scorecard-new',
        token: 'f5124452-c71b-43fc-b422-1703e8795347',
        teamMemberId: '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316',
        submissionDate: today,
        workDate: today,
        values: {
          team_member_id: '518a5ac1-53c4-4dc9-ba8d-21a6c8d98316',
          submission_date: today,
          work_date: today,
          outbound_calls: 25,
          talk_minutes: 47,
          quoted_count: 3,
          sold_items: 1,
          quoted_details: [
            { prospect_name: 'Batch1 Test A', lead_source: '1262c038-c548-42be-aae0-9c99e2cacb0a', detailed_notes: 'Phase 3 Batch 1 CI gate' },
            { prospect_name: 'Batch1 Test B', lead_source: '1262c038-c548-42be-aae0-9c99e2cacb0a', detailed_notes: 'Phase 3 Batch 1 CI gate' },
            { prospect_name: 'Batch1 Test C', lead_source: '1262c038-c548-42be-aae0-9c99e2cacb0a', detailed_notes: 'Phase 3 Batch 1 CI gate' },
          ],
        },
      } as const;

      (async () => {
        console.log('🚀 BATCH 1 CI GATE submitting...', payload);
        const { data, error } = await supabase.functions.invoke('submit_public_form', { body: payload });
        if (error) {
          console.error('❌ BATCH 1 CI GATE failed:', error);
          toast.error(`Batch 1 CI gate failed: ${error.message || 'unknown error'}`);
          return;
        }
        console.log('✅ BATCH 1 CI GATE success:', data);
        sessionStorage.setItem(FLAG, '1');
        toast.success(`Batch 1 CI gate: ${data?.submission_id?.slice(0,8) || 'unknown'}...`);
      })();
    } catch (e) {
      console.error('❌ BATCH 1 CI GATE exception:', e);
    }
  }, []);

  const handleDeleteForm = async (formId: string) => {
    await deleteForm(formId);
    // Refetch to ensure UI is updated immediately
    await refetch();
  };

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
          <TabsList className="grid w-full grid-cols-5">
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
                  <FormTemplateCard key={form.id} form={form} onDelete={handleDeleteForm} />
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
                        onClick={() => navigate("/settings?tab=scorecards&role=sales")}
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
                        onClick={() => navigate("/settings?tab=scorecards&role=service")}
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

        </Tabs>
      </div>
    </div>
  );
}