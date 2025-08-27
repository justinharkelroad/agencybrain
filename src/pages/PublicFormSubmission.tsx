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
      const u = `https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/resolve_public_form/f/${agencySlug}/${formSlug}?t=${token}`;
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

  if (err) return <div>Form error: {err}</div>;
  if (!form) return <div>Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">{form.slug}</h1>

      {/* Required system fields */}
      <div className="grid gap-4">
        <label className="flex flex-col">
          <span>Staff</span>
          <select value={values.staff_id || ""} onChange={e=>onChange("staff_id", e.target.value)}>
            <option value="">Select Staff Member</option>
            {/* TODO: Replace with actual team member list from form.team_members */}
            {form.team_members?.map((member: any) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span>Submission Date</span>
          <input type="date" value={values.submission_date || ""} onChange={e=>onChange("submission_date", e.target.value)} />
        </label>

        <label className="flex flex-col">
          <span>Work Date (optional)</span>
          <input type="date" value={values.work_date || ""} onChange={e=>onChange("work_date", e.target.value)} />
        </label>
      </div>

      <hr className="my-6" />

      {/* Render built-ins and customs */}
      <div className="grid gap-4">
        {form.fields.map((f) => {
          if (f.type === "number") {
            return (
              <label key={f.id} className="flex flex-col">
                <span>{f.label}{f.required?" *":""}</span>
                <input type="number" min={0} value={values[f.key] ?? ""} onChange={e=>onChange(f.key, e.target.value)} />
              </label>
            );
          }
          if (f.type === "currency") {
            return (
              <label key={f.id} className="flex flex-col">
                <span>{f.label}{f.required?" *":""}</span>
                <input type="number" min={0} step="0.01" value={values[f.key] ?? ""} onChange={e=>onChange(f.key, e.target.value)} />
              </label>
            );
          }
          if (f.type === "dropdown") {
            const opts = f.options_json?.entityOptions || f.options_json?.options || [];
            return (
              <label key={f.id} className="flex flex-col">
                <span>{f.label}{f.required?" *":""}</span>
                <select value={values[f.key] ?? ""} onChange={e=>onChange(f.key, e.target.value)}>
                  <option value="">Select</option>
                  {opts.map((o:string) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            );
          }
          if (f.type === "textarea") {
            return (
              <label key={f.id} className="flex flex-col">
                <span>{f.label}{f.required?" *":""}</span>
                <textarea value={values[f.key] ?? ""} onChange={e=>onChange(f.key, e.target.value)} />
              </label>
            );
          }
          if (f.type === "repeater" && f.key === "quoted_details") {
            const rows:any[] = values.quoted_details || [];
            const subfields = f.options_json?.subfields || [];
            return (
              <div key={f.id} className="border rounded p-3">
                <div className="font-medium mb-2">{f.label}</div>
                {rows.map((row, i) => (
                  <div key={i} className="grid gap-2 md:grid-cols-4 border-b py-2">
                    {subfields.map((sf:any) => (
                      <label key={sf.key} className="flex flex-col">
                        <span>{sf.label}{sf.required?" *":""}</span>
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
                        />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            );
          }
          if (f.type === "repeater" && f.key === "sold_details") {
            // similar render, but no auto-spawn by count
          }
          // default text
          return (
            <label key={f.id} className="flex flex-col">
              <span>{f.label}{f.required?" *":""}</span>
              <input value={values[f.key] ?? ""} onChange={e=>onChange(f.key, e.target.value)} />
            </label>
          );
        })}
      </div>

      <button className="mt-6 px-4 py-2 border rounded" onClick={submit}>Submit</button>
    </div>
  );
}
