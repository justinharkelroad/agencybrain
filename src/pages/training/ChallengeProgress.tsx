import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  ArrowLeft,
  User,
  CheckCircle2,
  Circle,
  Flame,
  Calendar,
  ChevronRight,
  MessageSquare,
  Dumbbell,
  Brain,
  Heart,
  Briefcase,
  Clock,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateLocal } from '@/lib/utils';

interface StaffAssignment {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  staff_user_id: string;
  staff_users: {
    id: string;
    display_name: string;
    email: string | null;
  };
  progress_stats: {
    completed: number;
    total: number;
    percent: number;
  };
  core4_stats: {
    total_days: number;
    perfect_days: number;
    current_streak: number;
  };
  last_activity: string | null;
}

interface LessonProgress {
  id: string;
  status: string;
  completed_at: string | null;
  reflection_response: Record<string, string> | null;
  challenge_lessons: {
    id: string;
    title: string;
    day_number: number;
    week_number: number;
    questions: Array<{ text: string }> | string[];
  };
}

interface Core4Log {
  id: string;
  log_date: string;
  body: boolean;
  being: boolean;
  balance: boolean;
  business: boolean;
  notes: string | null;
}

export default function ChallengeProgress() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<StaffAssignment | null>(null);
  const [lessonProgress, setLessonProgress] = useState<LessonProgress[]>([]);
  const [core4Logs, setCore4Logs] = useState<Core4Log[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchAssignments();
    }
  }, [user?.id]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      // Get user's agency
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user!.id)
        .single();

      if (!profile?.agency_id) {
        toast.error('Agency not found');
        return;
      }

      // Fetch assignments for this agency
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('challenge_assignments')
        .select(`
          id,
          status,
          start_date,
          end_date,
          staff_user_id,
          staff_users (
            id,
            display_name,
            email
          )
        `)
        .eq('agency_id', profile.agency_id)
        .in('status', ['active', 'pending', 'completed'])
        .order('created_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // For each assignment, fetch progress and core4 stats
      const enrichedAssignments = await Promise.all(
        (assignmentsData || []).map(async (assignment) => {
          // Fetch progress stats
          const { data: progressData } = await supabase
            .from('challenge_progress')
            .select('status, completed_at')
            .eq('assignment_id', assignment.id);

          const completed = progressData?.filter(p => p.status === 'completed').length || 0;
          const total = progressData?.length || 30;
          const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

          // Get last activity
          const lastCompleted = progressData
            ?.filter(p => p.completed_at)
            .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];

          // Fetch Core 4 stats
          const { data: core4Data } = await supabase
            .from('challenge_core4_logs')
            .select('body, being, balance, business, log_date')
            .eq('assignment_id', assignment.id)
            .order('log_date', { ascending: false });

          const perfectDays = core4Data?.filter(
            log => log.body && log.being && log.balance && log.business
          ).length || 0;

          // Calculate current streak
          let currentStreak = 0;
          if (core4Data && core4Data.length > 0) {
            const sortedLogs = [...core4Data].sort(
              (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
            );
            for (const log of sortedLogs) {
              if (log.body && log.being && log.balance && log.business) {
                currentStreak++;
              } else {
                break;
              }
            }
          }

          return {
            ...assignment,
            staff_users: assignment.staff_users as StaffAssignment['staff_users'],
            progress_stats: { completed, total, percent },
            core4_stats: {
              total_days: core4Data?.length || 0,
              perfect_days: perfectDays,
              current_streak: currentStreak,
            },
            last_activity: lastCompleted?.completed_at || null,
          } as StaffAssignment;
        })
      );

      setAssignments(enrichedAssignments);
    } catch (err) {
      console.error('Error fetching assignments:', err);
      toast.error('Failed to load progress data');
    } finally {
      setLoading(false);
    }
  };

  const openStaffDetail = async (assignment: StaffAssignment) => {
    setSelectedAssignment(assignment);
    setDetailOpen(true);
    setDetailLoading(true);

    try {
      // Fetch detailed lesson progress with reflection responses
      const { data: progressData, error: progressError } = await supabase
        .from('challenge_progress')
        .select(`
          id,
          status,
          completed_at,
          reflection_response,
          challenge_lessons (
            id,
            title,
            day_number,
            week_number,
            questions
          )
        `)
        .eq('assignment_id', assignment.id)
        .order('challenge_lessons(day_number)', { ascending: true });

      if (progressError) throw progressError;
      setLessonProgress(progressData as LessonProgress[] || []);

      // Fetch Core 4 logs
      const { data: core4Data, error: core4Error } = await supabase
        .from('challenge_core4_logs')
        .select('*')
        .eq('assignment_id', assignment.id)
        .order('log_date', { ascending: false });

      if (core4Error) throw core4Error;
      setCore4Logs(core4Data || []);
    } catch (err) {
      console.error('Error fetching details:', err);
      toast.error('Failed to load staff details');
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600">Active</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Back Link */}
      <Link
        to="/training/challenge"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Challenge
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Staff Challenge Progress</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your team's progress and view their reflections
        </p>
      </div>

      {/* Summary Stats */}
      {assignments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Enrolled</CardDescription>
              <CardTitle className="text-3xl">{assignments.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-3xl">
                {assignments.filter(a => a.status === 'active').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-3xl">
                {assignments.filter(a => a.status === 'completed').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Progress</CardDescription>
              <CardTitle className="text-3xl">
                {assignments.length > 0
                  ? Math.round(
                      assignments.reduce((sum, a) => sum + a.progress_stats.percent, 0) /
                        assignments.length
                    )
                  : 0}
                %
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Staff List */}
      {assignments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">No Staff Enrolled</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Purchase seats and assign staff to get started.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/training/challenge">Go to Challenge</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <Card
              key={assignment.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => openStaffDetail(assignment)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar / Icon */}
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-6 w-6 text-primary" />
                  </div>

                  {/* Staff Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">
                        {assignment.staff_users?.display_name || 'Unknown'}
                      </h3>
                      {getStatusBadge(assignment.status)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {assignment.staff_users?.email || 'No email'}
                    </p>
                  </div>

                  {/* Progress */}
                  <div className="hidden sm:block w-32">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span className="font-medium">{assignment.progress_stats.percent}%</span>
                    </div>
                    <Progress value={assignment.progress_stats.percent} className="h-2" />
                  </div>

                  {/* Core 4 Streak */}
                  <div className="hidden md:flex items-center gap-2 text-sm">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span>{assignment.core4_stats.current_streak} day streak</span>
                  </div>

                  {/* Last Activity */}
                  <div className="hidden lg:block text-sm text-muted-foreground">
                    {assignment.last_activity ? (
                      <span>Last active {formatDateLocal(assignment.last_activity)}</span>
                    ) : (
                      <span>Not started</span>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Mobile Progress */}
                <div className="sm:hidden mt-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span className="font-medium">{assignment.progress_stats.percent}%</span>
                  </div>
                  <Progress value={assignment.progress_stats.percent} className="h-2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Staff Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedAssignment?.staff_users?.display_name || 'Staff Member'}
            </DialogTitle>
            <DialogDescription>
              Challenge progress and reflection responses
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="progress" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="progress">Lessons</TabsTrigger>
                <TabsTrigger value="reflections">Reflections</TabsTrigger>
                <TabsTrigger value="core4">Core 4</TabsTrigger>
              </TabsList>

              {/* Lessons Tab */}
              <TabsContent value="progress" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-muted-foreground">Completed</div>
                    <div className="text-2xl font-bold">
                      {selectedAssignment?.progress_stats.completed} / {selectedAssignment?.progress_stats.total}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="text-muted-foreground">Progress</div>
                    <div className="text-2xl font-bold">{selectedAssignment?.progress_stats.percent}%</div>
                  </div>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {lessonProgress.map((progress) => (
                    <div
                      key={progress.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        progress.status === 'completed' ? 'bg-green-500/5 border-green-500/20' : ''
                      }`}
                    >
                      {progress.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          Day {progress.challenge_lessons?.day_number}: {progress.challenge_lessons?.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Week {progress.challenge_lessons?.week_number}
                          {progress.completed_at && ` - Completed ${formatDateLocal(progress.completed_at)}`}
                        </p>
                      </div>
                      {progress.reflection_response && Object.keys(progress.reflection_response).length > 0 && (
                        <Badge variant="outline" className="shrink-0">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Reflection
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Reflections Tab */}
              <TabsContent value="reflections" className="mt-4 space-y-4">
                {lessonProgress.filter(p => p.reflection_response && Object.keys(p.reflection_response).length > 0).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No reflection responses yet</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {lessonProgress
                      .filter(p => p.reflection_response && Object.keys(p.reflection_response).length > 0)
                      .map((progress) => (
                        <Card key={progress.id}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">
                              Day {progress.challenge_lessons?.day_number}: {progress.challenge_lessons?.title}
                            </CardTitle>
                            <CardDescription>
                              Week {progress.challenge_lessons?.week_number}
                              {progress.completed_at && ` - ${formatDateLocal(progress.completed_at)}`}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {progress.challenge_lessons?.questions?.map((question, i) => {
                              const questionText = typeof question === 'string' ? question : question.text;
                              const answer = progress.reflection_response?.[`q${i}`] || progress.reflection_response?.[i.toString()];

                              if (!answer) return null;

                              return (
                                <div key={i} className="space-y-1">
                                  <p className="text-sm font-medium text-muted-foreground">
                                    Q{i + 1}: {questionText}
                                  </p>
                                  <p className="text-sm bg-muted p-2 rounded">{answer}</p>
                                </div>
                              );
                            })}
                            {/* Handle case where response keys don't match expected format */}
                            {Object.entries(progress.reflection_response || {}).map(([key, value]) => {
                              if (key.startsWith('q') || /^\d+$/.test(key)) return null;
                              return (
                                <div key={key} className="space-y-1">
                                  <p className="text-sm font-medium text-muted-foreground">{key}</p>
                                  <p className="text-sm bg-muted p-2 rounded">{value}</p>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                )}
              </TabsContent>

              {/* Core 4 Tab */}
              <TabsContent value="core4" className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-muted-foreground">Days Logged</div>
                    <div className="text-2xl font-bold">{selectedAssignment?.core4_stats.total_days}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-muted-foreground">Perfect Days</div>
                    <div className="text-2xl font-bold text-green-600">
                      {selectedAssignment?.core4_stats.perfect_days}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-muted-foreground">Current Streak</div>
                    <div className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">
                      <Flame className="h-5 w-5" />
                      {selectedAssignment?.core4_stats.current_streak}
                    </div>
                  </div>
                </div>

                {core4Logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No Core 4 logs yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {core4Logs.map((log) => {
                      const isPerfect = log.body && log.being && log.balance && log.business;
                      const completedCount = [log.body, log.being, log.balance, log.business].filter(Boolean).length;

                      return (
                        <div
                          key={log.id}
                          className={`p-3 rounded-lg border ${
                            isPerfect ? 'bg-green-500/5 border-green-500/20' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{formatDateLocal(log.log_date)}</span>
                              {isPerfect && (
                                <Badge className="bg-green-600">
                                  <Trophy className="h-3 w-3 mr-1" />
                                  Perfect Day
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">{completedCount}/4</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className={`flex items-center gap-1 text-sm ${log.body ? 'text-green-600' : 'text-muted-foreground'}`}>
                              <Dumbbell className="h-4 w-4" />
                              <span>Body</span>
                              {log.body && <CheckCircle2 className="h-3 w-3" />}
                            </div>
                            <div className={`flex items-center gap-1 text-sm ${log.being ? 'text-green-600' : 'text-muted-foreground'}`}>
                              <Brain className="h-4 w-4" />
                              <span>Being</span>
                              {log.being && <CheckCircle2 className="h-3 w-3" />}
                            </div>
                            <div className={`flex items-center gap-1 text-sm ${log.balance ? 'text-green-600' : 'text-muted-foreground'}`}>
                              <Heart className="h-4 w-4" />
                              <span>Balance</span>
                              {log.balance && <CheckCircle2 className="h-3 w-3" />}
                            </div>
                            <div className={`flex items-center gap-1 text-sm ${log.business ? 'text-green-600' : 'text-muted-foreground'}`}>
                              <Briefcase className="h-4 w-4" />
                              <span>Business</span>
                              {log.business && <CheckCircle2 className="h-3 w-3" />}
                            </div>
                          </div>
                          {log.notes && (
                            <p className="text-sm text-muted-foreground mt-2 italic">"{log.notes}"</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
