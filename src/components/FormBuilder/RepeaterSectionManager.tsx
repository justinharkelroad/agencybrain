import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Settings, Trash2, Lock, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useLeadSources } from "@/hooks/useLeadSources";

interface RepeaterField {
  key: string;
  label: string;
  type: 'text' | 'longtext' | 'select' | 'number' | 'currency';
  required: boolean;
  options?: string[];
  isSticky?: boolean;
  isSystemRequired?: boolean;
}

interface StickyField {
  field_key: string;
  field_label: string;
  field_type: string;
  is_system_required: boolean;
  order_index: number;
}

interface RepeaterSection {
  enabled: boolean;
  title: string;
  description?: string;
  triggerKPI?: string; // KPI field that controls how many instances to show
  fields: RepeaterField[];
}

interface RepeaterSectionManagerProps {
  section: RepeaterSection;
  sectionKey: string;
  kpiFields: Array<{ key: string; label: string }>;
  onUpdateSection: (sectionKey: string, section: RepeaterSection) => void;
}

export default function RepeaterSectionManager({ 
  section, 
  sectionKey, 
  kpiFields,
  onUpdateSection 
}: RepeaterSectionManagerProps) {
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [stickyFields, setStickyFields] = useState<StickyField[]>([]);
  const [loadingSticky, setLoadingSticky] = useState(false);
  const { leadSources, loading: leadSourcesLoading, error: leadSourcesError } = useLeadSources();

  // Load sticky fields for this section type
  useEffect(() => {
    const loadStickyFields = async () => {
      setLoadingSticky(true);
      try {
        const { data, error } = await supabase.rpc('get_sticky_fields_for_section', {
          p_section_type: sectionKey
        });

        if (error) throw error;
        setStickyFields(data || []);
      } catch (error) {
        console.error('Error loading sticky fields:', error);
      } finally {
        setLoadingSticky(false);
      }
    };

    loadStickyFields();
  }, [sectionKey]);

  // Initialize section with sticky fields, replacing any pre-defined fields that match
  useEffect(() => {
    if (stickyFields.length > 0) {
      console.log('🔧 Sticky fields from database:', stickyFields);
      
      const existingFieldKeys = section.fields.map(f => f.key);
      const stickyFieldKeys = stickyFields.map(sf => sf.field_key);
      
      // Create sticky fields from database
      const newStickyFields: RepeaterField[] = stickyFields.map(sf => {
        const field = {
          key: sf.field_key,
          label: sf.field_label,
          type: sf.field_type as any,
          required: sf.is_system_required,
          isSticky: true,
          isSystemRequired: sf.is_system_required,
          options: sf.field_key === 'lead_source' ? [] : sf.field_key === 'policy_type' ? [
            'Auto Insurance',
            'Home Insurance', 
            'Life Insurance',
            'Business Insurance',
            'Health Insurance',
            'Other'
          ] : undefined
        };
        console.log('🔧 Created sticky field:', field);
        return field;
      });

      // Keep only custom fields that don't conflict with sticky fields
      const customFields = section.fields.filter(f => !stickyFieldKeys.includes(f.key) && !f.isSticky);
      
      console.log('🔧 Final fields array:', [...newStickyFields, ...customFields]);
      
      // Always replace with sticky fields first, then custom fields
      updateSection({
        fields: [...newStickyFields, ...customFields]
      });
    }
  }, [stickyFields]);

  // Update lead source options when leadSources data changes
  useEffect(() => {
    if (leadSources && leadSources.length > 0 && section.fields) {
      const updatedFields = section.fields.map(field => {
        if (field.key === 'lead_source' && field.type === 'select') {
          const options = leadSources.map(ls => ls.name);
          console.log('🔧 Updating lead source options:', options);
          return { ...field, options };
        }
        return field;
      });
      
      if (JSON.stringify(updatedFields) !== JSON.stringify(section.fields)) {
        updateSection({ fields: updatedFields });
      }
    }
  }, [leadSources, section.fields]);

  const updateSection = (updates: Partial<RepeaterSection>) => {
    onUpdateSection(sectionKey, { ...section, ...updates });
  };

  const addField = () => {
    const newField: RepeaterField = {
      key: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
    };
    
    updateSection({
      fields: [...section.fields, newField]
    });
  };

  const updateField = (index: number, updates: Partial<RepeaterField>) => {
    const updatedFields = section.fields.map((field, idx) => 
      idx === index ? { ...field, ...updates } : field
    );
    updateSection({ fields: updatedFields });
  };

  const removeField = (index: number) => {
    const updatedFields = section.fields.filter((_, idx) => idx !== index);
    updateSection({ fields: updatedFields });
  };

  const addOptionToField = (fieldIndex: number) => {
    const field = section.fields[fieldIndex];
    const newOptions = [...(field.options || []), 'New Option'];
    updateField(fieldIndex, { options: newOptions });
  };

  const updateOptionInField = (fieldIndex: number, optionIndex: number, value: string) => {
    const field = section.fields[fieldIndex];
    const newOptions = [...(field.options || [])];
    newOptions[optionIndex] = value;
    updateField(fieldIndex, { options: newOptions });
  };

  const removeOptionFromField = (fieldIndex: number, optionIndex: number) => {
    const field = section.fields[fieldIndex];
    const newOptions = (field.options || []).filter((_, i) => i !== optionIndex);
    updateField(fieldIndex, { options: newOptions });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Switch
                checked={section.enabled}
                onCheckedChange={(enabled) => updateSection({ enabled })}
              />
              {section.title}
            </CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFieldConfig(!showFieldConfig)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {section.enabled && (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`${sectionKey}-trigger`}>Controlled by KPI Field</Label>
              <Select
                value={section.triggerKPI || ''}
                onValueChange={(value) => updateSection({ triggerKPI: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select KPI field that controls count..." />
                </SelectTrigger>
                <SelectContent>
                  {kpiFields.map((kpi) => (
                    <SelectItem key={kpi.key} value={kpi.key}>
                      {kpi.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {showFieldConfig && (
              <div className="border-t pt-4">
                {/* Sticky Fields Section */}
                {section.fields.some(f => f.isSticky) && (
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">System Required Fields</h4>
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Cannot be deleted
                        </Badge>
                      </div>
                      {sectionKey === 'quotedDetails' || sectionKey === 'soldDetails' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open('/settings', '_blank')}
                          className="text-xs"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Manage Lead Sources
                        </Button>
                      ) : null}
                    </div>
                    
                    {section.fields
                      .filter(field => field.isSticky)
                      .map((field, index) => {
                        const actualIndex = section.fields.findIndex(f => f.key === field.key);
                        return (
                           <div key={field.key} className="border border-border/10 rounded-lg p-3 space-y-2 bg-card/50">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                 <Input
                                   value={field.label || ''}
                                   onChange={(e) => updateField(actualIndex, { label: e.target.value })}
                                   placeholder="Field label"
                                   className="flex-1 mr-2"
                                   disabled={field.isSystemRequired}
                                   readOnly={field.isSystemRequired}
                                 />
                                {field.isSystemRequired && (
                                  <Badge variant="outline" className="text-xs">
                                    <Lock className="h-3 w-3 mr-1" />
                                    System Required
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Field Type</Label>
                                 <Select
                                   value={field.type}
                                   onValueChange={(value: any) => updateField(actualIndex, { type: value })}
                                   disabled={field.isSystemRequired}
                                 >
                                   <SelectTrigger>
                                     <SelectValue />
                                   </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="text">Short Text</SelectItem>
                                    <SelectItem value="longtext">Long Text</SelectItem>
                                    <SelectItem value="select">Dropdown</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="currency">Currency</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex items-center gap-2 mt-6">
                                <Checkbox
                                  id={`required-${field.key}`}
                                  checked={field.required}
                                  onCheckedChange={(checked) => 
                                    updateField(actualIndex, { required: !!checked })
                                  }
                                  disabled={field.isSystemRequired}
                                />
                                <Label htmlFor={`required-${field.key}`} className="text-xs">Required</Label>
                              </div>
                            </div>

                            {field.type === 'select' && (
                              <div className="space-y-3">
                                {field.key === 'lead_source' ? (
                                  <div>
                                    <Label className="text-xs">Options</Label>
                                     <div className="p-3 border border-border/10 rounded-md bg-card/50 text-sm">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-muted-foreground text-xs">Automatically populated from Lead Source Management</p>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => window.open('/settings', '_blank')}
                                          className="text-xs h-6"
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          Manage
                                        </Button>
                                      </div>
                                       {leadSourcesLoading ? (
                                         <p className="text-xs text-muted-foreground">Loading lead sources...</p>
                                        ) : leadSourcesError ? (
                                          <div className="space-y-2">
                                            <p className="text-xs text-destructive">Failed to load lead sources</p>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => window.open('/settings', '_blank')}
                                              className="text-xs h-6"
                                            >
                                              <ExternalLink className="h-3 w-3 mr-1" />
                                              Setup Lead Sources
                                            </Button>
                                          </div>
                                       ) : leadSources.length > 0 ? (
                                         leadSources.map(ls => (
                                           <p key={ls.id} className="text-xs">• {ls.name}</p>
                                         ))
                                       ) : (
                                         <p className="text-xs text-orange-600">No active lead sources configured. Configure them in Settings → Lead Source Management.</p>
                                       )}
                                    </div>
                                  </div>
                                ) : field.key === 'policy_type' ? (
                                  <div>
                                    <Label className="text-xs">Options</Label>
                                    <div className="p-3 border border-border/10 rounded-md bg-card/50 text-sm">
                                      <p className="text-muted-foreground/70 mb-2 text-xs">Pre-defined policy types:</p>
                                      {(field.options || []).map(option => (
                                        <p key={option} className="text-xs">• {option}</p>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs">Options</Label>
                                      <Button
                                        onClick={() => addOptionToField(actualIndex)}
                                        size="sm"
                                        variant="outline"
                                        type="button"
                                        className="h-6 text-xs"
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add Option
                                      </Button>
                                    </div>
                                    <div className="space-y-2">
                                      {(field.options || []).map((option, optionIndex) => (
                                        <div key={optionIndex} className="flex items-center gap-2">
                                           <Input
                                             value={option}
                                             onChange={(e) => updateOptionInField(actualIndex, optionIndex, e.target.value)}
                                             placeholder={`Option ${optionIndex + 1}`}
                                             className="flex-1 h-8 text-xs"
                                           />
                                          <Button
                                            onClick={() => removeOptionFromField(actualIndex, optionIndex)}
                                            size="sm"
                                            variant="outline"
                                            type="button"
                                            className="text-destructive hover:text-destructive h-6 w-6 p-0"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Custom Fields Section */}
                <div className="space-y-3">
                  <Separator />
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Custom Fields</h4>
                    <Button variant="outline" size="sm" onClick={addField}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Custom Field
                    </Button>
                  </div>

                  {section.fields
                    .filter(field => !field.isSticky)
                    .map((field, customIndex) => {
                      const actualIndex = section.fields.findIndex(f => f.key === field.key);
                      return (
                         <div key={field.key} className="border border-border/10 rounded-lg p-3 space-y-2 bg-card/50">
                           <div className="flex items-center justify-between">
                             <Input
                               value={field.label}
                               onChange={(e) => updateField(actualIndex, { label: e.target.value })}
                               placeholder="Field label"
                               className="flex-1 mr-2"
                             />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeField(actualIndex)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Field Type</Label>
                               <Select
                                 value={field.type}
                                 onValueChange={(value: any) => updateField(actualIndex, { type: value })}
                               >
                                 <SelectTrigger>
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent className="z-50">
                                  <SelectItem value="text">Short Text</SelectItem>
                                  <SelectItem value="longtext">Long Text</SelectItem>
                                  <SelectItem value="select">Dropdown</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="currency">Currency</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center gap-2 mt-6">
                              <Checkbox
                                id={`required-${field.key}`}
                                checked={field.required}
                                onCheckedChange={(checked) => 
                                  updateField(actualIndex, { required: !!checked })
                                }
                              />
                              <Label htmlFor={`required-${field.key}`} className="text-xs">Required</Label>
                            </div>
                          </div>

                          {field.type === 'select' && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Options</Label>
                                <Button
                                  onClick={() => addOptionToField(actualIndex)}
                                  size="sm"
                                  variant="outline"
                                  type="button"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Option
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {(field.options || []).map((option, optionIndex) => (
                                  <div key={optionIndex} className="flex items-center gap-2">
                                      <Input
                                        value={option}
                                        onChange={(e) => updateOptionInField(actualIndex, optionIndex, e.target.value)}
                                        placeholder={`Option ${optionIndex + 1}`}
                                        className="flex-1"
                                      />
                                    <Button
                                      onClick={() => removeOptionFromField(actualIndex, optionIndex)}
                                      size="sm"
                                      variant="outline"
                                      type="button"
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                {(field.options || []).length === 0 && (
                                  <p className="text-muted-foreground text-sm">
                                    No options added yet. Click "Add Option" to get started.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {section.fields.filter(f => !f.isSticky).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No custom fields configured. Add a custom field above to get started.
                    </p>
                  )}
                </div>
              </div>
            )}
      </CardContent>
    </Card>
  );
}