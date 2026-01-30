import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Phone, MessageSquare, Mail, MoreHorizontal } from "lucide-react";

export type ActionType = 'call' | 'text' | 'email' | 'other';

export interface SequenceStep {
  id: string;
  dayNumber: number;
  actionType: ActionType;
  title: string;
  description: string;
  scriptTemplate?: string;
  sortOrder: number;
}

interface SequenceStepEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: SequenceStep | null;
  onSave: (step: Omit<SequenceStep, 'id' | 'sortOrder'> & { id?: string }) => void;
  existingDays: number[];
}

const actionTypeOptions = [
  { value: 'call', label: 'Phone Call', icon: Phone, color: 'text-green-500' },
  { value: 'text', label: 'Text Message', icon: MessageSquare, color: 'text-purple-500' },
  { value: 'email', label: 'Email', icon: Mail, color: 'text-blue-500' },
  { value: 'other', label: 'Other Task', icon: MoreHorizontal, color: 'text-gray-500' },
];

export function SequenceStepEditor({
  open,
  onOpenChange,
  step,
  onSave,
  existingDays,
}: SequenceStepEditorProps) {
  const [dayNumber, setDayNumber] = React.useState(step?.dayNumber ?? 0);
  const [actionType, setActionType] = React.useState<ActionType>(step?.actionType ?? 'call');
  const [title, setTitle] = React.useState(step?.title ?? '');
  const [description, setDescription] = React.useState(step?.description ?? '');
  const [scriptTemplate, setScriptTemplate] = React.useState(step?.scriptTemplate ?? '');

  // Reset form when step changes
  React.useEffect(() => {
    if (open) {
      setDayNumber(step?.dayNumber ?? Math.max(0, ...existingDays, -1) + 1);
      setActionType(step?.actionType ?? 'call');
      setTitle(step?.title ?? '');
      setDescription(step?.description ?? '');
      setScriptTemplate(step?.scriptTemplate ?? '');
    }
  }, [open, step, existingDays]);

  const handleSave = () => {
    onSave({
      id: step?.id,
      dayNumber,
      actionType,
      title,
      description,
      scriptTemplate: scriptTemplate || undefined,
    });
    onOpenChange(false);
  };

  const isValid = title.trim() && dayNumber >= 0;
  const isEditing = !!step;

  const selectedActionType = actionTypeOptions.find(a => a.value === actionType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Step' : 'Add Step'}
          </DialogTitle>
          <DialogDescription>
            Configure when and what action should be taken for this step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Day Number & Action Type Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="day-number">
                Day Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="day-number"
                type="number"
                min={0}
                value={dayNumber}
                onChange={(e) => setDayNumber(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Day 0 = sequence start date
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                Action Type <span className="text-red-500">*</span>
              </Label>
              <Select value={actionType} onValueChange={(v) => setActionType(v as ActionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionTypeOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${option.color}`} />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="step-title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="step-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`e.g., "Welcome ${selectedActionType?.label || 'Task'}"`}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="step-description">Description</Label>
            <Textarea
              id="step-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should the team member do for this step?"
              className="min-h-[80px]"
            />
          </div>

          {/* Script Template (only for calls) */}
          {actionType === 'call' && (
            <div className="space-y-2">
              <Label htmlFor="script-template">
                Call Script Template
                <span className="text-muted-foreground font-normal ml-2">(optional)</span>
              </Label>
              <Textarea
                id="script-template"
                value={scriptTemplate}
                onChange={(e) => setScriptTemplate(e.target.value)}
                placeholder="Hi [Customer Name], this is [Agent Name] from [Agency]..."
                className="min-h-[100px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use placeholders like [Customer Name], [Agent Name], [Agency] that will be replaced with actual values.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {isEditing ? 'Save Changes' : 'Add Step'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
