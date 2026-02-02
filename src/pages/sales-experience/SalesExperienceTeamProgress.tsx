import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSalesExperienceAccess } from '@/hooks/useSalesExperienceAccess';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  ArrowLeft,
  Users,
  Trophy,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
} from 'lucide-react';

interface StaffProgress {
  staff_user_id: string;
  staff_users: {
    id: string;
    display_name: string;
    email: string | null;
    team_members: {
      name: string;
    } | null;
  };
  total_lessons: number;
  completed_lessons: number;
  avg_quiz_score: number | null;
  last_activity: string | null;
}

interface QuizAttempt {
  id: string;
  staff_user_id: string;
  lesson_id: string;
  score_percent: number;
  completed_at: string;
  answers_json: Array<{
    question_id: string;
    question: string;
    user_answer: string;
    correct_answer?: string | null;
    is_correct?: boolean;
    is_open_ended?: boolean;
    points?: number;
  }>;
  feedback_ai?: string | null;
  staff_users: {
    display_name: string;
  };
  sales_experience_lessons: {
    title: string;
    sales_experience_modules: {
      week_number: number;
    };
  };
}

type StaffUsersData = StaffProgress['staff_users'];

export default function SalesExperienceTeamProgress() {
  const { hasAccess, assignment, currentWeek, isLoading: accessLoading } = useSalesExperienceAccess();
  const [selectedQuiz, setSelectedQuiz] = useState<QuizAttempt | null>(null);

  // Fetch staff progress
  const { data: staffProgress, isLoading: progressLoading } = useQuery({
    queryKey: ['sales-experience-team-progress', assignment?.id],
    enabled: hasAccess && !!assignment?.id,
    queryFn: async () => {
      // Get all staff progress for this assignment
      const { data: progress, error } = await supabase
        .from('sales_experience_staff_progress')
        .select(`
          staff_user_id,
          status,
          quiz_score_percent,
          completed_at,
          staff_users!inner(
            id,
            display_name,
            email,
            team_members(name)
          )
        `)
        .eq('assignment_id', assignment!.id);

      if (error) throw error;

      // Aggregate by staff user
      const staffMap = new Map<string, StaffProgress>();

      for (const record of progress || []) {
        const staffId = record.staff_user_id;

        if (!staffMap.has(staffId)) {
          staffMap.set(staffId, {
            staff_user_id: staffId,
            staff_users: record.staff_users as StaffUsersData,
            total_lessons: 0,
            completed_lessons: 0,
            avg_quiz_score: null,
            last_activity: null,
          });
        }

        const staff = staffMap.get(staffId)!;
        staff.total_lessons++;

        if (record.status === 'completed') {
          staff.completed_lessons++;
        }

        if (record.quiz_score_percent !== null) {
          if (staff.avg_quiz_score === null) {
            staff.avg_quiz_score = record.quiz_score_percent;
          } else {
            // Running average
            staff.avg_quiz_score =
              (staff.avg_quiz_score + record.quiz_score_percent) / 2;
          }
        }

        if (record.completed_at) {
          if (
            !staff.last_activity ||
            new Date(record.completed_at) > new Date(staff.last_activity)
          ) {
            staff.last_activity = record.completed_at;
          }
        }
      }

      return Array.from(staffMap.values());
    },
  });

  // Fetch recent quiz attempts
  const { data: recentQuizzes, isLoading: quizzesLoading } = useQuery({
    queryKey: ['sales-experience-recent-quizzes', assignment?.id],
    enabled: hasAccess && !!assignment?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_quiz_attempts')
        .select(`
          id,
          staff_user_id,
          lesson_id,
          score_percent,
          completed_at,
          answers_json,
          feedback_ai,
          staff_users(display_name),
          sales_experience_lessons(
            title,
            sales_experience_modules(week_number)
          )
        `)
        .eq('assignment_id', assignment!.id)
        .order('completed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as QuizAttempt[];
    },
  });

  // Calculate team stats
  const teamStats = useMemo(() => {
    if (!staffProgress || staffProgress.length === 0) {
      return {
        totalStaff: 0,
        avgCompletion: 0,
        avgQuizScore: 0,
        completedCount: 0,
      };
    }

    const totalStaff = staffProgress.length;
    const avgCompletion =
      staffProgress.reduce((sum, s) => {
        const pct =
          s.total_lessons > 0
            ? (s.completed_lessons / s.total_lessons) * 100
            : 0;
        return sum + pct;
      }, 0) / totalStaff;

    const staffWithScores = staffProgress.filter((s) => s.avg_quiz_score !== null);
    const avgQuizScore =
      staffWithScores.length > 0
        ? staffWithScores.reduce((sum, s) => sum + (s.avg_quiz_score || 0), 0) /
          staffWithScores.length
        : 0;

    const completedCount = staffProgress.filter(
      (s) => s.completed_lessons === s.total_lessons && s.total_lessons > 0
    ).length;

    return {
      totalStaff,
      avgCompletion: Math.round(avgCompletion),
      avgQuizScore: Math.round(avgQuizScore),
      completedCount,
    };
  }, [staffProgress]);

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

  const isLoading = progressLoading || quizzesLoading;

  const getInitials = (staff: StaffProgress['staff_users']) => {
    const name =
      staff.display_name ||
      staff.team_members?.name ||
      staff.email ||
      'Unknown';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getDisplayName = (staff: StaffProgress['staff_users']) => {
    return (
      staff.display_name ||
      staff.team_members?.name ||
      staff.email ||
      'Unknown Staff'
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };
  
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      {/* Back Link */}
      <Link
        to="/sales-experience"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Overview
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Team Quiz Results</h1>
        <p className="text-muted-foreground">
          Track your team's progress through the 8-Week Sales Experience training
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{teamStats.totalStaff}</span>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{teamStats.avgCompletion}%</span>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Quiz Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{teamStats.avgQuizScore}%</span>
              <Target className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fully Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{teamStats.completedCount}</span>
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Progress Table */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Individual Progress
          </CardTitle>
          <CardDescription>
            Lesson completion and quiz scores by team member
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : staffProgress && staffProgress.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                  <TableHead className="text-center">Avg. Quiz</TableHead>
                  <TableHead className="text-right">Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffProgress.map((staff) => {
                  const completionPct =
                    staff.total_lessons > 0
                      ? Math.round(
                          (staff.completed_lessons / staff.total_lessons) * 100
                        )
                      : 0;

                  return (
                    <TableRow key={staff.staff_user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(staff.staff_users)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {getDisplayName(staff.staff_users)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[150px]">
                          <Progress value={completionPct} className="h-2" />
                          <span className="text-sm text-muted-foreground w-12">
                            {completionPct}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={staff.completed_lessons === staff.total_lessons ? 'default' : 'outline'}>
                          {staff.completed_lessons}/{staff.total_lessons}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {staff.avg_quiz_score !== null ? (
                          <span
                            className={`font-semibold ${getScoreColor(
                              staff.avg_quiz_score
                            )}`}
                          >
                            {Math.round(staff.avg_quiz_score)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {staff.last_activity ? (
                          new Date(staff.last_activity).toLocaleDateString()
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No staff members have started training yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Quiz Attempts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Recent Quiz Completions
          </CardTitle>
          <CardDescription>Latest quiz attempts from your team</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentQuizzes && recentQuizzes.length > 0 ? (
            <div className="space-y-3">
              {recentQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {quiz.staff_users?.display_name
                          ?.split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2) || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">
                        {quiz.staff_users?.display_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Week{' '}
                        {quiz.sales_experience_lessons?.sales_experience_modules
                          ?.week_number || '?'}{' '}
                        - {quiz.sales_experience_lessons?.title || 'Unknown Lesson'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`font-bold ${getScoreColor(quiz.score_percent)}`}
                    >
                      {quiz.score_percent}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(quiz.completed_at)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedQuiz(quiz)}
                    >
                      View Responses
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No quiz completions yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedQuiz && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">
              Quiz Responses
            </CardTitle>
            <CardDescription>
              {selectedQuiz.staff_users?.display_name || 'Unknown'} • Week{' '}
              {selectedQuiz.sales_experience_lessons?.sales_experience_modules?.week_number || '?'} •{' '}
              {selectedQuiz.sales_experience_lessons?.title || 'Unknown Lesson'} •{' '}
              {formatDate(selectedQuiz.completed_at)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <span className={`text-2xl font-bold ${getScoreColor(selectedQuiz.score_percent)}`}>
                {selectedQuiz.score_percent}%
              </span>
              {selectedQuiz.feedback_ai ? (
                <span className="text-sm text-muted-foreground">
                  AI Feedback available below
                </span>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedQuiz(null)}
              >
                Close
              </Button>
            </div>

            {selectedQuiz.answers_json && selectedQuiz.answers_json.length > 0 ? (
              <div className="space-y-3">
                {selectedQuiz.answers_json.map((answer, index) => (
                  <div key={answer.question_id || index} className="p-3 rounded-lg border">
                    <p className="font-medium mb-2">
                      {index + 1}. {answer.question}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Answer:</span>{' '}
                      {answer.user_answer || '--'}
                    </p>
                    {answer.correct_answer ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold">Correct:</span>{' '}
                        {answer.correct_answer}
                      </p>
                    ) : null}
                    {typeof answer.is_correct === 'boolean' ? (
                      <p className="text-sm">
                        <span className="font-semibold">Result:</span>{' '}
                        <span className={answer.is_correct ? 'text-green-600' : 'text-red-600'}>
                          {answer.is_correct ? 'Correct' : 'Incorrect'}
                        </span>
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No responses recorded.</p>
            )}

            {selectedQuiz.feedback_ai ? (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-semibold mb-1">AI Feedback</p>
                <p className="text-sm whitespace-pre-wrap">{selectedQuiz.feedback_ai}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
