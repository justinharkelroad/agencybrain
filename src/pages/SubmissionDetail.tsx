import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ArrowLeft, Clock, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { hasStaffToken, fetchWithAuth } from "@/lib/staffRequest";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

    // Extract special fields that need custom formatting
    const itemsQuoted = row.items_quoted ?? null;
    const policiesQuoted = row.policies_quoted ?? null;
    const premiumPotential = row.premium_potential ?? null;

    // Any extra custom fields the agency added
    const EXCLUDE = new Set([
      "prospect_name","name","prospect",
      "lead_source","lead_source_id","leadSource","leadSourceId",
      "lead_source_label",
      "detailed_notes","notes",
      "zip","zip_code","postal",
      "email","phone","phone_number",
      "items_quoted","policies_quoted","premium_potential"
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

    return { prospect, leadSourceLabel, notes, zip, email, phone, itemsQuoted, policiesQuoted, premiumPotential, extras };
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
  const { user } = useAuth();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSubmission();
  }, [submissionId]);

  const fetchSubmission = async () => {
    const isStaff = hasStaffToken();

    try {
      if (isStaff) {
        // Staff users: use edge function to bypass RLS
        console.log('[SubmissionDetail] Staff user - fetching via edge function');

        const response = await fetchWithAuth('scorecards_admin', {
          method: 'POST',
          body: { action: 'submission_get', submission_id: submissionId },
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('[SubmissionDetail] Edge function error:', response.status, data);
          if (response.status === 404 || data?.error === 'Submission not found') {
            // Don't toast for not found - just show the not found UI
            setSubmission(null);
          } else {
            toast.error(data?.error || 'Failed to load submission details');
          }
          setLoading(false);
          return;
        }

        console.log('[SubmissionDetail] Staff fetch success:', data);
        setSubmission(data.submission);
        setLeadSources(data.leadSources || []);
      } else {
        // Regular users: use direct Supabase query
        const { data, error } = await supabase
          .from('submissions')
          .select(`
            *,
            form_templates(name, slug, agency_id, schema_json),
            team_members(name, email)
          `)
          .eq('id', submissionId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching submission:', error);
          toast.error('Failed to load submission details');
          setLoading(false);
          return;
        }

        if (!data) {
          // Not found - don't toast, just show the not found UI
          setSubmission(null);
          setLoading(false);
          return;
        }

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
      }
    } catch (error: any) {
      console.error('Error fetching submission:', error);
      toast.error('Failed to load submission details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!submissionId) return;
    
    setDeleting(true);
    try {
      // 1. Clear metrics_daily.final_submission_id references (FK without CASCADE)
      const { error: metricsError } = await supabase
        .from('metrics_daily')
        .update({ final_submission_id: null })
        .eq('final_submission_id', submissionId);
      
      if (metricsError) {
        console.error('Error clearing metrics_daily reference:', metricsError);
        // Continue anyway - might not have metrics_daily references
      }

      // 2. Delete quoted_household_details (FK without CASCADE)
      const { error: qhdError } = await supabase
        .from('quoted_household_details')
        .delete()
        .eq('submission_id', submissionId);
      
      if (qhdError) {
        console.error('Error deleting quoted_household_details:', qhdError);
        // Continue anyway - might not have these records
      }

      // 3. Delete custom_detail_entries (has CASCADE but being explicit)
      await supabase
        .from('custom_detail_entries')
        .delete()
        .eq('submission_id', submissionId);

      // 4. Delete the submission (cascades to quoted_households, sold_policy_details)
      const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('id', submissionId);

      if (error) throw error;

      toast.success('Submission deleted successfully');
      const isStaffUser = hasStaffToken();
      navigate(isStaffUser ? '/staff/metrics' : '/metrics');
    } catch (error: any) {
      console.error('Error deleting submission:', error);
      toast.error('Failed to delete submission');
    } finally {
      setDeleting(false);
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

  const rootCustoms = getRootCustomFields(submission, submission.form_templates?.schema_json);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
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
        
        {user && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this submission and all related data. 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
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
              <p className="font-medium">{format(parseISO(submission.work_date || submission.submission_date || submission.submitted_at), 'PPP')}</p>
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
              {/* Render quoted details as clean bulleted list */}
              {Array.isArray(submission?.payload_json?.quoted_details) && submission.payload_json.quoted_details.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-primary mb-3 block">
                    Quoted Details
                  </span>
                  <div className="rounded-md bg-muted/50 p-4 border border-border">
                    <ul className="space-y-3 list-disc pl-5">
                      {normalizeQuotedRows(submission, leadSources, submission.form_templates?.schema_json).map((row, i) => (
                        <li key={i} className="text-sm">
                          <div className="space-y-1">
                            {row.prospect && (
                              <div>
                                <span className="font-semibold">Prospect:</span> {row.prospect}
                              </div>
                            )}
                            {row.leadSourceLabel && (
                              <div>
                                <span className="font-semibold">Lead Source:</span> {row.leadSourceLabel}
                              </div>
                            )}
                            {row.zip && (
                              <div>
                                <span className="font-semibold">Zip Code:</span> {row.zip}
                              </div>
                            )}
                            {row.email && (
                              <div>
                                <span className="font-semibold">Email:</span> {row.email}
                              </div>
                            )}
                            {row.phone && (
                              <div>
                                <span className="font-semibold">Phone:</span> {row.phone}
                              </div>
                            )}
                            {row.itemsQuoted != null && (
                              <div>
                                <span className="font-semibold"># Items Quoted:</span> {row.itemsQuoted}
                              </div>
                            )}
                            {row.policiesQuoted != null && (
                              <div>
                                <span className="font-semibold"># Policies Quoted:</span> {row.policiesQuoted}
                              </div>
                            )}
                            {row.premiumPotential != null && (
                              <div>
                                <span className="font-semibold">Premium Potential:</span> ${Number(row.premiumPotential).toLocaleString()}
                              </div>
                            )}
                            {row.notes && (
                              <div>
                                <span className="font-semibold">Notes:</span> {row.notes}
                              </div>
                            )}
                            {/* Render any custom/extra fields with proper labels from schema */}
                            {row.extras.map((extra) => (
                              <div key={extra.key}>
                                <span className="font-semibold">{extra.key}:</span> {extra.value}
                              </div>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Render sold details as clean formatted section */}
              {Array.isArray(submission?.payload_json?.soldDetails) && submission.payload_json.soldDetails.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-primary mb-3 block">
                    Sold Household Details
                  </span>
                  <div className="space-y-3">
                    {submission.payload_json.soldDetails.map((sold: any, idx: number) => (
                      <div key={idx} className="rounded-md bg-muted/50 p-4 border border-border">
                        <div className="font-medium text-sm mb-2">Sale #{idx + 1}</div>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {sold.customer_name && (
                            <li><span className="font-semibold">Customer:</span> {sold.customer_name}</li>
                          )}
                          {(sold.lead_source_id || sold.lead_source || sold.lead_source_label) && (
                            <li>
                              <span className="font-semibold">Lead Source:</span> {
                                sold.lead_source_label ||
                                (sold.lead_source_id ? leadSources.find(ls => ls.id === sold.lead_source_id)?.name : null) ||
                                sold.lead_source ||
                                'Unknown'
                              }
                            </li>
                          )}
                          {sold.policy_type && (
                            <li>
                              <span className="font-semibold">Policy Type:</span> {
                                Array.isArray(sold.policy_type) 
                                  ? sold.policy_type.join(', ') 
                                  : sold.policy_type
                              }
                            </li>
                          )}
                          {sold.num_items && (
                            <li><span className="font-semibold">Items Sold:</span> {sold.num_items}</li>
                          )}
                          {sold.premium_sold && (
                            <li><span className="font-semibold">Premium:</span> ${sold.premium_sold}</li>
                          )}
                          {(sold.zip || sold.zip_code) && (
                            <li><span className="font-semibold">Zip Code:</span> {sold.zip || sold.zip_code}</li>
                          )}
                        </ul>
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
                    // Skip quoted_details and soldDetails as we render them above
                    if (key === 'quoted_details' || key === 'soldDetails' || key === 'repeaterData') {
                      return null;
                    }

                    // Skip internal fields and field_ prefixed keys
                    if (key.includes('team_member_id') ||
                        key.includes('submission_date') ||
                        key.includes('work_date') ||
                        key.startsWith('field_')) {
                      return null;
                    }

                    // UUID-like keys (collection IDs from repeaters) should be rendered if they contain arrays
                    const uuidPattern = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
                    const isUuidKey = uuidPattern.test(key);

                    // Skip UUID keys that are NOT arrays (just IDs)
                    if (isUuidKey && !Array.isArray(value)) {
                      return null;
                    }

                    // Skip keys that look like collection/repeater IDs (but not if they contain array data)
                    if ((key.startsWith('collection_') || key.startsWith('repeater_')) && !Array.isArray(value)) {
                      return null;
                    }

                    // For arrays (including UUID-keyed collections), render as a formatted list
                    if (Array.isArray(value) && value.length > 0) {
                      // Try to find a label from the schema for this collection
                      const schemaCollections = submission.form_templates?.schema_json?.collections || [];
                      const collection = schemaCollections.find((c: any) => c.id === key || c.key === key);
                      const collectionLabel = collection?.label ||
                        (isUuidKey ? 'Details' : key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim());
                      return (
                        <div key={key} className="border-b pb-2 last:border-b-0">
                          <span className="text-sm font-medium text-primary capitalize block mb-2">
                            {collectionLabel}
                          </span>
                          <div className="rounded-md bg-muted/50 p-3 border border-border space-y-3">
                            {value.map((item, idx) => (
                              <div key={idx} className="pl-3 border-l-2 border-primary/50 text-sm">
                                {typeof item === 'object' && item !== null
                                  ? Object.entries(item).map(([k, v]) => {
                                      // Skip null/empty values
                                      if (v == null || v === '') return null;
                                      // Format key nicely
                                      const displayKey = k.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim();
                                      return (
                                        <div key={k}>
                                          <span className="text-muted-foreground capitalize">
                                            {displayKey}:
                                          </span>{' '}
                                          <span className="font-medium">{String(v)}</span>
                                        </div>
                                      );
                                    }).filter(Boolean)
                                  : <span className="font-medium">{String(item)}</span>
                                }
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={key} className="border-b pb-2 last:border-b-0">
                        <span className="text-sm text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim()}
                        </span>
                        <p className="font-medium">
                          {typeof value === 'object' && value !== null
                            ? null  // Skip non-array objects (likely repeater data with bad keys)
                            : String(value || '—')}
                        </p>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
              ) : !Array.isArray(submission?.payload_json?.quoted_details) || submission.payload_json.quoted_details.length === 0 ? (
                <p className="text-muted-foreground">No data available</p>
              ) : null}

              {(!Array.isArray(submission?.payload_json?.quoted_details) || submission.payload_json.quoted_details.length === 0) && (
                <div className="text-sm text-muted-foreground">No quoted households on this submission.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}