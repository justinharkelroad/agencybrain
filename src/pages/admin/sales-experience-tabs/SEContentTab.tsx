import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2,
  Plus,
  Video,
  FileText,
  Edit,
  Save,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';

interface Module {
  id: string;
  week_number: number;
  title: string;
  description: string | null;
  pillar: string;
  icon: string | null;
}

interface Lesson {
  id: string;
  module_id: string;
  day_of_week: number;
  title: string;
  description: string | null;
  video_url: string | null;
  video_platform: string | null;
  content_html: string | null;
  is_staff_visible: boolean;
  quiz_questions: any[];
}

const dayLabels: Record<number, string> = {
  1: 'Monday',
  3: 'Wednesday',
  5: 'Friday',
};

const pillarLabels: Record<string, string> = {
  sales_process: 'Sales Process',
  accountability: 'Accountability',
  coaching_cadence: 'Coaching Cadence',
};

const pillarColors: Record<string, string> = {
  sales_process: 'bg-blue-500',
  accountability: 'bg-amber-500',
  coaching_cadence: 'bg-green-500',
};

export function SEContentTab() {
  const queryClient = useQueryClient();
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch modules
  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ['admin-se-modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_modules')
        .select('*')
        .order('week_number', { ascending: true });

      if (error) throw error;
      return data as Module[];
    },
  });

  // Fetch lessons
  const { data: lessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['admin-se-lessons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_lessons')
        .select('*')
        .order('day_of_week', { ascending: true });

      if (error) throw error;
      return data as Lesson[];
    },
  });

  // Update lesson mutation
  const updateLesson = useMutation({
    mutationFn: async (lesson: Partial<Lesson> & { id: string }) => {
      const { id, ...updates } = lesson;
      const { error } = await supabase
        .from('sales_experience_lessons')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-se-lessons'] });
      setIsEditDialogOpen(false);
      setEditingLesson(null);
      toast.success('Lesson updated successfully');
    },
    onError: (error) => {
      console.error('Error updating lesson:', error);
      toast.error('Failed to update lesson');
    },
  });

  const handleEditLesson = (lesson: Lesson) => {
    setEditingLesson({ ...lesson });
    setIsEditDialogOpen(true);
  };

  const handleSaveLesson = () => {
    if (!editingLesson) return;
    updateLesson.mutate(editingLesson);
  };

  // Group lessons by module
  const lessonsByModule = lessons?.reduce((acc, lesson) => {
    if (!acc[lesson.module_id]) {
      acc[lesson.module_id] = [];
    }
    acc[lesson.module_id].push(lesson);
    return acc;
  }, {} as Record<string, Lesson[]>);

  if (modulesLoading || lessonsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Content Management</h2>
        <p className="text-sm text-muted-foreground">
          Edit lesson content, videos, and quiz questions
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        {modules?.map((module) => (
          <AccordionItem key={module.id} value={module.id} className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-4">
                <div className={`h-2 w-2 rounded-full ${pillarColors[module.pillar]}`} />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Week {module.week_number}:</span>
                    <span>{module.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {pillarLabels[module.pillar]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{module.description}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 mt-2">
                {lessonsByModule?.[module.id]?.map((lesson) => (
                  <Card key={lesson.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center text-primary">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{lesson.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {dayLabels[lesson.day_of_week]}
                          </Badge>
                          {lesson.video_url && (
                            <Badge variant="secondary" className="text-xs">
                              <Video className="h-3 w-3 mr-1" />
                              Video
                            </Badge>
                          )}
                          {lesson.is_staff_visible && (
                            <Badge variant="secondary" className="text-xs">
                              Staff
                            </Badge>
                          )}
                        </div>
                        {lesson.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {lesson.description}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => handleEditLesson(lesson)}
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Edit Lesson Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
            <DialogDescription>
              Update lesson content, video, and settings
            </DialogDescription>
          </DialogHeader>
          {editingLesson && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editingLesson.title}
                  onChange={(e) =>
                    setEditingLesson({ ...editingLesson, title: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingLesson.description || ''}
                  onChange={(e) =>
                    setEditingLesson({ ...editingLesson, description: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Video URL</Label>
                  <Input
                    value={editingLesson.video_url || ''}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, video_url: e.target.value })
                    }
                    placeholder="https://vimeo.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Video Platform</Label>
                  <Input
                    value={editingLesson.video_platform || ''}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, video_platform: e.target.value })
                    }
                    placeholder="vimeo, youtube, etc."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Content (HTML)</Label>
                <Textarea
                  value={editingLesson.content_html || ''}
                  onChange={(e) =>
                    setEditingLesson({ ...editingLesson, content_html: e.target.value })
                  }
                  rows={8}
                  className="font-mono text-sm"
                  placeholder="<p>Lesson content...</p>"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Visible to Staff</Label>
                  <p className="text-sm text-muted-foreground">
                    Staff will see this lesson in their training portal
                  </p>
                </div>
                <Switch
                  checked={editingLesson.is_staff_visible}
                  onCheckedChange={(checked) =>
                    setEditingLesson({ ...editingLesson, is_staff_visible: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveLesson}
              disabled={updateLesson.isPending}
              className="gap-2"
            >
              {updateLesson.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
