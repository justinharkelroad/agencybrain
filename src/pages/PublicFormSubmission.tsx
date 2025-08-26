import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Clock, AlertCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface FormTemplate {
  id: string;
  name: string;
  role: string;
  schema_json: any;
  settings_json: any;
}

interface FormSubmission {
  team_member_id: string;
  submission_date: string;
  work_date: string;
  [key: string]: string | number | any[];
}

interface RepeaterData {
  [sectionKey: string]: Array<{ [fieldKey: string]: any }>;
}

export default function PublicFormSubmission() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formTemplate, setFormTemplate] = useState<FormTemplate | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [formData, setFormData] = useState<FormSubmission>({
    team_member_id: '',
    submission_date: new Date().toISOString().split('T')[0],
    work_date: new Date().toISOString().split('T')[0],
  });
  const [repeaterData, setRepeaterData] = useState<RepeaterData>({});

  useEffect(() => {
    if (slug && token) {
      loadForm();
    }
  }, [slug, token]);

  const loadForm = async () => {
    try {
      // Verify token and get form template
      const { data: linkData, error: linkError } = await supabase
        .from('form_links')
        .select(`
          *,
          form_templates (
            id,
            name,
            role,
            schema_json,
            settings_json,
            agencies (
              id,
              name
            )
          )
        `)
        .eq('token', token)
        .eq('enabled', true)
        .single();

      if (linkError || !linkData) {
        toast.error("Invalid or expired form link");
        return;
      }

      setFormTemplate(linkData.form_templates);

      // Load team members for the agency with matching role
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('id, name, email, role')
        .eq('agency_id', linkData.form_templates.agencies.id)
        .eq('role', linkData.form_templates.role)
        .eq('status', 'active');

      if (membersError) {
        console.error('Error loading team members:', membersError);
      } else {
        setTeamMembers(members || []);
      }

      // Initialize repeater sections
      const schema = linkData.form_templates.schema_json;
      const initialRepeaterData: RepeaterData = {};
      
      if (schema?.repeaterSections) {
        Object.keys(schema.repeaterSections).forEach(sectionKey => {
          const section = schema.repeaterSections[sectionKey];
          if (section.enabled) {
            initialRepeaterData[sectionKey] = [];
          }
        });
      }
      
      setRepeaterData(initialRepeaterData);
    } catch (error) {
      console.error('Error loading form:', error);
      toast.error("Failed to load form");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formTemplate || !formData.team_member_id) {
      toast.error("Please select a team member");
      return;
    }

    setSubmitting(true);
    try {
      // Check if submission is late
      const now = new Date();
      const submissionDate = new Date(formData.submission_date);
      const dueTime = formTemplate.settings_json?.dueBy || 'same-day-23:59';
      
      let isLate = false;
      if (dueTime === 'same-day-23:59') {
        const deadline = new Date(submissionDate);
        deadline.setHours(23, 59, 59, 999);
        isLate = now > deadline;
      }

      // Submit the form with both regular data and repeater data
      const submissionPayload = {
        ...formData,
        repeaterData: repeaterData
      };

      const { data: submission, error: submitError } = await supabase
        .from('submissions')
        .insert({
          form_template_id: formTemplate.id,
          team_member_id: formData.team_member_id,
          submission_date: formData.submission_date,
          work_date: formData.work_date,
          payload_json: submissionPayload,
          late: isLate,
          final: true,
        })
        .select()
        .single();

      if (submitError) throw submitError;

      // Save repeater section details to their respective tables
      for (const [sectionKey, entries] of Object.entries(repeaterData)) {
        if (!entries || entries.length === 0) continue;

        if (sectionKey === 'quotedDetails') {
          // Save quoted household details
          for (const entry of entries) {
            if (entry.household_name) {
              const { error: detailError } = await supabase
                .from('quoted_household_details')
                .insert({
                  submission_id: submission.id,
                  household_name: entry.household_name,
                  zip_code: entry.zip_code || null,
                  policy_type: entry.policy_type || null,
                  extras: entry
                });

              if (detailError) {
                console.error('Error saving quoted household detail:', detailError);
              }
            }
          }
        } else if (sectionKey === 'soldDetails') {
          // Save sold policy details
          for (const entry of entries) {
            if (entry.policy_holder && entry.policy_type) {
              const premiumCents = entry.premium_amount ? 
                Math.round(parseFloat(entry.premium_amount) * 100) : 0;
              const commissionCents = entry.commission_amount ? 
                Math.round(parseFloat(entry.commission_amount) * 100) : 0;

              const { error: detailError } = await supabase
                .from('sold_policy_details')
                .insert({
                  submission_id: submission.id,
                  policy_holder_name: entry.policy_holder,
                  policy_type: entry.policy_type,
                  premium_amount_cents: premiumCents,
                  commission_amount_cents: commissionCents,
                  extras: entry
                });

              if (detailError) {
                console.error('Error saving sold policy detail:', detailError);
              }
            }
          }
        }
      }

      // Update or create metrics_daily record
      const selectedMember = teamMembers.find(m => m.id === formData.team_member_id);
      if (selectedMember) {
        // Get agency_id from the team member
        const { data: memberData } = await supabase
          .from('team_members')
          .select('agency_id')
          .eq('id', formData.team_member_id)
          .single();

        if (memberData) {
          const metricsData = {
            agency_id: memberData.agency_id,
            team_member_id: formData.team_member_id,
            date: formData.work_date,
            outbound_calls: parseInt(formData.outbound_calls as string) || 0,
            talk_minutes: parseInt(formData.talk_minutes as string) || 0,
            quoted_count: parseInt(formData.quoted_count as string) || 0,
            sold_items: parseInt(formData.sold_items as string) || 0,
            cross_sells_uncovered: parseInt(formData.cross_sells_uncovered as string) || 0,
            mini_reviews: parseInt(formData.mini_reviews as string) || 0,
            final_submission_id: submission.id,
          };

          const { error: metricsError } = await supabase
            .from('metrics_daily')
            .upsert(metricsData, {
              onConflict: 'agency_id,team_member_id,date'
            });

          if (metricsError) {
            console.error('Error updating metrics:', metricsError);
          }
        }
      }

      setSubmitted(true);
      toast.success("Form submitted successfully!");
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error(error.message || "Failed to submit form");
    } finally {
      setSubmitting(false);
    }
  };

  const updateFormData = (key: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const updateRepeaterCount = (sectionKey: string, count: number) => {
    setRepeaterData(prev => {
      const currentData = prev[sectionKey] || [];
      const schema = formTemplate?.schema_json?.repeaterSections?.[sectionKey];
      
      if (!schema) return prev;

      // Adjust array length to match count
      const newData = Array.from({ length: count }, (_, index) => {
        if (currentData[index]) {
          return currentData[index]; // Keep existing data
        }
        
        // Initialize new entry with empty values
        const newEntry: { [key: string]: any } = {};
        schema.fields.forEach((field: any) => {
          newEntry[field.key] = '';
        });
        return newEntry;
      });

      return { ...prev, [sectionKey]: newData };
    });
  };

  const updateRepeaterField = (sectionKey: string, entryIndex: number, fieldKey: string, value: any) => {
    setRepeaterData(prev => {
      const sectionData = [...(prev[sectionKey] || [])];
      if (sectionData[entryIndex]) {
        sectionData[entryIndex] = {
          ...sectionData[entryIndex],
          [fieldKey]: value
        };
      }
      return { ...prev, [sectionKey]: sectionData };
    });
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

  if (!formTemplate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Form Not Found</CardTitle>
            <CardDescription>
              The form link is invalid or has expired.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Submission Received</CardTitle>
            <CardDescription>
              Thank you! Your scorecard has been submitted successfully.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const schema = formTemplate.schema_json;
  const kpis = schema?.kpis || [];
  const customFields = schema?.customFields || [];
  const repeaterSections = schema?.repeaterSections || {};

  // Render a repeater section
  const renderRepeaterSection = (sectionKey: string, section: any) => {
    const triggerKPI = section.triggerKPI;
    const triggerValue = parseInt(formData[triggerKPI] as string) || 0;
    
    // Update repeater count when trigger KPI changes
    if (repeaterData[sectionKey]?.length !== triggerValue) {
      updateRepeaterCount(sectionKey, triggerValue);
    }
    
    if (triggerValue === 0) {
      return null;
    }

    return (
      <div key={sectionKey} className="border-t pt-6">
        <h3 className="font-semibold text-lg mb-4">{section.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
        
        <div className="space-y-4">
          {Array.from({ length: triggerValue }, (_, index) => (
            <Card key={index} className="p-4">
              <h4 className="font-medium mb-3">Entry #{index + 1}</h4>
              <div className="grid grid-cols-2 gap-3">
                {section.fields.map((field: any) => (
                  <div key={field.key}>
                    <Label>
                      {field.label}
                      {field.required && <span className="text-destructive">*</span>}
                    </Label>
                    
                    {field.type === 'select' ? (
                      <Select
                        value={repeaterData[sectionKey]?.[index]?.[field.key] || ''}
                        onValueChange={(value) => updateRepeaterField(sectionKey, index, field.key, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((option: string, idx: number) => (
                            <SelectItem key={idx} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={field.type === 'currency' ? 'number' : field.type === 'number' ? 'number' : 'text'}
                        value={repeaterData[sectionKey]?.[index]?.[field.key] || ''}
                        onChange={(e) => updateRepeaterField(sectionKey, index, field.key, e.target.value)}
                        placeholder={
                          field.type === 'currency' ? '$0.00' : 
                          field.type === 'number' ? '0' : ''
                        }
                        step={field.type === 'currency' ? '0.01' : undefined}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{formTemplate.name}</CardTitle>
                <CardDescription className="mt-2">
                  Daily KPI tracking form
                </CardDescription>
              </div>
              <Badge variant={formTemplate.role === 'Sales' ? 'default' : 'secondary'}>
                {formTemplate.role}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Staff Selection */}
              <div>
                <Label htmlFor="team_member">Staff Member *</Label>
                <Select 
                  value={formData.team_member_id}
                  onValueChange={(value) => updateFormData('team_member_id', value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your name..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="submission_date">Submission Date</Label>
                  <Input
                    id="submission_date"
                    type="date"
                    value={formData.submission_date}
                    onChange={(e) => updateFormData('submission_date', e.target.value)}
                    required
                  />
                </div>
                {schema?.settings?.hasWorkDate && (
                  <div>
                    <Label htmlFor="work_date">Work Date</Label>
                    <Input
                      id="work_date"
                      type="date"
                      value={formData.work_date}
                      onChange={(e) => updateFormData('work_date', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                )}
              </div>

              {/* KPIs */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Daily KPIs
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {kpis.map((kpi: any) => (
                    <div key={kpi.key}>
                      <Label htmlFor={kpi.key}>
                        {kpi.label}
                        {kpi.required && <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        id={kpi.key}
                        type="number"
                        min="0"
                        value={formData[kpi.key] || ''}
                        onChange={(e) => {
                          updateFormData(kpi.key, e.target.value);
                        }}
                        placeholder="0"
                        required={kpi.required}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Fields */}
              {customFields.length > 0 && (
                <div className="border-t pt-6">
                  <h3 className="font-semibold text-lg mb-4">Additional Information</h3>
                  <div className="space-y-4">
                    {customFields.map((field: any) => (
                      <div key={field.key}>
                        <Label>
                          {field.label}
                          {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        
                        {field.type === 'dropdown' ? (
                          <Select
                            value={formData[field.key] as string || ''}
                            onValueChange={(value) => updateFormData(field.key, value)}
                            required={field.required}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options?.map((option: string, idx: number) => (
                                <SelectItem key={idx} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={field.type === 'date' ? 'date' : 'text'}
                            value={formData[field.key] as string || ''}
                            onChange={(e) => updateFormData(field.key, e.target.value)}
                            required={field.required}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Render Dynamic Repeater Sections */}
              {Object.entries(repeaterSections)
                .filter(([_, section]: [string, any]) => section?.enabled)
                .map(([sectionKey, section]) => 
                  renderRepeaterSection(sectionKey, section)
                )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={submitting}
                size="lg"
              >
                {submitting ? "Submitting..." : "Submit Scorecard"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}