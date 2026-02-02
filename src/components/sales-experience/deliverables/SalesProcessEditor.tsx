import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, GripVertical, X, Save, CheckCircle2 } from 'lucide-react';
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
import type { SalesProcessContent } from '@/hooks/useSalesExperienceDeliverables';

interface SalesProcessEditorProps {
  content: SalesProcessContent;
  onChange: (content: SalesProcessContent) => void;
  onSave: (markComplete?: boolean) => void;
  isSaving: boolean;
}

type PhaseKey = 'rapport' | 'coverage' | 'closing';

interface SortableItemProps {
  id: string;
  item: string;
  onRemove: () => void;
  onUpdate: (value: string) => void;
}

function SortableItem({ id, item, onRemove, onUpdate }: SortableItemProps) {
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
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-muted/50 rounded-md p-2 group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        value={item}
        onChange={(e) => onUpdate(e.target.value)}
        className="flex-1 h-8 bg-background"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface PhaseColumnProps {
  title: string;
  description: string;
  items: string[];
  phaseKey: PhaseKey;
  onItemsChange: (items: string[]) => void;
}

function PhaseColumn({ title, description, items, phaseKey, onItemsChange }: PhaseColumnProps) {
  const [newItem, setNewItem] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((_, i) => `${phaseKey}-${i}` === active.id);
      const newIndex = items.findIndex((_, i) => `${phaseKey}-${i}` === over.id);
      onItemsChange(arrayMove(items, oldIndex, newIndex));
    }
  };

  const addItem = () => {
    if (newItem.trim()) {
      onItemsChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    onItemsChange(newItems);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((_, i) => `${phaseKey}-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item, index) => (
                <SortableItem
                  key={`${phaseKey}-${index}`}
                  id={`${phaseKey}-${index}`}
                  item={item}
                  onRemove={() => removeItem(index)}
                  onUpdate={(value) => updateItem(index, value)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex gap-2">
          <Input
            placeholder="Add new item..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={addItem}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SalesProcessEditor({ content, onChange, onSave, isSaving }: SalesProcessEditorProps) {
  const handlePhaseChange = useCallback(
    (phase: PhaseKey, items: string[]) => {
      onChange({ ...content, [phase]: items });
    },
    [content, onChange]
  );

  const isComplete = content.rapport.length > 0 && content.coverage.length > 0 && content.closing.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PhaseColumn
          title="Rapport"
          description="How do you build trust and connect?"
          items={content.rapport}
          phaseKey="rapport"
          onItemsChange={(items) => handlePhaseChange('rapport', items)}
        />
        <PhaseColumn
          title="Coverage"
          description="How do you present coverage options?"
          items={content.coverage}
          phaseKey="coverage"
          onItemsChange={(items) => handlePhaseChange('coverage', items)}
        />
        <PhaseColumn
          title="Closing"
          description="How do you ask for the business?"
          items={content.closing}
          phaseKey="closing"
          onItemsChange={(items) => handlePhaseChange('closing', items)}
        />
      </div>

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
