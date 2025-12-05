import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

interface ProspectData {
  id: string;
  submission_id: string;
  form_template_id: string;
  team_member_id: string;
  work_date: string;
  household_name: string;
  lead_source?: string | null;
  items_quoted: number;
  policies_quoted: number;
  premium_potential_cents: number;
  is_final: boolean;
  is_late: boolean;
  created_at: string;
}

interface FormCustomField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: Array<{value: string; label: string}> | string[];
}

interface ProspectViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospect: ProspectData | null;
  teamMembers: Array<{id: string, name: string}>;
  leadSources: Array<{id: string, name: string}>;
}

export function ProspectViewModal({ 
  isOpen, 
  onClose,
  prospect, 
  teamMembers, 
  leadSources
}: ProspectViewModalProps) {
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [formCustomFields, setFormCustomFields] = useState<FormCustomField[]>([]);
  const [formCustomFieldValues, setFormCustomFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (prospect && isOpen) {
      loadFormCustomFields();
    }
  }, [prospect, isOpen]);

  const loadFormCustomFields = async () => {
    if (!prospect) return;

    setLoadingSchema(true);
    try {
      // Get the submission and form template schema
      // Get submission with payload_json AND form template schema
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .select(`
          id,
          payload_json,
          form_templates(schema_json)
        `)
        .eq('id', prospect.submission_id)
        .single();

      if (submissionError) throw submissionError;

      // Get the current extras values from quoted_household_details
      const { data: qhd, error: qhdError } = await supabase
        .from('quoted_household_details')
        .select('extras')
        .eq('id', prospect.id)
        .single();

      if (qhdError) throw qhdError;

      const schema = submission?.form_templates?.schema_json;
      const allFormFields: FormCustomField[] = [];
      
      // Extract root-level customFields
      if (schema?.customFields && Array.isArray(schema.customFields)) {
        allFormFields.push(...schema.customFields);
      }

      // Extract repeaterSections.quotedDetails.fields
      if (schema?.repeaterSections?.quotedDetails?.fields && 
          Array.isArray(schema.repeaterSections.quotedDetails.fields)) {
        allFormFields.push(...schema.repeaterSections.quotedDetails.fields);
      }

      setFormCustomFields(allFormFields);

      // Merge root-level payload_json + household-specific extras.raw_json
      const rootLevelFields = submission?.payload_json || {};
      const householdFields = qhd?.extras?.raw_json || {};
      const existingValues = {
        ...rootLevelFields,   // Root fields like field_0 (Hearsay)
        ...householdFields    // Household fields like prospect_name, lead_source_label
      };
      setFormCustomFieldValues(existingValues);

    } catch (error) {
      console.error('Error loading form custom fields:', error);
    } finally {
      setLoadingSchema(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const renderFieldValue = (field: FormCustomField, value: string) => {
    if (!value && value !== '0') {
      return <span className="text-muted-foreground italic">Not provided</span>;
    }
    
    if (field.type === 'currency') {
      const numVal = parseFloat(value);
      return <span>${isNaN(numVal) ? value : numVal.toFixed(2)}</span>;
    }
    
    return <span>{value}</span>;
  };

  if (!prospect) return null;

  const teamMemberName = teamMembers.find(m => m.id === prospect.team_member_id)?.name || 'Unknown';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Submission Details: {prospect.household_name}</span>
            <div className="flex gap-2">
              {prospect.is_late && (
                <Badge variant="destructive" className="text-xs">
                  Late
                </Badge>
              )}
              {!prospect.is_final && (
                <Badge variant="outline" className="text-xs">
                  Superseded
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Submission Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Submission Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Work Date</Label>
                <p className="font-medium">{prospect.work_date}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Staff Member</Label>
                <p className="font-medium">{teamMemberName}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Prospect Name</Label>
                <p className="font-medium">{prospect.household_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Lead Source</Label>
                <p className="font-medium">{prospect.lead_source || "Not specified"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Business Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Business Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Items Quoted</Label>
                <p className="font-medium">{prospect.items_quoted || 0}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Policies Quoted</Label>
                <p className="font-medium">{prospect.policies_quoted || 0}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Premium Potential</Label>
                <p className="font-medium">{formatCurrency(prospect.premium_potential_cents || 0)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Form Submission Details - Dynamic Custom Fields */}
          {formCustomFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Form Submission Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Additional fields from the original form submission
                </p>
              </CardHeader>
              <CardContent>
                {loadingSchema ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {formCustomFields.map((field) => {
                      const fieldKey = field.key;
                      let currentValue = formCustomFieldValues[fieldKey] || "";
                      
                      // Fix: lead_source schema key maps to lead_source_label in stored data
                      if (!currentValue && fieldKey === 'lead_source') {
                        currentValue = formCustomFieldValues['lead_source_label'] || "";
                      }
                      
                      return (
                        <div key={fieldKey}>
                          <Label className="text-sm font-medium text-muted-foreground">
                            {field.label}
                          </Label>
                          <p className="font-medium">
                            {renderFieldValue(field, currentValue)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
