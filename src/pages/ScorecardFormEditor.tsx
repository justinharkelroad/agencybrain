import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Save, AlertTriangle } from "lucide-react";
import KPIFieldManager from "@/components/FormBuilder/KPIFieldManager";
import CustomFieldManager from "@/components/FormBuilder/CustomFieldManager";
import AdvancedSettings from "@/components/FormBuilder/AdvancedSettings";
import NotificationSettings from "@/components/FormBuilder/NotificationSettings";
import FormPreview from "@/components/FormBuilder/FormPreview";
import RepeaterSectionManager from "@/components/FormBuilder/RepeaterSectionManager";
import CustomCollectionBuilder from "@/components/FormBuilder/CustomCollectionBuilder";
import { FormKpiUpdateDialog } from "@/components/dialogs/FormKpiUpdateDialog";
import { CustomCollectionSchemaItem } from "@/types/custom-collections";

import { useFormKpiBindings, useCurrentKpiVersion } from "@/hooks/useKpiVersions";
import { useAgencyKpis } from "@/hooks/useKpis";
import { toast } from "sonner";
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from "@/lib/auth";

// Validate that all KPI IDs in schema exist in active KPI list
function validateKpiIds(
  kpis: { selectedKpiId?: string; label: string }[],
  activeKpis: { kpi_id: string }[]
): { valid: boolean; invalidLabels: string[] } {
  const activeIds = new Set(activeKpis.map(k => k.kpi_id));
  const invalidLabels: string[] = [];

  for (const kpi of kpis) {
    if (kpi.selectedKpiId && !activeIds.has(kpi.selectedKpiId)) {
      invalidLabels.push(kpi.label);
    }
  }

  return { valid: invalidLabels.length === 0, invalidLabels };
}

