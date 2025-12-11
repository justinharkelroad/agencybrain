import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { CheckCircle, XCircle, Target } from "lucide-react";
import { mergeStickyFieldsIntoSchema } from "@/utils/mergeStickyFields";

// Helper function to get current local date in YYYY-MM-DD format
const getCurrentLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to convert string to Title Case (for prospect names)
const toTitleCase = (str: string): string => {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

type ResolvedForm = { 
  id: string; 
  slug: string; 
  agency_id: string;
  settings: any; 
  schema: any;
  team_members: Array<{ id: string; name: string; }>;
  lead_sources: Array<{ id: string; name: string; }>;
};

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

export default function PublicFormSubmission() {
  const { agencySlug, formSlug } = useParams();
  const [form, setForm] = useState<ResolvedForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const token = useMemo(() => new URLSearchParams(window.location.search).get("t"), []);
  
  // Conditional logger - only for admin diagnostics
  const log = (import.meta.env.DEV || import.meta.env.VITE_SHOW_DIAGNOSTICS === 'true') ? console.log : () => {};
  const logError = console.error; // Always log errors

  // Check auth session on load (for debugging)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      log("🔐 Auth session present?", Boolean(data.session));
    });
  }, [log]);

  useEffect(() => {
    if (!agencySlug || !formSlug || !token) { setErr("Missing link parameters."); return; }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('resolve_public_form', {
          body: {
            agencySlug,
            formSlug,
            token
          }
        });
        
        if (error) {
          logError('Form resolution failed:', error);
          setErr(error.message || "FORM_NOT_FOUND");
          return;
        }
        
        if (!data?.form) {
          logError('No form data returned');
          setErr("FORM_NOT_FOUND");
          return;
        }
        
        // Defensive mapping for in-flight deploys
        const form = data.form;
        if (!form.schema && form.schema_json) form.schema = form.schema_json;
        if (!form.settings) form.settings = form.schema?.settings ?? form.settings_json ?? {};
        
        // Merge sticky fields into schema at runtime (with policy type options)
        if (form.schema) {
          form.schema = await mergeStickyFieldsIntoSchema(form.schema, form.agency_id);
        }
        
        setForm(form);
        // seed defaults - both submission_date and work_date default to today (submission_date will be locked)
        const today = getCurrentLocalDate();
        setValues(v => ({ ...v, submission_date: today, work_date: today }));
        
        log('🔧 Lead sources loaded:', data.form.lead_sources?.length || 0, 'items');

        // Load targets for this agency
        if (form.agency_id) {
          const { data: targetRows } = await supabase
            .from('targets')
            .select('metric_key, value_number, team_member_id')
            .eq('agency_id', form.agency_id);

          if (targetRows) {
            const targetsMap: Record<string, number> = {};
            // Load agency defaults (team_member_id = null)
            targetRows.forEach(t => {
              if (!t.team_member_id) {
                targetsMap[t.metric_key] = t.value_number;
              }
            });
            setTargets(targetsMap);
            log('🎯 Targets loaded:', targetsMap);
          }
        }
      } catch (error) {
        logError('Form resolution error:', error);
        setErr("NETWORK_ERROR");
      }
    })();
  }, [agencySlug, formSlug, token]);

  // Load member-specific targets when team member is selected
  useEffect(() => {
    if (!form?.agency_id || !values.team_member_id) return;
    
    (async () => {
      const { data: targetRows } = await supabase
        .from('targets')
        .select('metric_key, value_number, team_member_id')
        .eq('agency_id', form.agency_id);

      if (targetRows) {
        const targetsMap: Record<string, number> = {};
        // First load agency defaults
        targetRows.forEach(t => {
          if (!t.team_member_id) {
            targetsMap[t.metric_key] = t.value_number;
          }
        });
        // Then override with member-specific targets
        targetRows.forEach(t => {
          if (t.team_member_id === values.team_member_id) {
            targetsMap[t.metric_key] = t.value_number;
          }
        });
        setTargets(targetsMap);
      }
    })();
  }, [form?.agency_id, values.team_member_id]);

  // Dynamic date refresh - ensure submission_date is always current
  useEffect(() => {
    const refreshSubmissionDate = () => {
      const currentDate = getCurrentLocalDate();
      setValues(v => ({ ...v, submission_date: currentDate }));
    };

    // Refresh immediately and then every minute to handle day changes
    refreshSubmissionDate();
    const interval = setInterval(refreshSubmissionDate, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const onChange = (key: string, val: any) => {
    setValues(v => ({ ...v, [key]: val }));
    
    // Clear field error when user starts typing
    if (fieldErrors[key]) {
      setFieldErrors(prev => ({ ...prev, [key]: '' }));
    }
    
    // Generate household details when quoted_count changes
    if (key === "quoted_count") {
      const cap = form?.settings?.spawnCap ?? 25;
      const rows = Math.max(0, Math.min(Number(val) || 0, cap));
      setValues(v => ({ ...v, quoted_details: Array.from({length: rows}).map((_,i)=>v.quoted_details?.[i] || {}) }));
    }
    
    // Handle repeater section triggers
    if (form?.schema?.repeaterSections) {
      Object.entries(form.schema.repeaterSections).forEach(([sectionKey, section]: [string, any]) => {
        if (section.enabled && section.triggerKPI === key) {
          const cap = form?.settings?.spawnCap ?? 25;
          const rows = Math.max(0, Math.min(Number(val) || 0, cap));
          setValues(v => ({ ...v, [sectionKey]: Array.from({length: rows}).map((_,i)=>v[sectionKey]?.[i] || {}) }));
        }
      });
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

  // Build performance summary for KPIs with targets
  const performanceSummary: PerformanceSummary = useMemo(() => {
    const kpiPerformance: KPIPerformance[] = [];
    
    if (form?.schema?.kpis) {
      form.schema.kpis.forEach((kpi: any) => {
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
    }

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
  }, [form?.schema?.kpis, values, targets]);

  const validateRequired = () => {
    const errors: Record<string, string> = {};
    
    // System required fields
    if (!values.team_member_id) {
      errors.team_member_id = "Staff member is required";
    }
    if (!values.submission_date) {
      errors.submission_date = "Submission date is required";
    }
    
    // Schema-based required fields
    if (form?.schema?.kpis) {
      form.schema.kpis.forEach((kpi: any) => {
        if (kpi.required && (values[kpi.key] === undefined || values[kpi.key] === null || values[kpi.key] === '')) {
          errors[kpi.key] = `${kpi.label} is required`;
        }
      });
    }
    
    if (form?.schema?.customFields) {
      form.schema.customFields.forEach((field: any) => {
        if (field.required && (values[field.key] === undefined || values[field.key] === null || values[field.key] === '')) {
          errors[field.key] = `${field.label} is required`;
        }
      });
    }
    
    // Validate required fields in repeater sections (handle both camelCase and snake_case)
    const quotedDetails = values.quoted_details || values.quotedDetails || [];
    const quotedCount = values.quoted_count || values.quotedCount || 0;
    
    // Only validate if quoted_count > 0 and we have rows
    if (quotedCount > 0 && quotedDetails.length > 0) {
      quotedDetails.forEach((row: any, rowIndex: number) => {
        // Check required keys: prospect_name, lead_source, detailed_notes
        if (!row.prospect_name || row.prospect_name.trim() === '') {
          errors[`quoted_details.${rowIndex}.prospect_name`] = `Prospect name is required for household #${rowIndex + 1}`;
        }
        if (!row.lead_source || row.lead_source.trim() === '') {
          errors[`quoted_details.${rowIndex}.lead_source`] = `Lead source is required for household #${rowIndex + 1}`;
        }
        if (!row.detailed_notes || row.detailed_notes.trim() === '') {
          errors[`quoted_details.${rowIndex}.detailed_notes`] = `Detailed notes are required for household #${rowIndex + 1}`;
        }
      });
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async () => {
    setIsSubmitting(true);
    setErr(null);
    
    log('🚀 Form submission started');
    log('🔧 Environment check:');
    log('  VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
    log('  VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
    log('📋 Form values:', values);
    log('✅ Required fields check...');
    
    // Enhanced validation with user feedback
    if (!validateRequired()) {
      log('❌ Validation failed - missing required fields');
      setErr("Please fill in all required fields");
      setIsSubmitting(false);
      return;
    }
    
    try {
      log('✅ Required fields check passed');

      // Normalize to snake_case before validation and submission
      log('🔧 Pre-normalization values:', values);
      
      // Convert quotedDetails to quoted_details (normalize from UI state)
      if (values.quotedDetails && !values.quoted_details) {
        values.quoted_details = values.quotedDetails;
        delete values.quotedDetails;
      }
      
      log('🔧 Post-normalization values:', values);

      const payload = {
        agencySlug,
        formSlug: formSlug,
        token,
        teamMemberId: values.team_member_id,
        submissionDate: values.submission_date,
        workDate: values.work_date || null,
        values: values,
        performanceSummary: performanceSummary, // Include performance data for AI email
      };

      log('📤 POST to submit_public_form...');
      log('📋 Payload being sent:', JSON.stringify(payload, null, 2));
      
      const { data, error } = await supabase.functions.invoke("submit_public_form", { body: payload });
      
      if (error) { 
        log('❌ Submission error details:', {
          error,
          errorMessage: error.message,
          errorCode: error.code,
          errorDetails: error.details
        });
        
        // Provide more specific error messages
        let errorMessage = "Submission failed";
        if (error.message) {
          if (error.message.includes('UUID')) {
            errorMessage = "Invalid data format. Please refresh the page and try again.";
          } else if (error.message.includes('FORM_NOT_FOUND')) {
            errorMessage = "This form link is no longer valid.";
          } else if (error.message.includes('FORM_EXPIRED')) {
            errorMessage = "This form link has expired.";
          } else if (error.message.includes('FORM_DISABLED')) {
            errorMessage = "This form is currently disabled.";
          } else {
            errorMessage = error.message;
          }
        }
        
        setErr(errorMessage); 
        return; 
      }
      
      log('✅ 200 OK - Form submitted successfully!');
      log('📋 Response data:', data);
      setErr(null);
      toast.success("Form submitted successfully!");
      
      // Reset form values to prevent duplicate submissions - maintain correct date defaults  
      const today = getCurrentLocalDate();
      setValues({ submission_date: today, work_date: today });
    } catch (error: any) {
      logError('❌ Network/catch error:', error);
      let errorMessage = "Network error. Please check your connection and try again.";
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = "Connection failed. Please check your internet connection.";
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      setErr(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (err) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full text-center">
        <h2 className="text-lg font-semibold text-destructive mb-2">Form Error</h2>
        <p className="text-muted-foreground">{err}</p>
      </div>
    </div>
  );
  
  if (!form) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading form...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-card border border-border rounded-lg shadow-sm">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border">
            <h1 className="text-2xl font-semibold text-foreground capitalize">
              {form.slug.replace(/-/g, ' ')}
            </h1>
          </div>

          {/* Form Content */}
          <div className="p-6 space-y-6">
            {/* System Fields First */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground mb-4">Basic Information</h3>
              
              {/* Staff Member Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Staff Member<span className="text-destructive"> *</span>
                </label>
                <select 
                  value={values.team_member_id ?? ""} 
                  onChange={e=>onChange("team_member_id", e.target.value)}
                  className={`w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground relative z-10 ${
                    fieldErrors.team_member_id ? 'border-destructive focus:ring-destructive' : 'border-input'
                  }`}
                >
                  <option value="">Select Staff Member</option>
                  {form.team_members?.map((member: any) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
                {fieldErrors.team_member_id && (
                  <p className="text-sm text-destructive">{fieldErrors.team_member_id}</p>
                )}
              </div>
              
              {/* Date Fields */}
               <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Submission Date<span className="text-destructive"> *</span>
                </label>
                <input 
                  type="date"
                  value={values.submission_date ?? ""} 
                  readOnly
                  className={`w-full px-3 py-2 bg-muted border rounded-md text-foreground cursor-not-allowed ${
                    fieldErrors.submission_date ? 'border-destructive' : 'border-input'
                  }`}
                />
                {fieldErrors.submission_date && (
                  <p className="text-sm text-destructive">{fieldErrors.submission_date}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Work Date
                </label>
                <input 
                  type="date"
                  value={values.work_date ?? ""} 
                  onChange={e=>onChange("work_date", e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                />
              </div>
            </div>

            {/* KPI Fields with Target Display */}
            {form.schema?.kpis?.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">Key Performance Indicators</h3>
                {form.schema.kpis.map((kpi: any) => {
                  // Priority: form schema target > targets table by slug > targets table by key
                  const targetValue = kpi.target?.goal ?? targets[kpi.selectedKpiSlug] ?? targets[kpi.key] ?? 0;
                  const passStatus = getPassStatus(kpi, values[kpi.key]);
                  const hasTarget = targetValue > 0;
                  
                  return (
                    <div key={kpi.key} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-foreground">
                          {kpi.label}{kpi.required && <span className="text-destructive"> *</span>}
                        </label>
                        {hasTarget && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Target: {targetValue}
                          </span>
                        )}
                      </div>
                      {kpi.type === "number" && (
                        <div className="relative">
                          <input 
                            type="number" 
                            min={0} 
                            value={values[kpi.key] ?? ""} 
                            onChange={e=>onChange(kpi.key, parseFloat(e.target.value) || 0)}
                            className={`w-full px-3 py-2 pr-10 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground ${
                              passStatus === true ? 'border-green-500 focus:ring-green-500' : 
                              passStatus === false ? 'border-red-500 focus:ring-red-500' : 'border-input'
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
                      )}
                      {kpi.type === "currency" && (
                        <div className="relative">
                          <input 
                            type="number" 
                            min={0} 
                            step="0.01" 
                            value={values[kpi.key] ?? ""} 
                            onChange={e=>onChange(kpi.key, parseFloat(e.target.value) || 0)}
                            className={`w-full px-3 py-2 pr-10 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground ${
                              passStatus === true ? 'border-green-500 focus:ring-green-500' : 
                              passStatus === false ? 'border-red-500 focus:ring-red-500' : 'border-input'
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
                      )}
                      {(kpi.type === "dropdown" || kpi.type === "select") && (
                        <select 
                          value={values[kpi.key] ?? ""} 
                          onChange={e=>onChange(kpi.key, e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                        >
                          <option value="">Select</option>
                          {(kpi.entityOptions || kpi.options || []).map((o:string) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom Fields */}
            {form.schema?.customFields?.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">Additional Information</h3>
                {form.schema.customFields.map((field: any) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {field.label}{field.required && <span className="text-destructive"> *</span>}
                    </label>
                     {(field.type === "textarea" || field.type === "longtext") ? (
                       <textarea 
                         value={typeof values[field.key] === 'object' ? JSON.stringify(values[field.key]) : (values[field.key] ?? "")} 
                         onChange={e=>onChange(field.key, e.target.value)}
                         rows={4}
                         className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground resize-vertical"
                       />
                     ) : field.type === "text" ? (
                       <input 
                         type="text"
                         value={typeof values[field.key] === 'object' ? JSON.stringify(values[field.key]) : (values[field.key] ?? "")} 
                         onChange={e=>onChange(field.key, e.target.value)}
                         className={`w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground ${
                           fieldErrors[field.key] ? 'border-destructive focus:ring-destructive' : 'border-input'
                         }`}
                       />
                     ) : field.type === "checkbox" ? (
                       <label className="flex items-center space-x-2">
                         <input
                           type="checkbox"
                           checked={values[field.key] === "yes" || values[field.key] === true}
                           onChange={e => onChange(field.key, e.target.checked ? "yes" : "no")}
                           className="rounded border-input text-primary focus:ring-primary focus:ring-offset-0"
                         />
                         <span className="text-sm text-foreground">Yes</span>
                       </label>
                     ) : field.type === "dropdown" ? (
                      <select 
                        value={values[field.key] ?? ""} 
                        onChange={e=>onChange(field.key, e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                      >
                        <option value="">Select</option>
                        {(field.options || []).map((o:string) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type={field.type === "number" ? "number" : "text"}
                        value={typeof values[field.key] === 'object' ? JSON.stringify(values[field.key]) : (values[field.key] ?? "")} 
                        onChange={e=>onChange(field.key, e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Repeater Sections (Household Details) */}
            {form.schema?.repeaterSections && Object.entries(form.schema.repeaterSections).map(([sectionKey, section]: [string, any]) => {
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
                                  value={row[field.key] || ""}
                                  onChange={e => {
                                    const v = e.target.value;
                                    setValues(prev => {
                                      // Create immutable copy of the array and object
                                      const currentArray = [...(prev[sectionKey] || [])];
                                      const currentItem = { ...(currentArray[i] || {}) };
                                      currentItem[field.key] = v;
                                      currentArray[i] = currentItem;
                                      return { ...prev, [sectionKey]: currentArray };
                                    });
                                    
                                    // Clear field error if exists
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
                                    form.lead_sources?.map((ls) => (
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
                                      // Create immutable copy of the array and object
                                      const currentArray = [...(prev[sectionKey] || [])];
                                      const currentItem = { ...(currentArray[i] || {}) };
                                      currentItem[field.key] = v;
                                      currentArray[i] = currentItem;
                                      return { ...prev, [sectionKey]: currentArray };
                                    });
                                    
                                    // Clear field error if exists
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
                                      // Create immutable copy of the array and object
                                      const currentArray = [...(prev[sectionKey] || [])];
                                      const currentItem = { ...(currentArray[i] || {}) };
                                      currentItem[field.key] = v;
                                      currentArray[i] = currentItem;
                                      return { ...prev, [sectionKey]: currentArray };
                                    });
                                    
                                    // Clear field error if exists
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
            <div className="border-t border-border pt-6">
              <button 
                onClick={submit}
                disabled={isSubmitting}
                className={`w-full px-4 py-3 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors ${
                  isSubmitting 
                    ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    Submitting...
                  </div>
                ) : (
                  'Submit Form'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
