import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  ArrowLeft,
  User,
  Users,
  BookOpen,
  Building2,
  Trophy,
  Clock,
  Activity,
  Play,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  Video,
  MessageSquare,
  BarChart3,
  ClipboardCheck,
  XCircle,
} from 'lucide-react';
import { useTeamTrainingAnalytics, StaffTrainingMember } from '@/hooks/useTeamTrainingAnalytics';
import { useStaffTrainingDetail, type QuizQuestionDetail } from '@/hooks/useStaffTrainingDetail';

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return formatMinutes(Math.round(seconds / 60));
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function getTotalLessons(member: StaffTrainingMember): number {
  return (
    member.standardPlaybook.lessonsStarted +
    member.agencyTraining.lessonsStarted +
    (member.challenge.enrolled ? member.challenge.lessonsCompleted : 0) +
    member.salesExperience.lessonsCompleted
  );
}

function getTotalCompleted(member: StaffTrainingMember): number {
  return (
    member.standardPlaybook.lessonsCompleted +
    member.agencyTraining.lessonsCompleted +
    member.challenge.lessonsCompleted +
    member.salesExperience.lessonsCompleted
  );
}

type SortOption = 'most-completed' | 'name-asc' | 'name-desc' | 'last-active' | 'most-time';

export default function TrainingAnalytics() {
  const { data, isLoading, error } = useTeamTrainingAnalytics();
  const [selectedMember, setSelectedMember] = useState<StaffTrainingMember | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('most-completed');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive">Failed to load training analytics</p>
        <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  const { staffMembers = [], totals } = data || { staffMembers: [], totals: null };

  const sorted = [...staffMembers].sort((a, b) => {
    switch (sortBy) {
      case 'name-asc':
        return a.displayName.localeCompare(b.displayName);
      case 'name-desc':
        return b.displayName.localeCompare(a.displayName);
      case 'last-active': {
        const aDate = a.lastActivityOverall || '';
        const bDate = b.lastActivityOverall || '';
        if (bDate !== aDate) return bDate.localeCompare(aDate);
        return a.displayName.localeCompare(b.displayName);
      }
      case 'most-time': {
        if (b.totalTimeMinutes !== a.totalTimeMinutes) return b.totalTimeMinutes - a.totalTimeMinutes;
        return a.displayName.localeCompare(b.displayName);
      }
      case 'most-completed':
      default: {
        const aTotal = getTotalCompleted(a);
        const bTotal = getTotalCompleted(b);
        if (bTotal !== aTotal) return bTotal - aTotal;
        return a.displayName.localeCompare(b.displayName);
      }
    }
  });

  const openMemberDetail = (member: StaffTrainingMember) => {
    setSelectedMember(member);
    setDetailOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Link
        to="/training/agency/manage"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Manage Training
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium flex items-center gap-2">
          <BarChart3 className="h-6 w-6" strokeWidth={1.5} />
          Team Training Analytics
        </h1>
        <p className="text-muted-foreground/70 mt-1">
          See what your team is learning across all training programs
        </p>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                Team Size
              </CardDescription>
              <CardTitle className="text-3xl">{totals.totalStaff}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" />
                Active This Week
              </CardDescription>
              <CardTitle className="text-3xl">{totals.activeThisWeek}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                SP Lessons Done
              </CardDescription>
              <CardTitle className="text-3xl">{totals.spLessonsCompleted}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{totals.spLessonsStarted} started</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                Agency Lessons Done
              </CardDescription>
              <CardTitle className="text-3xl">{totals.agencyLessonsCompleted}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{totals.agencyLessonsStarted} started</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Time Invested
              </CardDescription>
              <CardTitle className="text-3xl">
                {formatMinutes(totals.totalEstimatedMinutes)}
              </CardTitle>
            </CardHeader>
            {totals.totalVideoSeconds > 0 && (
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  {formatSeconds(totals.totalVideoSeconds)} video watched
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Staff List */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold">No Active Staff</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Active staff members with training progress will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Team Members</h2>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="most-completed">Most Completed</SelectItem>
                <SelectItem value="last-active">Last Active</SelectItem>
                <SelectItem value="most-time">Most Time</SelectItem>
                <SelectItem value="name-asc">Name A-Z</SelectItem>
                <SelectItem value="name-desc">Name Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sorted.map((member) => {
            const totalCompleted = getTotalCompleted(member);
            const hasAnyActivity = totalCompleted > 0 || getTotalLessons(member) > 0;

            return (
              <Card
                key={member.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => openMemberDetail(member)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>

                    {/* Name & Status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{member.displayName}</h3>
                        {member.isActiveThisWeek && (
                          <Badge variant="outline" className="text-green-600 border-green-200 shrink-0">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {hasAnyActivity ? (
                          <>
                            {totalCompleted} lesson{totalCompleted !== 1 ? 's' : ''} completed
                            {member.totalTimeMinutes > 0 && (
                              <span className="mx-1">·</span>
                            )}
                            {member.totalTimeMinutes > 0 && formatMinutes(member.totalTimeMinutes)}
                          </>
                        ) : (
                          'No training activity yet'
                        )}
                      </p>
                    </div>

                    {/* Per-system badges (desktop) */}
                    <div className="hidden md:flex items-center gap-2">
                      {member.standardPlaybook.lessonsStarted > 0 && (
                        <Badge variant="secondary" className="shrink-0">
                          <BookOpen className="h-3 w-3 mr-1" />
                          SP: {member.standardPlaybook.lessonsCompleted}
                        </Badge>
                      )}
                      {member.agencyTraining.lessonsStarted > 0 && (
                        <Badge variant="secondary" className="shrink-0">
                          <Building2 className="h-3 w-3 mr-1" />
                          Agency: {member.agencyTraining.lessonsCompleted}
                        </Badge>
                      )}
                      {member.challenge.enrolled && (
                        <Badge variant="secondary" className="shrink-0">
                          <Trophy className="h-3 w-3 mr-1" />
                          Challenge: {member.challenge.lessonsCompleted}/{member.challenge.totalLessons}
                        </Badge>
                      )}
                      {member.salesExperience.enrolled && (
                        <Badge variant="secondary" className="shrink-0">
                          <GraduationCap className="h-3 w-3 mr-1" />
                          Sales Exp: {member.salesExperience.lessonsCompleted}/{member.salesExperience.totalLessons}
                        </Badge>
                      )}
                    </div>

                    {/* Last Activity */}
                    <div className="hidden lg:block text-sm text-muted-foreground whitespace-nowrap">
                      {formatRelativeDate(member.lastActivityOverall)}
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Member Detail Dialog */}
      {selectedMember && (
        <MemberDetailDialog
          member={selectedMember}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}
    </div>
  );
}

function MemberDetailDialog({
  member,
  open,
  onOpenChange,
}: {
  member: StaffTrainingMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: detail, isLoading: detailLoading, error: detailError } = useStaffTrainingDetail(
    open ? member.id : null
  );
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {member.displayName}
          </DialogTitle>
          <DialogDescription>
            Training activity across all programs
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sp">SP</TabsTrigger>
            <TabsTrigger value="agency">Agency</TabsTrigger>
            <TabsTrigger value="challenge">Challenge</TabsTrigger>
            <TabsTrigger value="sales">Sales Exp</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Lessons Done</div>
                <div className="text-2xl font-bold">{getTotalCompleted(member)}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Time Invested</div>
                <div className="text-2xl font-bold">
                  {formatMinutes(member.totalTimeMinutes)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Video Time</div>
                <div className="text-2xl font-bold">
                  {member.totalVideoSeconds > 0
                    ? formatSeconds(member.totalVideoSeconds)
                    : `${member.standardPlaybook.videosWatched} vids`}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Last Active</div>
                <div className="text-lg font-bold">
                  {formatRelativeDate(member.lastActivityOverall)}
                </div>
              </div>
            </div>

            {/* System Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                By Program
              </h3>

              {/* Standard Playbook */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Standard Playbook</span>
                  {member.standardPlaybook.lessonsStarted === 0 && (
                    <Badge variant="outline" className="text-xs">No activity</Badge>
                  )}
                </div>
                {member.standardPlaybook.lessonsStarted > 0 && (
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Started</div>
                      <div className="font-semibold">{member.standardPlaybook.lessonsStarted}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Completed</div>
                      <div className="font-semibold">{member.standardPlaybook.lessonsCompleted}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Time</div>
                      <div className="font-semibold">{formatMinutes(member.standardPlaybook.estimatedMinutes)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Agency Training */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">Agency Training</span>
                  {member.agencyTraining.lessonsStarted === 0 && (
                    <Badge variant="outline" className="text-xs">No activity</Badge>
                  )}
                </div>
                {member.agencyTraining.lessonsStarted > 0 && (
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Started</div>
                      <div className="font-semibold">{member.agencyTraining.lessonsStarted}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Completed</div>
                      <div className="font-semibold">{member.agencyTraining.lessonsCompleted}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Assigned</div>
                      <div className="font-semibold">
                        {member.agencyTraining.assignmentsCompleted}/{member.agencyTraining.assignmentsTotal}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Challenge */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">6-Week Challenge</span>
                  {!member.challenge.enrolled && (
                    <Badge variant="outline" className="text-xs">Not enrolled</Badge>
                  )}
                </div>
                {member.challenge.enrolled && (
                  <>
                    <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                      <div>
                        <div className="text-muted-foreground">Lessons</div>
                        <div className="font-semibold">
                          {member.challenge.lessonsCompleted}/{member.challenge.totalLessons}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Video Time</div>
                        <div className="font-semibold">
                          {formatSeconds(member.challenge.videoWatchedSeconds)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Reflections</div>
                        <div className="font-semibold">{member.challenge.reflectionsSubmitted}</div>
                      </div>
                    </div>
                    <Progress
                      value={
                        member.challenge.totalLessons > 0
                          ? Math.round(
                              (member.challenge.lessonsCompleted /
                                member.challenge.totalLessons) *
                                100
                            )
                          : 0
                      }
                      className="h-2"
                    />
                  </>
                )}
              </div>

              {/* Sales Experience */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium">Sales Experience</span>
                  {!member.salesExperience.enrolled && (
                    <Badge variant="outline" className="text-xs">Not enrolled</Badge>
                  )}
                </div>
                {member.salesExperience.enrolled && (
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Completed</div>
                      <div className="font-semibold">
                        {member.salesExperience.lessonsCompleted}/{member.salesExperience.totalLessons}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Video Time</div>
                      <div className="font-semibold">
                        {formatSeconds(member.salesExperience.videoWatchedSeconds)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Last Active</div>
                      <div className="font-semibold">
                        {formatRelativeDate(member.salesExperience.lastActivity)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Standard Playbook Tab */}
          <TabsContent value="sp" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Started</div>
                <div className="text-2xl font-bold">{member.standardPlaybook.lessonsStarted}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Completed</div>
                <div className="text-2xl font-bold text-green-600">{member.standardPlaybook.lessonsCompleted}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Videos Watched</div>
                <div className="text-2xl font-bold">{member.standardPlaybook.videosWatched}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Est. Time</div>
                <div className="text-2xl font-bold">{formatMinutes(member.standardPlaybook.estimatedMinutes)}</div>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : detailError ? (
              <p className="text-sm text-destructive text-center py-4">
                Failed to load lesson details
              </p>
            ) : member.standardPlaybook.lessonsStarted === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No Standard Playbook activity yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {(detail?.spLessons || []).map((lesson) => {
                  const hasQuiz = lesson.quizQuestions.length > 0;
                  const hasReflections = !!(lesson.reflectionTakeaway || lesson.reflectionAction || lesson.reflectionResult);
                  const hasExpandable = hasQuiz || hasReflections;
                  const isExpanded = expandedQuiz === lesson.id;

                  return (
                    <div key={lesson.id} className="rounded-lg border overflow-hidden">
                      <div
                        className={`flex items-center gap-3 p-3 ${
                          lesson.quizPassed ? 'bg-green-500/5' : ''
                        } ${hasExpandable ? 'cursor-pointer' : ''}`}
                        onClick={hasExpandable ? () => setExpandedQuiz(isExpanded ? null : lesson.id) : undefined}
                      >
                        {lesson.quizPassed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        ) : lesson.videoWatched ? (
                          <Play className="h-5 w-5 text-blue-500 shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{lesson.lessonName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[lesson.categoryName, lesson.moduleName].filter(Boolean).join(' > ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lesson.quizPassed && lesson.completedAt
                              ? `Completed ${formatRelativeDate(lesson.completedAt)}`
                              : lesson.startedAt
                                ? `Started ${formatRelativeDate(lesson.startedAt)}`
                                : 'Not started'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {lesson.quizPassed && lesson.quizScore != null && hasQuiz && (
                            <Badge variant="secondary" className="text-xs">
                              {lesson.quizScore}%
                            </Badge>
                          )}
                          {lesson.videoWatched && lesson.videoWatchedSeconds > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Video className="h-3 w-3 mr-0.5" />
                              {formatSeconds(lesson.videoWatchedSeconds)}
                            </Badge>
                          )}
                          {lesson.videoWatched && lesson.videoWatchedSeconds === 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Video className="h-3 w-3 mr-0.5" />
                              Watched
                            </Badge>
                          )}
                          {hasExpandable && (
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      </div>

                      {/* Expandable Detail */}
                      {hasExpandable && isExpanded && (
                        <div className="border-t bg-muted/30 p-3 space-y-3">
                          {/* Quiz Answers (MC questions) */}
                          {hasQuiz && (
                            <>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Quiz Answers
                              </p>
                              {lesson.quizQuestions.map((q, qi) => (
                                <div key={q.id} className="text-sm space-y-1">
                                  <p className="font-medium">
                                    {qi + 1}. {q.question}
                                  </p>
                                  <div className="pl-4 space-y-0.5">
                                    {q.options.map((opt, oi) => {
                                      const isSelected = oi === q.selectedIndex;
                                      const isCorrect = oi === q.correctIndex;
                                      return (
                                        <div
                                          key={oi}
                                          className={`flex items-center gap-1.5 text-xs py-0.5 ${
                                            isSelected && isCorrect
                                              ? 'text-green-600 font-medium'
                                              : isSelected && !isCorrect
                                                ? 'text-red-500 font-medium'
                                                : isCorrect
                                                  ? 'text-green-600'
                                                  : 'text-muted-foreground'
                                          }`}
                                        >
                                          {isSelected && isCorrect && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                                          {isSelected && !isCorrect && <XCircle className="h-3 w-3 shrink-0" />}
                                          {!isSelected && isCorrect && <CheckCircle2 className="h-3 w-3 shrink-0 opacity-50" />}
                                          {!isSelected && !isCorrect && <Circle className="h-3 w-3 shrink-0" />}
                                          {opt}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* Reflections */}
                          {hasReflections && (
                            <>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Reflections
                              </p>
                              {lesson.reflectionTakeaway && (
                                <div className="text-sm">
                                  <p className="text-xs text-muted-foreground">Biggest Takeaway</p>
                                  <p className="mt-0.5">{lesson.reflectionTakeaway}</p>
                                </div>
                              )}
                              {lesson.reflectionAction && (
                                <div className="text-sm">
                                  <p className="text-xs text-muted-foreground">Immediate Action</p>
                                  <p className="mt-0.5">{lesson.reflectionAction}</p>
                                </div>
                              )}
                              {lesson.reflectionResult && (
                                <div className="text-sm">
                                  <p className="text-xs text-muted-foreground">Expected Result</p>
                                  <p className="mt-0.5">{lesson.reflectionResult}</p>
                                </div>
                              )}
                              {lesson.aiSummary && (
                                <div className="text-sm bg-green-500/10 rounded p-2 mt-1">
                                  <p className="text-xs text-muted-foreground">AI Summary</p>
                                  <p className="mt-0.5">{lesson.aiSummary}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Agency Training Tab */}
          <TabsContent value="agency" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Started</div>
                <div className="text-2xl font-bold">{member.agencyTraining.lessonsStarted}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Completed</div>
                <div className="text-2xl font-bold text-green-600">{member.agencyTraining.lessonsCompleted}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Assigned</div>
                <div className="text-2xl font-bold">{member.agencyTraining.assignmentsTotal}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-xs text-muted-foreground">Assignments Done</div>
                <div className="text-2xl font-bold text-green-600">{member.agencyTraining.assignmentsCompleted}</div>
              </div>
            </div>

            {member.agencyTraining.assignmentsTotal > 0 && (
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Assignment Completion</span>
                  <span className="font-medium">
                    {Math.round(
                      (member.agencyTraining.assignmentsCompleted /
                        member.agencyTraining.assignmentsTotal) *
                        100
                    )}%
                  </span>
                </div>
                <Progress
                  value={Math.round(
                    (member.agencyTraining.assignmentsCompleted /
                      member.agencyTraining.assignmentsTotal) *
                      100
                  )}
                  className="h-2"
                />
              </div>
            )}

            {detailLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : detailError ? (
              <p className="text-sm text-destructive text-center py-4">
                Failed to load lesson details
              </p>
            ) : member.agencyTraining.lessonsStarted === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No agency training activity yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {(detail?.agencyLessons || []).map((lesson) => (
                  <div
                    key={lesson.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      lesson.completed ? 'bg-green-500/5 border-green-500/20' : ''
                    }`}
                  >
                    {lesson.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{lesson.lessonName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[lesson.categoryName, lesson.moduleName].filter(Boolean).join(' > ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lesson.completed && lesson.completedAt
                          ? `Completed ${formatRelativeDate(lesson.completedAt)}`
                          : `Started ${formatRelativeDate(lesson.createdAt)}`}
                      </p>
                    </div>
                    {lesson.isAssigned && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        <ClipboardCheck className="h-3 w-3 mr-0.5" />
                        Assigned
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Challenge Tab */}
          <TabsContent value="challenge" className="mt-4 space-y-4">
            {!member.challenge.enrolled ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Not enrolled in the 6-Week Challenge</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-xs text-muted-foreground">Lessons</div>
                    <div className="text-2xl font-bold">
                      {member.challenge.lessonsCompleted}/{member.challenge.totalLessons}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-xs text-muted-foreground">Video Time</div>
                    <div className="text-2xl font-bold">
                      {formatSeconds(member.challenge.videoWatchedSeconds)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-xs text-muted-foreground">Reflections</div>
                    <div className="text-2xl font-bold">{member.challenge.reflectionsSubmitted}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-xs text-muted-foreground">Progress</div>
                    <div className="text-2xl font-bold">
                      {member.challenge.totalLessons > 0
                        ? Math.round(
                            (member.challenge.lessonsCompleted /
                              member.challenge.totalLessons) *
                              100
                          )
                        : 0}%
                    </div>
                  </div>
                </div>

                <Progress
                  value={
                    member.challenge.totalLessons > 0
                      ? Math.round(
                          (member.challenge.lessonsCompleted /
                            member.challenge.totalLessons) *
                            100
                        )
                      : 0
                  }
                  className="h-2"
                />

                {detailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : detailError ? (
                  <p className="text-sm text-destructive text-center py-4">
                    Failed to load lesson details
                  </p>
                ) : (detail?.challengeLessons || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No lesson progress yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {(detail?.challengeLessons || []).map((lesson) => (
                      <div
                        key={lesson.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          lesson.status === 'completed' ? 'bg-green-500/5 border-green-500/20' : ''
                        }`}
                      >
                        {lesson.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            Day {lesson.dayNumber}: {lesson.lessonTitle}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Week {lesson.weekNumber}
                            {lesson.completedAt && ` - Completed ${formatRelativeDate(lesson.completedAt)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {lesson.videoWatchedSeconds > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Video className="h-3 w-3 mr-0.5" />
                              {formatSeconds(lesson.videoWatchedSeconds)}
                            </Badge>
                          )}
                          {lesson.hasReflection && (
                            <Badge variant="outline" className="text-xs">
                              <MessageSquare className="h-3 w-3 mr-0.5" />
                              Reflection
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  For full reflections and AI feedback, visit{' '}
                  <Link to="/training/challenge/progress" className="text-primary hover:underline">
                    Challenge Progress
                  </Link>
                  .
                </p>
              </>
            )}
          </TabsContent>

          {/* Sales Experience Tab */}
          <TabsContent value="sales" className="mt-4 space-y-4">
            {!member.salesExperience.enrolled ? (
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Not enrolled in the Sales Experience</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-xs text-muted-foreground">Lessons</div>
                    <div className="text-2xl font-bold">
                      {member.salesExperience.lessonsCompleted}/{member.salesExperience.totalLessons}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-xs text-muted-foreground">Video Time</div>
                    <div className="text-2xl font-bold">
                      {formatSeconds(member.salesExperience.videoWatchedSeconds)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-xs text-muted-foreground">Progress</div>
                    <div className="text-2xl font-bold">
                      {member.salesExperience.totalLessons > 0
                        ? Math.round(
                            (member.salesExperience.lessonsCompleted /
                              member.salesExperience.totalLessons) *
                              100
                          )
                        : 0}%
                    </div>
                  </div>
                </div>

                {member.salesExperience.totalLessons > 0 && (
                  <Progress
                    value={Math.round(
                      (member.salesExperience.lessonsCompleted /
                        member.salesExperience.totalLessons) *
                        100
                    )}
                    className="h-2"
                  />
                )}

                {detailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : detailError ? (
                  <p className="text-sm text-destructive text-center py-4">
                    Failed to load lesson details
                  </p>
                ) : (detail?.salesExpLessons || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No lesson progress yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {(detail?.salesExpLessons || []).map((lesson) => (
                      <div
                        key={lesson.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          lesson.status === 'completed' ? 'bg-green-500/5 border-green-500/20' : ''
                        }`}
                      >
                        {lesson.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        ) : lesson.startedAt ? (
                          <Play className="h-5 w-5 text-blue-500 shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{lesson.lessonTitle}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            Week {lesson.weekNumber}{lesson.moduleTitle ? ` - ${lesson.moduleTitle}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lesson.status === 'completed' && lesson.completedAt
                              ? `Completed ${formatRelativeDate(lesson.completedAt)}`
                              : lesson.startedAt
                                ? `Started ${formatRelativeDate(lesson.startedAt)}`
                                : 'Not started'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {lesson.quizScorePercent != null && (
                            <Badge variant="secondary" className="text-xs">
                              {lesson.quizScorePercent}%
                            </Badge>
                          )}
                          {lesson.videoWatchedSeconds > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Video className="h-3 w-3 mr-0.5" />
                              {formatSeconds(lesson.videoWatchedSeconds)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