// Validate that custom dropdown fields have options configured
function validateDropdownFields(schema: FormSchema): string[] {
  const errors: string[] = [];

  // Check repeater sections
  Object.entries(schema.repeaterSections || {}).forEach(([key, section]: [string, any]) => {
    section?.fields?.forEach((field: any) => {
      if ((field.type === 'select' || field.type === 'dropdown') &&
          !field.isSticky && // Sticky fields load options dynamically
          (!field.options || field.options.length === 0)) {
        errors.push(`"${field.label}" in ${section.title || key}`);
      }
    });
  });

  // Check custom fields at root level
  schema.customFields?.forEach((field: any) => {
    if (field.type === 'dropdown' && (!field.options || field.options.length === 0)) {
      errors.push(`Custom field "${field.label}"`);
    }
  });

  return errors;
}

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
    customCollections?: CustomCollectionSchemaItem[];
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
  const [needsAttention, setNeedsAttention] = useState(false);
  const [showKpiUpdateDialog, setShowKpiUpdateDialog] = useState(false);
  const [dialogDismissed, setDialogDismissed] = useState(false);
  const [kpisHealed, setKpisHealed] = useState(false);
  const [formUpdatedAt, setFormUpdatedAt] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [outdatedKpiInfo, setOutdatedKpiInfo] = useState<{
    kpi_id: string;
    current_label: string;
    bound_label: string;
    bound_version_id: string;
  } | null>(null);

  // Detect staff mode
  const staffToken = localStorage.getItem('staff_session_token');
  const staffAgencyId = localStorage.getItem('staff_agency_id');
  const isStaffMode = !!staffToken && !!staffAgencyId;

  // Get form KPI bindings to check for outdated versions
  const { data: formBindings } = useFormKpiBindings(formId);
  const outdatedBinding = formBindings?.find(binding => binding.kpi_versions.valid_to !== null);
  const { data: currentKpiVersion } = useCurrentKpiVersion(outdatedBinding?.kpi_versions.kpi_id || "");
  
  // Load agency KPIs for dropdown - pass role from formSchema for filtering
  const { data: agencyKpis = [], refetch: refetchAgencyKpis } = useAgencyKpis(agencyId, formSchema?.role);

  // Refetch KPIs when window regains focus (handles edits in other tabs)
  useEffect(() => {
    const handleFocus = () => {
      if (agencyId) {
        refetchAgencyKpis();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [agencyId, refetchAgencyKpis]);

  // Warn user if navigating away with unsaved healed KPIs
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (kpisHealed && !saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [kpisHealed, saving]);

  useEffect(() => {
    if (formId && (user?.id || isStaffMode)) {
      loadForm();
    }
  }, [formId, user?.id, isStaffMode]);

  // Check for outdated KPI versions after form loads - only show once per session
  useEffect(() => {
    if (outdatedBinding && currentKpiVersion && !showKpiUpdateDialog && !dialogDismissed) {
      setOutdatedKpiInfo({
        kpi_id: outdatedBinding.kpi_versions.kpi_id,
        current_label: currentKpiVersion.label,
        bound_label: outdatedBinding.kpi_versions.label,
        bound_version_id: outdatedBinding.kpi_version_id,
      });
      setShowKpiUpdateDialog(true);
    }
  }, [outdatedBinding, currentKpiVersion, showKpiUpdateDialog, dialogDismissed]);

  // Auto-heal stale KPI IDs by matching on slug when IDs are outdated
  // Also auto-save to persist the healed IDs
  const triggerAutoSave = useCallback(() => {
    // Small delay to ensure state is updated before save
    setTimeout(() => {
      handleSaveInternal(true);
    }, 500);
  }, []);

  useEffect(() => {
    if (!formSchema || !agencyKpis.length) return;
    
    let needsUpdate = false;
    const healedKpis = formSchema.kpis.map(kpi => {
      // Check if selectedKpiId exists in available KPIs
      const idMatch = agencyKpis.find(k => k.kpi_id === kpi.selectedKpiId);
      if (idMatch) return kpi; // ID is valid, no change needed
      
      // ID not found - try slug match
      if (kpi.selectedKpiSlug) {
        const slugMatch = agencyKpis.find(k => k.slug === kpi.selectedKpiSlug);
        if (slugMatch && slugMatch.kpi_id !== kpi.selectedKpiId) {
          console.log(`Healing stale KPI: ${kpi.selectedKpiSlug} from ${kpi.selectedKpiId} to ${slugMatch.kpi_id}`);
          needsUpdate = true;
          return { ...kpi, selectedKpiId: slugMatch.kpi_id };
        }
      }
      return kpi;
    });
    
    if (needsUpdate) {
      setFormSchema(prev => prev ? { ...prev, kpis: healedKpis } : null);
      setKpisHealed(true);
      toast.info("KPI selections updated - auto-saving...");
    }
  }, [agencyKpis]);

  // Trigger auto-save when kpisHealed becomes true
  // Wait for initialLoadComplete to prevent race condition with child component initialization
  useEffect(() => {
    if (kpisHealed && formSchema && !saving && initialLoadComplete) {
      triggerAutoSave();
    }
  }, [kpisHealed, formSchema, saving, initialLoadComplete, triggerAutoSave]);

  const loadForm = async () => {
    try {
      if (isStaffMode) {
        // Staff mode: use edge function
        setAgencyId(staffAgencyId!);
        
        const { data, error } = await supabase.functions.invoke('scorecards_admin', {
          headers: {
            'x-staff-session': staffToken!,
          },
          body: {
            action: 'form_get',
            form_id: formId,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        setFormSchema(data.schema_json as unknown as FormSchema);
        setNeedsAttention(data.needs_attention || false);
        setFormUpdatedAt(data.updated_at || null);
      } else {
        // Owner mode: direct Supabase queries
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
        setNeedsAttention(template.needs_attention || false);
        setFormUpdatedAt(template.updated_at || null);
      }
    } catch (error: any) {
      console.error('Error loading form:', error);
      toast.error('Failed to load form');
      navigate(isStaffMode ? '/staff/metrics' : '/scorecard-forms');
    } finally {
      setLoading(false);
      // Delay marking initial load complete to allow child components
      // (RepeaterSectionManager) to load sticky fields, lead sources, and policy types
      setTimeout(() => {
        setInitialLoadComplete(true);
      }, 1500);
    }
  };

  // Internal save function used by both manual save and auto-save
  const handleSaveInternal = async (isAutoSave: boolean = false) => {
    if (!formSchema) return;

    // Validate all KPI IDs are current before saving
    const validation = validateKpiIds(formSchema.kpis, agencyKpis);
    if (!validation.valid) {
      toast.error(`Cannot save: Some KPIs have stale IDs: ${validation.invalidLabels.join(', ')}. Please re-select them.`);
      return;
    }

    // Validate custom dropdown fields have options
    const dropdownErrors = validateDropdownFields(formSchema);
    if (dropdownErrors.length > 0) {
      toast.error(`Cannot save: These dropdowns have no options: ${dropdownErrors.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      // If form had needs_attention, clear it on save (manager is fixing it)
      const updatePayload: any = {
        name: formSchema.title,
        slug: formSchema.title.toLowerCase().replace(/\s+/g, '-'),
        role: formSchema.role,
        schema_json: formSchema as any,
        settings_json: formSchema.settings as any,
        field_mappings: formSchema.fieldMappings as any,
      };
      
      // Clear needs_attention flag when saving (admin is fixing the issue)
      if (needsAttention) {
        updatePayload.needs_attention = false;
      }

      // Optimistic locking: check if form was modified by another admin
      if (formUpdatedAt) {
        const { data: currentForm, error: checkError } = await supabase
          .from('form_templates')
          .select('updated_at')
          .eq('id', formId)
          .single();

        if (!checkError && currentForm && currentForm.updated_at !== formUpdatedAt) {
          toast.error('Another admin modified this form while you were editing. Please refresh to see their changes.');
          setSaving(false);
          return;
        }
      }

      const { data: updatedData, error } = await supabase
        .from('form_templates')
        .update(updatePayload)
        .eq('id', formId)
        .select('updated_at')
        .single();

      if (error) throw error;

      // Update tracked timestamp after successful save
      if (updatedData?.updated_at) {
        setFormUpdatedAt(updatedData.updated_at);
      }

      // Bind KPI fields to their versions
      const { error: bindError } = await supabase.rpc('bind_form_kpis', {
        p_form: formId
      });

      if (bindError) {
        console.error('Error binding KPIs:', bindError);
        // Don't fail the form update, just warn
        toast.error("Form updated but KPI bindings failed: " + bindError.message);
      }

      // Clear healed flag and needs_attention after successful save
      setKpisHealed(false);
      setNeedsAttention(false);

      if (isAutoSave) {
        toast.success("KPI updates saved automatically");
      } else {
        toast.success("Form updated successfully!");
        navigate('/scorecard-forms');
      }
    } catch (error: any) {
      console.error('Error updating form:', error);
      toast.error(error.message || "Failed to update form");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => handleSaveInternal(false);

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
      key: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
          <Button variant="ghost" onClick={() => navigate(isStaffMode ? '/staff/metrics' : '/scorecard-forms')}>
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

        {/* LAYER 5: Show "Needs Attention" Banner when form is broken */}
        {needsAttention && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>This Form is Broken - Team Members Cannot Submit</AlertTitle>
            <AlertDescription>
              One or more KPIs used in this form have been deleted or deactivated. 
              Review each KPI field below - any showing warnings need to be updated or removed.
              <strong className="block mt-2">Save the form after fixing to re-enable submissions.</strong>
            </AlertDescription>
          </Alert>
        )}

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

              {/* Custom Collections Builder */}
              <CustomCollectionBuilder
                collections={formSchema.repeaterSections?.customCollections || []}
                kpiFields={formSchema.kpis.map(kpi => ({ key: kpi.key, label: kpi.label }))}
                onAddCollection={(collection) => {
                  setFormSchema(prev => prev ? {
                    ...prev,
                    repeaterSections: {
                      ...prev.repeaterSections,
                      customCollections: [
                        ...(prev.repeaterSections?.customCollections || []),
                        collection
                      ]
                    } as any
                  } : null);
                }}
                onUpdateCollection={(id, updates) => {
                  setFormSchema(prev => {
                    if (!prev) return null;
                    const collections = prev.repeaterSections?.customCollections || [];
                    return {
                      ...prev,
                      repeaterSections: {
                        ...prev.repeaterSections,
                        customCollections: collections.map(c => 
                          c.id === id ? { ...c, ...updates } : c
                        )
                      } as any
                    };
                  });
                }}
                onDeleteCollection={(id) => {
                  setFormSchema(prev => {
                    if (!prev) return null;
                    const collections = prev.repeaterSections?.customCollections || [];
                    return {
                      ...prev,
                      repeaterSections: {
                        ...prev.repeaterSections,
                        customCollections: collections.filter(c => c.id !== id)
                      } as any
                    };
                  });
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
              setDialogDismissed(true);
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