import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Users, MessageSquare, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// --- Team Progress Tab ---

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
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/get-sales-experience-team-progress`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-staff-session': sessionToken,
          },
          body: JSON.stringify({ assignment_id: assignmentId }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch team progress');
      }

      const data = await response.json();
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
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Progress
          </CardTitle>
          <CardDescription>
            Staff lesson completion and quiz scores
          </CardDescription>
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
                    <p className="font-medium text-sm">
                      {quiz.staff_users?.display_name}
                    </p>
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

// --- Messages Tab ---

interface Message {
  id: string;
  sender_type: 'coach' | 'owner';
  content: string;
  created_at: string;
  read_at: string | null;
  sender: { full_name: string | null; avatar_url: string | null } | null;
}

export function DelegateMessages({
  sessionToken,
}: {
  sessionToken: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/sales-experience-messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-staff-session': sessionToken,
          },
          body: JSON.stringify({ action: 'list' }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Coach Messages
        </CardTitle>
        <CardDescription>
          Messages between your agency and the sales coach
        </CardDescription>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No messages yet.
          </p>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.sender_type === 'coach'
                    ? 'bg-blue-500/10 border border-blue-500/20'
                    : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {msg.sender_type === 'coach' ? 'Coach' : 'Agency'}
                    {msg.sender?.full_name ? ` (${msg.sender.full_name})` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Deliverables Tab ---

interface Deliverable {
  id: string;
  deliverable_type: string;
  status: string;
  content_json: unknown;
}

const deliverableLabels: Record<string, string> = {
  sales_process: 'Sales Process',
  accountability_metrics: 'Accountability Metrics',
  consequence_ladder: 'Consequence Ladder',
};

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
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/save-deliverable-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-staff-session': sessionToken,
          },
          body: JSON.stringify({ action: 'list' }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch deliverables');
      }

      const data = await response.json();
      setDeliverables(data.deliverables || []);
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Deliverables
        </CardTitle>
        <CardDescription>
          8-Week Sales Experience deliverables for your agency
        </CardDescription>
      </CardHeader>
      <CardContent>
        {deliverables.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No deliverables created yet.
          </p>
        ) : (
          <div className="space-y-3">
            {deliverables.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {deliverableLabels[d.deliverable_type] || d.deliverable_type}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    d.status === 'complete'
                      ? 'border-green-500 text-green-600'
                      : d.status === 'in_progress'
                      ? 'border-amber-500 text-amber-600'
                      : 'border-slate-500 text-slate-600'
                  }
                >
                  {d.status === 'complete' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {d.status === 'in_progress' && <Clock className="h-3 w-3 mr-1" />}
                  {d.status === 'complete'
                    ? 'Complete'
                    : d.status === 'in_progress'
                    ? 'In Progress'
                    : 'Draft'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
