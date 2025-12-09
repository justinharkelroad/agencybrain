import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import KPIFieldManager from "@/components/FormBuilder/KPIFieldManager";
import CustomFieldManager from "@/components/FormBuilder/CustomFieldManager";
import AdvancedSettings from "@/components/FormBuilder/AdvancedSettings";
import NotificationSettings from "@/components/FormBuilder/NotificationSettings";
import FormPreview from "@/components/FormBuilder/FormPreview";
import RepeaterSectionManager from "@/components/FormBuilder/RepeaterSectionManager";
import { FormKpiUpdateDialog } from "@/components/dialogs/FormKpiUpdateDialog";

import { useFormKpiBindings, useCurrentKpiVersion } from "@/hooks/useKpiVersions";
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
    sendImmediateEmail?: boolean;
    additionalImmediateRecipients?: string[];
    sendDailySummary?: boolean;
    dailySummaryRecipients?: 'sales_team' | 'service_team' | 'all_team' | 'owner_only' | 'custom';
    customSummaryRecipients?: string[];
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

export default function ScorecardFormEditor() {
  const navigate = useNavigate();
  const { formId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
  const [agencyId, setAgencyId] = useState<string>("");
  const [showKpiUpdateDialog, setShowKpiUpdateDialog] = useState(false);
  const [outdatedKpiInfo, setOutdatedKpiInfo] = useState<{
    kpi_id: string;
    current_label: string;
    bound_label: string;
    bound_version_id: string;
  } | null>(null);

  // Get form KPI bindings to check for outdated versions
  const { data: formBindings } = useFormKpiBindings(formId);
  const outdatedBinding = formBindings?.find(binding => binding.kpi_versions.valid_to !== null);
  const { data: currentKpiVersion } = useCurrentKpiVersion(outdatedBinding?.kpi_versions.kpi_id || "");
  
  // Load agency KPIs for dropdown - pass role from formSchema for filtering
  const { data: agencyKpis = [] } = useAgencyKpis(agencyId, formSchema?.role);

  useEffect(() => {
    if (formId && user?.id) {
      loadForm();
    }
  }, [formId, user?.id]);

  // Check for outdated KPI versions after form loads
  useEffect(() => {
    if (outdatedBinding && currentKpiVersion && !showKpiUpdateDialog) {
      setOutdatedKpiInfo({
        kpi_id: outdatedBinding.kpi_versions.kpi_id,
        current_label: currentKpiVersion.label,
        bound_label: outdatedBinding.kpi_versions.label,
        bound_version_id: outdatedBinding.kpi_version_id,
      });
      setShowKpiUpdateDialog(true);
    }
  }, [outdatedBinding, currentKpiVersion, showKpiUpdateDialog]);

  const loadForm = async () => {
    try {
      // Get user's agency first
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();

      if (profile?.agency_id) {
        setAgencyId(profile.agency_id);
      }

      const { data: template, error } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', formId)
        .single();

      if (error) throw error;

      setFormSchema(template.schema_json as unknown as FormSchema);
    } catch (error: any) {
      console.error('Error loading form:', error);
      toast.error('Failed to load form');
      navigate('/scorecard-forms');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formSchema) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('form_templates')
        .update({
          name: formSchema.title,
          slug: formSchema.title.toLowerCase().replace(/\s+/g, '-'),
          role: formSchema.role,
          schema_json: formSchema as any,
          settings_json: formSchema.settings as any,
          field_mappings: formSchema.fieldMappings as any,
        })
        .eq('id', formId);

      if (error) throw error;

      // Bind KPI fields to their versions
      const { error: bindError } = await supabase.rpc('bind_form_kpis', {
        p_form: formId
      });

      if (bindError) {
        console.error('Error binding KPIs:', bindError);
        // Don't fail the form update, just warn
        toast.error("Form updated but KPI bindings failed: " + bindError.message);
      }

      toast.success("Form updated successfully!");
      navigate('/scorecard-forms');
    } catch (error: any) {
      console.error('Error updating form:', error);
      toast.error(error.message || "Failed to update form");
    } finally {
      setSaving(false);
    }
  };

  const updateKPILabel = (index: number, label: string) => {
    if (!formSchema) return;
    const updatedKPIs = [...formSchema.kpis];
    updatedKPIs[index] = { ...updatedKPIs[index], label };
    setFormSchema(prev => prev ? { ...prev, kpis: updatedKPIs } : null);
  };

  const toggleKPIRequired = (index: number) => {
    if (!formSchema) return;
    const updatedKPIs = [...formSchema.kpis];
    updatedKPIs[index] = { ...updatedKPIs[index], required: !updatedKPIs[index].required };
    setFormSchema(prev => prev ? { ...prev, kpis: updatedKPIs } : null);
  };

  const updateKPIType = (index: number, type: 'number' | 'currency' | 'percentage') => {
    if (!formSchema) return;
    const updatedKPIs = [...formSchema.kpis];
    updatedKPIs[index] = { ...updatedKPIs[index], type };
    setFormSchema(prev => prev ? { ...prev, kpis: updatedKPIs } : null);
  };

  const updateKPITarget = (index: number, target: { minimum?: number; goal?: number; excellent?: number }) => {
    if (!formSchema) return;
    const updatedKPIs = [...formSchema.kpis];
    updatedKPIs[index] = { ...updatedKPIs[index], target };
    setFormSchema(prev => prev ? { ...prev, kpis: updatedKPIs } : null);
  };

  const updateKpiSelection = (index: number, kpiId: string, slug: string, label: string) => {
    if (!formSchema) return;
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
    setFormSchema(prev => prev ? { ...prev, kpis: updatedKPIs } : null);
  };

  const addKPIField = () => {
    if (!formSchema) return;
    const newKPI: KPIField = {
      key: `custom_kpi_${formSchema.kpis.length}`,
      label: 'New KPI',
      required: false,
      type: 'number'
    };
    setFormSchema(prev => prev ? { ...prev, kpis: [...prev.kpis, newKPI] } : null);
  };

  const removeKPIField = (index: number) => {
    if (!formSchema) return;
    const updatedKPIs = formSchema.kpis.filter((_, i) => i !== index);
    setFormSchema(prev => prev ? { ...prev, kpis: updatedKPIs } : null);
  };

  const addCustomField = () => {
    if (!formSchema) return;
    const newField: CustomField = {
      key: `field_${formSchema.customFields?.length || 0}`,
      label: 'New Field',
      type: 'text',
      required: false
    };
    setFormSchema(prev => prev ? { 
      ...prev, 
      customFields: [...(prev.customFields || []), newField] 
    } : null);
  };

  const updateCustomField = (index: number, field: Partial<CustomField>) => {
    if (!formSchema) return;
    const updatedFields = [...(formSchema.customFields || [])];
    updatedFields[index] = { ...updatedFields[index], ...field };
    setFormSchema(prev => prev ? { ...prev, customFields: updatedFields } : null);
  };

  const removeCustomField = (index: number) => {
    if (!formSchema) return;
    const updatedFields = (formSchema.customFields || []).filter((_, i) => i !== index);
    setFormSchema(prev => prev ? { ...prev, customFields: updatedFields } : null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!formSchema) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Form not found</p>
          <Button onClick={() => navigate('/scorecard-forms')} className="mt-4">
            Back to Forms
          </Button>
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
            <h1 className="text-3xl font-bold text-foreground">Edit Form</h1>
            <p className="text-muted-foreground mt-2">
              Modify your scorecard form configuration
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
                    onChange={(e) => setFormSchema(prev => prev ? { ...prev, title: e.target.value } : null)}
                    placeholder="Enter form title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="role">Team Role</Label>
                  <Select 
                    value={formSchema.role} 
                    onValueChange={(value: 'Sales' | 'Service') => {
                      setFormSchema(prev => prev ? { 
                        ...prev, 
                        role: value
                      } : null);
                    }}
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
                  setFormSchema(prev => prev ? {
                    ...prev,
                    repeaterSections: {
                      ...prev.repeaterSections,
                      [key]: section
                    } as any
                  } : null);
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
                  setFormSchema(prev => prev ? {
                    ...prev,
                    repeaterSections: {
                      ...prev.repeaterSections,
                      [key]: section
                    } as any
                  } : null);
                }}
              />

            </div>

            <AdvancedSettings
              settings={{
                ...formSchema.settings,
                // Provide defaults for notification fields if missing (backward compatibility)
                sendImmediateEmail: formSchema.settings.sendImmediateEmail ?? true,
                additionalImmediateRecipients: formSchema.settings.additionalImmediateRecipients ?? [],
                sendDailySummary: formSchema.settings.sendDailySummary ?? false,
                dailySummaryRecipients: formSchema.settings.dailySummaryRecipients ?? (formSchema.role === 'Service' ? 'service_team' : 'sales_team'),
                customSummaryRecipients: formSchema.settings.customSummaryRecipients ?? [],
              }}
              onUpdateSettings={(settings) => setFormSchema(prev => prev ? {
                ...prev,
                settings: { ...prev.settings, ...settings }
              } : null)}
            />

            <NotificationSettings
              settings={{
                ...formSchema.settings,
                sendImmediateEmail: formSchema.settings.sendImmediateEmail ?? true,
                additionalImmediateRecipients: formSchema.settings.additionalImmediateRecipients ?? [],
                sendDailySummary: formSchema.settings.sendDailySummary ?? false,
                dailySummaryRecipients: formSchema.settings.dailySummaryRecipients ?? (formSchema.role === 'Service' ? 'service_team' : 'sales_team'),
                customSummaryRecipients: formSchema.settings.customSummaryRecipients ?? [],
              }}
              onUpdateSettings={(settings) => setFormSchema(prev => prev ? {
                ...prev,
                settings: { ...prev.settings, ...settings }
              } : null)}
              agencyId={agencyId}
            />
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <FormPreview formSchema={formSchema} />

            <div className="flex gap-4">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Update Dialog */}
      {formSchema && outdatedKpiInfo && (
        <FormKpiUpdateDialog
          isOpen={showKpiUpdateDialog}
          onOpenChange={(open) => {
            setShowKpiUpdateDialog(open);
            if (!open) {
              setOutdatedKpiInfo(null);
            }
          }}
          formId={formId!}
          formName={formSchema.title}
          outdatedKpi={outdatedKpiInfo}
        />
      )}
    </div>
  );
}