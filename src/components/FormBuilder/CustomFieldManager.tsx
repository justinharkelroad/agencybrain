import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'longtext' | 'dropdown' | 'radio' | 'checkbox' | 'date';
  required: boolean;
  options?: string[];
}

interface CustomFieldManagerProps {
  fields: CustomField[];
  onUpdateField: (index: number, field: Partial<CustomField>) => void;
  onAddField: () => void;
  onRemoveField: (index: number) => void;
}

export default function CustomFieldManager({
  fields,
  onUpdateField,
  onAddField,
  onRemoveField
}: CustomFieldManagerProps) {
  const [expandedFields, setExpandedFields] = useState<Set<number>>(new Set());

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFields(newExpanded);
  };

  const updateFieldOptions = (index: number, optionsText: string) => {
    const options = optionsText.split('\n').filter(opt => opt.trim());
    onUpdateField(index, { options });
  };

  const addOptionToField = (fieldIndex: number) => {
    const field = fields[fieldIndex];
    const newOptions = [...(field.options || []), ''];
    onUpdateField(fieldIndex, { options: newOptions });
  };

  const updateOptionInField = (fieldIndex: number, optionIndex: number, value: string) => {
    const field = fields[fieldIndex];
    const newOptions = [...(field.options || [])];
    newOptions[optionIndex] = value;
    onUpdateField(fieldIndex, { options: newOptions });
  };

  const removeOptionFromField = (fieldIndex: number, optionIndex: number) => {
    const field = fields[fieldIndex];
    const newOptions = (field.options || []).filter((_, i) => i !== optionIndex);
    onUpdateField(fieldIndex, { options: newOptions });
  };

  if (fields.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Custom Fields
            <Button onClick={onAddField} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </CardTitle>
          <CardDescription>
            Add custom fields to collect additional information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No custom fields added yet. Click "Add Field" to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Custom Fields
          <Button onClick={onAddField} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </CardTitle>
        <CardDescription>
          Configure custom fields for additional data collection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.key} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  value={field.label}
                  onChange={(e) => onUpdateField(index, { label: e.target.value })}
                  placeholder="Field Label"
                />
              </div>
              <Select 
                value={field.type} 
                onValueChange={(type: CustomField['type']) => {
                  onUpdateField(index, { type });
                  if (type === 'dropdown' || type === 'radio') {
                    setExpandedFields(prev => new Set(prev).add(index));
                  }
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Short Text</SelectItem>
                  <SelectItem value="longtext">Long Text</SelectItem>
                  <SelectItem value="dropdown">Dropdown</SelectItem>
                  <SelectItem value="radio">Radio</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  checked={field.required}
                  onCheckedChange={(required) => onUpdateField(index, { required })}
                />
                <Label className="text-sm">Required</Label>
              </div>
              <Button
                onClick={() => onRemoveField(index)}
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            {(field.type === 'dropdown' || field.type === 'radio') && (
              <div className="space-y-3">
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
        ))}
      </CardContent>
    </Card>
  );
}