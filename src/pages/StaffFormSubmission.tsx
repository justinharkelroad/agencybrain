import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Send, CheckCircle, AlertCircle, ArrowLeft, User, XCircle, Target } from 'lucide-react';
import { mergeStickyFieldsIntoSchema } from '@/utils/mergeStickyFields';

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
  
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [leadSources, setLeadSources] = useState<Array<{ id: string; name: string }>>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

        // Merge sticky fields into schema at runtime (with policy type options)
        if (template.schema_json) {
          template.schema_json = await mergeStickyFieldsIntoSchema(template.schema_json, template.agency_id);
        }

        setFormTemplate(template);


        // Load lead sources for repeater dropdowns
        const { data: leadSourcesData } = await supabase
          .from('lead_sources')
          .select('id, name')
          .eq('agency_id', template.agency_id)
          .eq('is_active', true)
          .order('name');
        
        if (leadSourcesData) {
          setLeadSources(leadSourcesData);
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

  // Helper function to convert string to Title Case (for prospect names)
  const toTitleCase = (str: string): string => {
    if (!str) return str;
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleInputChange = (key: string, value: any) => {
    // Clear field error when user starts typing
    if (fieldErrors[key]) {
      setFieldErrors(prev => ({ ...prev, [key]: '' }));
    }
    
    // Single consolidated state update to prevent data loss
    setValues(prev => {
      const newState = { ...prev, [key]: value };
      
      // Handle repeater section triggers
      const schema = formTemplate?.schema_json;
      if (schema?.repeaterSections) {
        const cap = schema?.settings?.spawnCap ?? 25;
        const rows = Math.max(0, Math.min(Number(value) || 0, cap));
        
        // Handle standard repeater sections
        Object.entries(schema.repeaterSections).forEach(([sectionKey, section]: [string, any]) => {
          // Skip customCollections array - handled separately below
          if (sectionKey === 'customCollections') return;
          if (section.enabled && section.triggerKPI === key) {
            const existingRows = prev[sectionKey] || [];
            // Preserve existing data, add empty objects for new rows
            newState[sectionKey] = Array.from({ length: rows }).map((_, i) => 
              existingRows[i] || {}
            );
          }
        });
        
        // Handle custom collections - they use controllingKpiKey, not triggerKPI
        const customCollections = schema.repeaterSections?.customCollections || [];
        customCollections.forEach((collection: any) => {
          if (collection.enabled && collection.controllingKpiKey === key) {
            const existingRows = prev[collection.id] || [];
            // Preserve existing data, add empty objects for new rows
            newState[collection.id] = Array.from({ length: rows }).map((_, i) => 
              existingRows[i] || {}
            );
          }
        });
      }
      
      return newState;
    });
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

    // Validate repeater sections for required fields
    const formSchema = formTemplate?.schema_json;
    if (formSchema?.repeaterSections) {
      for (const [sectionKey, section] of Object.entries(formSchema.repeaterSections) as [string, any][]) {
        if (!section.enabled) continue;
        
        const rows: any[] = values[sectionKey] || [];
        
        for (let i = 0; i < rows.length; i++) {
          for (const field of section.fields || []) {
            if (field.required) {
              const value = rows[i][field.key];
              const isEmpty = value === undefined || value === null || value === '' || 
                (Array.isArray(value) && value.length === 0);
              
              if (isEmpty) {
                const errorKey = `${sectionKey}.${i}.${field.key}`;
                setFieldErrors(prev => ({ ...prev, [errorKey]: `${field.label} is required` }));
                toast.error(`${section.title?.slice(0, -1) || 'Entry'} #${i + 1}: ${field.label} is required`);
                return;
              }
            }
          }
        }
      }
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
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Account Not Linked</AlertTitle>
          <AlertDescription>
            Your staff account is not linked to a team member. Please contact your administrator to set up your account before submitting forms.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Loading form
  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold">Submission Successful!</h2>
              <p className="text-muted-foreground">
                Your daily metrics have been recorded.
              </p>
              {performanceSummary.summary.totalKPIs > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 mt-4">
                  <p className="text-lg font-semibold">
                    {performanceSummary.summary.passedKPIs}/{performanceSummary.summary.totalKPIs} targets met ({performanceSummary.summary.passRate}%)
                  </p>
                </div>
              )}
              <div className="flex gap-4 justify-center pt-4">
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
    );
  }

  // Render form
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

        {/* Identity Card - Shows who is submitting (no dropdown!) */}
        <Card className="bg-muted/50 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Submitting as:</p>
                <p className="font-semibold">{user.team_member_name || user.display_name}</p>
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
                            step="any"
                            inputMode="decimal"
                            value={values[kpi.key] ?? ''}
                            onChange={(e) => handleInputChange(kpi.key, e.target.value)}
                            onBlur={(e) => {
                              if (kpi.type === 'number' || kpi.type === 'currency') {
                                const numVal = parseFloat(e.target.value);
                                if (!isNaN(numVal)) {
                                  handleInputChange(kpi.key, numVal);
                                }
                              }
                            }}
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
                            step="any"
                            inputMode="decimal"
                            min={0}
                            value={values[field.key] ?? ''}
                            onChange={(e) => handleInputChange(field.key, e.target.value)}
                            onBlur={(e) => {
                              const numVal = parseFloat(e.target.value);
                              if (!isNaN(numVal)) {
                                handleInputChange(field.key, numVal);
                              }
                            }}
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

              {/* Repeater Sections (Household Details) */}
              {formTemplate?.schema_json?.repeaterSections && Object.entries(formTemplate.schema_json.repeaterSections).map(([sectionKey, section]: [string, any]) => {
                if (!section.enabled || !section.triggerKPI) return null;
                
                const triggerValue = values[section.triggerKPI];
                const rows: any[] = values[sectionKey] || [];
                
                if (!triggerValue || triggerValue <= 0 || rows.length === 0) return null;
                
                return (
                  <div key={sectionKey} className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground mb-4">{section.title}</h3>
                    <div className="bg-muted/30 border border-border rounded-lg p-4">
                      {rows.map((row, i) => (
                        <div key={i} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end p-3 bg-background rounded-md mb-3 last:mb-0">
                          <div className="md:col-span-2 lg:col-span-4 text-sm font-medium text-foreground mb-2">
                            {section.title.slice(0, -1)} #{i + 1}
                          </div>
                          {section.fields?.map((field: any) => (
                            <div key={field.key} className={`space-y-1 ${field.type === "longtext" ? "md:col-span-2 lg:col-span-4" : ""}`}>
                              <label className="text-xs font-medium text-muted-foreground">
                                {field.label}{field.required && <span className="text-destructive"> *</span>}
                              </label>
                              {field.type === "select" ? (
                                <div className="space-y-1">
                                <select
                                  required={field.required}
                                  value={row[field.key] || ""}
                                    onChange={e => {
                                      const v = e.target.value;
                                      setValues(prev => {
                                        const currentArray = [...(prev[sectionKey] || [])];
                                        const currentItem = { ...(currentArray[i] || {}) };
                                        currentItem[field.key] = v;
                                        currentArray[i] = currentItem;
                                        return { ...prev, [sectionKey]: currentArray };
                                      });
                                      
                                      const errorKey = `${sectionKey}.${i}.${field.key}`;
                                      if (fieldErrors[errorKey]) {
                                        setFieldErrors(prev => ({ ...prev, [errorKey]: '' }));
                                      }
                                    }}
                                    className={`w-full px-2 py-1 text-sm bg-background border rounded focus:outline-none focus:ring-1 focus:ring-ring text-foreground ${
                                      fieldErrors[`${sectionKey}.${i}.${field.key}`] ? 'border-destructive focus:ring-destructive' : 'border-input'
                                    }`}
                                  >
                                    <option value="">Select</option>
                                    {field.key === 'lead_source' ? (
                                      leadSources?.map((ls) => (
                                        <option key={ls.id} value={ls.id}>{ls.name}</option>
                                      ))
                                    ) : (
                                      (field.options || []).map((o: string) => (
                                        <option key={o} value={o}>{o}</option>
                                      ))
                                    )}
                                  </select>
                                  {fieldErrors[`${sectionKey}.${i}.${field.key}`] && (
                                    <p className="text-xs text-destructive">{fieldErrors[`${sectionKey}.${i}.${field.key}`]}</p>
                                  )}
                                </div>
                              ) : field.type === "multiselect" ? (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2">
                                    {(field.options || []).map((option: string) => {
                                      const currentValues: string[] = row[field.key] || [];
                                      const isChecked = currentValues.includes(option);
                                      return (
                                        <label key={option} className="flex items-center gap-1.5 text-sm cursor-pointer bg-muted/50 px-2 py-1 rounded border border-input hover:bg-muted transition-colors">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={e => {
                                              setValues(prev => {
                                                const currentArray = [...(prev[sectionKey] || [])];
                                                const currentItem = { ...(currentArray[i] || {}) };
                                                const existingValues: string[] = currentItem[field.key] || [];
                                                
                                                if (e.target.checked) {
                                                  currentItem[field.key] = [...existingValues, option];
                                                } else {
                                                  currentItem[field.key] = existingValues.filter(v => v !== option);
                                                }
                                                
                                                currentArray[i] = currentItem;
                                                return { ...prev, [sectionKey]: currentArray };
                                              });
                                            }}
                                            className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0 h-3.5 w-3.5"
                                          />
                                          <span className="text-foreground">{option}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  {fieldErrors[`${sectionKey}.${i}.${field.key}`] && (
                                    <p className="text-xs text-destructive">{fieldErrors[`${sectionKey}.${i}.${field.key}`]}</p>
                                  )}
                                </div>
                              ) : field.type === "longtext" ? (
                                <div className="space-y-1">
                                  <textarea
                                    value={row[field.key] || ""}
                                    onChange={e => {
                                      const v = e.target.value;
                                      setValues(prev => {
                                        const currentArray = [...(prev[sectionKey] || [])];
                                        const currentItem = { ...(currentArray[i] || {}) };
                                        currentItem[field.key] = v;
                                        currentArray[i] = currentItem;
                                        return { ...prev, [sectionKey]: currentArray };
                                      });
                                      
                                      const errorKey = `${sectionKey}.${i}.${field.key}`;
                                      if (fieldErrors[errorKey]) {
                                        setFieldErrors(prev => ({ ...prev, [errorKey]: '' }));
                                      }
                                    }}
                                    rows={3}
                                    className={`w-full px-2 py-1 text-sm bg-background border rounded focus:outline-none focus:ring-1 focus:ring-ring text-foreground resize-vertical ${
                                      fieldErrors[`${sectionKey}.${i}.${field.key}`] ? 'border-destructive focus:ring-destructive' : 'border-input'
                                    }`}
                                  />
                                  {fieldErrors[`${sectionKey}.${i}.${field.key}`] && (
                                    <p className="text-xs text-destructive">{fieldErrors[`${sectionKey}.${i}.${field.key}`]}</p>
                                  )}
                                </div>
                              ) : field.type === "checkbox" ? (
                                <div className="space-y-1">
                                  <label className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={row[field.key] === "yes" || row[field.key] === true}
                                      onChange={e => {
                                        const v = e.target.checked ? "yes" : "no";
                                        setValues(prev => {
                                          const currentArray = [...(prev[sectionKey] || [])];
                                          const currentItem = { ...(currentArray[i] || {}) };
                                          currentItem[field.key] = v;
                                          currentArray[i] = currentItem;
                                          return { ...prev, [sectionKey]: currentArray };
                                        });
                                      }}
                                      className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-foreground">Yes</span>
                                  </label>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <input
                                    type={field.type === "number" ? "number" : "text"}
                                    value={row[field.key] || ""}
                                    onChange={e => {
                                      const v = e.target.value;
                                      setValues(prev => {
                                        const currentArray = [...(prev[sectionKey] || [])];
                                        const currentItem = { ...(currentArray[i] || {}) };
                                        currentItem[field.key] = v;
                                        currentArray[i] = currentItem;
                                        return { ...prev, [sectionKey]: currentArray };
                                      });
                                      
                                      const errorKey = `${sectionKey}.${i}.${field.key}`;
                                      if (fieldErrors[errorKey]) {
                                        setFieldErrors(prev => ({ ...prev, [errorKey]: '' }));
                                      }
                                    }}
                                    onBlur={field.key === 'prospect_name' ? (e) => {
                                      const formatted = toTitleCase(e.target.value);
                                      if (formatted !== e.target.value) {
                                        setValues(prev => {
                                          const currentArray = [...(prev[sectionKey] || [])];
                                          const currentItem = { ...(currentArray[i] || {}) };
                                          currentItem[field.key] = formatted;
                                          currentArray[i] = currentItem;
                                          return { ...prev, [sectionKey]: currentArray };
                                        });
                                      }
                                    } : undefined}
                                    className={`w-full px-2 py-1 text-sm bg-background border rounded focus:outline-none focus:ring-1 focus:ring-ring text-foreground ${
                                      fieldErrors[`${sectionKey}.${i}.${field.key}`] ? 'border-destructive focus:ring-destructive' : 'border-input'
                                    }`}
                                  />
                                  {fieldErrors[`${sectionKey}.${i}.${field.key}`] && (
                                    <p className="text-xs text-destructive">{fieldErrors[`${sectionKey}.${i}.${field.key}`]}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Custom Collections (Dynamic Repeater Sections) */}
              {formTemplate?.schema_json?.repeaterSections?.customCollections?.map((collection: any) => {
                if (!collection.enabled) return null;
                
                const triggerValue = values[collection.controllingKpiKey];
                const rows: any[] = values[collection.id] || [];
                
                if (!triggerValue || triggerValue <= 0 || rows.length === 0) return null;
                
                return (
                  <div key={collection.id} className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground mb-4">{collection.name}</h3>
                    <div className="bg-muted/30 border border-border rounded-lg p-4">
                      {rows.map((row, i) => (
                        <div key={i} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end p-3 bg-background rounded-md mb-3 last:mb-0">
                          <div className="md:col-span-2 lg:col-span-4 text-sm font-medium text-foreground mb-2">
                            {collection.name} #{i + 1}
                          </div>
                          {collection.fields?.map((field: any) => (
                            <div key={field.key} className={`space-y-1 ${field.type === "longtext" ? "md:col-span-2 lg:col-span-4" : ""}`}>
                              <label className="text-xs font-medium text-muted-foreground">
                                {field.label}{field.required && <span className="text-destructive"> *</span>}
                              </label>
                              {field.type === "select" || field.type === "dropdown" ? (
                                <select
                                  required={field.required}
                                  value={row[field.key] || ""}
                                  onChange={e => {
                                    const v = e.target.value;
                                    setValues(prev => {
                                      const currentArray = [...(prev[collection.id] || [])];
                                      const currentItem = { ...(currentArray[i] || {}) };
                                      currentItem[field.key] = v;
                                      currentArray[i] = currentItem;
                                      return { ...prev, [collection.id]: currentArray };
                                    });
                                  }}
                                  className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                                >
                                  <option value="">Select</option>
                                  {(field.options || []).map((o: string) => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                              ) : field.type === "longtext" || field.type === "textarea" ? (
                                <textarea
                                  value={row[field.key] || ""}
                                  onChange={e => {
                                    const v = e.target.value;
                                    setValues(prev => {
                                      const currentArray = [...(prev[collection.id] || [])];
                                      const currentItem = { ...(currentArray[i] || {}) };
                                      currentItem[field.key] = v;
                                      currentArray[i] = currentItem;
                                      return { ...prev, [collection.id]: currentArray };
                                    });
                                  }}
                                  rows={3}
                                  className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring text-foreground resize-vertical"
                                />
                              ) : field.type === "checkbox" ? (
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={row[field.key] === "yes" || row[field.key] === true}
                                    onChange={e => {
                                      const v = e.target.checked ? "yes" : "no";
                                      setValues(prev => {
                                        const currentArray = [...(prev[collection.id] || [])];
                                        const currentItem = { ...(currentArray[i] || {}) };
                                        currentItem[field.key] = v;
                                        currentArray[i] = currentItem;
                                        return { ...prev, [collection.id]: currentArray };
                                      });
                                    }}
                                    className="rounded border-input text-primary focus:ring-primary"
                                  />
                                  <span className="text-sm text-foreground">Yes</span>
                                </label>
                              ) : (
                                <input
                                  type={field.type === "number" ? "number" : "text"}
                                  value={row[field.key] || ""}
                                  onChange={e => {
                                    const v = e.target.value;
                                    setValues(prev => {
                                      const currentArray = [...(prev[collection.id] || [])];
                                      const currentItem = { ...(currentArray[i] || {}) };
                                      currentItem[field.key] = v;
                                      currentArray[i] = currentItem;
                                      return { ...prev, [collection.id]: currentArray };
                                    });
                                  }}
                                  className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Additional Information - Custom Fields */}
              {formTemplate?.schema_json?.customFields?.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-semibold text-foreground">Additional Information</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {formTemplate.schema_json.customFields.map((field: any) => (
                      <div key={field.key} className={`space-y-2 ${field.type === 'longtext' ? 'md:col-span-2' : ''}`}>
                        <Label htmlFor={field.key}>
                          {field.label}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {field.type === 'dropdown' ? (
                          <select
                            id={field.key}
                            required={field.required}
                            value={values[field.key] || ''}
                            onChange={(e) => handleInputChange(field.key, e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
                          >
                            <option value="">Select option...</option>
                            {field.options?.map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === 'longtext' ? (
                          <Textarea
                            id={field.key}
                            required={field.required}
                            value={values[field.key] || ''}
                            onChange={(e) => handleInputChange(field.key, e.target.value)}
                            rows={3}
                            className="resize-none"
                          />
                        ) : field.type === 'checkbox' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={field.key}
                              checked={values[field.key] === 'yes' || values[field.key] === true}
                              onChange={(e) => handleInputChange(field.key, e.target.checked ? 'yes' : 'no')}
                              className="h-4 w-4 rounded border-input"
                            />
                            <span className="text-sm text-muted-foreground">{field.label}</span>
                          </div>
                        ) : field.type === 'date' ? (
                          <Input
                            type="date"
                            id={field.key}
                            required={field.required}
                            value={values[field.key] || ''}
                            onChange={(e) => handleInputChange(field.key, e.target.value)}
                          />
                        ) : (
                          <Input
                            type="text"
                            id={field.key}
                            required={field.required}
                            value={values[field.key] || ''}
                            onChange={(e) => handleInputChange(field.key, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
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
  );
}
