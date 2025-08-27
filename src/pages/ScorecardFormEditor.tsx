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
import FormPreview from "@/components/FormBuilder/FormPreview";
import { LeadSourceManager } from "@/components/FormBuilder/LeadSourceManager";
import RepeaterSectionManager from "@/components/FormBuilder/RepeaterSectionManager";
import { toast } from "sonner";
import TopNav from "@/components/TopNav";
import { supa } from '@/lib/supabase';
import { useAuth } from "@/lib/auth";

interface KPIField {
  key: string;
  label: string;
  required: boolean;
  type: 'number' | 'currency' | 'percentage';
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
  leadSources?: LeadSource[];
  repeaterSections?: {
    quotedDetails: RepeaterSection;
    soldDetails: RepeaterSection;
  };
  settings: {
    dueBy: string;
    customDueTime?: string;
    lateCountsForPass: boolean;
    reminderTimes: string[];
    ccOwner: boolean;
    suppressIfFinal: boolean;
    hasWorkDate: boolean;
    hasQuotedDetails: boolean;
    hasSoldDetails: boolean;
  };
}

export default function ScorecardFormEditor() {
  const navigate = useNavigate();
  const { formId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);

  useEffect(() => {
    if (formId && user?.id) {
      loadForm();
    }
  }, [formId, user?.id]);

  const loadForm = async () => {
    try {
      const { data: template, error } = await supa
        .from('form_templates')
        .select('*')
        .eq('id', formId)
        .single();

      if (error) throw error;

      setFormSchema(template.schema_json as FormSchema | null);
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
      const { error } = await supa
        .from('form_templates')
        .update({
          name: formSchema.title,
          slug: formSchema.title.toLowerCase().replace(/\s+/g, '-'),
          role: formSchema.role,
          schema_json: formSchema as any,
          settings_json: formSchema.settings as any,
        })
        .eq('id', formId);

      if (error) throw error;

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

  const addKPIField = () => {
    if (!formSchema) return;
    const newKPI: KPIField = {
      key: `custom_${Date.now()}`,
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
      key: `field_${Date.now()}`,
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
      <TopNav />
      
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
              onUpdateLabel={updateKPILabel}
              onToggleRequired={toggleKPIRequired}
              onUpdateType={updateKPIType}
              onUpdateTarget={updateKPITarget}
              onAddField={addKPIField}
              onRemoveField={removeKPIField}
            />

            <CustomFieldManager
              fields={formSchema.customFields || []}
              onUpdateField={updateCustomField}
              onAddField={addCustomField}
              onRemoveField={removeCustomField}
            />

            {/* Lead Source Management */}
            <LeadSourceManager
              leadSources={formSchema.leadSources || []}
              onUpdateLeadSources={(sources) => setFormSchema(prev => prev ? {...prev, leadSources: sources} : null)}
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
                leadSources={formSchema.leadSources}
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
                  title: 'Sold Policy Details',
                  description: 'Track commission and policy information',
                  fields: []
                }}
                sectionKey="soldDetails"
                kpiFields={formSchema.kpis.map(kpi => ({ key: kpi.key, label: kpi.label }))}
                leadSources={formSchema.leadSources}
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
              settings={formSchema.settings}
              onUpdateSettings={(settings) => setFormSchema(prev => prev ? {
                ...prev,
                settings: { ...prev.settings, ...settings }
              } : null)}
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
    </div>
  );
}