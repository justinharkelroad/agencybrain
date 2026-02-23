import { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, ChevronLeft, X, FolderOpen, BookOpen, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

// Generic shape — works for both SP and Agency Training trees
export interface ContentNode {
  id: string;
  name: string;
  children?: ContentNode[];
}

export interface SelectedItem {
  id: string;
  level: 'category' | 'module' | 'lesson';
  name: string;
  breadcrumb?: string;
}

interface TrainingContentPickerProps {
  tree: ContentNode[];
  selected: SelectedItem[];
  onSelectionChange: (items: SelectedItem[]) => void;
  categoryLabel?: string;
  moduleLabel?: string;
  lessonLabel?: string;
}

export function TrainingContentPicker({
  tree,
  selected,
  onSelectionChange,
  categoryLabel = 'Category',
  moduleLabel = 'Module',
  lessonLabel = 'Lesson',
}: TrainingContentPickerProps) {
  // Navigation: null = categories, string = module list for a category, [catId, modId] = lesson list
  const [drillPath, setDrillPath] = useState<string[]>([]);

  const selectedIds = useMemo(() => new Set(selected.map(s => s.id)), [selected]);

  const toggleItem = (item: SelectedItem) => {
    const existing = selected.find(s => s.id === item.id);
    if (existing) {
      // Remove it
      onSelectionChange(selected.filter(s => s.id !== item.id));
    } else {
      // Add it, and remove children covered by parent
      let newSelection = [...selected, item];

      if (item.level === 'category') {
        // Remove any module/lesson selections under this category
        const cat = tree.find(c => c.id === item.id);
        if (cat?.children) {
          const childModIds = new Set(cat.children.map(m => m.id));
          const childLessonIds = new Set(
            cat.children.flatMap(m => (m.children || []).map(l => l.id))
          );
          newSelection = newSelection.filter(
            s => !childModIds.has(s.id) && !childLessonIds.has(s.id)
          );
        }
      } else if (item.level === 'module') {
        // Remove any lesson selections under this module
        const cat = tree.find(c => c.children?.some(m => m.id === item.id));
        const mod = cat?.children?.find(m => m.id === item.id);
        if (mod?.children) {
          const childIds = new Set(mod.children.map(l => l.id));
          newSelection = newSelection.filter(s => !childIds.has(s.id));
        }
      }

      onSelectionChange(newSelection);
    }
  };

  const removeItem = (id: string) => {
    onSelectionChange(selected.filter(s => s.id !== id));
  };

  // Determine current view
  const currentLevel = drillPath.length === 0 ? 'category'
    : drillPath.length === 1 ? 'module' : 'lesson';

  const currentItems: ContentNode[] = useMemo(() => {
    if (drillPath.length === 0) return tree;
    if (drillPath.length === 1) {
      const cat = tree.find(c => c.id === drillPath[0]);
      return cat?.children || [];
    }
    const cat = tree.find(c => c.id === drillPath[0]);
    const mod = cat?.children?.find(m => m.id === drillPath[1]);
    return mod?.children || [];
  }, [tree, drillPath]);

  const breadcrumbParts = useMemo(() => {
    const parts: { label: string; pathLength: number }[] = [];
    if (drillPath.length >= 1) {
      const cat = tree.find(c => c.id === drillPath[0]);
      parts.push({ label: cat?.name || '', pathLength: 0 });
    }
    if (drillPath.length >= 2) {
      const cat = tree.find(c => c.id === drillPath[0]);
      const mod = cat?.children?.find(m => m.id === drillPath[1]);
      parts.push({ label: mod?.name || '', pathLength: 1 });
    }
    return parts;
  }, [tree, drillPath]);

  const getLevelIcon = (level: string) => {
    if (level === 'category') return <FolderOpen className="h-4 w-4 text-muted-foreground" />;
    if (level === 'module') return <BookOpen className="h-4 w-4 text-muted-foreground" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const getLevelLabel = (level: string) => {
    if (level === 'category') return categoryLabel;
    if (level === 'module') return moduleLabel;
    return lessonLabel;
  };

  // Check if a parent category is selected (meaning children are implicitly covered)
  const isParentSelected = (itemId: string, level: 'module' | 'lesson') => {
    if (level === 'module') {
      // Check if parent category is selected
      const parentCat = tree.find(c => c.children?.some(m => m.id === itemId));
      return parentCat ? selectedIds.has(parentCat.id) : false;
    }
    if (level === 'lesson') {
      // Check if parent module or category is selected
      for (const cat of tree) {
        for (const mod of cat.children || []) {
          if (mod.children?.some(l => l.id === itemId)) {
            if (selectedIds.has(mod.id) || selectedIds.has(cat.id)) return true;
          }
        }
      }
    }
    return false;
  };

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(item => (
            <Badge
              key={item.id}
              variant="secondary"
              className="pl-2 pr-1 py-1 gap-1"
            >
              <span className="text-[10px] uppercase font-semibold text-muted-foreground mr-1">
                {getLevelLabel(item.level).slice(0, 3)}
              </span>
              <span className="text-xs">{item.name}</span>
              <button
                onClick={() => removeItem(item.id)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Breadcrumb nav */}
      {drillPath.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <button
            onClick={() => setDrillPath([])}
            className="hover:text-foreground transition-colors"
          >
            All
          </button>
          {breadcrumbParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <button
                onClick={() => setDrillPath(drillPath.slice(0, part.pathLength + 1))}
                className={cn(
                  "hover:text-foreground transition-colors",
                  i === breadcrumbParts.length - 1 && "text-foreground font-medium"
                )}
              >
                {part.label}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Item list */}
      <ScrollArea className="border rounded-md h-64">
        <div className="p-2 space-y-0.5">
          {drillPath.length > 0 && (
            <button
              onClick={() => setDrillPath(drillPath.slice(0, -1))}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}

          {currentItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No content available</p>
          )}

          {currentItems.map(item => {
            const hasChildren = (item.children?.length || 0) > 0;
            const isSelected = selectedIds.has(item.id);
            const parentCovered = currentLevel !== 'category' && isParentSelected(item.id, currentLevel as 'module' | 'lesson');

            // Build the selected item shape
            const getSelectedItem = (): SelectedItem => {
              const level = currentLevel as 'category' | 'module' | 'lesson';
              let breadcrumb: string | undefined;
              if (level === 'module') {
                const cat = tree.find(c => c.id === drillPath[0]);
                breadcrumb = cat?.name;
              } else if (level === 'lesson') {
                const cat = tree.find(c => c.id === drillPath[0]);
                const mod = cat?.children?.find(m => m.id === drillPath[1]);
                breadcrumb = `${cat?.name} / ${mod?.name}`;
              }
              return { id: item.id, level, name: item.name, breadcrumb };
            };

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md",
                  parentCovered && "opacity-50"
                )}
              >
                <Checkbox
                  checked={isSelected || parentCovered}
                  disabled={parentCovered}
                  onCheckedChange={() => toggleItem(getSelectedItem())}
                />
                {getLevelIcon(currentLevel)}
                <span className="text-sm flex-1 truncate">{item.name}</span>
                {parentCovered && (
                  <span className="text-[10px] text-muted-foreground">covered</span>
                )}
                {hasChildren && !parentCovered && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDrillPath([...drillPath, item.id]);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============ Adapter helpers: convert API tree shapes to generic ContentNode[] ============

/** Convert SP content tree (sp_categories → sp_modules → sp_lessons) to ContentNode[] */
export function spTreeToContentNodes(tree: any[]): ContentNode[] {
  return tree.map(cat => ({
    id: cat.id,
    name: cat.name,
    children: (cat.sp_modules || []).map((mod: any) => ({
      id: mod.id,
      name: mod.name,
      children: (mod.sp_lessons || []).map((lesson: any) => ({
        id: lesson.id,
        name: lesson.name,
      })),
    })),
  }));
}

/** Convert Agency Training content tree (training_categories → training_modules → training_lessons) to ContentNode[] */
export function trainingTreeToContentNodes(tree: any[]): ContentNode[] {
  return tree.map(cat => ({
    id: cat.id,
    name: cat.name,
    children: (cat.training_modules || []).map((mod: any) => ({
      id: mod.id,
      name: mod.name,
      children: (mod.training_lessons || []).map((lesson: any) => ({
        id: lesson.id,
        name: lesson.name,
      })),
    })),
  }));
}

/** Convert SelectedItem[] to SPAssignmentItem[] */
export function selectedToSPItems(items: SelectedItem[]): Array<{ sp_category_id?: string; sp_module_id?: string; sp_lesson_id?: string }> {
  return items.map(item => {
    if (item.level === 'category') return { sp_category_id: item.id };
    if (item.level === 'module') return { sp_module_id: item.id };
    return { sp_lesson_id: item.id };
  });
}

/** Convert SelectedItem[] to TrainingAssignmentItem[] */
export function selectedToTrainingItems(items: SelectedItem[]): Array<{ category_id?: string; module_id?: string; lesson_id?: string }> {
  return items.map(item => {
    if (item.level === 'category') return { category_id: item.id };
    if (item.level === 'module') return { module_id: item.id };
    return { lesson_id: item.id };
  });
}
