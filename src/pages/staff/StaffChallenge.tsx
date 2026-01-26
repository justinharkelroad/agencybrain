import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Play,
  CheckCircle2,
  Lock,
  Flame,
  ChevronRight,
  Dumbbell,
  Brain,
  Heart,
  Briefcase,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

interface ChallengeLesson {
  id: string;
  title: string;
  day_number: number;
  week_number: number;
  day_of_week: number;
  video_url: string | null;
  video_thumbnail_url: string | null;
  preview_text: string | null;
  content_html: string | null;
  questions: any[];
  action_items: any[];
  is_discovery_stack: boolean;
  challenge_progress: {
    id: string;
    status: string;
    unlocked_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    video_watched_seconds: number;
    video_completed: boolean;
    reflection_response: Record<string, string>;
    is_unlocked: boolean;
    is_today: boolean;
  };
}

interface ChallengeModule {
  id: string;
  name: string;
  week_number: number;
  description: string | null;
  icon: string | null;
}

interface ChallengeData {
  has_assignment: boolean;
  assignment?: {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
    product: {
      name: string;
      total_lessons: number;
      duration_weeks: number;
    };
  };
  current_business_day: number;
  modules: ChallengeModule[];
  lessons: ChallengeLesson[];
  progress: {
    total_lessons: number;
    completed_lessons: number;
    progress_percent: number;
  };
  core4: {
    today: {
      body: boolean;
      being: boolean;
      balance: boolean;
      business: boolean;
    };
    streak: number;
  };
}

