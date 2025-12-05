import { useState, useEffect, useMemo } from 'react';
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
import { Send, CheckCircle, AlertCircle, ArrowLeft, User, XCircle, Target } from 'lucide-react';

interface FormField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
}

interface KPIPerformance {
  key: string;
  label: string;
  submitted: number;
  target: number;
  passed: boolean;
  percentOfTarget: number;
}

interface PerformanceSummary {
  kpis: KPIPerformance[];
  summary: {
    totalKPIs: number;
    passedKPIs: number;
    passRate: number;
    overallPass: boolean;
  };
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
  const [targets, setTargets] = useState<Record<string, number>>({});

  // Load form template, team member info, and targets
  useEffect(() => {
    async function loadForm() {
      if (!user?.agency_id || !formSlug) return;

      try {
        setLoading(true);
        setError(null);

        // Get form template
        const { data: template, error: templateError } = await supabase
          .from('form_templates')
          .select('id, name, slug, schema_json, status, agency_id')
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

        // Load targets from targets table
        const { data: targetRows } = await supabase
          .from('targets')
          .select('metric_key, value_number, team_member_id')
          .eq('agency_id', template.agency_id);

        if (targetRows) {
          const targetsMap: Record<string, number> = {};
          // First load agency defaults (team_member_id = null)
          targetRows.forEach(t => {
            if (!t.team_member_id) {
              targetsMap[t.metric_key] = t.value_number;
            }
          });
          // Then override with member-specific targets if they exist
          if (user.team_member_id) {
            targetRows.forEach(t => {
              if (t.team_member_id === user.team_member_id) {
                targetsMap[t.metric_key] = t.value_number;
              }
            });
          }
          setTargets(targetsMap);
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

  // Parse form fields from schema
  const fields: FormField[] = useMemo(() => {
    const result: FormField[] = [];
    if (formTemplate?.schema_json?.sections) {
      for (const section of formTemplate.schema_json.sections) {
        if (section.fields) {
          for (const field of section.fields) {
            result.push({
              key: field.key || field.id,
              label: field.label,
              type: field.type || 'number',
              required: field.required
            });
          }
        }
      }
    }
    // Also check for KPIs in schema
    if (formTemplate?.schema_json?.kpis) {
      for (const kpi of formTemplate.schema_json.kpis) {
        if (!result.find(f => f.key === kpi.key)) {
          result.push({
            key: kpi.key,
            label: kpi.label,
            type: kpi.type || 'number',
            required: kpi.required
          });
        }
      }
    }
    return result;
  }, [formTemplate]);

  // Build performance summary for KPIs with targets
  const performanceSummary: PerformanceSummary = useMemo(() => {
    const kpiPerformance: KPIPerformance[] = [];
    const kpis = formTemplate?.schema_json?.kpis || [];
    
    kpis.forEach((kpi: any) => {
      // Priority: form schema target > targets table by slug > targets table by key
      const target = kpi.target?.goal ?? targets[kpi.selectedKpiSlug] ?? targets[kpi.key] ?? 0;
      if (target > 0) {
        const submitted = Number(values[kpi.key]) || 0;
        kpiPerformance.push({
          key: kpi.key,
          label: kpi.label,
          submitted,
          target,
          passed: submitted >= target,
          percentOfTarget: Math.round((submitted / target) * 100)
        });
      }
    });

    const totalKPIs = kpiPerformance.length;
    const passedKPIs = kpiPerformance.filter(k => k.passed).length;
    const passRate = totalKPIs > 0 ? Math.round((passedKPIs / totalKPIs) * 100) : 0;

    return {
      kpis: kpiPerformance,
      summary: {
        totalKPIs,
        passedKPIs,
        passRate,
        overallPass: passRate >= 50 // At least half targets met
      }
    };
  }, [fields, values, targets]);

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
          values: values,
          performanceSummary: performanceSummary
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

  // Helper to check pass/fail status - uses KPI object for target lookup priority
  const getPassStatus = (kpi: any, value: any): boolean | null => {
    // Priority: form schema target > targets table by slug > targets table by key
    const target = kpi.target?.goal ?? targets[kpi.selectedKpiSlug] ?? targets[kpi.key] ?? 0;
    if (target === 0) return null;
    if (value === '' || value === undefined || value === null) return null;
    return Number(value) >= target;
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
                {/* Show performance summary in success state */}
                {performanceSummary.summary.totalKPIs > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4 mt-4">
                    <p className="text-lg font-semibold">
                      {performanceSummary.summary.passedKPIs}/{performanceSummary.summary.totalKPIs} targets met ({performanceSummary.summary.passRate}%)
                    </p>
                  </div>
                )}
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

              {/* Dynamic Fields from Schema with Target Display */}
              {formTemplate?.schema_json?.kpis?.length > 0 ? (
                <div className="space-y-4">
                  {formTemplate.schema_json.kpis.map((kpi: any) => {
                    // Priority: form schema target > targets table by slug > targets table by key
                    const targetValue = kpi.target?.goal ?? targets[kpi.selectedKpiSlug] ?? targets[kpi.key] ?? 0;
                    const passStatus = getPassStatus(kpi, values[kpi.key]);
                    const hasTarget = targetValue > 0;
                    
                    return (
                      <div key={kpi.key} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label htmlFor={kpi.key}>
                            {kpi.label}
                            {kpi.required && <span className="text-destructive ml-1">*</span>}
                          </Label>
                          {hasTarget && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              Target: {targetValue}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <Input
                            id={kpi.key}
                            type={kpi.type === 'number' || kpi.type === 'currency' ? 'number' : 'text'}
                            value={values[kpi.key] ?? ''}
                            onChange={(e) => handleInputChange(
                              kpi.key, 
                              kpi.type === 'number' || kpi.type === 'currency' ? Number(e.target.value) : e.target.value
                            )}
                            required={kpi.required}
                            min={kpi.type === 'number' || kpi.type === 'currency' ? 0 : undefined}
                            className={`pr-10 ${
                              passStatus === true ? 'border-green-500 focus-visible:ring-green-500' : 
                              passStatus === false ? 'border-red-500 focus-visible:ring-red-500' : ''
                            }`}
                          />
                          {passStatus !== null && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {passStatus ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Default fields if no schema */
                <div className="space-y-4">
                  {[
                    { key: 'outbound_calls', label: 'Outbound Calls', selectedKpiSlug: 'outbound_calls' },
                    { key: 'talk_minutes', label: 'Talk Minutes', selectedKpiSlug: 'talk_minutes' },
                    { key: 'quoted_count', label: 'Quotes', selectedKpiSlug: 'quoted_count' },
                    { key: 'sold_items', label: 'Items Sold', selectedKpiSlug: 'sold_items' }
                  ].map((field) => {
                    const targetValue = targets[field.key] ?? 0;
                    const passStatus = getPassStatus(field, values[field.key]);
                    const hasTarget = targetValue > 0;
                    
                    return (
                      <div key={field.key} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label htmlFor={field.key}>{field.label}</Label>
                          {hasTarget && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              Target: {targetValue}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <Input
                            id={field.key}
                            type="number"
                            min={0}
                            value={values[field.key] ?? ''}
                            onChange={(e) => handleInputChange(field.key, Number(e.target.value))}
                            className={`pr-10 ${
                              passStatus === true ? 'border-green-500 focus-visible:ring-green-500' : 
                              passStatus === false ? 'border-red-500 focus-visible:ring-red-500' : ''
                            }`}
                          />
                          {passStatus !== null && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {passStatus ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Performance Summary */}
              {performanceSummary.summary.totalKPIs > 0 && (
                <div className="border-t border-b border-border py-4 my-4">
                  <div className={`text-center p-3 rounded-lg ${
                    performanceSummary.summary.overallPass 
                      ? 'bg-green-500/10 border border-green-500/20' 
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}>
                    <p className={`text-lg font-semibold ${
                      performanceSummary.summary.overallPass ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Performance Summary: {performanceSummary.summary.passedKPIs}/{performanceSummary.summary.totalKPIs} targets met ({performanceSummary.summary.passRate}%)
                    </p>
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
