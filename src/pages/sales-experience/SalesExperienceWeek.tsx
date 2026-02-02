import { useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSalesExperienceAccess } from '@/hooks/useSalesExperienceAccess';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  ArrowLeft,
  Video,
  FileText,
  MessageSquare,
  CheckCircle2,
  Circle,
  Lock,
  Play,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

interface Module {
  id: string;
  week_number: number;
  title: string;
  description: string;
  pillar: 'sales_process' | 'accountability' | 'coaching_cadence';
}

interface Lesson {
  id: string;
  module_id: string;
  day_of_week: number;
  title: string;
  description: string | null;
  video_url: string | null;
  video_platform: string | null;
  content_html: string | null;
  is_staff_visible: boolean;
}

const dayLabels: Record<number, string> = {
  1: 'Monday',
  3: 'Wednesday',
  5: 'Friday',
};

const pillarColors = {
  sales_process: 'bg-blue-500',
  accountability: 'bg-amber-500',
  coaching_cadence: 'bg-green-500',
};

const pillarLabels = {
  sales_process: 'Sales Process',
  accountability: 'Accountability',
  coaching_cadence: 'Coaching Cadence',
};

export default function SalesExperienceWeek() {
  const { week } = useParams<{ week: string }>();
  const weekNumber = parseInt(week || '1', 10);
  const { hasAccess, currentWeek, isLoading: accessLoading } = useSalesExperienceAccess();

  // Fetch module for this week
  const { data: module, isLoading: moduleLoading } = useQuery({
    queryKey: ['sales-experience-module', weekNumber],
    enabled: hasAccess && !isNaN(weekNumber),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_modules')
        .select('*')
        .eq('week_number', weekNumber)
        .single();

      if (error) throw error;
      return data as Module;
    },
  });

  // Fetch lessons for this week
  const { data: lessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['sales-experience-lessons', weekNumber],
    enabled: hasAccess && !!module?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_lessons')
        .select('*')
        .eq('module_id', module!.id)
        .order('day_of_week', { ascending: true });

      if (error) throw error;
      return data as Lesson[];
    },
  });

  const isWeekUnlocked = currentWeek >= weekNumber;

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

  if (!isWeekUnlocked) {
    return <Navigate to="/sales-experience" replace />;
  }

  const isLoading = moduleLoading || lessonsLoading;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Back Link */}
      <Link
        to="/sales-experience"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Overview
      </Link>

      {/* Header */}
      {isLoading ? (
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
      ) : module ? (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Badge
              variant="outline"
              className={`${pillarColors[module.pillar]} bg-opacity-10`}
            >
              {pillarLabels[module.pillar]}
            </Badge>
            {currentWeek === weekNumber && (
              <Badge className="bg-primary text-primary-foreground">
                Current Week
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Week {weekNumber}: {module.title}
          </h1>
          <p className="text-muted-foreground">{module.description}</p>
        </div>
      ) : null}

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link to={`/sales-experience/week/${weekNumber}/documents`}>
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </Button>
        </Link>
        <Link to={`/sales-experience/week/${weekNumber}/transcript`}>
          <Button variant="outline" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Transcript
          </Button>
        </Link>
      </div>

      {/* Lessons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Lesson Materials
          </CardTitle>
          <CardDescription>
            3 lessons per week: Monday, Wednesday, Friday
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : lessons && lessons.length > 0 ? (
            <div className="space-y-4">
              {lessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} weekNumber={weekNumber} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No lessons available for this week yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        {weekNumber > 1 && (
          <Link to={`/sales-experience/week/${weekNumber - 1}`}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Week {weekNumber - 1}
            </Button>
          </Link>
        )}
        <div className="flex-1" />
        {weekNumber < 8 && currentWeek > weekNumber && (
          <Link to={`/sales-experience/week/${weekNumber + 1}`}>
            <Button variant="outline" className="gap-2">
              Week {weekNumber + 1}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

interface LessonCardProps {
  lesson: Lesson;
  weekNumber: number;
}

function LessonCard({ lesson, weekNumber }: LessonCardProps) {
  const hasVideo = !!lesson.video_url;
  // TODO: Fetch actual completion status
  const isCompleted = false;

  return (
    <Card className="hover:bg-muted/50 transition-colors">
      <CardContent className="flex items-start gap-4 p-4">
        {/* Day indicator */}
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center text-primary">
          <span className="text-xs font-medium">
            {dayLabels[lesson.day_of_week]?.slice(0, 3)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{lesson.title}</h4>
            {isCompleted && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </div>
          {lesson.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {lesson.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2">
            {hasVideo && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Video className="h-3 w-3" />
                Video
              </span>
            )}
            {lesson.is_staff_visible && (
              <Badge variant="outline" className="text-xs">
                Staff Training
              </Badge>
            )}
          </div>
        </div>

        {/* Action */}
        {hasVideo ? (
          <Button size="sm" className="gap-2">
            <Play className="h-4 w-4" />
            Watch
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            View
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
