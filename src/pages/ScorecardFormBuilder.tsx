import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Eye, Link2 } from "lucide-react";
import { toast } from "sonner";
import TopNav from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface KPIField {
  key: string;
  label: string;
  required: boolean;
  type: 'number';
}

interface FormSchema {
  title: string;
  role: 'sales' | 'service';
  kpis: KPIField[];
  settings: {
    dueBy: string;
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

export default function ScorecardFormBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [agencyId, setAgencyId] = useState<string>("");

  const initialRole = (searchParams.get('role') as 'sales' | 'service') || 'sales';
  
  const [formSchema, setFormSchema] = useState<FormSchema>({
    title: `${initialRole.charAt(0).toUpperCase() + initialRole.slice(1)} Scorecard`,
    role: initialRole,
    kpis: initialRole === 'sales' ? DEFAULT_SALES_KPIS : DEFAULT_SERVICE_KPIS,
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
      
      const { data: profile } = await supabase
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
      const { data: template, error: templateError } = await supabase
        .from('form_templates')
        .insert({
          agency_id: agencyId,
          name: formSchema.title,
          slug: slug,
          role: formSchema.role,
          schema_json: formSchema,
          settings_json: formSchema.settings,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Create form link with token
      const token = crypto.randomUUID();
      const { error: linkError } = await supabase
        .from('form_links')
        .insert({
          form_template_id: template.id,
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
                    onValueChange={(value: 'sales' | 'service') => {
                      setFormSchema(prev => ({ 
                        ...prev, 
                        role: value,
                        kpis: value === 'sales' ? DEFAULT_SALES_KPIS : DEFAULT_SERVICE_KPIS
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>KPI Fields</CardTitle>
                <CardDescription>
                  Customize the KPI fields for your form
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {formSchema.kpis.map((kpi, index) => (
                  <div key={kpi.key} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <Input
                        value={kpi.label}
                        onChange={(e) => updateKPILabel(index, e.target.value)}
                        placeholder="KPI Label"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={kpi.required}
                        onCheckedChange={() => toggleKPIRequired(index)}
                      />
                      <Label className="text-sm">Required</Label>
                    </div>
                    <Badge variant="secondary">{kpi.key}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Form Settings</CardTitle>
                <CardDescription>
                  Configure submission and notification settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="dueBy">Due By</Label>
                  <Select 
                    value={formSchema.settings.dueBy}
                    onValueChange={(value) => setFormSchema(prev => ({
                      ...prev,
                      settings: { ...prev.settings, dueBy: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="same-day-23:59">Same day 23:59</SelectItem>
                      <SelectItem value="next-day-09:00">Next day 09:00</SelectItem>
                      <SelectItem value="custom">Custom time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="lateCountsForPass">Count late submissions toward pass/score</Label>
                  <Switch
                    id="lateCountsForPass"
                    checked={formSchema.settings.lateCountsForPass}
                    onCheckedChange={(checked) => setFormSchema(prev => ({
                      ...prev,
                      settings: { ...prev.settings, lateCountsForPass: checked }
                    }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="ccOwner">CC owner on reminders</Label>
                  <Switch
                    id="ccOwner"
                    checked={formSchema.settings.ccOwner}
                    onCheckedChange={(checked) => setFormSchema(prev => ({
                      ...prev,
                      settings: { ...prev.settings, ccOwner: checked }
                    }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="suppressIfFinal">Suppress reminders if submission exists</Label>
                  <Switch
                    id="suppressIfFinal"
                    checked={formSchema.settings.suppressIfFinal}
                    onCheckedChange={(checked) => setFormSchema(prev => ({
                      ...prev,
                      settings: { ...prev.settings, suppressIfFinal: checked }
                    }))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Form Preview
                </CardTitle>
                <CardDescription>
                  Preview how your form will look to staff members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border-2 border-dashed border-muted rounded-lg">
                  <h3 className="font-semibold text-lg mb-4">{formSchema.title}</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>Staff Member</Label>
                      <Select disabled>
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff member..." />
                        </SelectTrigger>
                      </Select>
                    </div>

                    <div>
                      <Label>Submission Date</Label>
                      <Input type="date" disabled value={new Date().toISOString().split('T')[0]} />
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Daily KPIs</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {formSchema.kpis.map((kpi) => (
                          <div key={kpi.key}>
                            <Label className="text-sm">
                              {kpi.label}
                              {kpi.required && <span className="text-destructive">*</span>}
                            </Label>
                            <Input type="number" disabled placeholder="0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

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