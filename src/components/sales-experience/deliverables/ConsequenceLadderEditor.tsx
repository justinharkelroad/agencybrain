import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, GripVertical, Trash2, Save, CheckCircle2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ConsequenceLadderContent } from '@/hooks/useSalesExperienceDeliverables';

interface ConsequenceLadderEditorProps {
  content: ConsequenceLadderContent;
  onChange: (content: ConsequenceLadderContent) => void;
  onSave: (markComplete?: boolean) => void;
  isSaving: boolean;
}

interface Step {
  incident: number;
  title: string;
  description: string;
}

interface SortableStepProps {
  id: string;
  step: Step;
  index: number;
  onUpdate: (step: Step) => void;
  onRemove: () => void;
}

function SortableStep({ id, step, index, onUpdate, onRemove }: SortableStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-1"
            >
              <GripVertical className="h-5 w-5" />
            </button>
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              {index + 1}
            </div>
            <div className="flex-1">
              <Input
                value={step.title}
                onChange={(e) => onUpdate({ ...step, title: e.target.value })}
                placeholder="Step title (e.g., Verbal Warning)..."
                className="font-medium text-base"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pl-[76px]">
          <Textarea
            value={step.description}
            onChange={(e) => onUpdate({ ...step, description: e.target.value })}
            placeholder="Describe what happens at this step..."
            rows={2}
            className="resize-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function ConsequenceLadderEditor({ content, onChange, onSave, isSaving }: ConsequenceLadderEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = content.steps.findIndex((_, i) => `step-${i}` === active.id);
      const newIndex = content.steps.findIndex((_, i) => `step-${i}` === over.id);
      const newSteps = arrayMove(content.steps, oldIndex, newIndex).map((step, i) => ({
        ...step,
        incident: i + 1,
      }));
      onChange({ steps: newSteps });
    }
  };

  const addStep = useCallback(() => {
    const newStep: Step = {
      incident: content.steps.length + 1,
      title: '',
      description: '',
    };
    onChange({ steps: [...content.steps, newStep] });
  }, [content, onChange]);

  const updateStep = useCallback(
    (index: number, step: Step) => {
      const newSteps = [...content.steps];
      newSteps[index] = step;
      onChange({ steps: newSteps });
    },
    [content, onChange]
  );

  const removeStep = useCallback(
    (index: number) => {
      const newSteps = content.steps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, incident: i + 1 }));
      onChange({ steps: newSteps });
    },
    [content, onChange]
  );

  const isComplete = content.steps.length >= 2 && content.steps.every(s => s.title && s.description);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Create a progressive discipline ladder. Drag to reorder steps. Most ladders have 4-6 steps
        from informal coaching to termination.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={content.steps.map((_, i) => `step-${i}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {content.steps.map((step, index) => (
              <SortableStep
                key={`step-${index}`}
                id={`step-${index}`}
                step={step}
                index={index}
                onUpdate={(s) => updateStep(index, s)}
                onRemove={() => removeStep(index)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {content.steps.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No steps defined yet. Add your first step to get started.
            </p>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" onClick={addStep} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        Add Step
      </Button>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => onSave(false)}
          disabled={isSaving}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Draft
        </Button>
        <Button
          onClick={() => onSave(true)}
          disabled={isSaving || !isComplete}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Mark Complete
        </Button>
      </div>
    </div>
  );
}
