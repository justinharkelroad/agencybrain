import { useMemo, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSalesExperienceAccess } from '@/hooks/useSalesExperienceAccess';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { VideoEmbed, dayLabels, pillarColors, pillarLabels, type Pillar } from '@/components/sales-experience';
import {
  Loader2,
  ArrowLeft,
  Video,
  FileText,
  MessageSquare,
  CheckCircle2,
  Circle,
  Play,
  ChevronRight,
  BookOpen,
  Download,
  ExternalLink,
} from 'lucide-react';

interface Module {
  id: string;
  week_number: number;
  title: string;
  description: string;
  pillar: Pillar;
}

interface LessonDocument {
  id: string;
  name: string;
  url: string;
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
  documents_json: LessonDocument[] | null;
}

interface OwnerProgress {
  id: string;
  assignment_id: string;
  user_id: string;
  lesson_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  video_watched_seconds: number;
  video_completed: boolean;
}

export default function SalesExperienceWeek() {
  const { week } = useParams<{ week: string }>();
  const weekNumber = parseInt(week || '1', 10);
  const { hasAccess, assignment, currentWeek, isLoading: accessLoading } = useSalesExperienceAccess();
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch module for this week
  const { data: module, isLoading: moduleLoading } = useQuery({
    queryKey: ['sales-experience-module', weekNumber],
    enabled: hasAccess && !isNaN(weekNumber),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_modules')
        .select('*')
        .eq('week_number', weekNumber)
        .single();

      if (error) throw error;
      return data as Module;
    },
  });

  // Fetch lessons for this week
  const { data: lessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['sales-experience-lessons', weekNumber],
    enabled: hasAccess && !!module?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_lessons')
        .select('*')
        .eq('module_id', module!.id)
        .order('day_of_week', { ascending: true });

      if (error) throw error;
      return data as Lesson[];
    },
  });

  // Fetch owner progress for this week's lessons
  const { data: progressRecords } = useQuery({
    queryKey: ['sales-experience-owner-progress', assignment?.id, weekNumber],
    enabled: hasAccess && !!assignment?.id && !!lessons?.length,
    queryFn: async () => {
      const lessonIds = lessons!.map((l) => l.id);
      const { data, error } = await supabase
        .from('sales_experience_owner_progress')
        .select('*')
        .eq('assignment_id', assignment!.id)
        .in('lesson_id', lessonIds);

      if (error) throw error;
      return data as OwnerProgress[];
    },
  });

  // Create a map of lesson progress
  const progressMap = useMemo(() => {
    const map = new Map<string, OwnerProgress>();
    progressRecords?.forEach((p) => map.set(p.lesson_id, p));
    return map;
  }, [progressRecords]);

  // Mutation for updating lesson progress
  const progressMutation = useMutation({
    mutationFn: async ({ lessonId, action }: { lessonId: string; action: 'start' | 'complete' }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-sales-lesson`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ lesson_id: lessonId, action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update progress');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-experience-owner-progress'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mark lesson as started when modal opens
  const handleOpenLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    const progress = progressMap.get(lesson.id);
    if (!progress || progress.status === 'not_started') {
      progressMutation.mutate({ lessonId: lesson.id, action: 'start' });
    }
  };

  // Mark lesson as completed
  const handleCompleteLesson = () => {
    if (!selectedLesson) return;
    progressMutation.mutate(
      { lessonId: selectedLesson.id, action: 'complete' },
      {
        onSuccess: () => {
          toast({
            title: 'Lesson completed',
            description: 'Your progress has been saved.',
          });
        },
      }
    );
  };

  const isWeekUnlocked = currentWeek >= weekNumber;

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isWeekUnlocked) {
    return <Navigate to="/sales-experience" replace />;
  }

  const isLoading = moduleLoading || lessonsLoading;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Back Link */}
      <Link
        to="/sales-experience"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Overview
      </Link>

      {/* Header */}
      {isLoading ? (
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
      ) : module ? (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Badge
              variant="outline"
              className={`${pillarColors[module.pillar]} bg-opacity-10`}
            >
              {pillarLabels[module.pillar]}
            </Badge>
            {currentWeek === weekNumber && (
              <Badge className="bg-primary text-primary-foreground">
                Current Week
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Week {weekNumber}: {module.title}
          </h1>
          <p className="text-muted-foreground">{module.description}</p>
        </div>
      ) : null}

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link to={`/sales-experience/week/${weekNumber}/documents`}>
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </Button>
        </Link>
        <Link to={`/sales-experience/week/${weekNumber}/transcript`}>
          <Button variant="outline" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Transcript
          </Button>
        </Link>
      </div>

      {/* Lessons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Lesson Materials
          </CardTitle>
          <CardDescription>
            3 lessons per week: Monday, Wednesday, Friday
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : lessons && lessons.length > 0 ? (
            <div className="space-y-4">
              {lessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  weekNumber={weekNumber}
                  progress={progressMap.get(lesson.id)}
                  onView={() => handleOpenLesson(lesson)}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No lessons available for this week yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        {weekNumber > 1 && (
          <Link to={`/sales-experience/week/${weekNumber - 1}`}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Week {weekNumber - 1}
            </Button>
          </Link>
        )}
        <div className="flex-1" />
        {weekNumber < 8 && currentWeek > weekNumber && (
          <Link to={`/sales-experience/week/${weekNumber + 1}`}>
            <Button variant="outline" className="gap-2">
              Week {weekNumber + 1}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {/* Lesson Detail Dialog */}
      <Dialog open={!!selectedLesson} onOpenChange={(open) => !open && setSelectedLesson(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline">{dayLabels[selectedLesson?.day_of_week || 1]}</Badge>
              {selectedLesson?.title}
              {selectedLesson && progressMap.get(selectedLesson.id)?.status === 'completed' && (
                <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto" />
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-160px)]">
            <div className="p-6 pt-4 space-y-6">
              {/* Video */}
              {selectedLesson?.video_url && (
                <VideoEmbed
                  url={selectedLesson.video_url}
                  platform={selectedLesson.video_platform}
                />
              )}

              {/* Content */}
              {selectedLesson?.content_html && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Lesson Content
                  </h3>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedLesson.content_html }}
                  />
                </div>
              )}

              {/* Documents */}
              {selectedLesson?.documents_json && selectedLesson.documents_json.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Downloadable Resources
                  </h3>
                  <div className="space-y-2">
                    {selectedLesson.documents_json.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{doc.url}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* No content message */}
              {!selectedLesson?.video_url && !selectedLesson?.content_html && (!selectedLesson?.documents_json || selectedLesson.documents_json.length === 0) && (
                <p className="text-muted-foreground text-center py-8">
                  No content available for this lesson yet.
                </p>
              )}
            </div>
          </ScrollArea>

          {/* Footer with Mark Complete button */}
          {selectedLesson && (
            <div className="p-6 pt-0 border-t bg-background">
              <div className="flex items-center justify-between pt-4">
                {progressMap.get(selectedLesson.id)?.status === 'completed' ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Completed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Circle className="h-5 w-5" />
                    <span>Not yet completed</span>
                  </div>
                )}
                <Button
                  onClick={handleCompleteLesson}
                  disabled={
                    progressMutation.isPending ||
                    progressMap.get(selectedLesson.id)?.status === 'completed'
                  }
                  className="gap-2"
                >
                  {progressMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {progressMap.get(selectedLesson.id)?.status === 'completed'
                    ? 'Completed'
                    : 'Mark as Complete'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface LessonCardProps {
  lesson: Lesson;
  weekNumber: number;
  progress?: OwnerProgress;
  onView: () => void;
}

function LessonCard({ lesson, weekNumber, progress, onView }: LessonCardProps) {
  const hasVideo = !!lesson.video_url;
  const hasDocuments = lesson.documents_json && lesson.documents_json.length > 0;
  const isCompleted = progress?.status === 'completed';
  const isInProgress = progress?.status === 'in_progress';

  return (
    <Card className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={onView}>
      <CardContent className="flex items-start gap-4 p-4">
        {/* Day indicator */}
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center text-primary">
          <span className="text-xs font-medium">
            {dayLabels[lesson.day_of_week]?.slice(0, 3)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{lesson.title}</h4>
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : isInProgress ? (
              <Circle className="h-4 w-4 text-amber-500" />
            ) : null}
          </div>
          {lesson.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {lesson.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2">
            {hasVideo && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Video className="h-3 w-3" />
                Video
              </span>
            )}
            {hasDocuments && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {lesson.documents_json!.length} Doc{lesson.documents_json!.length > 1 ? 's' : ''}
              </span>
            )}
            {lesson.is_staff_visible && (
              <Badge variant="outline" className="text-xs">
                Staff Training
              </Badge>
            )}
          </div>
        </div>

        {/* Action */}
        {hasVideo ? (
          <Button size="sm" className="gap-2" onClick={(e) => { e.stopPropagation(); onView(); }}>
            <Play className="h-4 w-4" />
            Watch
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onView(); }}>
            View
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
