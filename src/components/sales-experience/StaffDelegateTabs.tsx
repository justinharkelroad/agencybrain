import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Users,
  MessageSquare,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trophy,
  User,
  Send,
  ChevronRight,
  Calendar,
  Sparkles,
  CheckSquare,
  ClipboardList,
  Lock,
  Circle,
  Workflow,
  Target,
  ListOrdered,
  Edit,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ====== Shared fetch helper ======
async function staffFetch(url: string, sessionToken: string, body?: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-staff-session': sessionToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return response.json();
}

async function staffFetchGet(url: string, sessionToken: string) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-staff-session': sessionToken,
    },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return response.json();
}

// ====== DELEGATE OVERVIEW ======

interface OverviewData {
  has_access: boolean;
  assignment: {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
    timezone: string;
  } | null;
  current_week: number;
  current_business_day: number;
  day_in_week: number;
  modules: Array<{
    id: string;
    week_number: number;
    title: string;
    description: string;
    pillar: string;
    lessons: Array<{
      id: string;
      title: string;
      day_of_week: number;
      progress: { status: string } | null;
    }>;
  }>;
  progress: {
    total_lessons: number;
    completed_lessons: number;
    progress_percent: number;
  };
  unread_messages: number;
  current_week_transcript: {
    id: string;
    week_number: number;
    meeting_date: string;
    summary_ai: string | null;
  } | null;
}

interface MeetingResult {
  id: string;
  week_number: number;
  meeting_date: string;
  summary_ai: string | null;
  action_items_json: Array<{ action: string; owner: string; deadline: string | null }> | null;
  key_points_json: string[] | null;
}

const pillarColors: Record<string, string> = {
  sales_process: 'text-blue-500 border-blue-500',
  accountability: 'text-amber-500 border-amber-500',
  coaching_cadence: 'text-green-500 border-green-500',
};

const pillarLabels: Record<string, string> = {
  sales_process: 'Sales Process',
  accountability: 'Accountability',
  coaching_cadence: 'Coaching Cadence',
};

