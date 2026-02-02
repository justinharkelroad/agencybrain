import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Play,
  CheckCircle2,
  Lock,
  Trophy,
  ChevronRight,
  BookOpen,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { isLessonUnlocked } from '@/hooks/useSalesExperienceAccess';

interface SalesExperienceLesson {
  id: string;
  title: string;
  description: string | null;
  day_of_week: number;
  video_url: string | null;
  is_staff_visible: boolean;
  quiz_questions: any[];
  module: {
    id: string;
    week_number: number;
    title: string;
    pillar: string;
  };
  progress: {
    id: string;
    status: 'locked' | 'available' | 'in_progress' | 'completed';
    unlocked_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    quiz_score_percent: number | null;
  } | null;
}

interface SalesExperienceData {
  has_assignment: boolean;
  assignment?: {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
  };
  current_week: number;
  lessons: SalesExperienceLesson[];
  progress: {
    total_lessons: number;
    completed_lessons: number;
    progress_percent: number;
    avg_quiz_score: number | null;
  };
}

const dayLabels: Record<number, string> = {
  1: 'Monday',
  3: 'Wednesday',
  5: 'Friday',
};

const pillarColors: Record<string, string> = {
  sales_process: 'bg-blue-500',
  accountability: 'bg-amber-500',
  coaching_cadence: 'bg-green-500',
};

export default function StaffSalesTraining() {
  const navigate = useNavigate();
  const { user, sessionToken, isAuthenticated, loading: authLoading, agencyId } = useStaffAuth();

  const [data, setData] = useState<SalesExperienceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/staff/login');
      return;
    }

    if (isAuthenticated && user && sessionToken) {
      fetchSalesExperienceData();
    }
  }, [authLoading, isAuthenticated, user, sessionToken]);

  const fetchSalesExperienceData = async () => {
    if (!sessionToken || !user) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-staff-sales-lessons`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ staff_user_id: user.id }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch training data');
      }

      const result = await response.json();
      setData(result);

      // Set selected week to current week
      if (result.current_week) {
        setSelectedWeek(result.current_week);
      }
    } catch (error) {
      console.error('Error fetching sales experience data:', error);
      toast.error('Failed to load training content');
    } finally {
      setLoading(false);
    }
  };

  // Filter lessons by selected week
  const weekLessons = useMemo(() => {
    if (!data?.lessons) return [];
    return data.lessons
      .filter((lesson) => lesson.module.week_number === selectedWeek)
      .sort((a, b) => a.day_of_week - b.day_of_week);
  }, [data?.lessons, selectedWeek]);

  // Group lessons by week for navigation
  const weekNumbers = useMemo(() => {
    if (!data?.lessons) return [];
    const weeks = new Set(data.lessons.map((l) => l.module.week_number));
    return Array.from(weeks).sort((a, b) => a - b);
  }, [data?.lessons]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.has_assignment) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="text-center py-16">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">8-Week Sales Experience</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Your agency hasn't been enrolled in the 8-Week Sales Experience yet.
              Contact your agency owner to learn more about this training program.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-8 w-8 text-amber-500" />
          <h1 className="text-3xl font-bold">8-Week Sales Training</h1>
        </div>
        <p className="text-muted-foreground">
          Complete your lessons and quizzes to build a world-class sales mindset
        </p>
      </div>

      {/* Progress Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Week</p>
              <p className="text-3xl font-bold">{data.current_week}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Completed</p>
              <p className="text-3xl font-bold">
                {data.progress.completed_lessons}/{data.progress.total_lessons}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Progress</p>
              <div className="flex items-center gap-2">
                <Progress value={data.progress.progress_percent} className="h-2 flex-1" />
                <span className="text-sm font-medium">{data.progress.progress_percent}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Avg Quiz Score</p>
              <p className="text-3xl font-bold">
                {data.progress.avg_quiz_score !== null
                  ? `${Math.round(data.progress.avg_quiz_score)}%`
                  : '--'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Week Selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {weekNumbers.map((week) => {
          const isCurrentWeek = week === data.current_week;
          const isUnlocked = week <= data.current_week;

          return (
            <Button
              key={week}
              variant={selectedWeek === week ? 'default' : 'outline'}
              size="sm"
              onClick={() => isUnlocked && setSelectedWeek(week)}
              disabled={!isUnlocked}
              className="relative"
            >
              {!isUnlocked && <Lock className="h-3 w-3 mr-1" />}
              Week {week}
              {isCurrentWeek && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
              )}
            </Button>
          );
        })}
      </div>

      {/* Lessons List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Week {selectedWeek} Lessons
          </CardTitle>
          <CardDescription>
            Lessons unlock on Monday, Wednesday, and Friday each week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {weekLessons.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No lessons available for this week.
              </p>
            ) : (
              weekLessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  startDate={data.assignment?.start_date || ''}
                  onStart={() => navigate(`/staff/sales-training/lesson/${lesson.id}`)}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface LessonCardProps {
  lesson: SalesExperienceLesson;
  startDate: string;
  onStart: () => void;
}

function LessonCard({ lesson, startDate, onStart }: LessonCardProps) {
  const isUnlocked = isLessonUnlocked(
    startDate,
    lesson.module.week_number,
    lesson.day_of_week
  );
  const progress = lesson.progress;
  const status = progress?.status || (isUnlocked ? 'available' : 'locked');
  const hasQuiz = lesson.quiz_questions && lesson.quiz_questions.length > 0;
  const hasVideo = !!lesson.video_url;

  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      case 'available':
        return (
          <Badge variant="outline" className="border-green-500 text-green-600">
            Available
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Lock className="h-3 w-3 mr-1" />
            Locked
          </Badge>
        );
    }
  };

  return (
    <Card
      className={`transition-all ${
        status === 'locked' ? 'opacity-60' : 'hover:bg-muted/50 cursor-pointer'
      }`}
      onClick={() => isUnlocked && onStart()}
    >
      <CardContent className="flex items-center gap-4 p-4">
        {/* Day indicator */}
        <div
          className={`h-12 w-12 rounded-lg flex flex-col items-center justify-center ${
            status === 'completed'
              ? 'bg-green-500/10 text-green-600'
              : status === 'locked'
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/10 text-primary'
          }`}
        >
          <span className="text-xs font-medium">
            {dayLabels[lesson.day_of_week]?.slice(0, 3)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold truncate">{lesson.title}</h4>
            {getStatusBadge()}
          </div>
          {lesson.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {lesson.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {hasVideo && (
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                Video
              </span>
            )}
            {hasQuiz && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Quiz
              </span>
            )}
            {progress?.quiz_score_percent !== null && progress?.quiz_score_percent !== undefined && (
              <span className="flex items-center gap-1">
                Score: {progress.quiz_score_percent}%
              </span>
            )}
          </div>
        </div>

        {/* Action */}
        {isUnlocked && (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </CardContent>
    </Card>
  );
}
