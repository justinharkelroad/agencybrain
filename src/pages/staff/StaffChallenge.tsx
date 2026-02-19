import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  Play,
  CheckCircle2,
  Lock,
  Flame,
  ChevronRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useStaffFlowProfile } from '@/hooks/useStaffFlowProfile';
import { toast } from 'sonner';
import { StaffCore4Card } from '@/components/staff/StaffCore4Card';
import { SundayModuleCard } from '@/components/challenge/SundayModuleCard';
import type { SundayModule, SundayResponse } from '@/types/challenge-sunday';
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
  is_discovery_flow: boolean;
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
    discovery_flow_completed?: boolean;
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
  sunday_modules: SundayModule[];
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function StaffChallenge() {
  const navigate = useNavigate();
  const { user, sessionToken, isAuthenticated, loading: authLoading } = useStaffAuth();

  const [data, setData] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string>('1');
  const [selectedLesson, setSelectedLesson] = useState<ChallengeLesson | null>(null);
  
  const [completing, setCompleting] = useState(false);
  const [reflectionAnswers, setReflectionAnswers] = useState<Record<string, string>>({});
  const [discoveryFlowConfirmed, setDiscoveryFlowConfirmed] = useState(false);

  const { hasProfile } = useStaffFlowProfile();

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
    if (!authLoading) {
      if (isAuthenticated) {
        fetchChallengeData();
      } else {
        // Not authenticated - stop loading and let the component handle redirect
        setLoading(false);
      }
    }
  }, [authLoading, isAuthenticated, fetchChallengeData]);

  // Re-fetch when returning from discovery flow (page visibility change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        fetchChallengeData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, fetchChallengeData]);

  // Compute whether the Mark as Complete button should be enabled
  const canComplete = (() => {
    if (!selectedLesson) return false;
    if (selectedLesson.challenge_progress?.status === 'completed') return false;

    // All reflection questions must be answered
    const questions = selectedLesson.questions || [];
    if (questions.length > 0) {
      const allAnswered = questions.every((_, i) => {
        const answer = reflectionAnswers[`q${i}`];
        return answer && answer.trim().length > 0;
      });
      if (!allAnswered) return false;
    }

    // Discovery flow lessons require confirmed checkbox
    if (selectedLesson.is_discovery_flow && !discoveryFlowConfirmed) return false;

    return true;
  })();

  const handleMarkComplete = async () => {
    if (!selectedLesson || !data?.assignment?.id) return;

    // Prevent duplicate completions
    if (selectedLesson.challenge_progress?.status === 'completed') {
      toast.info('Lesson already completed');
      return;
    }

    // Validate reflection questions
    const questions = selectedLesson.questions || [];
    if (questions.length > 0) {
      const unanswered = questions.some((_, i) => {
        const answer = reflectionAnswers[`q${i}`];
        return !answer || !answer.trim();
      });
      if (unanswered) {
        toast.error('Please answer all reflection questions before completing');
        return;
      }
    }

    // Validate discovery flow confirmation for Friday lessons
    if (selectedLesson.is_discovery_flow && !discoveryFlowConfirmed) {
      toast.error('Please complete your Discovery Flow first');
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
          reflection_response: reflectionAnswers,
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
        setDiscoveryFlowConfirmed(false);
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
    setDiscoveryFlowConfirmed(false);
  };

  const getVideoEmbedUrl = (url: string | null): string | null => {
    if (!url) return null;

    // Vimeo (capture optional privacy hash for private videos)
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
    if (vimeoMatch) {
      const hash = vimeoMatch[2] ? `?h=${vimeoMatch[2]}` : '';
      return `https://player.vimeo.com/video/${vimeoMatch[1]}${hash}`;
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    navigate('/staff/login');
    return null;
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

  const { assignment, current_business_day, modules, lessons, progress, core4, sunday_modules } = data;
  const weekLessons = lessons.filter(l => l.week_number === parseInt(selectedWeek));
  const currentModule = modules.find(m => m.week_number === parseInt(selectedWeek));

  // Sunday module placement:
  // Week 1 tab: Sunday 0 at TOP
  // Week N tab (2-6): Sunday N-1 at TOP
  // Week 6 tab: Sunday 6 (FINAL) at BOTTOM
  const weekNum = parseInt(selectedWeek);
  const sundayTop = sunday_modules?.find((sm: SundayModule) =>
    weekNum === 1 ? sm.sunday_number === 0 : sm.sunday_number === weekNum - 1
  ) || null;
  const sundayBottom = weekNum === 6
    ? sunday_modules?.find((sm: SundayModule) => sm.sunday_number === 6) || null
    : null;

  const handleSundayComplete = (response: SundayResponse) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sunday_modules: prev.sunday_modules.map(sm =>
          sm.sunday_number === response.sunday_number
            ? { ...sm, is_completed: true, response }
            : sm
        ),
      };
    });
  };


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
              {/* Sunday Module at TOP of week */}
              {sundayTop && assignment && (
                <div className="mb-4">
                  <SundayModuleCard
                    key={sundayTop.id}
                    module={sundayTop}
                    assignmentId={assignment.id}
                    sessionToken={sessionToken}
                    onComplete={handleSundayComplete}
                  />
                </div>
              )}

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
                          {lesson.is_discovery_flow && (
                            <Badge variant="outline" className="text-xs">Discovery Flow</Badge>
                          )}
                        </div>
                        <p className="font-medium truncate">{lesson.title}</p>
                      </div>
                      {!isLocked && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>

              {/* Sunday Module FINAL at BOTTOM of Week 6 */}
              {sundayBottom && assignment && (
                <div className="mt-4">
                  <SundayModuleCard
                    key={sundayBottom.id}
                    module={sundayBottom}
                    assignmentId={assignment.id}
                    sessionToken={sessionToken}
                    onComplete={handleSundayComplete}
                  />
                </div>
              )}
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
                  {selectedLesson.is_discovery_flow && (
                    <>
                      <span>·</span>
                      <Badge variant="outline">Discovery Flow</Badge>
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
                  /<[^>]+>/.test(selectedLesson.content_html) ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedLesson.content_html }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {selectedLesson.content_html}
                    </div>
                  )
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

                {/* Discovery Flow Section - for Friday lessons that are not completed */}
                {selectedLesson.is_discovery_flow && selectedLesson.challenge_progress?.status !== 'completed' && (
                  <div className="space-y-3">
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (!hasProfile) {
                          navigate('/staff/flows/profile', {
                            state: { redirectTo: '/staff/flows/start/discovery' }
                          });
                        } else {
                          navigate('/staff/flows/start/discovery');
                        }
                      }}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start Discovery Flow
                    </Button>

                    {/* Discovery Flow Confirmation Checkbox */}
                    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                      selectedLesson.challenge_progress?.discovery_flow_completed
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-muted bg-muted/30'
                    }`}>
                      <Checkbox
                        id="discovery-flow-confirm"
                        checked={discoveryFlowConfirmed}
                        onCheckedChange={(checked) => setDiscoveryFlowConfirmed(checked === true)}
                        disabled={!selectedLesson.challenge_progress?.discovery_flow_completed}
                        className="mt-0.5"
                      />
                      <label
                        htmlFor="discovery-flow-confirm"
                        className={`text-sm leading-snug ${
                          selectedLesson.challenge_progress?.discovery_flow_completed
                            ? 'text-foreground cursor-pointer'
                            : 'text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        I completed my Discovery Flow
                        {!selectedLesson.challenge_progress?.discovery_flow_completed && (
                          <span className="block text-xs text-muted-foreground/70 mt-1">
                            Complete a Discovery Flow above to unlock this checkbox
                          </span>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                {/* Validation hint for unanswered questions */}
                {selectedLesson.challenge_progress?.status !== 'completed' &&
                  selectedLesson.questions?.length > 0 &&
                  !canComplete &&
                  !(selectedLesson.is_discovery_flow && !discoveryFlowConfirmed) && (
                  <div className="flex items-center gap-2 text-sm text-amber-500">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>Answer all reflection questions to complete this lesson</span>
                  </div>
                )}

                {/* Mark Complete Button */}
                {selectedLesson.challenge_progress?.status !== 'completed' && (
                  <Button
                    className="w-full"
                    onClick={handleMarkComplete}
                    disabled={completing || !canComplete}
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
          {/* Core 4 Card - Using the unified StaffCore4Card component */}
          <StaffCore4Card />

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
