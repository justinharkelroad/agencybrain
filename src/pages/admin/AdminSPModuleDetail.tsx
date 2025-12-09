import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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

export default function AdminSPModuleDetail() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [module, setModule] = useState<SPModule | null>(null);
  const [lessons, setLessons] = useState<SPLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (moduleId) {
      fetchData();
    }
  }, [moduleId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch module with category
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

      // Fetch lessons
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
        <div className="space-y-3">
          {lessons.map((lesson, index) => (
            <Card
              key={lesson.id}
              className={`transition-opacity ${!lesson.is_published ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Drag Handle */}
                  <div className="text-muted-foreground/40 cursor-grab">
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
                      onCheckedChange={() => toggleLessonPublished(lesson)}
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/standard-playbook/lesson/${lesson.id}`)}
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.5} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(lesson.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
    </div>
  );
}
