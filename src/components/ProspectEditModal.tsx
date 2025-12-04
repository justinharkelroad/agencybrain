import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
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

interface CustomField {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  value?: string;
  options?: string[]; // For dropdown fields
}

interface FormCustomField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: Array<{value: string; label: string}> | string[];
}

interface ProspectEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  prospect: ProspectData | null;
  teamMembers: Array<{id: string, name: string}>;
  leadSources: Array<{id: string, name: string}>;
  agencyId: string;
}

export function ProspectEditModal({ 
  isOpen, 
  onClose, 
  onSave,
  prospect, 
  teamMembers, 
  leadSources,
  agencyId
}: ProspectEditModalProps) {
  const { user } = useAuth();
  const [loading, setSaving] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [formCustomFields, setFormCustomFields] = useState<FormCustomField[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    prospect_name: "",
    items_quoted: 0,
    policies_quoted: 0,
    premium_potential: 0,
    lead_source_id: "",
    lead_source_raw: ""
  });

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [formCustomFieldValues, setFormCustomFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (prospect && isOpen) {
      // Load prospect data into form
      setFormData({
        prospect_name: prospect.household_name || "",
        items_quoted: prospect.items_quoted || 0,
        policies_quoted: prospect.policies_quoted || 0,
        premium_potential: (prospect.premium_potential_cents || 0) / 100,
        lead_source_id: "",
        lead_source_raw: prospect.lead_source || ""
      });

      // Load both custom field types
      loadCustomFields();
      loadFormCustomFields();
    }
  }, [prospect, isOpen, agencyId]);

  const loadCustomFields = async () => {
    if (!user || !agencyId) return;

    try {
      // Get custom field definitions
      const { data: fields } = await supabase
        .from('prospect_custom_fields')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('owner_user_id', user.id)
        .eq('active', true)
        .order('order_index');

      if (fields) {
        // Get existing values for this prospect
        const { data: values } = await supabase
          .from('prospect_custom_field_values')
          .select('field_id, value_text')
          .eq('quoted_household_detail_id', prospect?.id)
          .eq('owner_user_id', user.id);

        const valueMap = (values || []).reduce((acc, val) => {
          acc[val.field_id] = val.value_text || "";
          return acc;
        }, {} as Record<string, string>);

        setCustomFields(fields.map(field => ({
          ...field,
          value: valueMap[field.id] || ""
        })));

        setCustomFieldValues(valueMap);
      }
    } catch (error) {
      console.error('Error loading custom fields:', error);
    }
  };

  const loadFormCustomFields = async () => {
    if (!prospect) return;

    setLoadingSchema(true);
    try {
      // Get the submission and form template schema
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .select(`
          id,
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

      // Load existing values from extras.custom_fields
      const existingValues = qhd?.extras?.custom_fields || {};
      setFormCustomFieldValues(existingValues);

    } catch (error) {
      console.error('Error loading form custom fields:', error);
      toast.error("Failed to load form fields");
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleSave = async () => {
    if (!prospect || !user) return;

    setSaving(true);
    try {
      // Find matching lead source
      const leadSource = leadSources.find(ls => ls.name === formData.lead_source_raw);
      
      // Prepare override data
      const overrideData = {
        agency_id: agencyId,
        quoted_household_detail_id: prospect.id,
        prospect_name: formData.prospect_name || null,
        items_quoted: formData.items_quoted || null,
        policies_quoted: formData.policies_quoted || null,
        premium_potential_cents: formData.premium_potential ? Math.round(formData.premium_potential * 100) : null,
        lead_source_id: leadSource?.id || null,
        lead_source_raw: formData.lead_source_raw || null
      };

      // Upsert prospect override
      const { error: overrideError } = await supabase
        .from('prospect_overrides')
        .upsert(overrideData, {
          onConflict: 'agency_id,quoted_household_detail_id'
        });

      if (overrideError) throw overrideError;

      // Save prospect_custom_fields values
      for (const field of customFields) {
        const value = customFieldValues[field.id] || field.value || "";
        
        if (value.trim()) {
          // Insert or update custom field value
          await supabase
            .from('prospect_custom_field_values')
            .upsert({
              agency_id: agencyId,
              owner_user_id: user.id,
              quoted_household_detail_id: prospect.id,
              field_id: field.id,
              value_text: value
            }, {
              onConflict: 'quoted_household_detail_id,field_id,owner_user_id'
            });
        } else {
          // Delete if empty
          await supabase
            .from('prospect_custom_field_values')
            .delete()
            .eq('quoted_household_detail_id', prospect.id)
            .eq('field_id', field.id)
            .eq('owner_user_id', user.id);
        }
      }

      // Update form custom fields in extras.custom_fields
      if (formCustomFields.length > 0) {
        // Get current extras
        const { data: currentQhd } = await supabase
          .from('quoted_household_details')
          .select('extras')
          .eq('id', prospect.id)
          .single();

        const updatedExtras = {
          ...(currentQhd?.extras || {}),
          custom_fields: formCustomFieldValues
        };

        // Update the extras JSON
        const { error: extrasError } = await supabase
          .from('quoted_household_details')
          .update({ extras: updatedExtras })
          .eq('id', prospect.id);

        if (extrasError) throw extrasError;
      }

      toast.success("Prospect updated successfully");
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving prospect:', error);
      toast.error("Failed to save prospect changes");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const renderFormField = (field: FormCustomField, fieldKey: string, currentValue: string) => {
    const handleChange = (value: string) => {
      setFormCustomFieldValues(prev => ({
        ...prev,
        [fieldKey]: value
      }));
    };

    switch (field.type) {
      case 'select':
      case 'dropdown':
        const options = Array.isArray(field.options) 
          ? field.options.map(opt => 
              typeof opt === 'string' ? { value: opt, label: opt } : opt
            )
          : [];
        
        return (
          <Select value={currentValue} onValueChange={handleChange}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'longtext':
      case 'textarea':
        return (
          <Textarea
            id={`form_${fieldKey}`}
            value={currentValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Enter ${field.label}`}
            rows={3}
          />
        );

      case 'number':
        return (
          <Input
            id={`form_${fieldKey}`}
            type="number"
            value={currentValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Enter ${field.label}`}
          />
        );

      case 'email':
        return (
          <Input
            id={`form_${fieldKey}`}
            type="email"
            value={currentValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Enter ${field.label}`}
          />
        );

      case 'phone':
        return (
          <Input
            id={`form_${fieldKey}`}
            type="tel"
            value={currentValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Enter ${field.label}`}
          />
        );

      case 'currency':
        return (
          <Input
            id={`form_${fieldKey}`}
            type="number"
            step="0.01"
            value={currentValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Enter ${field.label}`}
          />
        );

      case 'text':
      default:
        return (
          <Input
            id={`form_${fieldKey}`}
            type="text"
            value={currentValue}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Enter ${field.label}`}
          />
        );
    }
  };

  if (!prospect) return null;

  const teamMemberName = teamMembers.find(m => m.id === prospect.team_member_id)?.name || 'Unknown';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Edit Prospect: {prospect.household_name}</span>
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
          {/* Basic Information (Read-only) */}
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
                <Label className="text-sm font-medium text-muted-foreground">Original Household Name</Label>
                <p className="font-medium">{prospect.household_name}</p>
              </div>
            </CardContent>
          </Card>

          {/* Editable Prospect Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prospect Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="prospect_name">Prospect Name</Label>
                  <Input
                    id="prospect_name"
                    value={formData.prospect_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, prospect_name: e.target.value }))}
                    placeholder="Enter prospect name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lead_source">Lead Source</Label>
                  <Select
                    value={formData.lead_source_raw}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, lead_source_raw: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select lead source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Undefined">Undefined</SelectItem>
                      {leadSources.map((source) => (
                        <SelectItem key={source.id} value={source.name}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Business Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Business Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="items_quoted">Items Quoted</Label>
                <Input
                  id="items_quoted"
                  type="number"
                  min="0"
                  value={formData.items_quoted}
                  onChange={(e) => setFormData(prev => ({ ...prev, items_quoted: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground">
                  Original: {prospect.items_quoted || 0}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="policies_quoted">Policies Quoted</Label>
                <Input
                  id="policies_quoted"
                  type="number"
                  min="0"
                  value={formData.policies_quoted}
                  onChange={(e) => setFormData(prev => ({ ...prev, policies_quoted: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground">
                  Original: {prospect.policies_quoted || 0}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="premium_potential">Premium Potential</Label>
                <Input
                  id="premium_potential"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.premium_potential}
                  onChange={(e) => setFormData(prev => ({ ...prev, premium_potential: parseFloat(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground">
                  Original: {formatCurrency(prospect.premium_potential_cents || 0)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Custom Fields from prospect_custom_fields */}
          {customFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={`custom_${field.id}`}>{field.field_label}</Label>
                    {field.field_type === 'dropdown' ? (
                      <Select
                        value={customFieldValues[field.id] || field.value || ""}
                        onValueChange={(value) => setCustomFieldValues(prev => ({ 
                          ...prev, 
                          [field.id]: value 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options || []).map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.field_type === 'textarea' ? (
                      <Textarea
                        id={`custom_${field.id}`}
                        value={customFieldValues[field.id] || field.value || ""}
                        onChange={(e) => setCustomFieldValues(prev => ({ 
                          ...prev, 
                          [field.id]: e.target.value 
                        }))}
                        rows={3}
                      />
                    ) : field.field_type === 'number' ? (
                      <Input
                        id={`custom_${field.id}`}
                        type="number"
                        value={customFieldValues[field.id] || field.value || ""}
                        onChange={(e) => setCustomFieldValues(prev => ({ 
                          ...prev, 
                          [field.id]: e.target.value 
                        }))}
                      />
                    ) : (
                      <Input
                        id={`custom_${field.id}`}
                        type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : 'text'}
                        value={customFieldValues[field.id] || field.value || ""}
                        onChange={(e) => setCustomFieldValues(prev => ({ 
                          ...prev, 
                          [field.id]: e.target.value 
                        }))}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Form Submission Details - Dynamic Custom Fields */}
          {formCustomFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Form Submission Details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Custom fields from the original form template
                </p>
              </CardHeader>
              <CardContent>
                {loadingSchema ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formCustomFields.map((field) => {
                      const fieldKey = field.key;
                      const currentValue = formCustomFieldValues[fieldKey] || "";
                      
                      return (
                        <div key={fieldKey} className="space-y-2">
                          <Label htmlFor={`form_${fieldKey}`}>
                            {field.label}
                            {field.required && <span className="text-destructive ml-1">*</span>}
                          </Label>
                          {renderFormField(field, fieldKey, currentValue)}
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
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}