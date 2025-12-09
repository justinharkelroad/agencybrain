import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Eye, Link2, Settings } from "lucide-react";
import KPIFieldManager from "@/components/FormBuilder/KPIFieldManager";
import CustomFieldManager from "@/components/FormBuilder/CustomFieldManager";
import AdvancedSettings from "@/components/FormBuilder/AdvancedSettings";
import NotificationSettings from "@/components/FormBuilder/NotificationSettings";
import FormPreview from "@/components/FormBuilder/FormPreview";
import RepeaterSectionManager from "@/components/FormBuilder/RepeaterSectionManager";

import KPIManagementDialog from "@/components/dialogs/KPIManagementDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
  import { useAgencyKpis } from "@/hooks/useKpis";
  import { toast } from "sonner";
  import { supabase } from '@/lib/supabaseClient';
  import { useAuth } from "@/lib/auth";

interface KPIField {
  key: string;
  label: string;
  required: boolean;
  type: 'number' | 'currency' | 'percentage';
  selectedKpiId?: string; // Links to actual agency KPI
  selectedKpiSlug?: string; // KPI slug for submission mapping
  target?: {
    minimum?: number;
    goal?: number;
    excellent?: number;
  };
}

interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'dropdown' | 'radio' | 'checkbox' | 'date';
  required: boolean;
  options?: string[];
}

interface LeadSource {
  id: string;
  name: string;
  is_active: boolean;
  order_index: number;
}

interface RepeaterSection {
  enabled: boolean;
  title: string;
  description?: string;
  triggerKPI?: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'select' | 'number' | 'currency';
    required: boolean;
    options?: string[];
  }>;
}

interface FormSchema {
  title: string;
  role: 'Sales' | 'Service';
  kpis: KPIField[];
  customFields?: CustomField[];
  repeaterSections?: {
    quotedDetails: RepeaterSection;
    soldDetails: RepeaterSection;
  };
  fieldMappings?: {
    repeater?: {
      quotedDetails?: {
        items_quoted?: string;
        policies_quoted?: string;
        premium_potential_cents?: string;
      }
    };
  };
  settings: {
    dueBy: string;
    customDueTime?: string;
    lateCountsForPass: boolean;
    reminderTimes: string[];
    ccOwner: boolean;
    suppressIfFinal: boolean;
    // Email notification settings
    sendImmediateEmail: boolean;
    additionalImmediateRecipients: string[];
    sendDailySummary: boolean;
    dailySummaryRecipients: 'sales_team' | 'service_team' | 'all_team' | 'owner_only' | 'custom';
    customSummaryRecipients: string[];
  };
}

// Sales-specific default KPI targets
const SALES_KPI_TARGETS: Record<string, { minimum: number; goal: number; excellent: number }> = {
  sold_items: { minimum: 0, goal: 2, excellent: 3 },
  quoted_count: { minimum: 0, goal: 5, excellent: 7 },
  talk_minutes: { minimum: 0, goal: 180, excellent: 220 },
  outbound_calls: { minimum: 0, goal: 100, excellent: 150 },
};

// Service-specific default KPI targets
const SERVICE_KPI_TARGETS: Record<string, { minimum: number; goal: number; excellent: number }> = {
  outbound_calls: { minimum: 0, goal: 30, excellent: 50 },
  talk_minutes: { minimum: 0, goal: 180, excellent: 220 },
  cross_sells_uncovered: { minimum: 0, goal: 2, excellent: 3 },
  mini_reviews: { minimum: 0, goal: 2, excellent: 3 },
};

const TIME_OPTIONS = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '16:45', label: '4:45 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
  { value: '22:00', label: '10:00 PM' },
  { value: '23:00', label: '11:00 PM' },
  { value: '23:59', label: '11:59 PM' },
];

