import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Download, ChevronDown, ChevronRight, CheckCircle2, Circle, Trophy, Clock, Users, BookOpen, TrendingUp, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';
import { exportToCSV } from '@/utils/exportUtils';
import { toast } from 'sonner';

type SortField = 'name' | 'modules' | 'completed' | 'percentage' | 'lastActivity' | 'status';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'On Track' | 'Behind' | 'Overdue';

export default function AdminTrainingProgress() {
  const { user } = useAuth();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get agency_id from user profile
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const agencyId = profile?.agency_id;

  // Fetch all data in parallel
  const { data: allData, isLoading } = useQuery({
    queryKey: ['admin-training-progress', agencyId],
    queryFn: async () => {
      const [
        { data: staffUsers, error: staffError },
        { data: assignments, error: assignmentsError },
        { data: lessonProgress, error: progressError },
        { data: quizAttempts, error: quizError },
        { data: lessons, error: lessonsError },
        { data: modules, error: modulesError },
        { data: quizzes, error: quizzesError }
      ] = await Promise.all([
        supabase.from('staff_users').select('*').eq('agency_id', agencyId).eq('is_active', true),
        supabase.from('training_assignments').select('*').eq('agency_id', agencyId),
        supabase.from('staff_lesson_progress').select('*'),
        supabase.from('training_quiz_attempts').select('*').eq('agency_id', agencyId),
        supabase.from('training_lessons').select('*').eq('agency_id', agencyId),
        supabase.from('training_modules').select('*').eq('agency_id', agencyId),
        supabase.from('training_quizzes').select('*').eq('agency_id', agencyId)
      ]);

      if (staffError) throw staffError;
      if (assignmentsError) throw assignmentsError;
      if (progressError) throw progressError;
      if (quizError) throw quizError;
      if (lessonsError) throw lessonsError;
      if (modulesError) throw modulesError;
      if (quizzesError) throw quizzesError;

      return {
        staffUsers: staffUsers || [],
        assignments: assignments || [],
        lessonProgress: lessonProgress || [],
        quizAttempts: quizAttempts || [],
        lessons: lessons || [],
        modules: modules || [],
        quizzes: quizzes || []
      };
    },
    enabled: !!agencyId,
  });

  // Create lookup maps
  const lessonToModule = useMemo(() => 
    new Map(allData?.lessons.map(l => [l.id, l.module_id])),
    [allData?.lessons]
  );

  const moduleMap = useMemo(() => 
    new Map(allData?.modules.map(m => [m.id, m])),
    [allData?.modules]
  );

  const quizMap = useMemo(() =>
    new Map(allData?.quizzes.map(q => [q.id, q])),
    [allData?.quizzes]
  );

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!allData) return { totalStaff: 0, totalCompleted: 0, avgCompletion: 0, overdueCount: 0 };

    const staffUserIds = new Set(allData.staffUsers.map(s => s.id));
    const totalCompleted = allData.lessonProgress.filter(
      p => staffUserIds.has(p.staff_user_id) && p.completed
    ).length;

    // Calculate total assigned lessons
    const assignmentLessonCounts = allData.assignments.map(a => {
      const moduleId = a.module_id;
      return allData.lessons.filter(l => l.module_id === moduleId).length;
    });
    const totalAssignedLessons = assignmentLessonCounts.reduce((sum, count) => sum + count, 0);

    const avgCompletion = totalAssignedLessons > 0 
      ? Math.round((totalCompleted / totalAssignedLessons) * 100)
      : 0;

    const overdueCount = allData.assignments.filter(a => 
      a.due_date && isPast(parseISO(a.due_date))
    ).length;

    return {
      totalStaff: allData.staffUsers.length,
      totalCompleted,
      avgCompletion,
      overdueCount
    };
  }, [allData]);

  // Build staff progress data
  const staffProgressData = useMemo(() => {
    if (!allData) return [];

    return allData.staffUsers.map((staff: any) => {
      // Get assignments for this staff
      const staffAssignments = allData.assignments.filter(a => a.staff_user_id === staff.id);
      
      // Calculate completed lessons
      const completedLessons = allData.lessonProgress.filter(
        p => p.staff_user_id === staff.id && p.completed
      ).length;

      // Calculate total lessons across all assignments
      const totalLessons = staffAssignments.reduce((total, assignment) => {
        const moduleId = assignment.module_id;
        const lessonsInModule = allData.lessons.filter(l => l.module_id === moduleId).length;
        return total + lessonsInModule;
      }, 0);

      const completionPercentage = totalLessons > 0 
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;

      // Get last activity
      const staffProgress = allData.lessonProgress.filter(p => p.staff_user_id === staff.id);
      const staffQuizzes = allData.quizAttempts.filter(q => q.staff_user_id === staff.id);
      
      const progressDates = staffProgress
        .filter(p => p.completed_at)
        .map(p => parseISO(p.completed_at!));
      
      const quizDates = staffQuizzes
        .filter(q => q.completed_at)
        .map(q => parseISO(q.completed_at!));
      
      const allDates = [...progressDates, ...quizDates];
      const lastActivity = allDates.length > 0 
        ? new Date(Math.max(...allDates.map(d => d.getTime())))
        : null;

      // Calculate status
      let status: 'On Track' | 'Behind' | 'Overdue' = 'On Track';
      const hasOverdue = staffAssignments.some(a => a.due_date && isPast(parseISO(a.due_date)));
      
      if (hasOverdue) {
        status = 'Overdue';
      } else if (completionPercentage < 50 && staffAssignments.some(a => a.due_date)) {
        status = 'Behind';
      }

      return {
        id: staff.id,
        name: staff.display_name || staff.email,
        email: staff.email,
        assignedModules: staffAssignments.length,
        completedLessons,
        totalLessons,
        completionPercentage,
        lastActivity,
        status,
        assignments: staffAssignments
      };
    });
  }, [allData]);

  // Build quiz scores data
  const quizScoresData = useMemo(() => {
    if (!allData) return [];

    const staffMap = new Map(allData.staffUsers.map((s: any) => [s.id, s]));
    
    // Group attempts by staff + quiz
    const groupedAttempts = new Map<string, any[]>();
    
    allData.quizAttempts.forEach((attempt: any) => {
      const key = `${attempt.staff_user_id}-${attempt.quiz_id}`;
      if (!groupedAttempts.has(key)) {
        groupedAttempts.set(key, []);
      }
      groupedAttempts.get(key)!.push(attempt);
    });

    return Array.from(groupedAttempts.entries()).map(([key, attempts]) => {
      const [staffUserId, quizId] = key.split('-');
      const staff: any = staffMap.get(staffUserId);
      const quiz: any = quizMap.get(quizId);
      
      const scores = attempts.map(a => a.score_percent || 0);
      const bestScore = Math.max(...scores);
      const latestAttempt = attempts.reduce((latest, current) => 
        !latest || (current.completed_at && (!latest.completed_at || current.completed_at > latest.completed_at))
          ? current
          : latest
      );

      return {
        staffName: staff?.display_name || staff?.email || 'Unknown',
        quizName: quiz?.name || 'Unknown Quiz',
        latestScore: latestAttempt.score_percent || 0,
        attempts: attempts.length,
        bestScore,
        date: latestAttempt.completed_at ? parseISO(latestAttempt.completed_at) : null
      };
    });
  }, [allData, quizMap]);

  // Apply filters and sorting
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...staffProgressData];

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(staff => 
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(staff => staff.status === statusFilter);
    }

    // Apply module filter
    if (moduleFilter !== 'all') {
      filtered = filtered.filter(staff => 
        staff.assignments.some(a => a.module_id === moduleFilter)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'modules':
          aVal = a.assignedModules;
          bVal = b.assignedModules;
          break;
        case 'completed':
          aVal = a.completedLessons;
          bVal = b.completedLessons;
          break;
        case 'percentage':
          aVal = a.completionPercentage;
          bVal = b.completionPercentage;
          break;
        case 'lastActivity':
          aVal = a.lastActivity?.getTime() || 0;
          bVal = b.lastActivity?.getTime() || 0;
          break;
        case 'status':
          const statusOrder = { 'Overdue': 0, 'Behind': 1, 'On Track': 2 };
          aVal = statusOrder[a.status];
          bVal = statusOrder[b.status];
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [staffProgressData, searchQuery, statusFilter, moduleFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleRow = (staffId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(staffId)) {
      newExpanded.delete(staffId);
    } else {
      newExpanded.add(staffId);
    }
    setExpandedRows(newExpanded);
  };

  const handleExportCSV = () => {
    if (!allData) return;

    const exportData = staffProgressData.flatMap(staff => {
      return staff.assignments.flatMap((assignment: any) => {
        const module: any = moduleMap.get(assignment.module_id);
        const moduleLessons = allData.lessons.filter((l: any) => l.module_id === assignment.module_id);
        
        return moduleLessons.map((lesson: any) => {
          const progress = allData.lessonProgress.find(
            (p: any) => p.staff_user_id === staff.id && p.lesson_id === lesson.id
          );

          const lessonQuiz = allData.quizzes.find((q: any) => q.lesson_id === lesson.id);
          const quizAttempt = lessonQuiz 
            ? allData.quizAttempts
                .filter((a: any) => a.staff_user_id === staff.id && a.quiz_id === lessonQuiz.id)
                .sort((a: any, b: any) => (b.score_percent || 0) - (a.score_percent || 0))[0]
            : null;

          return {
            'Staff Name': staff.name,
            'Staff Email': staff.email,
            'Module': module?.name || 'Unknown',
            'Lesson': lesson.name,
            'Completed': progress?.completed ? 'Yes' : 'No',
            'Completed Date': progress?.completed_at || '',
            'Quiz Score': quizAttempt ? `${quizAttempt.score_percent}%` : '',
            'Due Date': assignment.due_date || '',
            'Status': staff.status
          };
        });
      });
    });

    exportToCSV(exportData, `training-progress-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Progress data exported to CSV');
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'On Track': 'default',
      'Behind': 'secondary',
      'Overdue': 'destructive'
    };
    return (
      <Badge variant={variants[status as keyof typeof variants] as any}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Training Progress Dashboard</h1>
          <p className="text-muted-foreground">Monitor staff training completion and performance</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalStaff}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lessons Completed</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalCompleted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.avgCompletion}%</div>
          </CardContent>
        </Card>

        <Card className={summaryStats.overdueCount > 0 ? 'border-destructive' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Assignments</CardTitle>
            <AlertCircle className={`h-4 w-4 ${summaryStats.overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summaryStats.overdueCount > 0 ? 'text-destructive' : ''}`}>
              {summaryStats.overdueCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Progress</CardTitle>
          <CardDescription>View and filter training progress by staff member</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="On Track">On Track</SelectItem>
                <SelectItem value="Behind">Behind</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="sm:w-[200px]">
                <SelectValue placeholder="Filter by module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {allData?.modules.map(module => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Staff Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    Staff Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('modules')}
                  >
                    Assigned {sortField === 'modules' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('completed')}
                  >
                    Completed {sortField === 'completed' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('percentage')}
                  >
                    Progress {sortField === 'percentage' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('lastActivity')}
                  >
                    Last Activity {sortField === 'lastActivity' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('status')}
                  >
                    Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No staff members found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedData.map((staff) => (
                    <>
                      <TableRow 
                        key={staff.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(staff.id)}
                      >
                        <TableCell>
                          {expandedRows.has(staff.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>
                            <div>{staff.name}</div>
                            <div className="text-xs text-muted-foreground">{staff.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{staff.assignedModules} modules</TableCell>
                        <TableCell>{staff.completedLessons} / {staff.totalLessons}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-muted rounded-full h-2 max-w-[100px]">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${staff.completionPercentage}%` }}
                              />
                            </div>
                            <span className="text-sm">{staff.completionPercentage}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {staff.lastActivity 
                            ? formatDistanceToNow(staff.lastActivity, { addSuffix: true })
                            : 'No activity'
                          }
                        </TableCell>
                        <TableCell>{getStatusBadge(staff.status)}</TableCell>
                      </TableRow>
                      
                      {/* Expanded Row Details */}
                      {expandedRows.has(staff.id) && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-6">
                            <div className="space-y-4">
                              <h4 className="font-semibold text-sm">Assigned Modules & Lessons</h4>
                              {staff.assignments.map((assignment: any) => {
                                const module: any = moduleMap.get(assignment.module_id);
                                const moduleLessons = allData?.lessons.filter((l: any) => l.module_id === assignment.module_id) || [];
                                
                                return (
                                  <div key={assignment.id} className="border rounded-lg p-4 bg-background">
                                    <div className="flex items-center justify-between mb-3">
                                      <h5 className="font-medium">{module?.name || 'Unknown Module'}</h5>
                                      {assignment.due_date && (
                                        <Badge variant={isPast(parseISO(assignment.due_date)) ? 'destructive' : 'secondary'}>
                                          <Clock className="h-3 w-3 mr-1" />
                                          Due {formatDistanceToNow(parseISO(assignment.due_date), { addSuffix: true })}
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <div className="space-y-2">
                                      {moduleLessons.map((lesson: any) => {
                                        const progress = allData?.lessonProgress.find(
                                          (p: any) => p.staff_user_id === staff.id && p.lesson_id === lesson.id
                                        );
                                        
                                        const lessonQuiz = allData?.quizzes.find((q: any) => q.lesson_id === lesson.id);
                                        const quizAttempt = lessonQuiz 
                                          ? allData?.quizAttempts
                                              .filter((a: any) => a.staff_user_id === staff.id && a.quiz_id === lessonQuiz.id)
                                              .sort((a: any, b: any) => (b.score_percent || 0) - (a.score_percent || 0))[0]
                                          : null;

                                        return (
                                          <div key={lesson.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                            <div className="flex items-center gap-2">
                                              {progress?.completed ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                              ) : (
                                                <Circle className="h-4 w-4 text-muted-foreground" />
                                              )}
                                              <span className={progress?.completed ? 'text-muted-foreground line-through' : ''}>
                                                {lesson.name}
                                              </span>
                                            </div>
                                            {quizAttempt && (
                                              <Badge variant="outline" className="gap-1">
                                                <Trophy className="h-3 w-3" />
                                                Quiz: {quizAttempt.score_percent}%
                                              </Badge>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quiz Scores Section */}
      <Card>
        <CardHeader>
          <CardTitle>Quiz Performance</CardTitle>
          <CardDescription>View quiz attempts and scores across all staff</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Name</TableHead>
                  <TableHead>Quiz Name</TableHead>
                  <TableHead>Latest Score</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Best Score</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizScoresData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No quiz attempts yet
                    </TableCell>
                  </TableRow>
                ) : (
                  quizScoresData.map((score, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{score.staffName}</TableCell>
                      <TableCell>{score.quizName}</TableCell>
                      <TableCell>
                        <Badge variant={score.latestScore >= 80 ? 'default' : 'secondary'}>
                          {score.latestScore}%
                        </Badge>
                      </TableCell>
                      <TableCell>{score.attempts}</TableCell>
                      <TableCell>
                        <Badge variant={score.bestScore >= 80 ? 'default' : 'secondary'}>
                          <Trophy className="h-3 w-3 mr-1 inline" />
                          {score.bestScore}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {score.date 
                          ? formatDistanceToNow(score.date, { addSuffix: true })
                          : 'Unknown'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
