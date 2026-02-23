import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useStaffTrainingContent } from '@/hooks/useStaffTrainingContent';
import { useStaffTrainingProgress } from '@/hooks/useStaffTrainingProgress';
import { useUpdateTrainingProgress } from '@/hooks/useUpdateTrainingProgress';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { VideoEmbed } from '@/components/training/VideoEmbed';
import { QuizTaker } from '@/components/training/QuizTaker';
import { StaffTrainingComments } from '@/components/training/StaffTrainingComments';
import { getTrainingGradient } from '@/utils/categoryStyles';
import {
  BookOpen, CheckCircle, Circle, Video, FileText, Download,
  ClipboardList, AlertCircle, ChevronRight, ArrowLeft, Play,
  CheckCircle2, Clock, Flame,
} from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, isPast } from 'date-fns';
import { useQuery } from '@tanstack/react-query';

export default function StaffTraining() {
  const queryClient = useQueryClient();

  const { user: supabaseUser } = useAuth();
  const { user: staffUser, sessionToken } = useStaffAuth();

  const { data: adminProfile } = useQuery({
    queryKey: ['admin-profile-agency', supabaseUser?.id],
    queryFn: async () => {
      if (!supabaseUser?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', supabaseUser.id)
        .single();
      return data;
    },
    enabled: !!supabaseUser?.id
  });

  const effectiveAgencyId = adminProfile?.agency_id || staffUser?.agency_id;
  const isStaffUser = !!staffUser && !!sessionToken;

  const { data: contentData, isLoading: contentLoading } = useStaffTrainingContent(effectiveAgencyId);
  const { data: progressData, isLoading: progressLoading } = useStaffTrainingProgress();
  const updateProgress = useUpdateTrainingProgress();

  // Navigation state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<{
    id: string;
    title: string;
    content: string | null;
    video_url: string | null;
    thumbnail_url: string | null;
  } | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);

  const categories = contentData?.categories || [];

  // Computed selections
  const selectedCategory = useMemo(
    () => categories.find(c => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );
  const selectedModule = useMemo(
    () => selectedCategory?.modules.find(m => m.id === selectedModuleId) || null,
    [selectedCategory, selectedModuleId]
  );

  // Progress helpers
  const completedSet = useMemo(() => {
    const set = new Set<string>();
    progressData?.progress?.forEach(p => { if (p.completed) set.add(p.lesson_id); });
    return set;
  }, [progressData]);

  const isCompleted = (lessonId: string) => completedSet.has(lessonId);

  const totalLessons = useMemo(() =>
    categories.reduce((total, cat) =>
      total + cat.modules.reduce((mt, mod) => mt + mod.lessons.length, 0), 0
    ), [categories]);

  // Count only completed lessons that are actually in visible content (not deactivated modules)
  const completedLessons = useMemo(() => {
    let count = 0;
    categories.forEach(cat => {
      cat.modules.forEach(mod => {
        mod.lessons.forEach(l => { if (completedSet.has(l.id)) count++; });
      });
    });
    return count;
  }, [categories, completedSet]);
  const overallPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Day streak: walk backward from today through unique completion dates
  const dayStreak = useMemo(() => {
    const completionDates = progressData?.progress
      ?.filter(p => p.completed && p.completed_at)
      .map(p => new Date(p.completed_at!).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (!completionDates || completionDates.length === 0) return 0;

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (completionDates[0] !== today && completionDates[0] !== yesterday) return 0;

    let streak = 1;
    let checkDate = new Date(completionDates[0]);
    for (let i = 1; i < completionDates.length; i++) {
      checkDate = new Date(checkDate.getTime() - 86400000);
      if (completionDates[i] === checkDate.toDateString()) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [progressData]);

  // Per-category/module progress
  const getCategoryProgress = (cat: typeof categories[0]) => {
    let total = 0, done = 0;
    cat.modules.forEach(mod => {
      mod.lessons.forEach(l => { total++; if (completedSet.has(l.id)) done++; });
    });
    return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  const getModuleProgress = (mod: typeof categories[0]['modules'][0]) => {
    let total = 0, done = 0;
    mod.lessons.forEach(l => { total++; if (completedSet.has(l.id)) done++; });
    return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  // Find next incomplete lesson for "Continue Learning" card
  const nextLesson = useMemo(() => {
    for (const cat of categories) {
      for (const mod of cat.modules) {
        for (let i = 0; i < mod.lessons.length; i++) {
          const lesson = mod.lessons[i];
          if (!completedSet.has(lesson.id)) {
            const modProg = getModuleProgress(mod);
            return {
              lesson,
              module: mod,
              category: cat,
              lessonIndex: i + 1,
              lessonTotal: mod.lessons.length,
              modulePercent: modProg.percent,
              moduleDone: modProg.done,
              moduleTotal: modProg.total,
            };
          }
        }
      }
    }
    return null;
  }, [categories, completedSet]);

  const handleResumeLearning = () => {
    if (!nextLesson) return;
    setSelectedCategoryId(nextLesson.category.id);
    setSelectedModuleId(nextLesson.module.id);
    setSelectedLesson(nextLesson.lesson);
    setActiveQuiz(null);
  };

  // Attachments & quizzes for selected lesson
  const attachments = selectedLesson?.id ? (contentData?.attachmentsByLesson?.[selectedLesson.id] || []) : [];
  const quizzes = selectedLesson?.id ? (contentData?.quizzesByLesson?.[selectedLesson.id] || []) : [];

  // Handlers
  const handleToggleComplete = (lessonId: string) => {
    const currentStatus = isCompleted(lessonId);
    updateProgress.mutate({ lessonId, completed: !currentStatus });
  };

  const handleDownloadAttachment = async (attachment: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('get_training_attachment_url', {
        body: {
          session_token: sessionToken,
          attachment_id: attachment.id
        }
      });
      if (error) throw error;
      if (data?.url) {
        const response = await fetch(data.url);
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = data.name || attachment.name || 'download.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        toast.success('Download started');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file. Try disabling ad blocker.');
    }
  };

  const handleQuizComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['staff-training-progress'] });
    setActiveQuiz(null);
    toast.success('Quiz completed! Lesson marked as complete.');
  };

  const handleSelectModule = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    // Auto-select first incomplete lesson
    const mod = selectedCategory?.modules.find(m => m.id === moduleId);
    if (mod) {
      const firstIncomplete = mod.lessons.find(l => !completedSet.has(l.id));
      setSelectedLesson(firstIncomplete || mod.lessons[0] || null);
    }
  };

  const handleBack = () => {
    if (selectedModuleId) {
      setSelectedModuleId(null);
      setSelectedLesson(null);
      setActiveQuiz(null);
    } else if (selectedCategoryId) {
      setSelectedCategoryId(null);
    }
  };

  const getDueDateBadge = (dueDate: string | null | undefined) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const daysUntilDue = differenceInDays(due, new Date());
    if (isPast(due)) {
      const daysOverdue = Math.abs(daysUntilDue);
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          Overdue {daysOverdue}d
        </Badge>
      );
    }
    if (daysUntilDue <= 3) {
      return <Badge variant="destructive" className="text-xs">Due in {daysUntilDue}d</Badge>;
    }
    if (daysUntilDue <= 7) {
      return <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">Due in {daysUntilDue}d</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Due in {daysUntilDue}d</Badge>;
  };

  // Loading
  if (contentLoading || progressLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  // No assignments
  if (contentData?.no_assignments) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center text-center py-12">
          <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No training assigned yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Your administrator will assign training modules to you.
          </p>
        </div>
      </div>
    );
  }

  // ─── Breadcrumb (rendered as JSX variable to avoid remount) ───
  const breadcrumb = (
    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4 flex-wrap">
      <button
        onClick={() => { setSelectedCategoryId(null); setSelectedModuleId(null); setSelectedLesson(null); setActiveQuiz(null); }}
        className="hover:text-foreground transition-colors"
      >
        All Categories
      </button>
      {selectedCategory && (
        <>
          <ChevronRight className="h-3 w-3" />
          <button
            onClick={() => { setSelectedModuleId(null); setSelectedLesson(null); setActiveQuiz(null); }}
            className={selectedModuleId ? 'hover:text-foreground transition-colors' : 'text-foreground font-medium'}
          >
            {selectedCategory.name}
          </button>
        </>
      )}
      {selectedModule && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{selectedModule.title}</span>
        </>
      )}
    </div>
  );

  // ─── Level 0: Category Cards ───
  if (!selectedCategoryId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-medium flex items-center gap-2">
            <BookOpen className="h-6 w-6" strokeWidth={1.5} />
            Agency Training
          </h1>
        </div>

        {/* Stats Card */}
        {totalLessons > 0 && (
          <Card className="mb-6">
            <CardContent className="p-0">
              <div className="flex items-stretch divide-x divide-border/50">
                {/* Progress Ring */}
                <div className="flex items-center justify-center p-6 min-w-[140px]">
                  <div className="relative">
                    <svg width="80" height="80" className="transform -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-muted/30"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 32}
                        strokeDashoffset={2 * Math.PI * 32 * (1 - (completedLessons / Math.max(totalLessons, 1)))}
                        className="text-primary transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold">{overallPercent}%</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex-1 p-6 flex items-center justify-around">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-2xl font-bold">{completedLessons}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <span className="text-2xl font-bold">{totalLessons - completedLessons}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Flame className="h-5 w-5 text-orange-500" />
                      <span className="text-2xl font-bold">{dayStreak}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Day Streak</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Continue Learning Hero */}
        {nextLesson && completedLessons > 0 && (
          <Card
            className="mb-6 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            onClick={handleResumeLearning}
          >
            <div className="flex flex-col sm:flex-row">
              {/* Cover image / gradient - left side */}
              <div className="sm:w-48 sm:min-h-full flex-shrink-0">
                {nextLesson.module.thumbnail_url ? (
                  <img
                    src={nextLesson.module.thumbnail_url}
                    alt={nextLesson.module.title}
                    className="w-full h-32 sm:h-full object-cover"
                  />
                ) : (
                  <div className={`w-full h-32 sm:h-full ${getTrainingGradient(nextLesson.module.title)} flex items-center justify-center`}>
                    <Play className="h-10 w-10 text-white/80" fill="currentColor" />
                  </div>
                )}
              </div>

              {/* Content - right side */}
              <CardContent className="flex-1 p-5 flex flex-col justify-center">
                <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">Continue Learning</p>
                <h3 className="font-semibold text-lg mb-1 line-clamp-1">{nextLesson.lesson.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {nextLesson.category.name} &middot; {nextLesson.module.title} &middot; Lesson {nextLesson.lessonIndex} of {nextLesson.lessonTotal}
                </p>
                <div className="flex items-center gap-3">
                  <Progress value={nextLesson.modulePercent} className="flex-1 h-2 max-w-xs" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {nextLesson.moduleDone}/{nextLesson.moduleTotal} complete
                  </span>
                  <Button size="sm" className="ml-auto">
                    Resume <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </div>
          </Card>
        )}

        {categories.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" strokeWidth={1} />
              <h3 className="font-medium mb-2">No training content available</h3>
              <p className="text-sm text-muted-foreground/70">
                Training categories will appear here when created.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map(category => {
              const prog = getCategoryProgress(category);
              return (
                <Card
                  key={category.id}
                  className="cursor-pointer hover:bg-accent/5 transition-colors border border-border overflow-hidden"
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  {category.cover_image_url ? (
                    <img
                      src={category.cover_image_url}
                      alt={category.name}
                      className="w-full aspect-[3/1] object-cover"
                    />
                  ) : (
                    <div className={`w-full aspect-[3/1] ${getTrainingGradient(category.name)} flex items-center justify-center`}>
                      <BookOpen className="h-10 w-10 text-white/80" strokeWidth={1.5} />
                    </div>
                  )}
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium mb-1">{category.name}</h3>
                        {category.description && (
                          <p className="text-sm text-muted-foreground/70 line-clamp-2 mb-3">
                            {category.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3">
                          <Progress value={prog.percent} className="flex-1 h-2" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {prog.done}/{prog.total} lessons
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Level 1: Module Cards ───
  if (selectedCategoryId && !selectedModuleId) {
    const modules = selectedCategory?.modules || [];
    return (
      <div className="p-6 max-w-5xl mx-auto">
        {breadcrumb}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={handleBack} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-medium">{selectedCategory?.name}</h2>
            {selectedCategory?.description && (
              <p className="text-sm text-muted-foreground mt-1">{selectedCategory.description}</p>
            )}
          </div>
        </div>

        {modules.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" strokeWidth={1} />
              <h3 className="font-medium mb-2">No modules yet</h3>
              <p className="text-sm text-muted-foreground/70">
                Modules will appear here when added.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map(mod => {
              const prog = getModuleProgress(mod);
              return (
                <Card
                  key={mod.id}
                  className="cursor-pointer hover:bg-accent/5 transition-colors border border-border overflow-hidden"
                  onClick={() => handleSelectModule(mod.id)}
                >
                  {mod.thumbnail_url ? (
                    <img
                      src={mod.thumbnail_url}
                      alt={mod.title}
                      className="w-full aspect-[3/1] object-cover"
                    />
                  ) : (
                    <div className={`w-full aspect-[3/1] ${getTrainingGradient(mod.title)} flex items-center justify-center`}>
                      <BookOpen className="h-10 w-10 text-white/80" strokeWidth={1.5} />
                    </div>
                  )}
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{mod.title}</h3>
                          {getDueDateBadge(mod.due_date)}
                        </div>
                        {mod.description && (
                          <p className="text-sm text-muted-foreground/70 line-clamp-2 mb-3">
                            {mod.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3">
                          <Progress value={prog.percent} className="flex-1 h-2" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {prog.done}/{prog.total} lessons
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Level 2: Lesson List + Viewer ───
  const lessons = selectedModule?.lessons || [];
  const modProg = selectedModule ? getModuleProgress(selectedModule) : { total: 0, done: 0, percent: 0 };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {breadcrumb}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={handleBack} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-medium">{selectedModule?.title}</h2>
          <div className="flex items-center gap-3 mt-1">
            <Progress value={modProg.percent} className="flex-1 max-w-xs h-2" />
            <span className="text-xs text-muted-foreground">
              {modProg.done}/{modProg.total} complete
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lesson List */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lessons</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[calc(100vh-280px)]">
                <div className="px-2 pb-2">
                  {lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className={`flex items-center gap-2 p-3 rounded-md cursor-pointer transition-colors ${
                        selectedLesson?.id === lesson.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => { setSelectedLesson(lesson); setActiveQuiz(null); }}
                    >
                      {isCompleted(lesson.id) ? (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="text-sm flex-1 truncate">{lesson.title}</span>
                      {lesson.video_url && <Video className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Lesson Viewer */}
        <div className="md:col-span-2">
          {activeQuiz ? (
            <QuizTaker
              quiz={activeQuiz}
              sessionToken={sessionToken || ''}
              onBack={() => setActiveQuiz(null)}
              onComplete={handleQuizComplete}
            />
          ) : (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{selectedLesson?.title || 'Select a lesson'}</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
                  {!selectedLesson ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20">
                      <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium">No lesson selected</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Select a lesson from the list to view its content
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Thumbnail Image */}
                      {selectedLesson.thumbnail_url && (
                        <img
                          src={selectedLesson.thumbnail_url}
                          alt={selectedLesson.title}
                          className="w-full rounded-lg object-cover"
                          style={{ maxHeight: '300px' }}
                        />
                      )}

                      {selectedLesson.video_url && (
                        <VideoEmbed url={selectedLesson.video_url} />
                      )}

                      {selectedLesson.content && (
                        <>
                          <Separator />
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            {/<[^>]+>/.test(selectedLesson.content) ? (
                              <div dangerouslySetInnerHTML={{ __html: selectedLesson.content }} />
                            ) : (
                              <div className="whitespace-pre-wrap">{selectedLesson.content}</div>
                            )}
                          </div>
                        </>
                      )}

                      {/* Attachments */}
                      {attachments.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Attachments
                            </h3>
                            <div className="space-y-2">
                              {attachments.map((attachment) => (
                                <Button
                                  key={attachment.id}
                                  variant="outline"
                                  className="w-full justify-start"
                                  onClick={() => handleDownloadAttachment(attachment)}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  {attachment.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Quiz */}
                      {quizzes.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                              <ClipboardList className="h-4 w-4" />
                              Quiz
                            </h3>
                            {quizzes.map((quiz) => (
                              <div key={quiz.id} className="p-4 border rounded-lg">
                                <p className="font-medium">{quiz.name}</p>
                                {quiz.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{quiz.description}</p>
                                )}
                                {isStaffUser && (
                                  <Button className="mt-3" onClick={() => setActiveQuiz(quiz)}>
                                    Take Quiz
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Completion — only for staff users who can track progress */}
                      {selectedLesson && isStaffUser && (
                        <>
                          <Separator />
                          <div className="p-4 rounded-lg border bg-muted/30">
                            {quizzes.length > 0 ? (
                              isCompleted(selectedLesson.id) ? (
                                <div className="flex items-center gap-3 text-green-600">
                                  <CheckCircle className="h-6 w-6 fill-green-600" />
                                  <div>
                                    <p className="font-semibold">Lesson Complete!</p>
                                    <p className="text-sm text-muted-foreground">You've finished this lesson</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 text-amber-600">
                                  <ClipboardList className="h-6 w-6" />
                                  <div>
                                    <p className="font-semibold">Quiz Required</p>
                                    <p className="text-sm text-muted-foreground">Complete the quiz above to finish this lesson</p>
                                  </div>
                                </div>
                              )
                            ) : (
                              isCompleted(selectedLesson.id) ? (
                                <div className="flex items-center gap-3 text-green-600">
                                  <CheckCircle className="h-6 w-6 fill-green-600" />
                                  <div>
                                    <p className="font-semibold">Lesson Complete!</p>
                                    <p className="text-sm text-muted-foreground">You've finished this lesson</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold">Ready to complete?</p>
                                    <p className="text-sm text-muted-foreground">Mark this lesson as done</p>
                                  </div>
                                  <Button
                                    onClick={() => handleToggleComplete(selectedLesson.id)}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Mark Complete
                                  </Button>
                                </div>
                              )
                            )}
                          </div>
                        </>
                      )}

                      {!selectedLesson.content && !selectedLesson.video_url && attachments.length === 0 && quizzes.length === 0 && (
                        <p className="text-muted-foreground text-center py-8">
                          No content available for this lesson yet.
                        </p>
                      )}

                      {/* Community Discussion */}
                      {selectedLesson?.id && (
                        <StaffTrainingComments
                          lessonId={selectedLesson.id}
                          staffMember={{
                            id: staffUser?.id || supabaseUser?.id || '',
                            name: staffUser?.team_member_name || staffUser?.display_name || supabaseUser?.email || 'Staff Member'
                          }}
                        />
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
