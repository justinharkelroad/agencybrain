import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Loader2,
  ListTree,
  AlertCircle,
} from "lucide-react";
import {
  useAllSequenceTypeOptions,
  useSequenceTypeUsageCounts,
  useSequenceTypeOptionsMutations,
  type SequenceTypeOption,
} from "@/hooks/useSequenceTypeOptions";
import { cn } from "@/lib/utils";

const AdminSequenceTypes: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { data: types = [], isLoading } = useAllSequenceTypeOptions();
  const { data: usageCounts = {} } = useSequenceTypeUsageCounts();
  const { createType, updateType, deleteType, toggleActive, reorderTypes } = useSequenceTypeOptionsMutations();

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<SequenceTypeOption | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingType, setDeletingType] = useState<SequenceTypeOption | null>(null);

  // Form state
  const [formLabel, setFormLabel] = useState("");
  const [formDescription, setFormDescription] = useState("");

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [localTypes, setLocalTypes] = useState<SequenceTypeOption[]>([]);

  // Keep local state in sync with server data
  useEffect(() => {
    setLocalTypes(types);
  }, [types]);

  // SEO
  useEffect(() => {
    document.title = "Sequence Types – Admin";
    const desc = "Manage sequence type categories for the sequence builder.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);

  // Open edit dialog
  const handleEdit = (type: SequenceTypeOption) => {
    setEditingType(type);
    setFormLabel(type.label);
    setFormDescription(type.description || "");
    setEditDialogOpen(true);
  };

  // Open add dialog
  const handleAdd = () => {
    setEditingType(null);
    setFormLabel("");
    setFormDescription("");
    setEditDialogOpen(true);
  };

  // Save type (create or update)
  const handleSave = async () => {
    if (!formLabel.trim()) return;

    if (editingType) {
      await updateType.mutateAsync({
        id: editingType.id,
        label: formLabel.trim(),
        description: formDescription.trim() || undefined,
      });
    } else {
      await createType.mutateAsync({
        label: formLabel.trim(),
        description: formDescription.trim() || undefined,
      });
    }
    setEditDialogOpen(false);
  };

  // Confirm delete
  const handleDeleteClick = (type: SequenceTypeOption) => {
    setDeletingType(type);
    setDeleteDialogOpen(true);
  };

  // Execute delete
  const handleConfirmDelete = async () => {
    if (!deletingType) return;
    await deleteType.mutateAsync(deletingType.id);
    setDeleteDialogOpen(false);
    setDeletingType(null);
  };

  // Toggle active status
  const handleToggleActive = async (type: SequenceTypeOption) => {
    await toggleActive.mutateAsync({ id: type.id, is_active: !type.is_active });
  };

  // Drag handlers
  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = localTypes.findIndex((t) => t.id === draggedId);
    const targetIndex = localTypes.findIndex((t) => t.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Don't allow dragging to position 99 (reserved for "other")
    const targetType = localTypes[targetIndex];
    if (targetType.type_key === "other") return;

    const newTypes = [...localTypes];
    const [dragged] = newTypes.splice(draggedIndex, 1);
    newTypes.splice(targetIndex, 0, dragged);
    setLocalTypes(newTypes);
  };

  const handleDragEnd = async () => {
    if (!draggedId) return;
    setDraggedId(null);

    // Save the new order
    const orderedIds = localTypes.map((t) => t.id);
    await reorderTypes.mutateAsync(orderedIds);
  };

  // Check if type can be deleted
  const canDelete = (type: SequenceTypeOption) => {
    // Cannot delete "other" type
    if (type.type_key === "other") return false;
    // Cannot delete if in use
    const count = usageCounts[type.type_key] || 0;
    return count === 0;
  };

  if (!user || !isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ListTree className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Sequence Types</h1>
              <p className="text-sm text-muted-foreground">
                Manage categories for sequence templates
              </p>
            </div>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Type
          </Button>
        </div>

        {/* Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p>
                  Sequence types categorize templates in the Sequence Builder. Drag to reorder how
                  they appear in dropdowns. The "Other" type always appears last and allows users
                  to enter a custom category name.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Types Table */}
        <Card>
          <CardHeader>
            <CardTitle>Current Types</CardTitle>
            <CardDescription>
              {types.length} type{types.length !== 1 ? "s" : ""} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : localTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sequence types configured. Click "Add Type" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-24 text-center">In Use</TableHead>
                    <TableHead className="w-24 text-center">Active</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localTypes.map((type) => {
                    const count = usageCounts[type.type_key] || 0;
                    const isOther = type.type_key === "other";
                    const isDragging = draggedId === type.id;

                    return (
                      <TableRow
                        key={type.id}
                        draggable={!isOther}
                        onDragStart={() => handleDragStart(type.id)}
                        onDragOver={(e) => handleDragOver(e, type.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          isDragging && "opacity-50 bg-muted/50",
                          isOther && "bg-muted/20"
                        )}
                      >
                        <TableCell>
                          {!isOther && (
                            <div className="cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {type.label}
                          {isOther && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              System
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {type.description || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {count > 0 ? (
                            <Badge variant="outline">{count}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={type.is_active}
                            onCheckedChange={() => handleToggleActive(type)}
                            disabled={isOther}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(type)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(type)}
                              disabled={!canDelete(type)}
                              title={
                                isOther
                                  ? "System type cannot be deleted"
                                  : count > 0
                                  ? `In use by ${count} sequence${count !== 1 ? "s" : ""}`
                                  : "Delete type"
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Edit Sequence Type" : "Add Sequence Type"}
            </DialogTitle>
            <DialogDescription>
              {editingType
                ? "Update the label and description for this sequence type."
                : "Create a new category for sequence templates."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type-label">
                Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="type-label"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g., Cross-Sell Campaign"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-description">Description</Label>
              <Input
                id="type-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="e.g., For promoting additional products"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formLabel.trim() || createType.isPending || updateType.isPending}
            >
              {(createType.isPending || updateType.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingType ? "Save Changes" : "Create Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sequence Type?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingType?.label}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingType(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteType.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSequenceTypes;
