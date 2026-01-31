import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Download, ChevronDown, ChevronRight, Users, BookOpen, TrendingUp, AlertCircle, MessageSquare, Trash2, UserX } from 'lucide-react';
import { formatDistanceToNow, isPast, parseISO, format } from 'date-fns';
import { exportToCSV } from '@/utils/exportUtils';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAgencyRosterWithStaffLogins, TeamMemberWithLogin } from '@/hooks/useAgencyRosterWithStaffLogins';
import { Link } from 'react-router-dom';

type SortField = 'name' | 'modules' | 'completed' | 'percentage' | 'lastActivity' | 'status';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'On Track' | 'Behind' | 'Overdue';

// Session storage key for filter state
const PROGRESS_FILTERS_KEY = 'training_progress_filters';

interface TrainingProgressTabProps {
  agencyId: string;
}

export function TrainingProgressTab({ agencyId }: TrainingProgressTabProps) {
  // Initialize filter state from sessionStorage to survive tab switches
  const getInitialFilters = () => {
    try {
      const saved = sessionStorage.getItem(PROGRESS_FILTERS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  };
  const initialFilters = getInitialFilters();

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>(initialFilters?.sortField || 'name');
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialFilters?.sortDirection || 'asc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilters?.statusFilter || 'all');
  const [moduleFilter, setModuleFilter] = useState<string>(initialFilters?.moduleFilter || 'all');
  const [searchQuery, setSearchQuery] = useState(initialFilters?.searchQuery || '');
  const [expandedReflections, setExpandedReflections] = useState<Set<string>>(new Set());
  const [reflectionStaffFilter, setReflectionStaffFilter] = useState<string>(initialFilters?.reflectionStaffFilter || 'all');

  // Persist filter state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(PROGRESS_FILTERS_KEY, JSON.stringify({
      sortField,
      sortDirection,
      statusFilter,
      moduleFilter,
      searchQuery,
      reflectionStaffFilter,
    }));
  }, [sortField, sortDirection, statusFilter, moduleFilter, searchQuery, reflectionStaffFilter]);

  // Get unified roster with login status
  const { data: rosterData, isLoading: rosterLoading } = useAgencyRosterWithStaffLogins(agencyId);

  // Fetch training data (assignments, progress, etc.)
  const { data: allData, isLoading: trainingLoading } = useQuery({
    queryKey: ['admin-training-progress', agencyId],
    queryFn: async () => {
      const [
        { data: assignments, error: assignmentsError },
        { data: lessonProgress, error: progressError },
        { data: quizAttempts, error: quizError },
        { data: lessons, error: lessonsError },
        { data: modules, error: modulesError },
        { data: quizzes, error: quizzesError }
      ] = await Promise.all([
        supabase.from('training_assignments').select('*').eq('agency_id', agencyId),
        supabase.from('staff_lesson_progress').select('*'),
        supabase.from('training_quiz_attempts').select('*').eq('agency_id', agencyId).order('completed_at', { ascending: false }),
        supabase.from('training_lessons').select('*').eq('agency_id', agencyId),
        supabase.from('training_modules').select('*').eq('agency_id', agencyId),
        supabase.from('training_quizzes').select('*').eq('agency_id', agencyId)
      ]);

      if (assignmentsError) throw assignmentsError;
      if (progressError) throw progressError;
      if (quizError) throw quizError;
      if (lessonsError) throw lessonsError;
      if (modulesError) throw modulesError;
      if (quizzesError) throw quizzesError;

      return {
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

  const isLoading = rosterLoading || trainingLoading;

  // Get active staff users from roster (those with logins)
  const activeStaffUsers = useMemo(() => {
    if (!rosterData?.roster) return [];
    return rosterData.roster
      .filter(m => m.staffUser !== null)
      .map(m => m.staffUser!);
  }, [rosterData?.roster]);

  // Create lookup maps
  const moduleMap = useMemo(() => 
    new Map(allData?.modules.map(m => [m.id, m])),
    [allData?.modules]
  );

  const quizMap = useMemo(() =>
    new Map(allData?.quizzes.map(q => [q.id, q])),
    [allData?.quizzes]
  );

  const staffMap = useMemo(() =>
    new Map(activeStaffUsers.map(s => [s.id, s])),
    [activeStaffUsers]
  );

  // Calculate summary stats - now uses roster count for total
  const summaryStats = useMemo(() => {
    if (!allData || !rosterData) return { totalTeamMembers: 0, staffWithLogins: 0, totalCompleted: 0, avgCompletion: 0, overdueCount: 0 };

    const staffUserIds = new Set(activeStaffUsers.map(s => s.id));
    const totalCompleted = allData.lessonProgress.filter(
      p => staffUserIds.has(p.staff_user_id) && p.completed
    ).length;

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
      totalTeamMembers: rosterData.roster.length,
      staffWithLogins: activeStaffUsers.length,
      totalCompleted,
      avgCompletion,
      overdueCount
    };
  }, [allData, rosterData, activeStaffUsers]);

  // Build staff progress data - now based on roster (team members)
  const staffProgressData = useMemo(() => {
    if (!allData || !rosterData) return [];

    return rosterData.roster.map((member: TeamMemberWithLogin) => {
      const staffUserId = member.staffUser?.id;
      const hasStaffLogin = member.loginStatus === 'active';
      
      // Get assignments for this staff user (if they have a login)
      const staffAssignments = staffUserId 
        ? allData.assignments.filter(a => a.staff_user_id === staffUserId)
        : [];
      
      const completedLessons = staffUserId 
        ? allData.lessonProgress.filter(
            p => p.staff_user_id === staffUserId && p.completed
          ).length
        : 0;

      const totalLessons = staffAssignments.reduce((total, assignment) => {
        const moduleId = assignment.module_id;
        const lessonsInModule = allData.lessons.filter(l => l.module_id === moduleId).length;
        return total + lessonsInModule;
      }, 0);

      const completionPercentage = totalLessons > 0 
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;

      const staffProgress = staffUserId 
        ? allData.lessonProgress.filter(p => p.staff_user_id === staffUserId)
        : [];
      const staffQuizzes = staffUserId 
        ? allData.quizAttempts.filter(q => q.staff_user_id === staffUserId)
        : [];
      
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

      let status: 'On Track' | 'Behind' | 'Overdue' | 'No Access' = hasStaffLogin ? 'On Track' : 'No Access';
      
      if (hasStaffLogin) {
        const hasOverdue = staffAssignments.some(a => a.due_date && isPast(parseISO(a.due_date)));
        if (hasOverdue) {
          status = 'Overdue';
        } else if (completionPercentage < 50 && staffAssignments.some(a => a.due_date)) {
          status = 'Behind';
        }
      }

      return {
        id: member.id, // team_member.id
        staffUserId,
        name: member.name,
        email: member.email,
        loginStatus: member.loginStatus,
        hasStaffLogin,
        assignedModules: staffAssignments.length,
        completedLessons,
        totalLessons,
        completionPercentage,
        lastActivity,
        status,
        assignments: staffAssignments
      };
    });
  }, [allData, rosterData]);

  // Build quiz scores data with snapshot support
  const quizScoresData = useMemo(() => {
    if (!allData) return [];
    
    const groupedAttempts = new Map<string, any[]>();
    
    allData.quizAttempts.forEach((attempt: any) => {
      const key = `${attempt.staff_user_id}|${attempt.quiz_id || 'deleted'}`;
      if (!groupedAttempts.has(key)) {
        groupedAttempts.set(key, []);
      }
      groupedAttempts.get(key)!.push(attempt);
    });

    return Array.from(groupedAttempts.entries()).map(([key, attempts]) => {
      const [staffUserId] = key.split('|');
      const staff: any = staffMap.get(staffUserId);
      const latestAttempt = attempts[0]; // Already sorted by completed_at desc
      const quiz: any = latestAttempt.quiz_id ? quizMap.get(latestAttempt.quiz_id) : null;
      
      const scores = attempts.map(a => a.score_percent || 0);
      const bestScore = Math.max(...scores);

      // Use snapshot name if quiz was deleted, fallback to current quiz name
      const quizName = quiz?.name || latestAttempt.quiz_name || 'Unknown Quiz';
      const isDeleted = !quiz && latestAttempt.quiz_id === null;

      return {
        staffName: staff?.display_name || staff?.email || 'Unknown',
        quizName,
        isDeleted,
        lessonName: latestAttempt.lesson_name,
        moduleName: latestAttempt.module_name,
        categoryName: latestAttempt.category_name,
        latestScore: latestAttempt.score_percent || 0,
        attempts: attempts.length,
        bestScore,
        date: latestAttempt.completed_at ? parseISO(latestAttempt.completed_at) : null
      };
    });
  }, [allData, quizMap, staffMap]);

  // Build reflection review data - only attempts with reflections or AI feedback
  const reflectionReviewData = useMemo(() => {
    if (!allData) return [];

    return allData.quizAttempts
      .filter((attempt: any) => {
        const answers = attempt.answers_json || {};
        const hasReflections = answers.reflection_1 || answers.reflection_2;
        const hasAiFeedback = attempt.ai_feedback;
        return hasReflections || hasAiFeedback;
      })
      .map((attempt: any) => {
        const staff: any = staffMap.get(attempt.staff_user_id);
        const quiz: any = attempt.quiz_id ? quizMap.get(attempt.quiz_id) : null;
        const answers = attempt.answers_json || {};

        return {
          id: attempt.id,
          staffId: attempt.staff_user_id,
          staffName: staff?.display_name || staff?.email || 'Unknown',
          // Use snapshot names if content was deleted
          quizName: quiz?.name || attempt.quiz_name || 'Unknown Quiz',
          lessonName: attempt.lesson_name || 'Unknown Lesson',
          moduleName: attempt.module_name || 'Unknown Module',
          categoryName: attempt.category_name || 'Unknown Category',
          isDeleted: !quiz && attempt.quiz_id === null,
          score: attempt.score_percent || 0,
          reflection1: answers.reflection_1 || '',
          reflection2: answers.reflection_2 || '',
          aiFeedback: attempt.ai_feedback || null,
          feedbackViewedAt: attempt.feedback_viewed_at,
          completedAt: attempt.completed_at ? parseISO(attempt.completed_at) : null
        };
      });
  }, [allData, quizMap, staffMap]);

  // Filter reflection data by staff
  const filteredReflectionData = useMemo(() => {
    if (reflectionStaffFilter === 'all') return reflectionReviewData;
    return reflectionReviewData.filter(r => r.staffId === reflectionStaffFilter);
  }, [reflectionReviewData, reflectionStaffFilter]);

  // Apply filters and sorting
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...staffProgressData];

    if (searchQuery) {
      filtered = filtered.filter(staff => 
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(staff => staff.status === statusFilter);
    }

    if (moduleFilter !== 'all') {
      filtered = filtered.filter(staff => 
        staff.assignments.some(a => a.module_id === moduleFilter)
      );
    }

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

  const toggleReflection = (attemptId: string) => {
    const newExpanded = new Set(expandedReflections);
    if (newExpanded.has(attemptId)) {
      newExpanded.delete(attemptId);
    } else {
      newExpanded.add(attemptId);
    }
    setExpandedReflections(newExpanded);
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

  const handleExportReflections = () => {
    const exportData = filteredReflectionData.map(r => ({
      'Staff Name': r.staffName,
      'Category': r.categoryName,
      'Module': r.moduleName,
      'Lesson': r.lessonName,
      'Quiz': r.quizName,
      'Course Deleted': r.isDeleted ? 'Yes' : 'No',
      'Score': `${r.score}%`,
      'Reflection 1 - Main Takeaway': r.reflection1,
      'Reflection 2 - Why Important': r.reflection2,
      'AI Coaching Feedback': r.aiFeedback || '',
      'Feedback Viewed': r.feedbackViewedAt ? 'Yes' : 'No',
      'Completed At': r.completedAt ? format(r.completedAt, 'yyyy-MM-dd HH:mm') : ''
    }));

    exportToCSV(exportData, `reflections-export-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Reflections exported to CSV');
  };

  const getStatusBadge = (status: string, hasStaffLogin?: boolean) => {
    if (!hasStaffLogin || status === 'No Access') {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <UserX className="h-3 w-3 mr-1" />
          No Access
        </Badge>
      );
    }
    
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Training Progress</h2>
          <p className="text-muted-foreground text-sm">
            Monitor training completion for your team. Team roster is managed in{' '}
            <Link to="/agency/manage?tab=team" className="text-primary hover:underline">My Agency → Team</Link>.
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="flat">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalTeamMembers}</div>
            <p className="text-xs text-muted-foreground">{summaryStats.staffWithLogins} with portal access</p>
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
            <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.avgCompletion}%</div>
          </CardContent>
        </Card>

        <Card className={summaryStats.overdueCount > 0 ? 'border-destructive' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
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
                {allData?.modules.map(mod => (
                  <SelectItem key={mod.id} value={mod.id}>{mod.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                    Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('modules')}>
                    Modules {sortField === 'modules' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('completed')}>
                    Completed {sortField === 'completed' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('percentage')}>
                    Progress {sortField === 'percentage' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('lastActivity')}>
                    Last Activity {sortField === 'lastActivity' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                    Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No team members found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedData.map((staff) => (
                    <>
                      <TableRow key={staff.id} className="cursor-pointer" onClick={() => toggleRow(staff.id)}>
                        <TableCell>
                          {expandedRows.has(staff.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {staff.name}
                            {!staff.hasStaffLogin && (
                              <span className="text-xs text-muted-foreground">(no portal access)</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={!staff.hasStaffLogin ? 'text-muted-foreground' : ''}>
                          {staff.hasStaffLogin ? staff.assignedModules : '—'}
                        </TableCell>
                        <TableCell className={!staff.hasStaffLogin ? 'text-muted-foreground' : ''}>
                          {staff.hasStaffLogin ? `${staff.completedLessons}/${staff.totalLessons}` : '—'}
                        </TableCell>
                        <TableCell className={!staff.hasStaffLogin ? 'text-muted-foreground' : ''}>
                          {staff.hasStaffLogin ? `${staff.completionPercentage}%` : '—'}
                        </TableCell>
                        <TableCell className={!staff.hasStaffLogin ? 'text-muted-foreground' : ''}>
                          {staff.hasStaffLogin 
                            ? (staff.lastActivity 
                                ? formatDistanceToNow(staff.lastActivity, { addSuffix: true })
                                : 'Never')
                            : '—'
                          }
                        </TableCell>
                        <TableCell>{getStatusBadge(staff.status, staff.hasStaffLogin)}</TableCell>
                      </TableRow>
                      {expandedRows.has(staff.id) && staff.hasStaffLogin && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/50 p-4">
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Assigned Modules</h4>
                              {staff.assignments.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No modules assigned</p>
                              ) : (
                                <div className="grid gap-2">
                                  {staff.assignments.map((assignment: any) => {
                                    const module = moduleMap.get(assignment.module_id);
                                    const moduleLessons = allData?.lessons.filter(l => l.module_id === assignment.module_id) || [];
                                    const completedInModule = allData?.lessonProgress.filter(
                                      p => p.staff_user_id === staff.staffUserId && 
                                           moduleLessons.some(l => l.id === p.lesson_id) &&
                                           p.completed
                                    ).length || 0;
                                    
                                    return (
                                      <div key={assignment.id} className="flex items-center gap-4 text-sm">
                                        <span className="font-medium">{(module as any)?.name || 'Unknown'}</span>
                                        <span className="text-muted-foreground">
                                          {completedInModule}/{moduleLessons.length} lessons
                                        </span>
                                        {assignment.due_date && (
                                          <span className={isPast(parseISO(assignment.due_date)) ? 'text-destructive' : 'text-muted-foreground'}>
                                            Due: {new Date(assignment.due_date + 'T12:00:00').toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
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

      {/* Quiz Scores */}
      {quizScoresData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quiz Performance</CardTitle>
            <CardDescription>View quiz scores and attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Quiz</TableHead>
                    <TableHead>Latest Score</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Best Score</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quizScoresData.map((score, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{score.staffName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {score.quizName}
                          {score.isDeleted && (
                            <Badge variant="outline" className="text-muted-foreground">
                              <Trash2 className="h-3 w-3 mr-1" />
                              Deleted
                            </Badge>
                          )}
                        </div>
                        {score.isDeleted && score.lessonName && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {score.categoryName} → {score.moduleName} → {score.lessonName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{score.latestScore}%</TableCell>
                      <TableCell>{score.attempts}</TableCell>
                      <TableCell>{score.bestScore}%</TableCell>
                      <TableCell>
                        {score.date ? formatDistanceToNow(score.date, { addSuffix: true }) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reflection Review Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Reflection Review
              </CardTitle>
              <CardDescription>Review staff reflections and AI coaching feedback</CardDescription>
            </div>
            <Button onClick={handleExportReflections} variant="flat" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Reflections
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={reflectionStaffFilter} onValueChange={setReflectionStaffFilter}>
              <SelectTrigger className="sm:w-[250px]">
                <SelectValue placeholder="Filter by staff member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff Members</SelectItem>
                {activeStaffUsers.map(staff => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.display_name || staff.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredReflectionData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reflections found
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReflectionData.map((reflection) => (
                <Collapsible
                  key={reflection.id}
                  open={expandedReflections.has(reflection.id)}
                  onOpenChange={() => toggleReflection(reflection.id)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4 text-left">
                          {expandedReflections.has(reflection.id) ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          )}
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {reflection.staffName}
                              {reflection.isDeleted && (
                                <Badge variant="outline" className="text-muted-foreground text-xs">
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Course Deleted
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {reflection.moduleName} → {reflection.lessonName}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={reflection.score >= 70 ? 'default' : 'destructive'}>
                            {reflection.score}%
                          </Badge>
                          {reflection.aiFeedback && (
                            <Badge variant="outline" className="bg-primary/10">
                              AI Feedback
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground hidden sm:block">
                            {reflection.completedAt ? format(reflection.completedAt, 'MMM d, yyyy') : '-'}
                          </span>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t p-4 space-y-4 bg-muted/30">
                        {/* Reflection Answers */}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Main Takeaway</h4>
                            <p className="text-sm bg-background p-3 rounded-md border">
                              {reflection.reflection1 || <span className="text-muted-foreground italic">No response</span>}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Why It's Important</h4>
                            <p className="text-sm bg-background p-3 rounded-md border">
                              {reflection.reflection2 || <span className="text-muted-foreground italic">No response</span>}
                            </p>
                          </div>
                        </div>

                        {/* AI Coaching Feedback */}
                        {reflection.aiFeedback && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-primary" />
                              AI Coaching Feedback
                              {reflection.feedbackViewedAt && (
                                <Badge variant="outline" className="text-xs">
                                  Viewed by staff
                                </Badge>
                              )}
                            </h4>
                            <div className="text-sm bg-primary/5 p-4 rounded-md border border-primary/20 whitespace-pre-wrap">
                              {reflection.aiFeedback}
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}