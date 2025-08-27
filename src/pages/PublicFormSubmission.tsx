import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

type Field = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  options_json?: any;
  builtin: boolean;
  position: number;
};
type ResolvedForm = { 
  id: string; 
  slug: string; 
  settings: any; 
  fields: Field[];
  team_members?: Array<{ id: string; name: string; }>;
};

export default function PublicFormSubmission() {
  const { agencySlug, formSlug } = useParams();
  const [form, setForm] = useState<ResolvedForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const token = useMemo(() => new URLSearchParams(window.location.search).get("t"), []);

  useEffect(() => {
    if (!agencySlug || !formSlug || !token) { setErr("Missing link parameters."); return; }
    (async () => {
      const u = `https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/resolve_public_form?agencySlug=${agencySlug}&formSlug=${formSlug}&t=${token}`;
      const r = await fetch(u);
      if (!r.ok) { const j = await r.json().catch(()=>({code:"ERROR"})); setErr(j.code || "ERROR"); return; }
      const j = await r.json();
      setForm(j.form);
      // seed defaults including previous business day
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      setValues(v => ({ ...v, submission_date: yesterday, work_date: yesterday }));
    })();
  }, [agencySlug, formSlug, token]);

  const onChange = (key: string, val: any) => {
    setValues(v => ({ ...v, [key]: val }));
    if (key === "quoted_count") {
      const cap = form?.settings?.spawnCap ?? 25;
      const rows = Math.max(0, Math.min(Number(val) || 0, cap));
      setValues(v => ({ ...v, quoted_details: Array.from({length: rows}).map((_,i)=>v.quoted_details?.[i] || {}) }));
    }
  };

  const submit = async () => {
    // required system fields
    if (!values.staff_id || !values.submission_date) { setErr("MISSING_FIELDS"); return; }
    const r = await fetch("https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/submit_public_form", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agencySlug, formSlug, token,
        teamMemberId: values.staff_id,
        submissionDate: values.submission_date,
        workDate: values.work_date || null,
        values
      })
    });
    if (!r.ok) { const j = await r.json().catch(()=>({code:"ERROR"})); setErr(j.code || "ERROR"); return; }
    setErr(null);
    alert("Submitted");
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
            {/* Required system fields */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-foreground">Basic Information</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Staff Member <span className="text-destructive">*</span>
                  </label>
                  <select 
                    value={values.staff_id || ""} 
                    onChange={e=>onChange("staff_id", e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                  >
                    <option value="">Select Staff Member</option>
                    {form.team_members?.map((member: any) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Submission Date <span className="text-destructive">*</span>
                  </label>
                  <input 
                    type="date" 
                    value={values.submission_date || ""} 
                    onChange={e=>onChange("submission_date", e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Work Date (optional)</label>
                  <input 
                    type="date" 
                    value={values.work_date || ""} 
                    onChange={e=>onChange("work_date", e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Form Fields */}
            {form.fields.length > 0 && (
              <>
                <div className="border-t border-border pt-6">
                  <h2 className="text-lg font-medium text-foreground mb-4">Performance Metrics</h2>
                  
                  <div className="space-y-4">
                    {form.fields.map((f) => {
                      if (f.type === "number") {
                        return (
                          <div key={f.id} className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                              {f.label}{f.required && <span className="text-destructive"> *</span>}
                            </label>
                            <input 
                              type="number" 
                              min={0} 
                              value={values[f.key] ?? ""} 
                              onChange={e=>onChange(f.key, e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                            />
                          </div>
                        );
                      }
                      if (f.type === "currency") {
                        return (
                          <div key={f.id} className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                              {f.label}{f.required && <span className="text-destructive"> *</span>}
                            </label>
                            <input 
                              type="number" 
                              min={0} 
                              step="0.01" 
                              value={values[f.key] ?? ""} 
                              onChange={e=>onChange(f.key, e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                            />
                          </div>
                        );
                      }
                      if (f.type === "dropdown") {
                        const opts = f.options_json?.entityOptions || f.options_json?.options || [];
                        return (
                          <div key={f.id} className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                              {f.label}{f.required && <span className="text-destructive"> *</span>}
                            </label>
                            <select 
                              value={values[f.key] ?? ""} 
                              onChange={e=>onChange(f.key, e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                            >
                              <option value="">Select</option>
                              {opts.map((o:string) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                        );
                      }
                      if (f.type === "textarea") {
                        return (
                          <div key={f.id} className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                              {f.label}{f.required && <span className="text-destructive"> *</span>}
                            </label>
                            <textarea 
                              value={values[f.key] ?? ""} 
                              onChange={e=>onChange(f.key, e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground resize-vertical"
                            />
                          </div>
                        );
                      }
                      if (f.type === "repeater" && f.key === "quoted_details") {
                        const rows:any[] = values.quoted_details || [];
                        const subfields = f.options_json?.subfields || [];
                        return (
                          <div key={f.id} className="space-y-4">
                            <label className="text-sm font-medium text-foreground">{f.label}</label>
                            <div className="bg-muted/30 border border-border rounded-lg p-4">
                              {rows.map((row, i) => (
                                <div key={i} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 p-3 bg-background rounded-md mb-3 last:mb-0">
                                  {subfields.map((sf:any) => (
                                    <div key={sf.key} className="space-y-1">
                                      <label className="text-xs font-medium text-muted-foreground">
                                        {sf.label}{sf.required && <span className="text-destructive"> *</span>}
                                      </label>
                                      <input
                                        value={row[sf.key] || ""}
                                        onChange={e => {
                                          const v = e.target.value;
                                          setValues(prev => {
                                            const next = [...(prev.quoted_details||[])];
                                            next[i] = { ...(next[i]||{}), [sf.key]: v };
                                            return { ...prev, quoted_details: next };
                                          });
                                        }}
                                        className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                                      />
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      // default text
                      return (
                        <div key={f.id} className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            {f.label}{f.required && <span className="text-destructive"> *</span>}
                          </label>
                          <input 
                            value={values[f.key] ?? ""} 
                            onChange={e=>onChange(f.key, e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Submit Button */}
            <div className="border-t border-border pt-6">
              <button 
                onClick={submit}
                className="w-full px-4 py-3 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
              >
                Submit Form
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
