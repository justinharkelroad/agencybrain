import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, GripVertical } from "lucide-react";
import { useCustomFields, type CustomField, type CreateCustomFieldData } from "@/hooks/useCustomFields";

interface CustomFieldsManagerProps {
  agencyId: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' }
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
    field_type: 'text'
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
        field_type: 'text'
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
      field_type: field.field_type
    });
    setIsEditDialogOpen(true);
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
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Key: {field.field_key}
                    </p>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Field</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="field_label">Field Label</Label>
              <Input
                id="field_label"
                value={newField.field_label}
                onChange={(e) => setNewField(prev => ({ ...prev, field_label: e.target.value }))}
                placeholder="Enter field label"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="field_key">Field Key (optional)</Label>
              <Input
                id="field_key"
                value={newField.field_key}
                onChange={(e) => setNewField(prev => ({ ...prev, field_key: e.target.value }))}
                placeholder="Auto-generated from label"
              />
              <p className="text-xs text-muted-foreground">
                Used for data storage. Leave blank to auto-generate.
              </p>
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
        <DialogContent>
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