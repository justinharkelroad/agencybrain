import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  CheckCircle2,
  Flame,
  ChevronRight,
  Dumbbell,
  Brain,
  Heart,
  Briefcase,
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
  core4: {
    today: {
      body: boolean;
      being: boolean;
      balance: boolean;
      business: boolean;
    };
    streak: number;
  };
}

const CORE4_ITEMS = [
  { key: 'body', label: 'Body', icon: Dumbbell, color: 'text-red-500' },
  { key: 'being', label: 'Being', icon: Brain, color: 'text-purple-500' },
  { key: 'balance', label: 'Balance', icon: Heart, color: 'text-pink-500' },
  { key: 'business', label: 'Business', icon: Briefcase, color: 'text-blue-500' },
] as const;

export function ChallengeDashboardWidget() {
  const { sessionToken } = useStaffAuth();
  const [data, setData] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [core4Updating, setCore4Updating] = useState<string | null>(null);

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

  const handleCore4Toggle = async (key: string, checked: boolean) => {
    if (!data?.assignment?.id || core4Updating) return;

    // Optimistic update
    const previousData = data;
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        core4: {
          ...prev.core4,
          today: {
            ...prev.core4.today,
            [key]: checked,
          },
        },
      };
    });

    setCore4Updating(key);

    try {
      const { data: response, error } = await supabase.functions.invoke('challenge-update-core4', {
        headers: { 'x-staff-session': sessionToken },
        body: {
          assignment_id: data.assignment.id,
          ...data.core4.today,
          [key]: checked,
        },
      });

      if (error) throw error;

      // Update streak from response
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          core4: {
            ...prev.core4,
            streak: response.streak,
          },
        };
      });
    } catch (err) {
      console.error('Core 4 update error:', err);
      // Revert on error
      setData(previousData);
    } finally {
      setCore4Updating(null);
    }
  };

  // Return null if loading or no assignment (fail silently)
  if (loading) {
    return null;
  }

  if (!data?.has_assignment) {
    return null;
  }

  const { assignment, current_business_day, todays_lesson, progress, core4 } = data;
  const isLessonCompleted = todays_lesson?.progress?.status === 'completed';
  const allCore4Complete = core4.today.body && core4.today.being && core4.today.balance && core4.today.business;

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
          {core4.streak > 0 && (
            <div className="flex items-center gap-1 bg-orange-500/20 px-2 py-1 rounded-full">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold text-orange-500">{core4.streak}</span>
            </div>
          )}
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

        {/* Core 4 Checklist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Daily Core 4</h3>
            {allCore4Complete && (
              <span className="text-xs text-green-600 font-medium">All complete!</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CORE4_ITEMS.map(({ key, label, icon: Icon, color }) => (
              <label
                key={key}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                  core4.today[key as keyof typeof core4.today]
                    ? 'bg-muted border-primary/30'
                    : 'hover:bg-muted/50'
                } ${core4Updating === key ? 'opacity-50' : ''}`}
              >
                <Checkbox
                  checked={core4.today[key as keyof typeof core4.today]}
                  onCheckedChange={(checked) => handleCore4Toggle(key, !!checked)}
                  disabled={core4Updating !== null}
                  className="data-[state=checked]:bg-primary"
                />
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

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
