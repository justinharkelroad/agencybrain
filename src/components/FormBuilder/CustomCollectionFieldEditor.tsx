import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, X } from "lucide-react";
import { 
  CustomCollectionSchemaItem, 
  CustomFieldType, 
  FIELD_TYPE_LABELS,
  generateFieldKey
} from "@/types/custom-collections";

interface CustomCollectionFieldEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: CustomCollectionSchemaItem;
  kpiFields: Array<{ key: string; label: string }>;
  onUpdate: (updates: Partial<CustomCollectionSchemaItem>) => void;
}

interface FieldEditorState {
  label: string;
  type: CustomFieldType;
  required: boolean;
  options: string[];
}

export default function CustomCollectionFieldEditor({
  open,
  onOpenChange,
  collection,
  kpiFields,
  onUpdate,
}: CustomCollectionFieldEditorProps) {
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState<FieldEditorState>({
    label: "",
    type: "short_text",
    required: false,
    options: [],
  });
  const [editingSettings, setEditingSettings] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const [editKpi, setEditKpi] = useState(collection.controllingKpiKey);

  const handleAddField = () => {
    if (!newField.label.trim()) return;

    const field = {
      id: crypto.randomUUID(),
      label: newField.label.trim(),
      fieldKey: generateFieldKey(newField.label),
      type: newField.type,
      required: newField.required,
      options: newField.type === "dropdown" ? newField.options.filter(o => o.trim()) : undefined,
    };

    onUpdate({
      fields: [...collection.fields, field],
    });

    // Reset
    setNewField({
      label: "",
      type: "short_text",
      required: false,
      options: [],
    });
    setShowAddField(false);
  };

  const handleRemoveField = (fieldId: string) => {
    onUpdate({
      fields: collection.fields.filter(f => f.id !== fieldId),
    });
  };

  const handleToggleRequired = (fieldId: string) => {
    onUpdate({
      fields: collection.fields.map(f => 
        f.id === fieldId ? { ...f, required: !f.required } : f
      ),
    });
  };

  const handleUpdateFieldLabel = (fieldId: string, label: string) => {
    onUpdate({
      fields: collection.fields.map(f => 
        f.id === fieldId ? { ...f, label } : f
      ),
    });
  };

  const handleSaveSettings = () => {
    if (editName.trim() && editKpi) {
      onUpdate({
        name: editName.trim(),
        controllingKpiKey: editKpi,
      });
      setEditingSettings(false);
    }
  };

  const addOption = () => {
    setNewField(prev => ({
      ...prev,
      options: [...prev.options, ""],
    }));
  };

  const updateOption = (index: number, value: string) => {
    setNewField(prev => ({
      ...prev,
      options: prev.options.map((o, i) => i === index ? value : o),
    }));
  };

  const removeOption = (index: number) => {
    setNewField(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const getControllingKpiLabel = (kpiKey: string) => {
    const kpi = kpiFields.find(k => k.key === kpiKey);
    return kpi?.label || kpiKey;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure: {collection.name}</DialogTitle>
          <DialogDescription>
            Add and manage fields for this collection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Collection Settings */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Collection Settings</h4>
              {!editingSettings ? (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setEditName(collection.name);
                    setEditKpi(collection.controllingKpiKey);
                    setEditingSettings(true);
                  }}
                >
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setEditingSettings(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleSaveSettings}
                  >
                    Save
                  </Button>
                </div>
              )}
            </div>
            
            {editingSettings ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Collection name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Controlled by</Label>
                  <Select value={editKpi} onValueChange={setEditKpi}>
                    <SelectTrigger>
                      <SelectValue />
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
            ) : (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Name: {collection.name}</p>
                <p>Controlled by: {getControllingKpiLabel(collection.controllingKpiKey)}</p>
              </div>
            )}
          </div>

          {/* Fields List */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Fields</h4>
            
            {collection.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                No fields yet. Add your first field below.
              </p>
            ) : (
              <div className="space-y-2">
                {collection.fields.map((field, index) => (
                  <div 
                    key={field.id}
                    className="flex items-center gap-2 p-3 border rounded-lg bg-card"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Input
                        value={field.label}
                        onChange={(e) => handleUpdateFieldLabel(field.id, e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {FIELD_TYPE_LABELS[field.type]}
                    </Badge>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Checkbox
                        checked={field.required}
                        onCheckedChange={() => handleToggleRequired(field.id)}
                      />
                      <span className="text-xs text-muted-foreground">Req</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveField(field.id)}
                      className="text-destructive hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Field Section */}
          {showAddField ? (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Add Field</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddField(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs">
                    Field Label <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Enter field label"
                    value={newField.label}
                    onChange={(e) => setNewField(prev => ({ ...prev, label: e.target.value }))}
                    maxLength={100}
                  />
                </div>

                <div>
                  <Label className="text-xs">
                    Field Type <span className="text-destructive">*</span>
                  </Label>
                  <Select 
                    value={newField.type} 
                    onValueChange={(v) => setNewField(prev => ({ 
                      ...prev, 
                      type: v as CustomFieldType,
                      options: v === "dropdown" ? [""] : [],
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="new-field-required"
                    checked={newField.required}
                    onCheckedChange={(checked) => 
                      setNewField(prev => ({ ...prev, required: !!checked }))
                    }
                  />
                  <Label htmlFor="new-field-required" className="text-sm">
                    Required field
                  </Label>
                </div>

                {newField.type === "dropdown" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Dropdown Options</Label>
                    {newField.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addOption}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Option
                    </Button>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddField(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddField}
                    disabled={!newField.label.trim() || (newField.type === "dropdown" && newField.options.filter(o => o.trim()).length < 2)}
                    className="flex-1"
                  >
                    Add Field
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowAddField(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