const formatTimeToAMPM = (time24: string): string => {
  const [hours, minutes] = time24.split(':');
  const hour24 = parseInt(hours);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${period}`;
};

export default function ScorecardFormBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [agencyId, setAgencyId] = useState<string>("");
  const [currentMemberId, setCurrentMemberId] = useState<string>("");

  const roleParam = searchParams.get('role')?.toLowerCase();
  const initialRole: 'Sales' | 'Service' = roleParam === 'service' ? 'Service' : 'Sales';
  
  const [formSchema, setFormSchema] = useState<FormSchema>({
    title: `${initialRole} Scorecard`,
    role: initialRole,
    kpis: [],
    customFields: [],
    repeaterSections: {
      quotedDetails: {
        enabled: false,
        title: 'Quoted Household Details',
        description: 'Capture detailed information for each quoted household',
        triggerKPI: 'quoted_count',
        fields: []
      },
      soldDetails: {
        enabled: false,
        title: 'Sold Household Details',
        description: 'Track household details and policy information for each sale',
        triggerKPI: 'sold_items',
        fields: []
      }
    },
    fieldMappings: {
      repeater: {
        quotedDetails: {
          items_quoted: undefined,
          policies_quoted: undefined,
          premium_potential_cents: undefined
        }
      }
    },
    settings: {
      dueBy: 'same-day-23:59',
      lateCountsForPass: false,
      reminderTimes: ['16:45', '07:00'],
      ccOwner: true,
      suppressIfFinal: true,
      // Email notification defaults based on role
      sendImmediateEmail: true,
      additionalImmediateRecipients: [],
      sendDailySummary: false,
      dailySummaryRecipients: initialRole === 'Service' ? 'service_team' : 'sales_team',
      customSummaryRecipients: [],
    }
  });

  // Load KPIs and scorecard rules with role filtering
  const { data: agencyKpis = [], isLoading: kpisLoading, error: kpisError, refetch } = useAgencyKpis(agencyId, formSchema.role);
  
  // Load scorecard rules for preselected KPIs
  const [scorecardRules, setScorecardRules] = useState<{ selected_metrics?: string[] } | null>(null);
  
  useEffect(() => {
    const loadScorecardRules = async () => {
      if (!agencyId) return;
      
      const { data } = await supabase
        .from('scorecard_rules')
        .select('selected_metrics, selected_metric_slugs')
        .eq('agency_id', agencyId)
        .eq('role', formSchema.role)
        .single();
        
      setScorecardRules(data);
    };
    
    loadScorecardRules();
  }, [agencyId, formSchema.role]);

  useEffect(() => {
    const fetchAgencyAndMember = async () => {
      if (!user?.id) return;
      
      const { data: profile } = await supa
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();
        
      if (profile?.agency_id) {
        setAgencyId(profile.agency_id);
        
        // Get first team member for this agency (for KPI loading)
        const { data: members } = await supa
          .from('team_members')
          .select('id')
          .eq('agency_id', profile.agency_id)
          .limit(1);
          
        if (members?.[0]) {
          setCurrentMemberId(members[0].id);
        }
      }
    };
    
    fetchAgencyAndMember();
  }, [user?.id]);

  // Initialize KPI fields when agency KPIs load or role changes
  useEffect(() => {
    if (agencyKpis.length > 0 && scorecardRules) {
      const preselectedSlugs = scorecardRules.selected_metrics || [];
      
      // Create KPI fields for preselected metrics
      const kpiFields: KPIField[] = preselectedSlugs.map((slug, index) => {
        const matchedKpi = agencyKpis.find(k => k.slug === slug);
        // Use role-specific defaults based on initialRole, with fallback to other role
        const roleTargets = initialRole === 'Service' ? SERVICE_KPI_TARGETS : SALES_KPI_TARGETS;
        const otherTargets = initialRole === 'Service' ? SALES_KPI_TARGETS : SERVICE_KPI_TARGETS;
        const defaultTarget = roleTargets[slug] || otherTargets[slug] || { minimum: 0, goal: 0, excellent: 0 };
        return {
          key: `preselected_kpi_${index}_${slug}`,
          label: matchedKpi?.label || slug,
          required: true,
          type: 'number' as const,
          selectedKpiId: matchedKpi?.kpi_id,
          selectedKpiSlug: slug,
          target: defaultTarget
        };
      });
      
      setFormSchema(prev => ({
        ...prev,
        kpis: kpiFields
      }));
    }
  }, [agencyKpis, scorecardRules]);

  const handleRoleChange = (newRole: 'Sales' | 'Service') => {
    setFormSchema(prev => ({
      ...prev,
      role: newRole,
      kpis: [] // Will be repopulated when scorecard rules load
    }));
  };

  const handleSave = async () => {
    if (!agencyId) {
      toast.error("Agency information not found");
      return;
    }

    setLoading(true);
    try {
      const slug = formSchema.title.toLowerCase().replace(/\s+/g, '-');
      
      // Create form template (upsert to handle duplicate slug)
      const { data: template, error: templateError } = await supa
        .from('form_templates')
        .upsert({
          agency_id: agencyId,
          name: formSchema.title,
          slug: slug,
          role: formSchema.role,
          schema_json: formSchema as any,
          settings_json: formSchema.settings as any,
          field_mappings: formSchema.fieldMappings as any,
          is_active: true,
        }, { onConflict: 'agency_id,slug' })
        .select()
        .single();

      if (templateError) throw templateError;

      // Upsert form link (handles existing links gracefully)
      const token = crypto.randomUUID();
      const { error: linkError } = await supa
        .from('form_links')
        .upsert({
          form_template_id: template.id,
          agency_id: agencyId,
          token: token,
          enabled: true,
        }, { onConflict: 'form_template_id' });

      if (linkError && !linkError.message?.includes('duplicate')) {
        console.error('Form link error:', linkError);
      }

      // Bind KPI fields to their versions
      const { error: bindError } = await supa.rpc('bind_form_kpis', {
        p_form: template.id
      });

      if (bindError) {
        console.error('Error binding KPIs:', bindError);
        // Don't fail the form creation, just warn
        toast.error("Form created but KPI bindings failed: " + bindError.message);
      }

      toast.success("Form created successfully!");
      navigate('/scorecard-forms');
    } catch (error: any) {
      console.error('Error creating form:', error);
      toast.error(error.message || "Failed to create form");
    } finally {
      setLoading(false);
    }
  };

  const updateKPILabel = (index: number, label: string) => {
    const updatedKPIs = [...formSchema.kpis];
    updatedKPIs[index] = { ...updatedKPIs[index], label };
    setFormSchema(prev => ({ ...prev, kpis: updatedKPIs }));
  };

  const toggleKPIRequired = (index: number) => {
    const updatedKPIs = [...formSchema.kpis];
    updatedKPIs[index] = { ...updatedKPIs[index], required: !updatedKPIs[index].required };
    setFormSchema(prev => ({ ...prev, kpis: updatedKPIs }));
  };

  const updateKPIType = (index: number, type: 'number' | 'currency' | 'percentage') => {
    const updatedKPIs = [...formSchema.kpis];
    updatedKPIs[index] = { ...updatedKPIs[index], type };
    setFormSchema(prev => ({ ...prev, kpis: updatedKPIs }));
  };

  const updateKPITarget = (index: number, target: { minimum?: number; goal?: number; excellent?: number }) => {
    const updatedKPIs = [...formSchema.kpis];
    updatedKPIs[index] = { ...updatedKPIs[index], target };
    setFormSchema(prev => ({ ...prev, kpis: updatedKPIs }));
  };

  const updateKpiSelection = (index: number, kpiId: string, slug: string, label: string) => {
    const updatedKPIs = [...formSchema.kpis];
    // Select defaults based on form role, with fallback to other role
    const roleTargets = formSchema.role === 'Service' ? SERVICE_KPI_TARGETS : SALES_KPI_TARGETS;
    const otherTargets = formSchema.role === 'Service' ? SALES_KPI_TARGETS : SERVICE_KPI_TARGETS;
    const defaultTargets = roleTargets[slug] || otherTargets[slug];
    
    updatedKPIs[index] = { 
      ...updatedKPIs[index], 
      selectedKpiId: kpiId,
      selectedKpiSlug: slug,
      // Only update label if it's empty or was auto-generated, don't override user input
      ...(updatedKPIs[index].label === 'New KPI' || !updatedKPIs[index].label ? { label } : {}),
      // Auto-populate targets if defaults exist and no targets are set yet
      ...(defaultTargets ? { target: defaultTargets } : {})
    };
    setFormSchema(prev => ({ ...prev, kpis: updatedKPIs }));
  };

  const addKPIField = () => {
    const newKPI: KPIField = {
      key: `custom_kpi_${formSchema.kpis.length}`,
      label: 'New KPI',
      required: false,
      type: 'number'
    };
    setFormSchema(prev => ({ ...prev, kpis: [...prev.kpis, newKPI] }));
  };

  const removeKPIField = (index: number) => {
    const updatedKPIs = formSchema.kpis.filter((_, i) => i !== index);
    setFormSchema(prev => ({ ...prev, kpis: updatedKPIs }));
  };

  const addCustomField = () => {
    const newField: CustomField = {
      key: `field_${formSchema.customFields?.length || 0}`,
      label: 'New Field',
      type: 'text',
      required: false
    };
    setFormSchema(prev => ({ 
      ...prev, 
      customFields: [...(prev.customFields || []), newField] 
    }));
  };

  const updateCustomField = (index: number, field: Partial<CustomField>) => {
    const updatedFields = [...(formSchema.customFields || [])];
    updatedFields[index] = { ...updatedFields[index], ...field };
    setFormSchema(prev => ({ ...prev, customFields: updatedFields }));
  };

  const removeCustomField = (index: number) => {
    const updatedFields = (formSchema.customFields || []).filter((_, i) => i !== index);
    setFormSchema(prev => ({ ...prev, customFields: updatedFields }));
  };

  if (kpisLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="flex items-center gap-2 justify-center mt-20">
            <LoadingSpinner />
            <span>Loading KPI configuration...</span>
          </div>
        </div>
      </div>
    );
  }

  if (kpisError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="text-destructive text-center mt-20">
            Error loading KPIs: {kpisError.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/scorecard-forms')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Forms
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Form Builder</h1>
            <p className="text-muted-foreground mt-2">
              Create a new scorecard form for your team
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Configuration */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Settings</CardTitle>
                <CardDescription>
                  Configure the basic settings for your form
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Form Title</Label>
                  <Input
                    id="title"
                    value={formSchema.title}
                    onChange={(e) => setFormSchema(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter form title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="role">Team Role</Label>
                  <Select 
                    value={formSchema.role} 
                    onValueChange={handleRoleChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>KPI Fields</CardTitle>
                    <CardDescription>Configure the KPI fields for your form</CardDescription>
                  </div>
                  {currentMemberId && (
                    <KPIManagementDialog 
                      memberId={currentMemberId} 
                      role={formSchema.role}
                      onKPIUpdated={() => refetch()}
                    >
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Manage KPIs
                      </Button>
                    </KPIManagementDialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <KPIFieldManager 
                  kpis={formSchema.kpis}
                  availableKpis={agencyKpis}
                  onUpdateLabel={updateKPILabel}
                  onToggleRequired={toggleKPIRequired}
                  onUpdateType={updateKPIType}
                  onUpdateTarget={updateKPITarget}
                  onUpdateKpiSelection={updateKpiSelection}
                  onAddField={addKPIField}
                  onRemoveField={removeKPIField}
                />
              </CardContent>
            </Card>

            <CustomFieldManager
              fields={formSchema.customFields || []}
              onUpdateField={updateCustomField}
              onAddField={addCustomField}
              onRemoveField={removeCustomField}
            />

            {/* Repeater Sections */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dynamic Detail Collection</h3>
              
              <RepeaterSectionManager
                section={formSchema.repeaterSections?.quotedDetails || {
                  enabled: false,
                  title: 'Quoted Household Details',
                  description: 'Collect details for each quoted household',
                  fields: []
                }}
                sectionKey="quotedDetails"
                kpiFields={formSchema.kpis.map(kpi => ({ key: kpi.key, label: kpi.label }))}
                onUpdateSection={(key, section) => {
                  setFormSchema(prev => ({
                    ...prev,
                    repeaterSections: {
                      ...prev.repeaterSections,
                      [key]: section
                    } as any
                  }));
                }}
              />


              <RepeaterSectionManager
                section={formSchema.repeaterSections?.soldDetails || {
                  enabled: false,
                  title: 'Sold Household Details',
                  description: 'Track household details and policy information',
                  fields: []
                }}
                sectionKey="soldDetails"
                kpiFields={formSchema.kpis.map(kpi => ({ key: kpi.key, label: kpi.label }))}
                onUpdateSection={(key, section) => {
                  setFormSchema(prev => ({
                    ...prev,
                    repeaterSections: {
                      ...prev.repeaterSections,
                      [key]: section
                    } as any
                  }));
                }}
              />
            </div>

            <AdvancedSettings 
              settings={formSchema.settings}
              onUpdateSettings={(settings) => setFormSchema(prev => ({
                ...prev,
                settings: { ...prev.settings, ...settings }
              }))}
            />

            <NotificationSettings
              settings={formSchema.settings}
              onUpdateSettings={(settings) => setFormSchema(prev => ({
                ...prev,
                settings: { ...prev.settings, ...settings }
              }))}
              agencyId={agencyId}
            />
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <FormPreview formSchema={formSchema} />

            <div className="flex gap-4">
              <Button onClick={handleSave} disabled={loading} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Creating..." : "Create Form"}
              </Button>
              <Button variant="outline" disabled>
                <Link2 className="h-4 w-4 mr-2" />
                Generate Link
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}