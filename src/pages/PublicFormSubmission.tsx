import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supaPublic } from "@/lib/supabasePublic";

type ResolvedForm = { 
  id: string; 
  slug: string; 
  settings: any; 
  schema: any;
  team_members: Array<{ id: string; name: string; }>;
};

import { supa } from "@/lib/supabase";

export default function PublicFormSubmission() {
  const { agencySlug, formSlug } = useParams();
  const [form, setForm] = useState<ResolvedForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const token = useMemo(() => new URLSearchParams(window.location.search).get("t"), []);

  // Check auth session on load
  useEffect(() => {
    supa.auth.getSession().then(({ data }) => {
      console.log("🔐 Auth session present?", Boolean(data.session));
    });
  }, []);

  useEffect(() => {
    if (!agencySlug || !formSlug || !token) { setErr("Missing link parameters."); return; }
    (async () => {
      try {
        const { data, error } = await supaPublic.functions.invoke('resolve_public_form', {
          body: {
            agencySlug,
            formSlug,
            token
          }
        });
        
        if (error) {
          console.error('Form resolution failed:', error);
          setErr(error.message || "FORM_NOT_FOUND");
          return;
        }
        
        if (!data?.form) {
          console.error('No form data returned');
          setErr("FORM_NOT_FOUND");
          return;
        }
        
        setForm(data.form);
        // seed defaults including previous business day
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        setValues(v => ({ ...v, submission_date: yesterday, work_date: yesterday }));
      } catch (error) {
        console.error('Form resolution error:', error);
        setErr("NETWORK_ERROR");
      }
    })();
  }, [agencySlug, formSlug, token]);

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
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async () => {
    setIsSubmitting(true);
    setErr(null);
    
    console.log('🚀 Form submission started');
    console.log('🔧 Environment check:');
    console.log('  VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('  VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
    console.log('📋 Form values:', values);
    console.log('✅ Required fields check...');
    
    // Enhanced validation with user feedback
    if (!validateRequired()) {
      console.log('❌ Validation failed - missing required fields');
      setErr("Please fill in all required fields");
      setIsSubmitting(false);
      return;
    }
    
    try {
      console.log('✅ Required fields check passed');

      const payload = {
        agencySlug,
        formSlug: formSlug,
        token,
        teamMemberId: values.team_member_id,
        submissionDate: values.submission_date,
        workDate: values.work_date || null,
        values,
      };

      console.log('📤 POST to submit_public_form...');
      const { data, error } = await supaPublic.functions.invoke("submit_public_form", { body: payload });
      
      if (error) { 
        console.log('❌ Submission error:', error);
        setErr(error.message || "ERROR"); 
        return; 
      }
      
      console.log('✅ 200 OK - Form submitted successfully!');
      setErr(null);
      alert("Form submitted successfully!");
    } catch (error) {
      console.error('Network error:', error);
      setErr("Network error. Please check your connection and try again.");
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
                  className={`w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground ${
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
                  onChange={e=>onChange("submission_date", e.target.value)}
                  className={`w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground ${
                    fieldErrors.submission_date ? 'border-destructive focus:ring-destructive' : 'border-input'
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

            {/* KPI Fields */}
            {form.schema?.kpis?.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">Key Performance Indicators</h3>
                {form.schema.kpis.map((kpi: any) => (
                  <div key={kpi.key} className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {kpi.label}{kpi.required && <span className="text-destructive"> *</span>}
                    </label>
                    {kpi.type === "number" && (
                      <input 
                        type="number" 
                        min={0} 
                        value={values[kpi.key] ?? ""} 
                        onChange={e=>onChange(kpi.key, parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                      />
                    )}
                    {kpi.type === "currency" && (
                      <input 
                        type="number" 
                        min={0} 
                        step="0.01" 
                        value={values[kpi.key] ?? ""} 
                        onChange={e=>onChange(kpi.key, parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                      />
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
                ))}
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
                        value={values[field.key] ?? ""} 
                        onChange={e=>onChange(field.key, e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground resize-vertical"
                      />
                    ) : field.type === "select" ? (
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
                        value={values[field.key] ?? ""} 
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
                      <div key={i} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 p-3 bg-background rounded-md mb-3 last:mb-0">
                        <div className="md:col-span-2 lg:col-span-4 text-sm font-medium text-foreground mb-2">
                          {section.title.slice(0, -1)} #{i + 1}
                        </div>
                        {section.fields?.map((field: any) => (
                          <div key={field.key} className={`space-y-1 ${field.type === "longtext" ? "md:col-span-2 lg:col-span-4" : ""}`}>
                            <label className="text-xs font-medium text-muted-foreground">
                              {field.label}{field.required && <span className="text-destructive"> *</span>}
                            </label>
                            {field.type === "select" ? (
                              <select
                                value={row[field.key] || ""}
                                onChange={e => {
                                  const v = e.target.value;
                                  setValues(prev => {
                                    const next = [...(prev[sectionKey] || [])];
                                    next[i] = { ...(next[i] || {}), [field.key]: v };
                                    return { ...prev, [sectionKey]: next };
                                  });
                                }}
                                className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                              >
                                <option value="">Select</option>
                                {(field.options || []).map((o: string) => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            ) : field.type === "longtext" ? (
                              <textarea
                                value={row[field.key] || ""}
                                onChange={e => {
                                  const v = e.target.value;
                                  setValues(prev => {
                                    const next = [...(prev[sectionKey] || [])];
                                    next[i] = { ...(next[i] || {}), [field.key]: v };
                                    return { ...prev, [sectionKey]: next };
                                  });
                                }}
                                rows={3}
                                className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring text-foreground resize-vertical"
                              />
                            ) : (
                              <input
                                type={field.type === "number" ? "number" : "text"}
                                value={row[field.key] || ""}
                                onChange={e => {
                                  const v = e.target.value;
                                  setValues(prev => {
                                    const next = [...(prev[sectionKey] || [])];
                                    next[i] = { ...(next[i] || {}), [field.key]: v };
                                    return { ...prev, [sectionKey]: next };
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
