import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, GripVertical, X, Save, CheckCircle2, Trash2 } from 'lucide-react';
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
import type { AccountabilityMetricsContent } from '@/hooks/useSalesExperienceDeliverables';

interface AccountabilityEditorProps {
  content: AccountabilityMetricsContent;
  onChange: (content: AccountabilityMetricsContent) => void;
  onSave: (markComplete?: boolean) => void;
  isSaving: boolean;
}

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

interface CategoryCardProps {
  category: { name: string; items: string[] };
  categoryIndex: number;
  onUpdate: (category: { name: string; items: string[] }) => void;
  onRemove: () => void;
}

function CategoryCard({ category, categoryIndex, onUpdate, onRemove }: CategoryCardProps) {
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
      const oldIndex = category.items.findIndex((_, i) => `cat-${categoryIndex}-item-${i}` === active.id);
      const newIndex = category.items.findIndex((_, i) => `cat-${categoryIndex}-item-${i}` === over.id);
      onUpdate({ ...category, items: arrayMove(category.items, oldIndex, newIndex) });
    }
  };

  const addItem = () => {
    if (newItem.trim()) {
      onUpdate({ ...category, items: [...category.items, newItem.trim()] });
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    onUpdate({ ...category, items: category.items.filter((_, i) => i !== index) });
  };

  const updateItem = (index: number, value: string) => {
    const newItems = [...category.items];
    newItems[index] = value;
    onUpdate({ ...category, items: newItems });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Input
            value={category.name}
            onChange={(e) => onUpdate({ ...category, name: e.target.value })}
            placeholder="Category name..."
            className="text-base font-semibold h-9 w-auto"
          />
          <Button variant="ghost" size="icon" onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={category.items.map((_, i) => `cat-${categoryIndex}-item-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {category.items.map((item, index) => (
                <SortableItem
                  key={`cat-${categoryIndex}-item-${index}`}
                  id={`cat-${categoryIndex}-item-${index}`}
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
            placeholder="Add metric..."
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

export function AccountabilityEditor({ content, onChange, onSave, isSaving }: AccountabilityEditorProps) {
  const addCategory = useCallback(() => {
    onChange({
      categories: [
        ...content.categories,
        { name: 'New Category', items: [] },
      ],
    });
  }, [content, onChange]);

  const updateCategory = useCallback(
    (index: number, category: { name: string; items: string[] }) => {
      const newCategories = [...content.categories];
      newCategories[index] = category;
      onChange({ categories: newCategories });
    },
    [content, onChange]
  );

  const removeCategory = useCallback(
    (index: number) => {
      onChange({
        categories: content.categories.filter((_, i) => i !== index),
      });
    },
    [content, onChange]
  );

  const isComplete = content.categories.length > 0 && content.categories.every(c => c.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {content.categories.map((category, index) => (
          <CategoryCard
            key={index}
            category={category}
            categoryIndex={index}
            onUpdate={(cat) => updateCategory(index, cat)}
            onRemove={() => removeCategory(index)}
          />
        ))}
      </div>

      <Button variant="outline" onClick={addCategory} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        Add Category
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
