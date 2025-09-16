import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { toast } from "sonner";

interface Submission {
  id: string;
  form_template_id: string;
  team_member_id: string;
  submission_date: string;
  work_date: string;
  submitted_at: string;
  payload_json: any;
  late: boolean;
  final: boolean;
  form_templates?: {
    name: string;
    slug: string;
    agency_id: string;
    schema_json?: any;
  };
  team_members?: {
    name: string;
    email: string;
  };
}

interface LeadSource {
  id: string;
  name: string;
}

// --- helpers for quoted details rendering
type QuotedRow = Record<string, any>;

function buildSchemaLookups(schema: any | undefined) {
  const labelMap: Map<string, string> = new Map();
  const optionMap: Map<string, Map<string, string>> = new Map();

  const addField = (keyLike: string, label: string, options?: any[]) => {
    // keyLike may be "field_1757…" or "1757…"
    const fullKey = keyLike.startsWith("field_") ? keyLike : `field_${keyLike}`;
    const idOnly = keyLike.startsWith("field_") ? keyLike.slice(6) : keyLike;

    // Map BOTH to label so lookups by k ("field_…") or idOnly ("…") succeed
    labelMap.set(fullKey, label);
    labelMap.set(idOnly, label);

    if (Array.isArray(options) && options.length) {
      const m = new Map<string, string>();
      for (const opt of options) {
        const v = String(opt?.value ?? "");
        const l = String(opt?.label ?? v);
        m.set(v, l);
      }
      optionMap.set(fullKey, m);
      optionMap.set(idOnly, m);
    }
  };

  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;

    // Common shapes
    if (n.key && n.label) addField(String(n.key), String(n.label), n.options);
    if (n.id && n.label) addField(String(n.id), String(n.label), n.options);

    for (const v of Object.values(n)) {
      if (v && typeof v === "object") walk(v);
    }
  };

  walk(schema);
  return { labelMap, optionMap };
}

function normalizeQuotedRows(
  submission: any,
  leadSources: LeadSource[] = [],
  schema: Record<string, any> | undefined = undefined
) {
  const rows: QuotedRow[] = Array.isArray(submission?.payload_json?.quoted_details)
    ? submission.payload_json.quoted_details
    : [];

  const lsMap = new Map(leadSources.map((ls) => [ls.id, ls.name]));
  const { labelMap, optionMap } = buildSchemaLookups(schema);

  return rows.map((row) => {
    const prospect =
      row.prospect_name ?? row.name ?? row.prospect ?? "";

    const leadSourceId =
      row.lead_source_id ?? row.lead_source ?? row.leadSourceId ?? row.leadSource ?? "";

    const leadSourceLabel =
      row.lead_source_label ??
      (leadSourceId ? lsMap.get(String(leadSourceId)) : "") ??
      ""; // last resort, empty string

    const notes = row.detailed_notes ?? row.notes ?? "";

    const zip =
      row.zip ?? row.zip_code ?? row.postal ?? "";

    const email = row.email ?? "";
    const phone = row.phone ?? row.phone_number ?? "";

    // Any extra custom fields the agency added
    const EXCLUDE = new Set([
      "prospect_name","name","prospect",
      "lead_source","lead_source_id","leadSource","leadSourceId",
      "lead_source_label",
      "detailed_notes","notes",
      "zip","zip_code","postal",
      "email","phone","phone_number"
    ]);
    const extras = Object.entries(row)
      .filter(([k]) => !EXCLUDE.has(k) && row[k] != null && row[k] !== "")
      .map(([k, v]) => {
        const fieldId = k.startsWith("field_") ? k.slice("field_".length) : k; // "1757…" id
        // Try full key first, then id-only
        const label =
          labelMap.get(k) ??
          labelMap.get(fieldId) ??
          k.replace(/_/g, " ");

        const optMap =
          optionMap.get(k) ??
          optionMap.get(fieldId);

        let value: string;
        if (optMap) {
          const vv = String(v);
          value = optMap.get(vv) ?? vv;
        } else if (typeof v === "boolean") {
          value = v ? "Yes" : "No";
        } else {
          value = String(v);
        }
        return { key: label, value };
      });

    return { prospect, leadSourceLabel, notes, zip, email, phone, extras };
  });
}

// --- helper to extract form-level custom fields from the submission root
type CustomDisplayRow = { label: string; value: string };

function getRootCustomFields(
  submission: any,
  schema: Record<string, any> | undefined
): CustomDisplayRow[] {
  const payload = submission?.payload_json ?? {};
  const { labelMap, optionMap } = buildSchemaLookups(schema);

  const rows: CustomDisplayRow[] = [];
  for (const [key, rawVal] of Object.entries(payload)) {
    if (!key.startsWith("field_")) continue;
    if (rawVal == null || rawVal === "") continue;

    const id = key.slice("field_".length);           // e.g., field_17576... -> 17576...
    const label =
      labelMap.get(id) ??
      labelMap.get(key) ??
      "Custom Field";

    // dropdown / option set → map stored "value" to human label
    const optMap = optionMap.get(id);
    let value: string;
    if (optMap) {
      const v = String(rawVal);
      value = optMap.get(v) ?? v;
    } else if (typeof rawVal === "boolean") {
      value = rawVal ? "Yes" : "No";
    } else {
      value = String(rawVal);
    }

    rows.push({ label, value });
  }
  return rows;
}

