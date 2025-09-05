import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Eye, Link2 } from "lucide-react";
import KPIFieldManager from "@/components/FormBuilder/KPIFieldManager";
import CustomFieldManager from "@/components/FormBuilder/CustomFieldManager";
import AdvancedSettings from "@/components/FormBuilder/AdvancedSettings";
import FormPreview from "@/components/FormBuilder/FormPreview";
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
  };
}

const DEFAULT_SALES_KPIS: KPIField[] = [
  { key: 'outbound_calls', label: 'Outbound Calls', required: true, type: 'number' },
  { key: 'talk_minutes', label: 'Talk Minutes', required: true, type: 'number' },
  { key: 'quoted_count', label: 'Households Quoted', required: true, type: 'number' },
  { key: 'sold_items', label: 'Items Sold', required: true, type: 'number' },
];

const DEFAULT_SERVICE_KPIS: KPIField[] = [
  { key: 'talk_minutes', label: 'Talk Minutes', required: true, type: 'number' },
  { key: 'outbound_calls', label: 'Outbound Calls', required: true, type: 'number' },
  { key: 'cross_sells_uncovered', label: 'Cross-sells Uncovered', required: true, type: 'number' },
  { key: 'mini_reviews', label: 'Mini Reviews', required: true, type: 'number' },
];

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

  const initialRole = (searchParams.get('role') as 'Sales' | 'Service') || 'Sales';
  
  const [formSchema, setFormSchema] = useState<FormSchema>({
    title: `${initialRole} Scorecard`,
    role: initialRole,
    kpis: initialRole === 'Sales' ? DEFAULT_SALES_KPIS : DEFAULT_SERVICE_KPIS,
    customFields: [],
    repeaterSections: {
      quotedDetails: {
        enabled: false,
        title: 'Quoted Household Details',
        description: 'Capture detailed information for each quoted household',
        triggerKPI: 'quoted_count',
        fields: [
          // Sticky fields will be loaded from database
          // Only include non-sticky custom fields here if needed
        ]
      },
      soldDetails: {
        enabled: false,
        title: 'Sold Household Details',
        description: 'Track household details and policy information for each sale',
        triggerKPI: 'sold_items',
        fields: [
          // Sticky fields will be loaded from database
          // Only include non-sticky custom fields here if needed
        ]
      }
    },
    settings: {
      dueBy: 'same-day-23:59',
      lateCountsForPass: false,
      reminderTimes: ['16:45', '07:00'],
      ccOwner: true,
      suppressIfFinal: true,
    }
  });

  useEffect(() => {
    const fetchAgencyId = async () => {
      if (!user?.id) return;
      
      const { data: profile } = await supa
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();
        
      if (profile?.agency_id) {
        setAgencyId(profile.agency_id);
      }
    };
    
    fetchAgencyId();
  }, [user?.id]);

  const handleSave = async () => {
    if (!agencyId) {
      toast.error("Agency information not found");
      return;
    }

    setLoading(true);
    try {
      const slug = formSchema.title.toLowerCase().replace(/\s+/g, '-');
      
      // Create form template
      const { data: template, error: templateError } = await supa
        .from('form_templates')
        .insert({
          agency_id: agencyId,
          name: formSchema.title,
          slug: slug,
          role: formSchema.role,
          schema_json: formSchema as any,
          settings_json: formSchema.settings as any,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Create form link with token
      const token = crypto.randomUUID();
      const { error: linkError } = await supa
        .from('form_links')
        .insert({
          form_template_id: template.id,
          agency_id: agencyId, // Fix: Include agency_id from state
          token: token,
          enabled: true,
        });

      if (linkError) throw linkError;

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

  const addKPIField = () => {
    const newKPI: KPIField = {
      key: `custom_${Date.now()}`,
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
      key: `field_${Date.now()}`,
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
                    onValueChange={(value: 'Sales' | 'Service') => {
                      setFormSchema(prev => ({ 
                        ...prev, 
                        role: value,
                        kpis: value === 'Sales' ? DEFAULT_SALES_KPIS : DEFAULT_SERVICE_KPIS
                      }));
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