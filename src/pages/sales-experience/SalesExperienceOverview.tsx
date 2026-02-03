import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useSalesExperienceAccess } from '@/hooks/useSalesExperienceAccess';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { pillarColors, pillarLabels, MeetingResultsCard, type Pillar } from '@/components/sales-experience';
import {
  Loader2,
  Trophy,
  CheckCircle2,
  Circle,
  Lock,
  ChevronRight,
  MessageSquare,
  Users,
  Calendar,
  FileText,
} from 'lucide-react';
import {
  useSalesExperienceDeliverables,
  getOverallProgress,
} from '@/hooks/useSalesExperienceDeliverables';

interface LessonProgress {
  id: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
}

interface ModuleLesson {
  id: string;
  title: string;
  day_of_week: number;
  progress: LessonProgress | null;
}

interface ModuleWithLessons {
  id: string;
  week_number: number;
  title: string;
  description: string;
  pillar: Pillar;
  icon: string;
  lessons: ModuleLesson[];
}

interface WeekTranscript {
  id: string;
  week_number: number;
  meeting_date: string;
  summary_ai: string | null;
}

interface SalesExperienceData {
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
  modules: ModuleWithLessons[];
  progress: {
    total_lessons: number;
    completed_lessons: number;
    progress_percent: number;
  };
  unread_messages: number;
  current_week_transcript: WeekTranscript | null;
}

export default function SalesExperienceOverview() {
  const { session } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useSalesExperienceAccess();
  const { data: deliverables } = useSalesExperienceDeliverables();

  // Fetch data using edge function
  const { data, isLoading: dataLoading, error } = useQuery<SalesExperienceData>({
    queryKey: ['sales-experience-data'],
    enabled: hasAccess && !!session?.access_token,
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-sales-experience`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch data');
      }

      return response.json();
    },
  });

  // Calculate days until end
  const daysRemaining = useMemo(() => {
    if (!data?.assignment?.end_date) return 0;
    const end = new Date(data.assignment.end_date);
    const today = new Date();
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [data?.assignment?.end_date]);

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

  const isLoading = dataLoading;
  const currentWeek = data?.current_week || 1;
  const isActive = data?.assignment?.status === 'active';

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-8 w-8 text-amber-500" />
          <h1 className="text-3xl font-bold">8-Week Sales Experience</h1>
        </div>
        <p className="text-muted-foreground">
          Your journey to building a world-class sales organization
        </p>
      </div>

      {/* Status & Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{currentWeek}</span>
              <span className="text-muted-foreground">of 8</span>
            </div>
            {isActive && (
              <Badge variant="outline" className="mt-2 bg-green-500/10 text-green-600 border-green-500/30">
                Active
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold">{data?.progress?.progress_percent || 0}%</span>
            </div>
            <Progress value={data?.progress?.progress_percent || 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {data?.progress?.completed_lessons || 0} of {data?.progress?.total_lessons || 0} lessons completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Days Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{daysRemaining}</span>
              <span className="text-muted-foreground">days</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Ends {data?.assignment?.end_date}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link to="/sales-experience/messages">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center relative">
                <MessageSquare className="h-6 w-6 text-blue-500" />
                {(data?.unread_messages || 0) > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                    {data?.unread_messages}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Coach Messages</h3>
                <p className="text-sm text-muted-foreground">
                  {(data?.unread_messages || 0) > 0
                    ? `${data?.unread_messages} unread message${data?.unread_messages === 1 ? '' : 's'}`
                    : 'Connect with your coach'}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/sales-experience/team-progress">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Team Quiz Results</h3>
                <p className="text-sm text-muted-foreground">
                  View your team's training progress
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Meeting Results */}
      {data?.assignment?.id && (
        <div className="mb-8">
          <MeetingResultsCard assignmentId={data.assignment.id} currentWeek={currentWeek} />
        </div>
      )}

      {/* Your Deliverables */}
      <Card className="mb-8">
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
            <Link to="/sales-experience/deliverables">
              <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                View All <ChevronRight className="h-3 w-3 ml-1" />
              </Badge>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress
              value={deliverables ? getOverallProgress(deliverables) : 0}
              className="flex-1 h-2"
            />
            <span className="text-sm font-medium text-muted-foreground">
              {deliverables?.filter(d => d.status === 'complete').length || 0} / 3 complete
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Use the AI Builder to create professional documents throughout your 8-week experience
          </p>
        </CardContent>
      </Card>

      {/* 8-Week Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Your 8-Week Journey</CardTitle>
          <CardDescription>
            Click on any week to view lesson materials, documents, and transcripts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {data?.modules?.map((module) => {
                const isUnlocked = currentWeek >= module.week_number;
                const isCurrent = currentWeek === module.week_number;
                const isCompleted = module.lessons?.every(
                  (l) => l.progress?.status === 'completed'
                );

                return (
                  <Link
                    key={module.id}
                    to={isUnlocked ? `/sales-experience/week/${module.week_number}` : '#'}
                    className={!isUnlocked ? 'cursor-not-allowed' : ''}
                  >
                    <Card
                      className={`transition-all ${
                        isCurrent
                          ? 'border-primary bg-primary/5 shadow-md'
                          : isUnlocked
                          ? 'hover:bg-muted/50 cursor-pointer'
                          : 'opacity-60'
                      }`}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        {/* Status Icon */}
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          isCompleted
                            ? 'bg-green-500/10'
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

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">Week {module.week_number}</span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${pillarColors[module.pillar]} bg-opacity-10`}
                            >
                              {pillarLabels[module.pillar]}
                            </Badge>
                            {isCurrent && (
                              <Badge className="bg-primary text-primary-foreground">
                                Current
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-medium truncate">{module.title}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {module.description}
                          </p>
                        </div>

                        {/* Arrow */}
                        {isUnlocked && (
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pillar Legend */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">The Three Pillars</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className={`h-3 w-3 rounded-full mt-1.5 ${pillarColors.sales_process}`} />
              <div>
                <h4 className="font-medium">Sales Process (Weeks 1-3)</h4>
                <p className="text-sm text-muted-foreground">
                  Build a repeatable, scalable sales framework
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={`h-3 w-3 rounded-full mt-1.5 ${pillarColors.accountability}`} />
              <div>
                <h4 className="font-medium">Accountability (Weeks 4-5)</h4>
                <p className="text-sm text-muted-foreground">
                  Create systems that drive consistent performance
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={`h-3 w-3 rounded-full mt-1.5 ${pillarColors.coaching_cadence}`} />
              <div>
                <h4 className="font-medium">Coaching Cadence (Weeks 6-8)</h4>
                <p className="text-sm text-muted-foreground">
                  Master the art of developing your team
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
