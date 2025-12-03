import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Send, CheckCircle, AlertCircle, ArrowLeft, User } from 'lucide-react';

interface FormField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
}

export default function StaffFormSubmission() {
  const { formSlug } = useParams<{ formSlug: string }>();
  const navigate = useNavigate();
  const { user, sessionToken, isAuthenticated, loading: authLoading } = useStaffAuth();
  
  const [formTemplate, setFormTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [teamMemberName, setTeamMemberName] = useState<string>('');

  // Load form template and team member info
  useEffect(() => {
    async function loadForm() {
      if (!user?.agency_id || !formSlug) return;

      try {
        setLoading(true);
        setError(null);

        // Get form template
        const { data: template, error: templateError } = await supabase
          .from('form_templates')
          .select('id, name, slug, schema_json, status')
          .eq('slug', formSlug)
          .eq('agency_id', user.agency_id)
          .single();

        if (templateError || !template) {
          setError('Form not found');
          return;
        }

        if (template.status !== 'published') {
          setError('This form is not currently available');
          return;
        }

        setFormTemplate(template);

        // Get team member name if linked
        if (user.team_member_id) {
          const { data: member } = await supabase
            .from('team_members')
            .select('name')
            .eq('id', user.team_member_id)
            .single();
          
          if (member) {
            setTeamMemberName(member.name);
          }
        }

        // Initialize default values
        const initialValues: Record<string, any> = {
          submission_date: format(new Date(), 'yyyy-MM-dd'),
          work_date: format(new Date(), 'yyyy-MM-dd'),
        };
        setValues(initialValues);

      } catch (err) {
        console.error('Error loading form:', err);
        setError('Failed to load form');
      } finally {
        setLoading(false);
      }
    }

    if (isAuthenticated && user) {
      loadForm();
    }
  }, [user, formSlug, isAuthenticated]);

  const handleInputChange = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionToken || !formSlug) {
      toast.error('Session error. Please log in again.');
      return;
    }

    if (!user?.team_member_id) {
      toast.error('Your account is not linked to a team member. Contact your administrator.');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('staff_submit_form', {
        body: {
          formSlug,
          submissionDate: values.submission_date,
          workDate: values.work_date,
          values: values
        },
        headers: {
          'x-staff-session': sessionToken
        }
      });

      if (error) {
        throw new Error(error.message || 'Submission failed');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSubmitted(true);
      toast.success('Form submitted successfully!');

    } catch (err: any) {
      console.error('Submission error:', err);
      toast.error(err.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  // Not authenticated (should be handled by StaffProtectedRoute, but just in case)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to submit forms</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/staff/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not linked to team member
  if (!user?.team_member_id) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/staff/training')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Training
          </Button>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Account Not Linked</AlertTitle>
            <AlertDescription>
              Your staff account is not linked to a team member. Please contact your administrator to set up your account before submitting forms.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Loading form
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/staff/training')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Training
          </Button>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-2xl font-bold">Submission Successful!</h2>
                <p className="text-muted-foreground">
                  Your daily metrics have been recorded.
                </p>
                <div className="flex gap-4 justify-center pt-4">
                  <Button variant="outline" onClick={() => navigate('/staff/training')}>
                    Back to Training
                  </Button>
                  <Button onClick={() => {
                    setSubmitted(false);
                    setValues({
                      submission_date: format(new Date(), 'yyyy-MM-dd'),
                      work_date: format(new Date(), 'yyyy-MM-dd'),
                    });
                  }}>
                    Submit Another
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Parse form fields from schema
  const fields: FormField[] = [];
  if (formTemplate?.schema_json?.sections) {
    for (const section of formTemplate.schema_json.sections) {
      if (section.fields) {
        for (const field of section.fields) {
          fields.push({
            key: field.key || field.id,
            label: field.label,
            type: field.type || 'number',
            required: field.required
          });
        }
      }
    }
  }

  // Render form
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/staff/training')} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Training
        </Button>

        {/* Identity Card - Shows who is submitting (no dropdown!) */}
        <Card className="bg-muted/50 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Submitting as:</p>
                <p className="font-semibold">{teamMemberName || user.display_name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>{formTemplate?.name || 'Daily Scorecard'}</CardTitle>
            <CardDescription>
              Enter your metrics for the day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Date Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="submission_date">Submission Date</Label>
                  <Input
                    id="submission_date"
                    type="date"
                    value={values.submission_date || ''}
                    onChange={(e) => handleInputChange('submission_date', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="work_date">Work Date</Label>
                  <Input
                    id="work_date"
                    type="date"
                    value={values.work_date || ''}
                    onChange={(e) => handleInputChange('work_date', e.target.value)}
                  />
                </div>
              </div>

              {/* Dynamic Fields from Schema */}
              {fields.length > 0 ? (
                <div className="space-y-4">
                  {fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>
                        {field.label}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      <Input
                        id={field.key}
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={values[field.key] || ''}
                        onChange={(e) => handleInputChange(
                          field.key, 
                          field.type === 'number' ? Number(e.target.value) : e.target.value
                        )}
                        required={field.required}
                        min={field.type === 'number' ? 0 : undefined}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                /* Default fields if no schema */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="outbound_calls">Outbound Calls</Label>
                    <Input
                      id="outbound_calls"
                      type="number"
                      min={0}
                      value={values.outbound_calls || ''}
                      onChange={(e) => handleInputChange('outbound_calls', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="talk_minutes">Talk Minutes</Label>
                    <Input
                      id="talk_minutes"
                      type="number"
                      min={0}
                      value={values.talk_minutes || ''}
                      onChange={(e) => handleInputChange('talk_minutes', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quoted_count">Quotes</Label>
                    <Input
                      id="quoted_count"
                      type="number"
                      min={0}
                      value={values.quoted_count || ''}
                      onChange={(e) => handleInputChange('quoted_count', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sold_items">Items Sold</Label>
                    <Input
                      id="sold_items"
                      type="number"
                      min={0}
                      value={values.sold_items || ''}
                      onChange={(e) => handleInputChange('sold_items', Number(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <LoadingSpinner className="h-4 w-4 mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Scorecard
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
