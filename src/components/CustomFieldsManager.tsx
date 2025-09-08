import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, GripVertical, X } from "lucide-react";
import { useCustomFields, type CustomField, type CreateCustomFieldData } from "@/hooks/useCustomFields";

interface CustomFieldsManagerProps {
  agencyId: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'dropdown', label: 'Dropdown' }
];

export function CustomFieldsManager({ agencyId }: CustomFieldsManagerProps) {
  const {
    customFields,
    loading,
    createCustomField,
    updateCustomField,
    deleteCustomField
  } = useCustomFields(agencyId);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);

  const [newField, setNewField] = useState<CreateCustomFieldData>({
    field_key: '',
    field_label: '',
    field_type: 'text',
    options: []
  });

  const [editField, setEditField] = useState<Partial<CustomField>>({});

  const handleCreateField = async () => {
    if (!newField.field_label.trim()) return;

    // Generate field key from label if not provided
    const fieldKey = newField.field_key.trim() || 
      newField.field_label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

    const success = await createCustomField({
      ...newField,
      field_key: fieldKey
    });

    if (success) {
      setIsCreateDialogOpen(false);
      setNewField({
        field_key: '',
        field_label: '',
        field_type: 'text',
        options: []
      });
    }
  };

  const handleEditField = async () => {
    if (!editingField || !editField.field_label?.trim()) return;

    const success = await updateCustomField(editingField.id, editField);

    if (success) {
      setIsEditDialogOpen(false);
      setEditingField(null);
      setEditField({});
    }
  };

  const handleDeleteField = async (field: CustomField) => {
    if (confirm(`Are you sure you want to delete the field "${field.field_label}"?`)) {
      await deleteCustomField(field.id);
    }
  };

  const openEditDialog = (field: CustomField) => {
    setEditingField(field);
    setEditField({
      field_label: field.field_label,
      field_type: field.field_type,
      options: field.options || []
    });
    setIsEditDialogOpen(true);
  };

  const addNewFieldOption = () => {
    setNewField(prev => ({
      ...prev,
      options: [...(prev.options || []), '']
    }));
  };

  const updateNewFieldOption = (index: number, value: string) => {
    setNewField(prev => ({
      ...prev,
      options: prev.options?.map((opt, i) => i === index ? value : opt) || []
    }));
  };

  const removeNewFieldOption = (index: number) => {
    setNewField(prev => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index) || []
    }));
  };

  const addEditFieldOption = () => {
    setEditField(prev => ({
      ...prev,
      options: [...(prev.options || []), '']
    }));
  };

  const updateEditFieldOption = (index: number, value: string) => {
    setEditField(prev => ({
      ...prev,
      options: prev.options?.map((opt, i) => i === index ? value : opt) || []
    }));
  };

  const removeEditFieldOption = (index: number) => {
    setEditField(prev => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index) || []
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Custom Fields</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Add custom fields to capture additional prospect information
              </p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Custom fields</strong> will appear in the Explorer tab when viewing prospect details. 
              Use them to collect additional information specific to your agency's needs.
            </p>
          </div>
          
          {loading ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Loading custom fields...</p>
            </div>
          ) : customFields.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No custom fields configured. Create your first field to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {customFields.map((field) => (
                <div key={field.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{field.field_label}</span>
                      <Badge variant="outline" className="text-xs">
                        {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                      </Badge>
                      {field.field_type === 'dropdown' && field.options && (
                        <Badge variant="secondary" className="text-xs">
                          {field.options.length} options
                        </Badge>
                      )}
                    </div>
                    {field.field_type === 'dropdown' && field.options && field.options.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Options: {field.options.slice(0, 3).join(', ')}{field.options.length > 3 ? '...' : ''}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(field)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteField(field)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Field Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Custom Field</DialogTitle>
            <p className="text-sm text-muted-foreground">
              This field will be available when viewing prospect details in the Explorer.
            </p>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="field_label">Field Label</Label>
              <Input
                id="field_label"
                value={newField.field_label}
                onChange={(e) => setNewField(prev => ({ ...prev, field_label: e.target.value }))}
                placeholder="e.g. 'Follow-up Date' or 'Lead Source'"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="field_type">Field Type</Label>
              <Select
                value={newField.field_type}
                onValueChange={(value) => setNewField(prev => ({ ...prev, field_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dropdown Options */}
            {newField.field_type === 'dropdown' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Dropdown Options</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addNewFieldOption}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(newField.options || []).map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateNewFieldOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeNewFieldOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateField} disabled={!newField.field_label.trim()}>
              Create Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Field Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Custom Field</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_field_label">Field Label</Label>
              <Input
                id="edit_field_label"
                value={editField.field_label || ''}
                onChange={(e) => setEditField(prev => ({ ...prev, field_label: e.target.value }))}
                placeholder="Enter field label"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_field_type">Field Type</Label>
              <Select
                value={editField.field_type || 'text'}
                onValueChange={(value) => setEditField(prev => ({ ...prev, field_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dropdown Options */}
            {editField.field_type === 'dropdown' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Dropdown Options</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addEditFieldOption}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(editField.options || []).map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateEditFieldOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeEditFieldOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditField} disabled={!editField.field_label?.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}