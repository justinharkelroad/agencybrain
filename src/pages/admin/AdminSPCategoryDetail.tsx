import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ArrowLeft,
  ChevronRight,
  Loader2,
  Package,
  BookOpen,
  Save,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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

interface SPCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  access_tiers: string[];
  is_published: boolean;
}

interface SPModule {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  image_url: string | null;
  display_order: number;
  is_published: boolean;
  lesson_count?: number;
}

const EMOJI_OPTIONS = ['📦', '🎯', '📚', '🚀', '⭐', '🔥', '💡', '📈', '🎓', '🏆', '📊', '🤝', '💪', '🧠'];

interface SortableModuleProps {
  module: SPModule;
  index: number;
  onTogglePublished: (module: SPModule) => void;
  onManageLessons: (id: string) => void;
  onEdit: (module: SPModule) => void;
  onDelete: (id: string) => void;
}

function SortableModule({ module, index, onTogglePublished, onManageLessons, onEdit, onDelete }: SortableModuleProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`transition-opacity ${!module.is_published ? 'opacity-60' : ''} ${isDragging ? 'shadow-lg ring-2 ring-primary' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="text-muted-foreground/40 cursor-grab active:cursor-grabbing hover:text-muted-foreground touch-none"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          {/* Module Number */}
          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-sm font-medium">
            {index + 1}
          </div>

          {/* Icon */}
          <div className="text-2xl">{module.icon || '📦'}</div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{module.name}</h3>
              {!module.is_published && (
                <Badge variant="outline" className="text-xs">Draft</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground/70 truncate">
              {module.lesson_count} lesson{module.lesson_count !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Switch
              checked={module.is_published}
              onCheckedChange={() => onTogglePublished(module)}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onManageLessons(module.id)}
            >
              <BookOpen className="h-4 w-4 mr-1" />
              Lessons
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(module)}
            >
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(module.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSPCategoryDetail() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [category, setCategory] = useState<SPCategory | null>(null);
  const [modules, setModules] = useState<SPModule[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Module dialog state
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<SPModule | null>(null);
  const [moduleName, setModuleName] = useState('');
  const [moduleSlug, setModuleSlug] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [moduleIcon, setModuleIcon] = useState('📦');
  const [moduleImageUrl, setModuleImageUrl] = useState('');
  const [uploadingModuleImage, setUploadingModuleImage] = useState(false);
  const [savingModule, setSavingModule] = useState(false);
  
  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (categoryId) {
      fetchData();
    }
  }, [categoryId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch category
      const { data: catData, error: catError } = await supabase
        .from('sp_categories')
        .select('*')
        .eq('id', categoryId)
        .single();

      if (catError) throw catError;
      setCategory(catData);

      // Fetch modules with lesson count
      const { data: modData, error: modError } = await supabase
        .from('sp_modules')
        .select(`
          *,
          sp_lessons(count)
        `)
        .eq('category_id', categoryId)
        .order('display_order', { ascending: true });

      if (modError) throw modError;

      const modulesWithCount = (modData || []).map(mod => ({
        ...mod,
        lesson_count: mod.sp_lessons?.[0]?.count || 0,
      }));

      setModules(modulesWithCount);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast({ title: 'Error loading category', variant: 'destructive' });
      navigate('/admin/standard-playbook');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const openModuleDialog = (module?: SPModule) => {
    if (module) {
      setEditingModule(module);
      setModuleName(module.name);
      setModuleSlug(module.slug);
      setModuleDescription(module.description || '');
      setModuleIcon(module.icon || '📦');
      setModuleImageUrl(module.image_url || '');
    } else {
      setEditingModule(null);
      setModuleName('');
      setModuleSlug('');
      setModuleDescription('');
      setModuleIcon('📦');
      setModuleImageUrl('');
    }
    setModuleDialogOpen(true);
  };

  const closeModuleDialog = () => {
    setModuleDialogOpen(false);
    setEditingModule(null);
    setModuleName('');
    setModuleSlug('');
    setModuleDescription('');
    setModuleIcon('📦');
    setModuleImageUrl('');
  };

  const handleModuleNameChange = (value: string) => {
    setModuleName(value);
    if (!editingModule) {
      setModuleSlug(generateSlug(value));
    }
  };

  const saveModule = async () => {
    if (!moduleName.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!moduleSlug.trim()) {
      toast({ title: 'Slug is required', variant: 'destructive' });
      return;
    }

    setSavingModule(true);
    try {
      // Strip cache-busting params before saving
      const cleanImageUrl = moduleImageUrl ? moduleImageUrl.split('?')[0] : null;
      const moduleData = {
        category_id: categoryId,
        name: moduleName.trim(),
        slug: moduleSlug.trim(),
        description: moduleDescription.trim() || null,
        icon: moduleIcon,
        image_url: cleanImageUrl,
      };

      if (editingModule) {
        const { error } = await supabase
          .from('sp_modules')
          .update(moduleData)
          .eq('id', editingModule.id);

        if (error) throw error;
        toast({ title: 'Module updated!' });
      } else {
        const { error } = await supabase
          .from('sp_modules')
          .insert({
            ...moduleData,
            display_order: modules.length,
          });

        if (error) {
          if (error.code === '23505') {
            toast({ title: 'A module with this slug already exists', variant: 'destructive' });
            return;
          }
          throw error;
        }
        toast({ title: 'Module created!' });
      }

      closeModuleDialog();
      fetchData();
    } catch (err) {
      console.error('Error saving module:', err);
      toast({ title: 'Error saving module', variant: 'destructive' });
    } finally {
      setSavingModule(false);
    }
  };

  const toggleModulePublished = async (module: SPModule) => {
    try {
      const newState = !module.is_published;
      const { error } = await supabase
        .from('sp_modules')
        .update({
          is_published: newState,
          published_at: newState ? new Date().toISOString() : null,
        })
        .eq('id', module.id);

      if (error) throw error;

      setModules(prev =>
        prev.map(m => m.id === module.id ? { ...m, is_published: newState } : m)
      );

      toast({ title: `Module ${newState ? 'published' : 'unpublished'}` });
    } catch (err) {
      console.error('Error toggling module:', err);
      toast({ title: 'Error updating module', variant: 'destructive' });
    }
  };

  const deleteModule = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('sp_modules')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      setModules(prev => prev.filter(m => m.id !== deleteId));
      toast({ title: 'Module deleted' });
    } catch (err) {
      console.error('Error deleting module:', err);
      toast({ title: 'Error deleting module', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const oldIndex = modules.findIndex(m => m.id === active.id);
    const newIndex = modules.findIndex(m => m.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update local state
    const newModules = arrayMove(modules, oldIndex, newIndex);
    setModules(newModules);

    // Persist new order to database
    try {
      const updates = newModules.map((mod, index) => ({
        id: mod.id,
        display_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('sp_modules')
          .update({ display_order: update.display_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({ title: 'Order saved' });
    } catch (err) {
      console.error('Error saving order:', err);
      toast({ title: 'Failed to save order', variant: 'destructive' });
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Category not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/standard-playbook')}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
          Back to Standard Playbook
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{category.icon}</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-medium">{category.name}</h1>
                {!category.is_published && (
                  <Badge variant="outline">Draft</Badge>
                )}
              </div>
              <p className="text-muted-foreground/70 mt-1">
                {category.description || 'No description'}
              </p>
            </div>
          </div>

          <Button onClick={() => openModuleDialog()}>
            <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
            New Module
          </Button>
        </div>
      </div>

      {/* Modules List */}
      {modules.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" strokeWidth={1} />
            <h3 className="font-medium mb-2">No modules yet</h3>
            <p className="text-sm text-muted-foreground/70 mb-4">
              Create your first module to start adding lessons.
            </p>
            <Button onClick={() => openModuleDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Module
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={modules.map(m => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {modules.map((module, index) => (
                <SortableModule
                  key={module.id}
                  module={module}
                  index={index}
                  onTogglePublished={toggleModulePublished}
                  onManageLessons={(id) => navigate(`/admin/standard-playbook/module/${id}`)}
                  onEdit={openModuleDialog}
                  onDelete={setDeleteId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingModule ? 'Edit Module' : 'New Module'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="moduleName">Name *</Label>
              <Input
                id="moduleName"
                value={moduleName}
                onChange={e => handleModuleNameChange(e.target.value)}
                placeholder="e.g., Getting Started"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="moduleSlug">Slug *</Label>
              <Input
                id="moduleSlug"
                value={moduleSlug}
                onChange={e => setModuleSlug(e.target.value)}
                placeholder="e.g., getting-started"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="moduleDesc">Description</Label>
              <Textarea
                id="moduleDesc"
                value={moduleDescription}
                onChange={e => setModuleDescription(e.target.value)}
                placeholder="Brief description of this module"
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setModuleIcon(emoji)}
                    className={`w-9 h-9 text-lg rounded-lg border transition-all ${
                      moduleIcon === emoji
                        ? 'border-primary bg-primary/10'
                        : 'border-border/50 hover:border-border'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Cover Image */}
            <div>
              <Label>Cover Image</Label>
              <p className="text-xs text-muted-foreground/70 mb-2">Recommended: 1200×400px (3:1)</p>
              {moduleImageUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-border/50">
                  <img
                    src={moduleImageUrl}
                    alt="Module cover"
                    className="w-full aspect-[3/1] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setModuleImageUrl('')}
                    className="absolute top-2 right-2 bg-background/80 backdrop-blur rounded-md px-2 py-1 text-xs hover:bg-background"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => document.getElementById('moduleImageInput')?.click()}
                  className="w-full aspect-[3/1] rounded-lg border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-2 text-muted-foreground/50 hover:border-border hover:text-muted-foreground transition-colors"
                >
                  {uploadingModuleImage ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <Package className="h-6 w-6" />
                      <span className="text-sm">Upload cover image</span>
                    </>
                  )}
                </button>
              )}
              <input
                id="moduleImageInput"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setUploadingModuleImage(true);
                  try {
                    const ext = file.name.split('.').pop() || 'png';
                    const id = editingModule?.id || crypto.randomUUID();
                    const path = `module-images/${id}.${ext}`;

                    const { error: uploadError } = await supabase.storage
                      .from('training-assets')
                      .upload(path, file, { upsert: true });

                    if (uploadError) throw uploadError;

                    const { data: publicUrlData } = supabase.storage
                      .from('training-assets')
                      .getPublicUrl(path);

                    setModuleImageUrl(`${publicUrlData.publicUrl}?t=${Date.now()}`);
                    toast({ title: 'Image uploaded' });
                  } catch (err) {
                    console.error('Image upload error:', err);
                    toast({ title: 'Failed to upload image', variant: 'destructive' });
                  } finally {
                    setUploadingModuleImage(false);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeModuleDialog}>
              Cancel
            </Button>
            <Button onClick={saveModule} disabled={savingModule}>
              {savingModule ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {savingModule ? 'Saving...' : 'Save Module'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this module?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the module and all its lessons.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteModule}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Module'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
