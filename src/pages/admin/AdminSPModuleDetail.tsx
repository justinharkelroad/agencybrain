import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ArrowLeft,
  Loader2,
  FileText,
  Video,
  FileDown,
  HelpCircle,
  Clock,
  Share2,
  Eye,
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
import { useToast } from '@/hooks/use-toast';
import { ExchangeShareModal } from '@/components/exchange/ExchangeShareModal';
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

interface SPModule {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  icon: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface SPLesson {
  id: string;
  module_id: string;
  name: string;
  slug: string;
  description: string | null;
  video_url: string | null;
  content_html: string | null;
  document_url: string | null;
  has_quiz: boolean;
  estimated_minutes: number;
  display_order: number;
  is_published: boolean;
}

interface SortableLessonProps {
  lesson: SPLesson;
  index: number;
  moduleSlug: string | undefined;
  categorySlug: string | undefined;
  onTogglePublished: (lesson: SPLesson) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onShare: (lesson: SPLesson) => void;
  onPreview: (lesson: SPLesson) => void;
}

function SortableLesson({ lesson, index, moduleSlug, categorySlug, onTogglePublished, onEdit, onDelete, onShare, onPreview }: SortableLessonProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`transition-opacity ${!lesson.is_published ? 'opacity-60' : ''} ${isDragging ? 'shadow-lg ring-2 ring-primary' : ''}`}
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

          {/* Lesson Number */}
          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-sm font-medium">
            {index + 1}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{lesson.name}</h3>
              {!lesson.is_published && (
                <Badge variant="outline" className="text-xs">Draft</Badge>
              )}
            </div>
            
            {/* Content indicators */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
              {lesson.video_url && (
                <span className="flex items-center gap-1">
                  <Video className="h-3 w-3" /> Video
                </span>
              )}
              {lesson.content_html && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Content
                </span>
              )}
              {lesson.document_url && (
                <span className="flex items-center gap-1">
                  <FileDown className="h-3 w-3" /> Document
                </span>
              )}
              {lesson.has_quiz && (
                <span className="flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" /> Quiz
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {lesson.estimated_minutes} min
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Switch
              checked={lesson.is_published}
              onCheckedChange={() => onTogglePublished(lesson)}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onPreview(lesson)}
                >
                  <Eye className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preview Lesson</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onShare(lesson)}
                >
                  <Share2 className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share to The Exchange</TooltipContent>
            </Tooltip>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(lesson.id)}
            >
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(lesson.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSPModuleDetail() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [module, setModule] = useState<SPModule | null>(null);
  const [lessons, setLessons] = useState<SPLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLesson, setShareLesson] = useState<SPLesson | null>(null);

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
    if (moduleId) {
      fetchData();
    }
  }, [moduleId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: modData, error: modError } = await supabase
        .from('sp_modules')
        .select(`
          *,
          category:sp_categories(id, name, slug)
        `)
        .eq('id', moduleId)
        .single();

      if (modError) throw modError;
      setModule(modData);

      const { data: lessonData, error: lessonError } = await supabase
        .from('sp_lessons')
        .select('*')
        .eq('module_id', moduleId)
        .order('display_order', { ascending: true });

      if (lessonError) throw lessonError;
      setLessons(lessonData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast({ title: 'Error loading module', variant: 'destructive' });
      navigate('/admin/standard-playbook');
    } finally {
      setLoading(false);
    }
  };

  const toggleLessonPublished = async (lesson: SPLesson) => {
    try {
      const newState = !lesson.is_published;
      const { error } = await supabase
        .from('sp_lessons')
        .update({
          is_published: newState,
          published_at: newState ? new Date().toISOString() : null,
        })
        .eq('id', lesson.id);

      if (error) throw error;

      setLessons(prev =>
        prev.map(l => l.id === lesson.id ? { ...l, is_published: newState } : l)
      );

      toast({ title: `Lesson ${newState ? 'published' : 'unpublished'}` });
    } catch (err) {
      console.error('Error toggling lesson:', err);
      toast({ title: 'Error updating lesson', variant: 'destructive' });
    }
  };

  const deleteLesson = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('sp_lessons')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      setLessons(prev => prev.filter(l => l.id !== deleteId));
      toast({ title: 'Lesson deleted' });
    } catch (err) {
      console.error('Error deleting lesson:', err);
      toast({ title: 'Error deleting lesson', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = lessons.findIndex(l => l.id === active.id);
    const newIndex = lessons.findIndex(l => l.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newLessons = arrayMove(lessons, oldIndex, newIndex);
    setLessons(newLessons);

    try {
      const updates = newLessons.map((lesson, index) => ({
        id: lesson.id,
        display_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('sp_lessons')
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

  if (!module) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Module not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate(`/admin/standard-playbook/category/${module.category_id}`)}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
          Back to {module.category?.name || 'Category'}
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{module.icon}</div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {module.category?.name}
              </p>
              <h1 className="text-2xl font-medium">{module.name}</h1>
            </div>
          </div>

          <Button onClick={() => navigate(`/admin/standard-playbook/lesson/new?moduleId=${moduleId}`)}>
            <Plus className="h-4 w-4 mr-2" strokeWidth={1.5} />
            New Lesson
          </Button>
        </div>
      </div>

      {/* Lessons List */}
      {lessons.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" strokeWidth={1} />
            <h3 className="font-medium mb-2">No lessons yet</h3>
            <p className="text-sm text-muted-foreground/70 mb-4">
              Create your first lesson with video, content, and quiz.
            </p>
            <Button onClick={() => navigate(`/admin/standard-playbook/lesson/new?moduleId=${moduleId}`)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Lesson
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
            items={lessons.map(l => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {lessons.map((lesson, index) => (
                <SortableLesson
                  key={lesson.id}
                  lesson={lesson}
                  index={index}
                  moduleSlug={module.slug}
                  categorySlug={module.category?.slug}
                  onTogglePublished={toggleLessonPublished}
                  onEdit={(id) => navigate(`/admin/standard-playbook/lesson/${id}`)}
                  onDelete={setDeleteId}
                  onShare={(l) => {
                    setShareLesson(l);
                    setShareModalOpen(true);
                  }}
                  onPreview={(l) => navigate(`/training/standard/${module.category?.slug}/${module.slug}/${l.slug}`)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the lesson and its quiz.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteLesson}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Lesson'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share to Exchange Modal */}
      {shareLesson && module && (
        <ExchangeShareModal
          open={shareModalOpen}
          onOpenChange={(open) => {
            setShareModalOpen(open);
            if (!open) setShareLesson(null);
          }}
          contentType="training_module"
          sourceReference={{
            type: 'sp_lesson',
            id: shareLesson.id,
            title: shareLesson.name,
            path: `/training/standard/${module.category?.slug}/${module.slug}/${shareLesson.slug}`,
          }}
          filePath={shareLesson.document_url || undefined}
          fileName={shareLesson.document_url ? `${shareLesson.name}.pdf` : undefined}
        />
      )}
    </div>
  );
}