const CORE4_ITEMS = [
  { key: 'body', label: 'Body', icon: Dumbbell, color: 'text-red-500', description: 'Did you move today?' },
  { key: 'being', label: 'Being', icon: Brain, color: 'text-purple-500', description: 'Did you take time for mindfulness?' },
  { key: 'balance', label: 'Balance', icon: Heart, color: 'text-pink-500', description: 'Did you nurture a relationship?' },
  { key: 'business', label: 'Business', icon: Briefcase, color: 'text-blue-500', description: 'Did you take action on your goals?' },
] as const;

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function StaffChallenge() {
  const navigate = useNavigate();
  const { user, sessionToken, isAuthenticated, loading: authLoading } = useStaffAuth();

  const [data, setData] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string>('1');
  const [selectedLesson, setSelectedLesson] = useState<ChallengeLesson | null>(null);
  const [core4Updating, setCore4Updating] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [reflectionAnswers, setReflectionAnswers] = useState<Record<string, string>>({});

  const fetchChallengeData = useCallback(async () => {
    if (!sessionToken) return;

    try {
      const { data: response, error } = await supabase.functions.invoke('get-staff-challenge', {
        headers: { 'x-staff-session': sessionToken },
      });

      if (error) throw error;
      setData(response);

      // Set selected week to current week if not set
      if (response?.current_business_day) {
        const currentWeek = Math.ceil(response.current_business_day / 5);
        setSelectedWeek(Math.min(currentWeek, 6).toString());
      }

      // Auto-select today's lesson
      const todaysLesson = response?.lessons?.find((l: ChallengeLesson) =>
        l.challenge_progress?.is_today
      );
      if (todaysLesson && !selectedLesson) {
        setSelectedLesson(todaysLesson);
        setReflectionAnswers(todaysLesson.challenge_progress?.reflection_response || {});
      }
    } catch (err) {
      console.error('Challenge data error:', err);
      toast.error('Failed to load challenge data');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchChallengeData();
    }
  }, [authLoading, isAuthenticated, fetchChallengeData]);

  const handleCore4Toggle = async (key: string, checked: boolean) => {
    if (!user?.id || core4Updating) return;

    const previousData = data;
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        core4: {
          ...prev.core4,
          today: {
            ...prev.core4.today,
            [key]: checked,
          },
        },
      };
    });

    setCore4Updating(key);

    try {
      // Use the unified staff Core 4 system via get_staff_core4_entries edge function
      const { error } = await supabase.functions.invoke('get_staff_core4_entries', {
        headers: { 'x-staff-session': sessionToken },
        body: {
          action: 'toggle',
          domain: key,
        },
      });

      if (error) throw error;

      // Refetch to get updated streak from server
      await fetchChallengeData();
    } catch (err) {
      console.error('Core 4 update error:', err);
      setData(previousData);
      toast.error('Failed to update Core 4');
    } finally {
      setCore4Updating(null);
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedLesson || !data?.assignment?.id) return;

    // Prevent duplicate completions
    if (selectedLesson.challenge_progress?.status === 'completed') {
      toast.info('Lesson already completed');
      return;
    }

    setCompleting(true);
    try {
      // Call edge function to save to database
      const { data: response, error } = await supabase.functions.invoke('challenge-complete-lesson', {
        headers: { 'x-staff-session': sessionToken },
        body: {
          assignment_id: data.assignment.id,
          lesson_id: selectedLesson.id,
          reflection_responses: reflectionAnswers,
        },
      });

      if (error) throw error;

      if (response?.already_completed) {
        toast.info('Lesson already completed');
        return;
      }

      toast.success('Lesson marked as complete!');

      // Update local state with response from server
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          lessons: prev.lessons.map(l =>
            l.id === selectedLesson.id
              ? {
                  ...l,
                  challenge_progress: {
                    ...l.challenge_progress,
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    reflection_response: reflectionAnswers,
                  },
                }
              : l
          ),
          progress: response.progress || {
            ...prev.progress,
            completed_lessons: response.stats.completed_lessons,
            progress_percent: response.stats.progress_percent,
          },
        };
      });

      // Move to next available lesson
      const currentIndex = data.lessons.findIndex(l => l.id === selectedLesson.id);
      const nextLesson = data.lessons.find(
        (l, i) => i > currentIndex && l.challenge_progress?.is_unlocked
      );
      if (nextLesson) {
        setSelectedLesson(nextLesson);
        setReflectionAnswers(nextLesson.challenge_progress?.reflection_response || {});
      }
    } catch (err) {
      console.error('Complete error:', err);
      toast.error('Failed to mark lesson as complete');
    } finally {
      setCompleting(false);
    }
  };

  const selectLesson = (lesson: ChallengeLesson) => {
    if (!lesson.challenge_progress?.is_unlocked) return;
    setSelectedLesson(lesson);
    setReflectionAnswers(lesson.challenge_progress?.reflection_response || {});
  };

  const getVideoEmbedUrl = (url: string | null): string | null => {
    if (!url) return null;

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Loom
    const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (loomMatch) {
      return `https://www.loom.com/embed/${loomMatch[1]}`;
    }

    return url;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.has_assignment) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold">Not Enrolled</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You're not currently enrolled in The Challenge. Contact your agency owner to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { assignment, current_business_day, modules, lessons, progress, core4 } = data;
  const weekLessons = lessons.filter(l => l.week_number === parseInt(selectedWeek));
  const currentModule = modules.find(m => m.week_number === parseInt(selectedWeek));
  const allCore4Complete = core4.today.body && core4.today.being && core4.today.balance && core4.today.business;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div
        className="rounded-xl p-4 sm:p-6"
        style={{
          background: 'linear-gradient(135deg, #1e283a 0%, #020817 100%)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">The Challenge</h1>
            <p className="text-sm text-slate-400 mt-1">
              Day {current_business_day} of {assignment?.product?.total_lessons || 30}
            </p>
          </div>
          {core4.streak > 0 && (
            <div className="flex items-center gap-1 bg-orange-500/20 px-3 py-1.5 rounded-full">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="text-lg font-bold text-orange-500">{core4.streak}</span>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Overall Progress</span>
            <span className="text-white font-medium">{progress.progress_percent}%</span>
          </div>
          <Progress value={progress.progress_percent} className="h-2 bg-slate-700" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Week Tabs */}
          <Tabs value={selectedWeek} onValueChange={setSelectedWeek}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {modules.map((module) => {
                const weekProgress = lessons.filter(
                  l => l.week_number === module.week_number &&
                       l.challenge_progress?.status === 'completed'
                ).length;
                const weekTotal = lessons.filter(l => l.week_number === module.week_number).length;

                return (
                  <TabsTrigger
                    key={module.week_number}
                    value={module.week_number.toString()}
                    className="flex-shrink-0"
                  >
                    Week {module.week_number}
                    {weekProgress === weekTotal && weekTotal > 0 && (
                      <CheckCircle2 className="h-3 w-3 ml-1 text-green-600" />
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={selectedWeek} className="mt-4">
              {/* Module Info */}
              {currentModule && (
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{currentModule.name}</h2>
                  {currentModule.description && (
                    <p className="text-sm text-muted-foreground mt-1">{currentModule.description}</p>
                  )}
                </div>
              )}

              {/* Lesson List */}
              <div className="grid gap-2">
                {weekLessons.map((lesson) => {
                  const isLocked = !lesson.challenge_progress?.is_unlocked;
                  const isCompleted = lesson.challenge_progress?.status === 'completed';
                  const isToday = lesson.challenge_progress?.is_today;
                  const isSelected = selectedLesson?.id === lesson.id;

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => selectLesson(lesson)}
                      disabled={isLocked}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : isLocked
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-muted/50'
                      } ${isToday ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    >
                      <div className={`p-2 rounded-full ${
                        isCompleted
                          ? 'bg-green-500/10'
                          : isLocked
                          ? 'bg-muted'
                          : 'bg-primary/10'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : isLocked ? (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Play className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {DAY_NAMES[lesson.day_of_week - 1]}
                          </span>
                          {isToday && <Badge variant="secondary" className="text-xs">Today</Badge>}
                          {lesson.is_discovery_stack && (
                            <Badge variant="outline" className="text-xs">Discovery Stack</Badge>
                          )}
                        </div>
                        <p className="font-medium truncate">{lesson.title}</p>
                      </div>
                      {!isLocked && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          {/* Selected Lesson Content */}
          {selectedLesson && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Day {selectedLesson.day_number}</span>
                  <span>·</span>
                  <span>Week {selectedLesson.week_number}</span>
                  {selectedLesson.is_discovery_stack && (
                    <>
                      <span>·</span>
                      <Badge variant="outline">Discovery Stack</Badge>
                    </>
                  )}
                </div>
                <CardTitle>{selectedLesson.title}</CardTitle>
                {selectedLesson.preview_text && (
                  <CardDescription>{selectedLesson.preview_text}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Video */}
                {selectedLesson.video_url && (
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <iframe
                      src={getVideoEmbedUrl(selectedLesson.video_url) || ''}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                {/* Content HTML */}
                {selectedLesson.content_html && (
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedLesson.content_html }}
                  />
                )}

                {/* Questions/Reflection */}
                {selectedLesson.questions && selectedLesson.questions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Reflection Questions</h3>
                    {selectedLesson.questions.map((question: any, i: number) => (
                      <div key={i} className="space-y-2">
                        <label className="text-sm font-medium">{question.text || question}</label>
                        <Textarea
                          placeholder="Your reflection..."
                          value={reflectionAnswers[`q${i}`] || ''}
                          onChange={(e) =>
                            setReflectionAnswers(prev => ({ ...prev, [`q${i}`]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Items */}
                {selectedLesson.action_items && selectedLesson.action_items.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Action Items</h3>
                    <ul className="space-y-2">
                      {selectedLesson.action_items.map((item: any, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 mt-1 text-muted-foreground" />
                          <span className="text-sm">{item.text || item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mark Complete Button */}
                {selectedLesson.challenge_progress?.status !== 'completed' && (
                  <Button
                    className="w-full"
                    onClick={handleMarkComplete}
                    disabled={completing}
                  >
                    {completing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark as Complete
                      </>
                    )}
                  </Button>
                )}

                {selectedLesson.challenge_progress?.status === 'completed' && (
                  <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-600">Lesson Completed</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Core 4 Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Daily Core 4</CardTitle>
                {allCore4Complete && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Complete!</Badge>
                )}
              </div>
              <CardDescription>Check in on your daily habits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {CORE4_ITEMS.map(({ key, label, icon: Icon, color, description }) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    core4.today[key as keyof typeof core4.today]
                      ? 'bg-muted border-primary/30'
                      : 'hover:bg-muted/50'
                  } ${core4Updating === key ? 'opacity-50' : ''}`}
                >
                  <Checkbox
                    checked={core4.today[key as keyof typeof core4.today]}
                    onCheckedChange={(checked) => handleCore4Toggle(key, !!checked)}
                    disabled={core4Updating !== null}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <span className="font-medium">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                  </div>
                </label>
              ))}

              {core4.streak > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-orange-500/10 flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <span className="text-sm">
                    <span className="font-bold text-orange-600">{core4.streak} day</span> streak!
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lessons Completed</span>
                  <span className="font-medium">
                    {progress.completed_lessons} / {progress.total_lessons}
                  </span>
                </div>
                <Progress value={progress.progress_percent} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{current_business_day}</p>
                  <p className="text-xs text-muted-foreground">Current Day</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{Math.ceil(current_business_day / 5)}</p>
                  <p className="text-xs text-muted-foreground">Current Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
