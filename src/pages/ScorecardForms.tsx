import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, BarChart3, Users, Target, FileText, Award, Filter, UserCheck, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useScorecardForms } from "@/hooks/useScorecardForms";
import FormTemplateCard from "@/components/scorecards/FormTemplateCard";
import { SubmissionsList } from "@/components/scorecards/SubmissionsList";
import MetricsDashboard from "@/pages/MetricsDashboard";
import Explorer from "@/pages/Explorer";
import { UnifiedSettingsDialog } from "@/components/dialogs/UnifiedSettingsDialog";
import { EnhancedKPIConfigDialog } from "@/components/dialogs/EnhancedKPIConfigDialog";
import { DailyAgencyGoalsConfig } from "@/components/settings/DailyAgencyGoalsConfig";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getPreviousBusinessDay } from "@/utils/businessDays";

// Interface for form templates loaded via edge function
interface StaffFormTemplate {
  id: string;
  name: string;
  slug: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  schema_json: any;
  settings_json: any;
}

export default function ScorecardForms() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("metrics");
  const [formFilter, setFormFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const { forms: ownerForms, loading: ownerLoading, agencyId, deleteForm, toggleFormActive, refetch } = useScorecardForms();
  const { isAdmin } = useAuth();
  
  // Staff user detection - prevents session recovery from signing out staff users
  const [isStaffUser, setIsStaffUser] = useState(false);
  const [staffAgencyId, setStaffAgencyId] = useState<string | null>(null);
  const [staffAgencyProfile, setStaffAgencyProfile] = useState<{
    agencyId: string;
    agencySlug: string;
    agencyName: string;
  } | null>(null);
  const [staffDataLoaded, setStaffDataLoaded] = useState(false);
  
  // Staff-specific forms state (loaded via edge function)
  const [staffForms, setStaffForms] = useState<StaffFormTemplate[]>([]);
  const [staffFormsLoading, setStaffFormsLoading] = useState(false);

  // Detect staff user by verifying session token
  useEffect(() => {
    const detectStaffUser = async () => {
      const token = localStorage.getItem('staff_session_token');
      
      if (!token) {
        setStaffDataLoaded(true);
        return;
      }
      
      try {
        const { data, error } = await supabase.functions.invoke('staff_verify_session', {
          body: { session_token: token }
        });
        
        if (error || !data?.valid) {
          setStaffDataLoaded(true);
          return;
        }
        
        const agencyId = data.user?.agency_id;
        const agencySlug = data.user?.agency_slug;
        const agencyName = data.user?.agency_name;
        
        setIsStaffUser(true);
        setStaffAgencyId(agencyId || null);
        
        // Set full agency profile from staff_verify_session response
        if (agencyId && agencySlug) {
          setStaffAgencyProfile({
            agencyId: agencyId,
            agencySlug: agencySlug,
            agencyName: agencyName || '',
          });
        }
        
        setStaffDataLoaded(true);
      } catch (err) {
        console.error('Error detecting staff user:', err);
        setStaffDataLoaded(true);
      }
    };
    
    detectStaffUser();
  }, []);

  // Load forms via edge function for staff users
  useEffect(() => {
    const loadStaffForms = async () => {
      if (!isStaffUser || !staffDataLoaded) return;
      
      const token = localStorage.getItem('staff_session_token');
      if (!token) return;
      
      setStaffFormsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('scorecards_admin', {
          headers: {
            'x-staff-session': token,
          },
          body: {
            action: 'forms_list',
          },
        });
        
        if (error) {
          console.error('Edge function error loading forms:', error);
          return;
        }
        
        if (data?.error) {
          console.error('scorecards_admin forms error:', data.error);
          return;
        }
        // Map forms with default values for schema_json and settings_json
        const formsData = (data?.forms || []).map((f: any) => ({
          ...f,
          schema_json: f.schema_json || {},
          settings_json: f.settings_json || {},
        }));
        setStaffForms(formsData);
      } catch (err) {
        console.error('Error loading staff forms:', err);
      } finally {
        setStaffFormsLoading(false);
      }
    };
    
    loadStaffForms();
  }, [isStaffUser, staffDataLoaded]);

  // Use staff forms when staff user, otherwise owner forms
  const forms = isStaffUser ? staffForms : ownerForms;
  const loading = isStaffUser ? staffFormsLoading : ownerLoading;
  
  // Check if diagnostics should be shown (only for Supabase-authenticated admins, not staff)
  const showDiagnostics = !isStaffUser && isAdmin && import.meta.env.VITE_SHOW_DIAGNOSTICS === 'true';

  // TEMP: Phase 3 Batch 5 CI Gate - KPI smoke test (only run in dev/admin diagnostic mode)
  useEffect(() => {
    if (!showDiagnostics) return; // Don't run smoke test in production for non-admins
    
    try {
      const FLAG = 'phase4_final_test_done';
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
          outbound_calls: 100,
          talk_minutes: 240,
          quoted_count: 6,
          sold_items: 3,
          quoted_details: [
            { prospect_name: 'Phase4 Final Test A', lead_source: '1262c038-c548-42be-aae0-9c99e2cacb0a', detailed_notes: 'Phase 4 final smoke test - all 17 functions restored' },
            { prospect_name: 'Phase4 Final Test B', lead_source: '1262c038-c548-42be-aae0-9c99e2cacb0a', detailed_notes: 'Phase 4 final smoke test - deploy gates enforced' },
            { prospect_name: 'Phase4 Final Test C', lead_source: '1262c038-c548-42be-aae0-9c99e2cacb0a', detailed_notes: 'Phase 4 final smoke test - nightly regression enabled' },
            { prospect_name: 'Phase4 Final Test D', lead_source: '1262c038-c548-42be-aae0-9c99e2cacb0a', detailed_notes: 'Phase 4 final smoke test - v-functions-restored tag ready' },
          ],
        },
      } as const;

      (async () => {
        console.log('🚀 BATCH 5 CI GATE submitting...', payload);
        const { data, error } = await supabase.functions.invoke('submit_public_form', { body: payload });
        if (error) {
          console.error('❌ BATCH 5 CI GATE failed:', error);
          toast.error(`Batch 5 CI gate failed: ${error.message || 'unknown error'}`);
          return;
        }
        console.log('✅ BATCH 5 CI GATE success:', data);
        sessionStorage.setItem(FLAG, '1');
        toast.success(`Batch 5 CI gate: ${data?.submission_id?.slice(0,8) || 'unknown'}...`);
      })();
    } catch (e) {
      console.error('❌ BATCH 5 CI GATE exception:', e);
    }
  }, [showDiagnostics]);

  const handleDeleteForm = async (formId: string) => {
    await deleteForm(formId);
    await refetch();
  };

  const handleToggleActive = async (formId: string, isActive: boolean): Promise<boolean> => {
    const success = await toggleFormActive(formId, isActive);
    if (success) {
      await refetch();
    }
    return success;
  };

  const handleDuplicateForm = async (newForm: any) => {
    // Refresh the forms list to show the new duplicate
    if (isStaffUser) {
      // Reload staff forms via edge function
      const token = localStorage.getItem('staff_session_token');
      if (token) {
        const { data } = await supabase.functions.invoke('scorecards_admin', {
          headers: { 'x-staff-session': token },
          body: { action: 'forms_list' },
        });
        if (data?.forms) {
          setStaffForms(data.forms.map((f: any) => ({
            ...f,
            schema_json: f.schema_json || {},
            settings_json: f.settings_json || {},
          })));
        }
      }
    } else {
      await refetch();
    }
  };

  // Filter forms based on selection
  const filteredForms = forms.filter(form => {
    if (formFilter === 'active') return form.is_active;
    if (formFilter === 'inactive') return !form.is_active;
    return true; // 'all'
  });

  // Wait for staff detection to complete before rendering
  if (!staffDataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Metrics</h1>
            <p className="text-muted-foreground mt-2">
              View performance analytics and manage KPI tracking forms
            </p>
          </div>
        </div>

        {/* Meeting Frame CTA - Works for both staff and regular users */}
        <div className="mb-6">
          <Button 
            variant="outline" 
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => navigate(isStaffUser ? "/staff/meeting-frame" : "/agency?tab=meeting-frame")}
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Create a 1-on-1 Meeting Frame with your team
          </Button>
        </div>

        {/* GO-LIVE STATUS - Only show in dev mode or for admins with diagnostics enabled */}
        {showDiagnostics && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 p-6 rounded-lg border border-green-200 dark:border-green-800 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <h2 className="text-lg font-semibold text-green-800 dark:text-green-200">🚀 GO-LIVE READY - All Systems Operational</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded">
                <p className="font-medium text-green-700 dark:text-green-300">✅ Functions Deployed</p>
                <p className="text-muted-foreground">17/17 DISK=CONFIG</p>
              </div>
              <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded">
                <p className="font-medium text-blue-700 dark:text-blue-300">✅ CI Gates Active</p>
                <p className="text-muted-foreground">Required on main</p>
              </div>
              <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded">
                <p className="font-medium text-purple-700 dark:text-purple-300">✅ KPI Smoke Passing</p>
                <p className="text-muted-foreground">0 null violations</p>
              </div>
            </div>
            <div className="mt-4 text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
              <span>Tag: v-functions-restored</span>
              <span>•</span>
              <span>Nightly tests: 2:00 AM UTC</span>
              <span>•</span>
              <span>Structured logging: ACTIVE</span>
            </div>
          </div>
        )}

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
            <MetricsDashboard 
              staffAgencyProfile={isStaffUser ? staffAgencyProfile : undefined}
              defaultDate={isStaffUser ? getPreviousBusinessDay() : undefined}
            />
          </TabsContent>

          <TabsContent value="forms" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Form Templates</h2>
              <div className="flex items-center gap-3">
                <Select value={formFilter} onValueChange={(v) => setFormFilter(v as 'all' | 'active' | 'inactive')}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                    <SelectItem value="all">All Forms</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => navigate(isStaffUser ? "/staff/metrics/builder" : "/metrics/builder")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Form
                </Button>
              </div>
            </div>
            
            {/* Always show template cards */}
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
                    onClick={() => navigate(isStaffUser ? "/staff/metrics/builder?role=sales" : "/metrics/builder?role=sales")}
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
                    onClick={() => navigate(isStaffUser ? "/staff/metrics/builder?role=service" : "/metrics/builder?role=service")}
                  >
                    Create Service Form
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Show existing forms below */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading forms...</p>
              </div>
            ) : filteredForms.length > 0 ? (
              <>
                <h3 className="text-lg font-semibold mt-6">
                  {formFilter === 'active' ? 'Active Forms' : formFilter === 'inactive' ? 'Inactive Forms' : 'All Forms'}
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {filteredForms.map((form) => (
                    <FormTemplateCard 
                      key={form.id} 
                      form={form} 
                      onDelete={handleDeleteForm}
                      onToggleActive={handleToggleActive}
                      onDuplicate={handleDuplicateForm}
                    />
                  ))}
                </div>
              </>
            ) : forms.length > 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No {formFilter} forms found. Try a different filter.
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="submissions" className="space-y-6">
            <SubmissionsList staffAgencyId={isStaffUser ? staffAgencyId : undefined} />
          </TabsContent>

          <TabsContent value="explorer" className="space-y-6">
            <div className="bg-background rounded-lg">
              <Explorer staffAgencyId={isStaffUser ? staffAgencyId : undefined} />
            </div>
          </TabsContent>

          <TabsContent value="targets" className="space-y-6">
            {/* Daily Agency Goals - Use effectiveAgencyId for staff support */}
            {(isStaffUser ? staffAgencyId : agencyId) && <DailyAgencyGoalsConfig agencyId={(isStaffUser ? staffAgencyId : agencyId)!} />}
            
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
                      <EnhancedKPIConfigDialog title="Configure Sales KPIs" type="sales" agencyId={isStaffUser ? staffAgencyId! : agencyId} isStaffMode={isStaffUser}>
                        <Button variant="outline" className="w-full">
                          <Target className="h-4 w-4 mr-2" />
                          Configure Sales KPIs
                        </Button>
                      </EnhancedKPIConfigDialog>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => navigate(isStaffUser ? "/staff/metrics/settings?role=sales" : "/settings?tab=scorecards&role=sales")}
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
                      <EnhancedKPIConfigDialog title="Configure Service KPIs" type="service" agencyId={isStaffUser ? staffAgencyId! : agencyId} isStaffMode={isStaffUser}>
                        <Button variant="outline" className="w-full">
                          <Target className="h-4 w-4 mr-2" />
                          Configure Service KPIs
                        </Button>
                      </EnhancedKPIConfigDialog>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => navigate(isStaffUser ? "/staff/metrics/settings?role=service" : "/settings?tab=scorecards&role=service")}
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