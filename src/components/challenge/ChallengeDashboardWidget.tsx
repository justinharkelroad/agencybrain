import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

interface ChallengeData {
  has_assignment: boolean;
  assignment?: {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
    product: {
      name: string;
      total_lessons: number;
      duration_weeks: number;
    };
  };
  current_business_day: number;
  todays_lesson?: {
    id: string;
    title: string;
    day_number: number;
    week_number: number;
    preview_text?: string;
    progress?: {
      status: string;
      completed_at?: string;
    };
  };
  progress: {
    total_lessons: number;
    completed_lessons: number;
    progress_percent: number;
  };
}

export function ChallengeDashboardWidget() {
  const { sessionToken } = useStaffAuth();
  const [data, setData] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchChallengeData = useCallback(async () => {
    if (!sessionToken) {
      setLoading(false);
      return;
    }

    try {
      const { data: response, error } = await supabase.functions.invoke('get-staff-challenge', {
        headers: { 'x-staff-session': sessionToken },
      });

      if (error) throw error;
      setData(response);
    } catch (err) {
      console.error('Challenge widget error:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchChallengeData();
  }, [fetchChallengeData]);

  // Return null if loading or no assignment (fail silently)
  if (loading) {
    return null;
  }

  if (!data?.has_assignment) {
    return null;
  }

  const { assignment, current_business_day, todays_lesson, progress } = data;
  const isLessonCompleted = todays_lesson?.progress?.status === 'completed';

  return (
    <Card className="overflow-hidden">
      {/* Gradient Header */}
      <div
        className="p-4 sm:p-6"
        style={{
          background: 'linear-gradient(135deg, #1e283a 0%, #020817 100%)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">The Challenge</h2>
            <p className="text-sm text-slate-400">
              Day {current_business_day} of {assignment?.product?.total_lessons || 30}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Progress</span>
            <span className="text-white font-medium">{progress.progress_percent}%</span>
          </div>
          <Progress value={progress.progress_percent} className="h-2 bg-slate-700" />
          <p className="text-xs text-slate-500">
            {progress.completed_lessons} of {progress.total_lessons} lessons completed
          </p>
        </div>
      </div>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Today's Lesson */}
        {todays_lesson && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Today's Lesson</h3>
              {isLessonCompleted && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Completed
                </span>
              )}
            </div>
            <Link to="/staff/challenge" className="block group">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div className={`p-2 rounded-full ${isLessonCompleted ? 'bg-green-500/10' : 'bg-primary/10'}`}>
                  {isLessonCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Play className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{todays_lesson.title}</p>
                  <p className="text-xs text-muted-foreground">Week {todays_lesson.week_number}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        )}

        {/* View All Link */}
        <Button variant="outline" className="w-full" asChild>
          <Link to="/staff/challenge">
            View Challenge
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
