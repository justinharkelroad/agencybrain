import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
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
  [key: string]: string | number;
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

      // Submit the form
      const { data: submission, error: submitError } = await supabase
        .from('submissions')
        .insert({
          form_template_id: formTemplate.id,
          team_member_id: formData.team_member_id,
          submission_date: formData.submission_date,
          work_date: formData.work_date,
          payload_json: formData,
          late: isLate,
          final: true,
        })
        .select()
        .single();

      if (submitError) throw submitError;

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
              <Badge variant={formTemplate.role === 'sales' ? 'default' : 'secondary'}>
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
                        onChange={(e) => updateFormData(kpi.key, e.target.value)}
                        placeholder="0"
                        required={kpi.required}
                      />
                    </div>
                  ))}
                </div>
              </div>

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