export default function SubmissionDetail() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmission();
  }, [submissionId]);

  const fetchSubmission = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          form_templates(name, slug, agency_id, schema_json),
          team_members(name, email)
        `)
        .eq('id', submissionId)
        .single();

      if (error) throw error;
      setSubmission(data);

      // Fetch lead sources for the form's agency
      if (data?.form_templates?.agency_id) {
        const { data: leadSourcesData } = await supabase
          .from('lead_sources')
          .select('id, name')
          .eq('agency_id', data.form_templates.agency_id)
          .eq('is_active', true);
        
        setLeadSources(leadSourcesData || []);
      }
    } catch (error: any) {
      console.error('Error fetching submission:', error);
      toast.error('Failed to load submission details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Submission not found</p>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quoted = normalizeQuotedRows(submission, leadSources, submission.form_templates?.schema_json);
  const rootCustoms = getRootCustomFields(submission, submission.form_templates?.schema_json);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Submission Details</h1>
          <p className="text-muted-foreground">
            {submission.form_templates?.name || 'Unknown Form'} • {format(new Date(submission.submitted_at), 'PPP')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Submission Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Team Member</span>
              <p className="font-medium">{submission.team_members?.name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{submission.team_members?.email}</p>
            </div>
            
            <div>
              <span className="text-sm text-muted-foreground">Work Date</span>
              <p className="font-medium">{format(new Date(submission.work_date), 'PPP')}</p>
            </div>
            
            <div>
              <span className="text-sm text-muted-foreground">Submitted</span>
              <p className="font-medium">{format(new Date(submission.submitted_at), 'PPpp')}</p>
            </div>
            
            <div>
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex gap-2 mt-1">
                {submission.final ? (
                  <Badge variant="default" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Final
                  </Badge>
                ) : (
                  <Badge variant="secondary">Draft</Badge>
                )}
                {submission.late && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Late
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Render quoted details first */}
              {quoted.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-primary mb-3 block">
                    Quoted Details
                  </span>
                  <div className="space-y-4">
                    {quoted.map((q, i) => (
                      <div key={i} className="rounded-md bg-muted/50 p-4 border border-border">
                        {q.prospect && (
                          <div className="text-sm">
                            <span className="font-semibold">Prospect:</span> {q.prospect}
                          </div>
                        )}
                        {q.leadSourceLabel && (
                          <div className="text-sm">
                            <span className="font-semibold">Lead Source:</span> {q.leadSourceLabel}
                          </div>
                        )}
                        {q.email && (
                          <div className="text-sm">
                            <span className="font-semibold">Email:</span> {q.email}
                          </div>
                        )}
                        {q.phone && (
                          <div className="text-sm">
                            <span className="font-semibold">Phone:</span> {q.phone}
                          </div>
                        )}
                        {q.zip && (
                          <div className="text-sm">
                            <span className="font-semibold">ZIP:</span> {q.zip}
                          </div>
                        )}
                        {q.notes && (
                          <div className="text-sm">
                            <span className="font-semibold">Notes:</span> {q.notes}
                          </div>
                        )}
                        {q.extras.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Additional</div>
                            <ul className="mt-1 list-disc pl-4">
                              {q.extras.map((e) => (
                                <li key={e.key} className="text-sm">
                                  <span className="font-semibold">{e.key}:</span> {e.value}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Render form-level custom fields */}
              {rootCustoms.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-primary mb-3 block">
                    Custom Fields
                  </span>
                  <div className="rounded-md bg-muted/50 p-4 border border-border">
                    <div className="space-y-2">
                      {rootCustoms.map((c, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-semibold">{c.label}:</span> {c.value}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Render other form fields */}
              {submission.payload_json && typeof submission.payload_json === 'object' ? (
                <div className="space-y-3">
                  {Object.entries(submission.payload_json).map(([key, value]) => {
                    // Skip quoted_details as we render it above
                    if (key === 'quoted_details' || key === 'repeaterData') {
                      return null;
                    }
                    
                    // Skip internal fields and field_ prefixed keys
                    if (key.includes('team_member_id') || 
                        key.includes('submission_date') || 
                        key.includes('work_date') ||
                        key.startsWith('field_')) {
                      return null;
                    }
                    
                    return (
                      <div key={key} className="border-b pb-2 last:border-b-0">
                        <span className="text-sm text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim()}
                        </span>
                        <p className="font-medium">
                          {typeof value === 'object' && value !== null
                            ? JSON.stringify(value, null, 2) 
                            : String(value || '—')}
                        </p>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
              ) : quoted.length === 0 ? (
                <p className="text-muted-foreground">No data available</p>
              ) : null}

              {quoted.length === 0 && (
                <div className="text-sm text-muted-foreground">No quoted households on this submission.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}