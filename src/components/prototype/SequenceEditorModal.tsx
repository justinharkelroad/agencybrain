import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Phone,
  MessageSquare,
  Mail,
  MoreHorizontal,
  Workflow,
  AlertCircle,
} from "lucide-react";
import { SequenceStep, SequenceStepEditor, ActionType } from "./SequenceStepEditor";

export type SequenceTargetType = 'onboarding' | 'lead_nurturing' | 'requote' | 'retention' | 'other';

export interface Sequence {
  id: string;
  name: string;
  description: string;
  targetType: SequenceTargetType;
  isActive: boolean;
  steps: SequenceStep[];
  createdAt: Date;
  updatedAt: Date;
}

interface SequenceEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence: Sequence | null;
  onSave: (sequence: Omit<Sequence, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
}

const targetTypeOptions = [
  { value: 'onboarding', label: 'New Customer Onboarding', description: 'For newly sold policies' },
  { value: 'lead_nurturing', label: 'Lead Nurturing', description: 'For unconverted leads' },
  { value: 'requote', label: 'Re-quote Follow-up', description: 'For expiring quotes' },
  { value: 'retention', label: 'Retention', description: 'For at-risk customers' },
  { value: 'other', label: 'Other', description: 'Custom sequence type' },
];

const actionIcons: Record<ActionType, React.ElementType> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  other: MoreHorizontal,
};

const actionColors: Record<ActionType, string> = {
  call: 'text-green-500 bg-green-500/10',
  text: 'text-purple-500 bg-purple-500/10',
  email: 'text-blue-500 bg-blue-500/10',
  other: 'text-gray-500 bg-gray-500/10',
};

export function SequenceEditorModal({
  open,
  onOpenChange,
  sequence,
  onSave,
}: SequenceEditorModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<SequenceTargetType>('onboarding');
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<SequenceStep[]>([]);

  // Step editor state
  const [stepEditorOpen, setStepEditorOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null);

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Reset form when sequence changes
  useEffect(() => {
    if (open) {
      setName(sequence?.name ?? '');
      setDescription(sequence?.description ?? '');
      setTargetType(sequence?.targetType ?? 'onboarding');
      setIsActive(sequence?.isActive ?? true);
      setSteps(sequence?.steps ?? []);
    }
  }, [open, sequence]);

  const isEditing = !!sequence;

  const handleSave = () => {
    onSave({
      id: sequence?.id,
      name,
      description,
      targetType,
      isActive,
      steps,
    });
    onOpenChange(false);
  };

  const handleAddStep = () => {
    setEditingStep(null);
    setStepEditorOpen(true);
  };

  const handleEditStep = (step: SequenceStep) => {
    setEditingStep(step);
    setStepEditorOpen(true);
  };

  const handleDeleteStep = (stepId: string) => {
    setSteps(current => current.filter(s => s.id !== stepId));
  };

  const handleSaveStep = (stepData: Omit<SequenceStep, 'id' | 'sortOrder'> & { id?: string }) => {
    if (stepData.id) {
      // Editing existing step
      setSteps(current =>
        current.map(s =>
          s.id === stepData.id
            ? { ...s, ...stepData }
            : s
        )
      );
    } else {
      // Adding new step
      const newStep: SequenceStep = {
        ...stepData,
        id: `step-${Date.now()}`,
        sortOrder: steps.length,
      };
      setSteps(current => [...current, newStep]);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSteps = [...steps];
    const draggedStep = newSteps[draggedIndex];
    newSteps.splice(draggedIndex, 1);
    newSteps.splice(index, 0, draggedStep);

    // Update sort orders
    newSteps.forEach((step, i) => {
      step.sortOrder = i;
    });

    setSteps(newSteps);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Sort steps by day number for display
  const sortedSteps = [...steps].sort((a, b) => a.dayNumber - b.dayNumber || a.sortOrder - b.sortOrder);

  const isValid = name.trim() && steps.length > 0;

  // Calculate total duration
  const totalDays = steps.length > 0 ? Math.max(...steps.map(s => s.dayNumber)) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="w-5 h-5 text-primary" />
              {isEditing ? 'Edit Sequence' : 'Create New Sequence'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the sequence template and its steps.'
                : 'Create a reusable sequence template with timed follow-up tasks.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Sequence Details</h3>
                <div className="flex items-center gap-2">
                  <Label htmlFor="is-active" className="text-sm">Active</Label>
                  <Switch
                    id="is-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sequence-name">
                    Sequence Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sequence-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., New Auto Policy Onboarding"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sequence Type</Label>
                  <Select value={targetType} onValueChange={(v) => setTargetType(v as SequenceTargetType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {targetTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div>{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sequence-description">Description</Label>
                <Textarea
                  id="sequence-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe when this sequence should be used..."
                  className="min-h-[60px]"
                />
              </div>
            </div>

            {/* Steps Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Steps</h3>
                  {steps.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {steps.length} step{steps.length !== 1 ? 's' : ''} • {totalDays} day{totalDays !== 1 ? 's' : ''} total
                    </p>
                  )}
                </div>
                <Button size="sm" onClick={handleAddStep}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Step
                </Button>
              </div>

              {steps.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No steps yet. Add at least one step to create this sequence.
                    </p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={handleAddStep}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add First Step
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {sortedSteps.map((step, index) => {
                    const ActionIcon = actionIcons[step.actionType];
                    return (
                      <Card
                        key={step.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "cursor-move transition-all",
                          draggedIndex === index && "opacity-50 scale-[0.98]"
                        )}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            {/* Drag Handle */}
                            <div className="mt-1 cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                            </div>

                            {/* Day Badge */}
                            <div className="flex flex-col items-center min-w-[50px]">
                              <Badge variant="outline" className="text-xs font-mono">
                                Day {step.dayNumber}
                              </Badge>
                            </div>

                            {/* Action Icon */}
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                              actionColors[step.actionType]
                            )}>
                              <ActionIcon className="w-4 h-4" />
                            </div>

                            {/* Step Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{step.title}</p>
                              {step.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                  {step.description}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditStep(step)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteStep(step.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              {isEditing ? 'Save Changes' : 'Create Sequence'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step Editor Modal */}
      <SequenceStepEditor
        open={stepEditorOpen}
        onOpenChange={setStepEditorOpen}
        step={editingStep}
        onSave={handleSaveStep}
        existingDays={steps.map(s => s.dayNumber)}
      />
    </>
  );
}