export function DelegateOverview({
  assignmentId,
  sessionToken,
  onTabChange,
}: {
  assignmentId: string;
  sessionToken: string;
  onTabChange?: (tab: string) => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [meetings, setMeetings] = useState<MeetingResult[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingResult | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewResult, deliverablesResult] = await Promise.all([
        staffFetchGet(`${SUPABASE_URL}/functions/v1/get-sales-experience`, sessionToken),
        staffFetch(`${SUPABASE_URL}/functions/v1/save-deliverable-content`, sessionToken, { action: 'list' }),
      ]);
      setData(overviewResult);
      setDeliverables(deliverablesResult.deliverables || []);

      // Fetch meeting transcripts if we have an assignment
      if (overviewResult.assignment?.id) {
        // We don't have a dedicated edge function for transcripts list via staff session,
        // so we'll use the overview data's current_week_transcript
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [assignmentId, sessionToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600 dark:text-red-400" />
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const currentWeek = data.current_week || 1;
  const isActive = data.assignment?.status === 'active';
  const daysRemaining = data.assignment?.end_date
    ? Math.max(0, Math.ceil((new Date(data.assignment.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const overallDeliverableProgress = deliverables.length > 0
    ? Math.round(deliverables.reduce((sum, d) => sum + getDeliverableProgressLocal(d), 0) / deliverables.length)
    : 0;
  const completeCount = deliverables.filter(d => d.status === 'complete').length;

  return (
    <div className="space-y-6">
      {/* Status & Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{currentWeek}</span>
              <span className="text-muted-foreground">of 8</span>
            </div>
            {isActive && (
              <Badge variant="outline" className="mt-2 bg-green-500/15 text-green-600 border-green-500/50 dark:border-green-500/30">
                Active
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold">{data.progress?.progress_percent || 0}%</span>
            </div>
            <Progress value={data.progress?.progress_percent || 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {data.progress?.completed_lessons || 0} of {data.progress?.total_lessons || 0} lessons completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Days Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{daysRemaining}</span>
              <span className="text-muted-foreground">days</span>
            </div>
            {data.assignment?.end_date && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Ends {data.assignment.end_date}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => onTabChange?.('messages')} className="text-left">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-full bg-blue-500/15 flex items-center justify-center relative">
                <MessageSquare className="h-6 w-6 text-blue-500" />
                {(data.unread_messages || 0) > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                    {data.unread_messages}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Coach Messages</h3>
                <p className="text-sm text-muted-foreground">
                  {(data.unread_messages || 0) > 0
                    ? `${data.unread_messages} unread message${data.unread_messages === 1 ? '' : 's'}`
                    : 'Connect with your coach'}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </button>

        <button onClick={() => onTabChange?.('team')} className="text-left">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-full bg-green-500/15 flex items-center justify-center">
                <Users className="h-6 w-6 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Team Quiz Results</h3>
                <p className="text-sm text-muted-foreground">View your team's training progress</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </button>
      </div>

      {/* Deliverables Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Your Deliverables
              </CardTitle>
              <CardDescription>
                Build your Sales Process, Accountability Metrics, and Consequence Ladder
              </CardDescription>
            </div>
            <button onClick={() => onTabChange?.('deliverables')}>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                View All <ChevronRight className="h-3 w-3 ml-1" />
              </Badge>
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={overallDeliverableProgress} className="flex-1 h-2" />
            <span className="text-sm font-medium text-muted-foreground">
              {completeCount} / 3 complete
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 8-Week Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Your 8-Week Journey</CardTitle>
          <CardDescription>
            Track progress across all 8 weeks of the program
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.modules?.map((module) => {
              const isUnlocked = currentWeek >= module.week_number;
              const isCurrent = currentWeek === module.week_number;
              const isCompleted = module.lessons?.every(
                (l) => l.progress?.status === 'completed'
              );

              return (
                <Card
                  key={module.id}
                  className={`transition-all ${
                    isCurrent
                      ? 'border-primary bg-primary/5 shadow-md'
                      : isUnlocked
                      ? 'hover:bg-muted/50'
                      : 'opacity-60'
                  }`}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-500/15'
                        : isCurrent
                        ? 'bg-primary/10'
                        : 'bg-muted'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : isCurrent ? (
                        <Circle className="h-5 w-5 text-primary fill-primary" />
                      ) : !isUnlocked ? (
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">Week {module.week_number}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${pillarColors[module.pillar] || ''} bg-opacity-10`}
                        >
                          {pillarLabels[module.pillar] || module.pillar}
                        </Badge>
                        {isCurrent && (
                          <Badge className="bg-primary text-primary-foreground">Current</Badge>
                        )}
                      </div>
                      <h4 className="font-medium truncate">{module.title}</h4>
                      <p className="text-sm text-muted-foreground truncate">{module.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Meeting Details Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={(open) => !open && setSelectedMeeting(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Week {selectedMeeting?.week_number} Meeting Results</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {selectedMeeting?.meeting_date && format(new Date(selectedMeeting.meeting_date), 'EEE, MMM d')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-120px)]">
            <div className="space-y-6 pr-4">
              {selectedMeeting?.summary_ai && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Summary
                  </h3>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedMeeting.summary_ai}</p>
                </div>
              )}
              {selectedMeeting?.key_points_json && selectedMeeting.key_points_json.length > 0 && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4" />
                    Key Discussion Points
                  </h3>
                  <ul className="space-y-2">
                    {selectedMeeting.key_points_json.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm">
                        <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedMeeting?.action_items_json && selectedMeeting.action_items_json.length > 0 && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <CheckSquare className="h-4 w-4" />
                    Action Items
                  </h3>
                  <div className="space-y-2">
                    {selectedMeeting.action_items_json.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{item.action}</p>
                          <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                            {item.owner && <span>Owner: {item.owner}</span>}
                            {item.deadline && <span>Due: {item.deadline}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====== DELEGATE TEAM PROGRESS ======

interface StaffProgressItem {
  staff_user_id: string;
  staff_users: {
    id: string;
    display_name: string;
    email: string | null;
    team_members: { name: string } | null;
  };
  total_lessons: number;
  completed_lessons: number;
  avg_quiz_score: number | null;
  last_activity: string | null;
}

interface RecentQuiz {
  id: string;
  staff_user_id: string;
  score_percent: number;
  completed_at: string;
  staff_users: { display_name: string };
  sales_experience_lessons: {
    title: string;
    sales_experience_modules: { week_number: number };
  };
}

export function DelegateTeamProgress({
  assignmentId,
  sessionToken,
}: {
  assignmentId: string;
  sessionToken: string;
}) {
  const [staffProgress, setStaffProgress] = useState<StaffProgressItem[]>([]);
  const [recentQuizzes, setRecentQuizzes] = useState<RecentQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await staffFetch(
        `${SUPABASE_URL}/functions/v1/get-sales-experience-team-progress`,
        sessionToken,
        { assignment_id: assignmentId }
      );
      setStaffProgress(data.staff_progress || []);
      setRecentQuizzes(data.recent_quizzes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [assignmentId, sessionToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600 dark:text-red-400" />
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate stats
  const teamSize = staffProgress.length;
  const avgCompletion = teamSize > 0
    ? Math.round(staffProgress.reduce((sum, s) => sum + (s.total_lessons > 0 ? (s.completed_lessons / s.total_lessons) * 100 : 0), 0) / teamSize)
    : 0;
  const avgQuizScore = (() => {
    const withScores = staffProgress.filter(s => s.avg_quiz_score !== null);
    return withScores.length > 0
      ? Math.round(withScores.reduce((sum, s) => sum + (s.avg_quiz_score || 0), 0) / withScores.length)
      : null;
  })();
  const fullyCompleted = staffProgress.filter(s => s.total_lessons > 0 && s.completed_lessons >= s.total_lessons).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Team Members</p>
            <p className="text-2xl font-bold">{teamSize}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Completion</p>
            <p className="text-2xl font-bold">{avgCompletion}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Quiz Score</p>
            <p className="text-2xl font-bold">{avgQuizScore !== null ? `${avgQuizScore}%` : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Fully Completed</p>
            <p className="text-2xl font-bold">{fullyCompleted}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Progress
          </CardTitle>
          <CardDescription>Staff lesson completion and quiz scores</CardDescription>
        </CardHeader>
        <CardContent>
          {staffProgress.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No team progress data yet. Staff members will appear here once they start their lessons.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Member</TableHead>
                  <TableHead className="text-center">Lessons</TableHead>
                  <TableHead className="text-center">Avg Quiz Score</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffProgress.map((staff) => (
                  <TableRow key={staff.staff_user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {staff.staff_users.team_members?.name || staff.staff_users.display_name}
                        </p>
                        {staff.staff_users.email && (
                          <p className="text-xs text-muted-foreground">{staff.staff_users.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">{staff.completed_lessons}</span>
                      <span className="text-muted-foreground">/{staff.total_lessons}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {staff.avg_quiz_score !== null ? (
                        <Badge
                          variant="outline"
                          className={
                            staff.avg_quiz_score >= 80
                              ? 'border-green-500 text-green-600'
                              : staff.avg_quiz_score >= 60
                              ? 'border-amber-500 text-amber-600'
                              : 'border-red-500 text-red-600'
                          }
                        >
                          {staff.avg_quiz_score}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {staff.last_activity ? (
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(staff.last_activity), 'MMM d, h:mm a')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {recentQuizzes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Quiz Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{quiz.staff_users?.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Week {quiz.sales_experience_lessons?.sales_experience_modules?.week_number} —{' '}
                      {quiz.sales_experience_lessons?.title}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={
                        quiz.score_percent >= 80
                          ? 'border-green-500 text-green-600'
                          : quiz.score_percent >= 60
                          ? 'border-amber-500 text-amber-600'
                          : 'border-red-500 text-red-600'
                      }
                    >
                      {quiz.score_percent}%
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(quiz.completed_at), 'MMM d')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ====== DELEGATE MESSAGES (full messaging with send) ======

interface Message {
  id: string;
  sender_type: 'coach' | 'owner' | 'manager';
  sender_user_id: string | null;
  content: string;
  created_at: string;
  read_at: string | null;
  sender: { full_name: string | null; avatar_url: string | null } | null;
}

export function DelegateMessages({
  sessionToken,
  assignmentId,
}: {
  sessionToken: string;
  assignmentId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await staffFetch(
        `${SUPABASE_URL}/functions/v1/sales-experience-messages`,
        sessionToken,
        { action: 'list' }
      );
      setMessages(data.messages || []);
      setError(null);
    } catch (err) {
      if (!messages.length) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark coach messages as read
  useEffect(() => {
    if (!messages.length) return;
    const unread = messages.filter((m) => !m.read_at && m.sender_type === 'coach');
    if (unread.length === 0) return;

    const markRead = async () => {
      for (const msg of unread) {
        try {
          await staffFetch(
            `${SUPABASE_URL}/functions/v1/sales-experience-messages`,
            sessionToken,
            { action: 'mark_read', message_id: msg.id }
          );
        } catch {
          // Silently fail - not critical
        }
      }
    };
    markRead();
  }, [messages, sessionToken]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await staffFetch(
        `${SUPABASE_URL}/functions/v1/sales-experience-messages`,
        sessionToken,
        { action: 'send', assignment_id: assignmentId, content: newMessage.trim() }
      );
      setNewMessage('');
      await fetchMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Coach Messages</h2>
        <p className="text-muted-foreground">Direct communication with your 8-Week Experience coach</p>
      </div>

      <Card className="flex flex-col h-[calc(100vh-400px)] min-h-[500px]">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversation
          </CardTitle>
        </CardHeader>

        <ScrollArea className="flex-1 p-4">
          {error && !messages.length ? (
            <div className="flex flex-col items-center justify-center h-full">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400 mb-2" />
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : sortedMessages.length > 0 ? (
            <div className="space-y-4">
              {sortedMessages.map((message) => {
                const isCoach = message.sender_type === 'coach';
                const isOwnMessage = message.sender_type === 'manager' || message.sender_type === 'owner';

                return (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback
                        className={
                          isCoach
                            ? 'bg-amber-500 text-white'
                            : 'bg-primary text-primary-foreground'
                        }
                      >
                        {isCoach ? <Trophy className="h-5 w-5" /> : <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>

                    <div className={`flex-1 max-w-[80%] ${isOwnMessage ? 'text-right' : ''}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {isCoach ? 'Coach' : message.sender?.full_name || 'Manager'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div
                        className={`inline-block rounded-lg px-4 py-2 ${
                          isCoach
                            ? 'bg-amber-500/10 text-foreground'
                            : isOwnMessage
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No messages yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Start a conversation with your coach. They're here to help you succeed.
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 border-t">
          <form onSubmit={handleSend} className="flex gap-2">
            <Textarea
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 self-end"
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  );
}

// ====== DELEGATE DELIVERABLES (full view with progress) ======

interface Deliverable {
  id: string;
  assignment_id: string;
  deliverable_type: string;
  status: string;
  content_json: Record<string, unknown>;
  updated_at: string;
  created_at: string;
}

const deliverableLabels: Record<string, { title: string; description: string; icon: string }> = {
  sales_process: {
    title: 'Sales Process',
    description: 'Define your Rapport \u2192 Coverage \u2192 Closing framework',
    icon: 'workflow',
  },
  accountability_metrics: {
    title: 'Accountability Metrics',
    description: 'Set up categories and metrics to track performance',
    icon: 'target',
  },
  consequence_ladder: {
    title: 'Consequence Ladder',
    description: 'Create progressive steps for addressing performance issues',
    icon: 'list-ordered',
  },
};

const deliverableIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  workflow: Workflow,
  target: Target,
  'list-ordered': ListOrdered,
};

function getDeliverableProgressLocal(d: Deliverable): number {
  const content = d.content_json;
  switch (d.deliverable_type) {
    case 'sales_process': {
      const sp = content as { rapport?: string[]; coverage?: string[]; closing?: string[] };
      let filled = 0;
      if (sp.rapport?.length) filled++;
      if (sp.coverage?.length) filled++;
      if (sp.closing?.length) filled++;
      return Math.round((filled / 3) * 100);
    }
    case 'accountability_metrics': {
      const am = content as { categories?: Array<{ items?: string[] }> };
      if (!am.categories?.length) return 0;
      const hasItems = am.categories.filter(c => c.items?.length).length;
      return Math.round((hasItems / am.categories.length) * 100);
    }
    case 'consequence_ladder': {
      const cl = content as { steps?: unknown[] };
      const count = cl.steps?.length || 0;
      return Math.min(100, Math.round((count / 4) * 100));
    }
    default:
      return 0;
  }
}

export function DelegateDeliverables({
  sessionToken,
}: {
  sessionToken: string;
}) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await staffFetch(
        `${SUPABASE_URL}/functions/v1/save-deliverable-content`,
        sessionToken,
        { action: 'list' }
      );
      // Sort by display order
      const order = ['sales_process', 'accountability_metrics', 'consequence_ladder'];
      const sorted = (data.deliverables || []).sort(
        (a: Deliverable, b: Deliverable) => order.indexOf(a.deliverable_type) - order.indexOf(b.deliverable_type)
      );
      setDeliverables(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600 dark:text-red-400" />
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  const overallProgress = deliverables.length > 0
    ? Math.round(deliverables.reduce((sum, d) => sum + getDeliverableProgressLocal(d), 0) / deliverables.length)
    : 0;
  const completeCount = deliverables.filter(d => d.status === 'complete').length;

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-8 w-8 text-amber-500" />
          <h2 className="text-2xl font-bold">Your Deliverables</h2>
        </div>
        <p className="text-muted-foreground">
          Build these three key documents throughout your 8-Week Sales Experience.
        </p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Overall Progress</CardTitle>
          <CardDescription>{completeCount} of 3 deliverables complete</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={overallProgress} className="flex-1 h-3" />
            <span className="text-2xl font-bold w-16 text-right">{overallProgress}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Deliverable Cards */}
      <div className="space-y-4">
        {deliverables.map((d) => {
          const info = deliverableLabels[d.deliverable_type] || { title: d.deliverable_type, description: '', icon: 'file-text' };
          const Icon = deliverableIcons[info.icon] || FileText;
          const progress = getDeliverableProgressLocal(d);
          const isComplete = d.status === 'complete';
          const isDraft = d.status === 'draft';

          const statusConfig = {
            draft: { label: 'Not Started', icon: FileText, className: '' },
            in_progress: { label: 'In Progress', icon: Clock, className: 'border-amber-500 text-amber-600' },
            complete: { label: 'Complete', icon: CheckCircle2, className: 'border-green-500 text-green-600' },
          };
          const sc = statusConfig[d.status as keyof typeof statusConfig] || statusConfig.draft;
          const StatusIcon = sc.icon;

          return (
            <Card
              key={d.id}
              className={`transition-all ${isComplete ? 'border-green-500/50 dark:border-green-500/30 bg-green-50/30 dark:bg-green-950/10' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      isComplete ? 'bg-green-500/15 text-green-600' : 'bg-primary/10 text-primary'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{info.title}</CardTitle>
                      <CardDescription className="text-sm">{info.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={`flex items-center gap-1 ${sc.className}`}>
                    <StatusIcon className="h-3 w-3" />
                    {sc.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {!isDraft && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {/* Content Preview */}
                {d.deliverable_type === 'sales_process' && !isDraft && (
                  <DeliverableSalesProcessPreview content={d.content_json} />
                )}
                {d.deliverable_type === 'accountability_metrics' && !isDraft && (
                  <DeliverableAccountabilityPreview content={d.content_json} />
                )}
                {d.deliverable_type === 'consequence_ladder' && !isDraft && (
                  <DeliverableConsequenceLadderPreview content={d.content_json} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ====== Deliverable Content Previews ======

function DeliverableSalesProcessPreview({ content }: { content: Record<string, unknown> }) {
  const sp = content as { rapport?: string[]; coverage?: string[]; closing?: string[] };
  if (!sp.rapport?.length && !sp.coverage?.length && !sp.closing?.length) return null;

  return (
    <div className="grid grid-cols-3 gap-3 mt-2">
      {['rapport', 'coverage', 'closing'].map((section) => {
        const items = (sp as Record<string, string[]>)[section] || [];
        return (
          <div key={section} className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {section}
            </p>
            {items.length > 0 ? (
              <ul className="space-y-1">
                {items.slice(0, 3).map((item, i) => (
                  <li key={i} className="text-xs truncate">{item}</li>
                ))}
                {items.length > 3 && (
                  <li className="text-xs text-muted-foreground">+{items.length - 3} more</li>
                )}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground italic">No items</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DeliverableAccountabilityPreview({ content }: { content: Record<string, unknown> }) {
  const am = content as { categories?: Array<{ name: string; items?: string[] }> };
  if (!am.categories?.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {am.categories.slice(0, 3).map((cat, i) => (
        <div key={i} className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-semibold">{cat.name}</p>
          <p className="text-xs text-muted-foreground">{cat.items?.length || 0} metrics</p>
        </div>
      ))}
      {am.categories.length > 3 && (
        <p className="text-xs text-muted-foreground">+{am.categories.length - 3} more categories</p>
      )}
    </div>
  );
}

function DeliverableConsequenceLadderPreview({ content }: { content: Record<string, unknown> }) {
  const cl = content as { steps?: Array<{ incident: number; title: string; description: string }> };
  if (!cl.steps?.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {cl.steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
            {step.incident}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{step.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
