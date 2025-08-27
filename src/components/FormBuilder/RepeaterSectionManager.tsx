import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Settings, Trash2 } from "lucide-react";
import { useState } from "react";

interface RepeaterField {
  key: string;
  label: string;
  type: 'text' | 'longtext' | 'select' | 'number' | 'currency';
  required: boolean;
  options?: string[];
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
  leadSources?: Array<{ id: string; name: string; is_active: boolean; order_index: number }>;
  onUpdateSection: (sectionKey: string, section: RepeaterSection) => void;
}

export default function RepeaterSectionManager({ 
  section, 
  sectionKey, 
  kpiFields,
  leadSources = [],
  onUpdateSection 
}: RepeaterSectionManagerProps) {
  const [showFieldConfig, setShowFieldConfig] = useState(false);

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
    const newOptions = [...(field.options || []), ''];
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
      
      {section.enabled && (
        <CardContent className="space-y-4">
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

            {showFieldConfig && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Section Fields</h4>
                  <Button variant="outline" size="sm" onClick={addField}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Field
                  </Button>
                </div>

                <div className="space-y-3">
                  {section.fields.map((field, index) => (
                    <div key={field.key} className="border p-3 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Input
                          value={field.label}
                          onChange={(e) => updateField(index, { label: e.target.value })}
                          placeholder="Field label"
                          className="flex-1 mr-2"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeField(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Field Type</Label>
                          <Select
                            value={field.type}
                            onValueChange={(value: any) => updateField(index, { type: value })}
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
                              updateField(index, { required: !!checked })
                            }
                          />
                          <Label htmlFor={`required-${field.key}`}>Required</Label>
                        </div>
                      </div>

                      {field.type === 'select' && (
                        <div className="space-y-3">
                          {field.key === 'lead_source' && leadSources.length > 0 ? (
                            <div>
                              <Label>Options</Label>
                              <div className="p-3 border rounded-md bg-muted text-sm">
                                <p className="text-muted-foreground mb-2">Automatically populated from Lead Source Configuration:</p>
                                {leadSources.filter(ls => ls.is_active).map(ls => (
                                  <p key={ls.id} className="text-xs">• {ls.name}</p>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Options</Label>
                                <Button
                                  onClick={() => addOptionToField(index)}
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
                                      onChange={(e) => updateOptionInField(index, optionIndex, e.target.value)}
                                      placeholder={`Option ${optionIndex + 1}`}
                                      className="flex-1"
                                    />
                                    <Button
                                      onClick={() => removeOptionFromField(index, optionIndex)}
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
                      )}
                    </div>
                  ))}

                  {section.fields.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No fields configured. Add a field above to get started.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}