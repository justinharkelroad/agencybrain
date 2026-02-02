import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  Users,
  Building2,
  BookOpen,
  Trophy,
  TrendingUp,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface AssignmentWithProgress {
  id: string;
  agency_id: string;
  start_date: string;
  status: string;
  agencies: {
    name: string;
  };
  owner_progress: {
    id: string;
    status: string;
    lesson_id: string;
  }[];
  staff_progress: {
    id: string;
    status: string;
    quiz_score: number | null;
    staff_user_id: string;
  }[];
}

interface AnalyticsSummary {
  totalAssignments: number;
  activeAssignments: number;
  completedAssignments: number;
  averageOwnerCompletion: number;
  averageStaffCompletion: number;
  averageQuizScore: number;
}

export function SEAnalyticsTab() {
  // Fetch assignments with progress data
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['admin-se-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_assignments')
        .select(`
          id,
          agency_id,
          start_date,
          status,
          agencies(name),
          owner_progress:sales_experience_owner_progress(id, status, lesson_id),
          staff_progress:sales_experience_staff_progress(id, status, quiz_score, staff_user_id)
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data as AssignmentWithProgress[];
    },
  });

  // Fetch total lessons count
  const { data: lessonsCount } = useQuery({
    queryKey: ['admin-se-lessons-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('sales_experience_lessons')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 24; // Default to 24 lessons (3 per week x 8 weeks)
    },
  });

  const totalLessons = lessonsCount || 24;

  // Calculate summary statistics
  const summary: AnalyticsSummary | null = assignments
    ? {
        totalAssignments: assignments.length,
        activeAssignments: assignments.filter((a) => a.status === 'active').length,
        completedAssignments: assignments.filter((a) => a.status === 'completed').length,
        averageOwnerCompletion: calculateAverageOwnerCompletion(assignments, totalLessons),
        averageStaffCompletion: calculateAverageStaffCompletion(assignments),
        averageQuizScore: calculateAverageQuizScore(assignments),
      }
    : null;

  if (assignmentsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Analytics Overview</h2>
        <p className="text-sm text-muted-foreground">
          Track participation and completion rates across all agencies
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalAssignments || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.activeAssignments || 0} active, {summary?.completedAssignments || 0}{' '}
              completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Owner Completion</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.averageOwnerCompletion?.toFixed(0) || 0}%
            </div>
            <Progress value={summary?.averageOwnerCompletion || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Staff Quiz Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.averageQuizScore?.toFixed(0) || 0}%
            </div>
            <Progress value={summary?.averageQuizScore || 0} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Per-Agency Progress Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Agency Progress
          </CardTitle>
          <CardDescription>
            Detailed progress breakdown for each enrolled agency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner Progress</TableHead>
                <TableHead>Staff Enrolled</TableHead>
                <TableHead>Staff Completion</TableHead>
                <TableHead>Avg Quiz Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No assignments yet.
                  </TableCell>
                </TableRow>
              ) : (
                assignments?.map((assignment) => {
                  const ownerCompleted = assignment.owner_progress?.filter(
                    (p) => p.status === 'completed'
                  ).length || 0;
                  const ownerProgress = (ownerCompleted / totalLessons) * 100;

                  const uniqueStaff = new Set(
                    assignment.staff_progress?.map((p) => p.staff_user_id) || []
                  );
                  const staffCount = uniqueStaff.size;

                  const staffCompleted = assignment.staff_progress?.filter(
                    (p) => p.status === 'completed'
                  ).length || 0;
                  const totalStaffLessons = staffCount * totalLessons;
                  const staffCompletionRate =
                    totalStaffLessons > 0 ? (staffCompleted / totalStaffLessons) * 100 : 0;

                  const quizScores = assignment.staff_progress
                    ?.filter((p) => p.quiz_score !== null)
                    .map((p) => p.quiz_score as number) || [];
                  const avgQuizScore =
                    quizScores.length > 0
                      ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
                      : 0;

                  return (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{assignment.agencies.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={assignment.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={ownerProgress} className="w-20" />
                          <span className="text-sm text-muted-foreground">
                            {ownerCompleted}/{totalLessons}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{staffCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={staffCompletionRate} className="w-20" />
                          <span className="text-sm text-muted-foreground">
                            {staffCompletionRate.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {quizScores.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            <span>{avgQuizScore.toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; className: string }> = {
    active: { icon: TrendingUp, className: 'bg-green-500/10 text-green-600 border-green-500/30' },
    pending: { icon: Clock, className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
    completed: {
      icon: CheckCircle2,
      className: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
    },
    paused: { icon: Clock, className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
    cancelled: { icon: Clock, className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  };

  const { icon: Icon, className } = config[status] || config.pending;

  return (
    <Badge variant="outline" className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function calculateAverageOwnerCompletion(
  assignments: AssignmentWithProgress[],
  totalLessons: number
): number {
  if (assignments.length === 0) return 0;

  const activeAssignments = assignments.filter((a) => ['active', 'completed'].includes(a.status));
  if (activeAssignments.length === 0) return 0;

  const totalCompletion = activeAssignments.reduce((sum, assignment) => {
    const completed =
      assignment.owner_progress?.filter((p) => p.status === 'completed').length || 0;
    return sum + (completed / totalLessons) * 100;
  }, 0);

  return totalCompletion / activeAssignments.length;
}

function calculateAverageStaffCompletion(assignments: AssignmentWithProgress[]): number {
  const activeAssignments = assignments.filter((a) => ['active', 'completed'].includes(a.status));
  if (activeAssignments.length === 0) return 0;

  let totalProgress = 0;
  let totalStaff = 0;

  activeAssignments.forEach((assignment) => {
    const staffUsers = new Set(assignment.staff_progress?.map((p) => p.staff_user_id) || []);
    totalStaff += staffUsers.size;

    const completed =
      assignment.staff_progress?.filter((p) => p.status === 'completed').length || 0;
    totalProgress += completed;
  });

  return totalStaff > 0 ? (totalProgress / (totalStaff * 24)) * 100 : 0;
}

function calculateAverageQuizScore(assignments: AssignmentWithProgress[]): number {
  const allScores: number[] = [];

  assignments.forEach((assignment) => {
    assignment.staff_progress?.forEach((progress) => {
      if (progress.quiz_score !== null) {
        allScores.push(progress.quiz_score);
      }
    });
  });

  if (allScores.length === 0) return 0;
  return allScores.reduce((a, b) => a + b, 0) / allScores.length;
}
