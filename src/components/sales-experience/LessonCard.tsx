import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  Circle,
  Lock,
  ChevronRight,
  Play,
  BookOpen,
  Clock,
  Video,
} from 'lucide-react';
import { dayLabels, type LessonStatus } from './constants';

interface LessonCardProps {
  id: string;
  title: string;
  description?: string | null;
  dayOfWeek: number;
  isUnlocked: boolean;
  status: LessonStatus;
  hasVideo: boolean;
  hasQuiz?: boolean;
  quizScore?: number | null;
  isStaffVisible?: boolean;
  onClick?: () => void;
  showWatchButton?: boolean;
}

/**
 * Lesson card component used in both owner and staff views.
 * Displays lesson title, day, status, and available actions.
 */
export function LessonCard({
  id,
  title,
  description,
  dayOfWeek,
  isUnlocked,
  status,
  hasVideo,
  hasQuiz,
  quizScore,
  isStaffVisible,
  onClick,
  showWatchButton = false,
}: LessonCardProps) {
  const isCompleted = status === 'completed';
  const isInProgress = status === 'in_progress';

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
      case 'locked':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Lock className="h-3 w-3 mr-1" />
            Locked
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card
      className={`transition-all ${
        status === 'locked'
          ? 'opacity-60'
          : 'hover:bg-muted/50 cursor-pointer'
      }`}
      onClick={() => isUnlocked && onClick?.()}
    >
      <CardContent className="flex items-center gap-4 p-4">
        {/* Day indicator */}
        <div
          className={`h-12 w-12 rounded-lg flex flex-col items-center justify-center ${
            isCompleted
              ? 'bg-green-500/10 text-green-600'
              : status === 'locked'
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/10 text-primary'
          }`}
        >
          <span className="text-xs font-medium">
            {dayLabels[dayOfWeek]?.slice(0, 3)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold truncate">{title}</h4>
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : isInProgress ? (
              <Circle className="h-4 w-4 text-amber-500" />
            ) : null}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {hasVideo && (
              <span className="flex items-center gap-1">
                <Video className="h-3 w-3" />
                Video
              </span>
            )}
            {hasQuiz && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Quiz
              </span>
            )}
            {quizScore !== null && quizScore !== undefined && (
              <span className="flex items-center gap-1">
                Score: {quizScore}%
              </span>
            )}
            {isStaffVisible && (
              <Badge variant="outline" className="text-xs">
                Staff Training
              </Badge>
            )}
          </div>
        </div>

        {/* Action */}
        {isUnlocked && (
          showWatchButton && hasVideo ? (
            <Button
              size="sm"
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
            >
              <Play className="h-4 w-4" />
              Watch
            </Button>
          ) : showWatchButton ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
            >
              View
            </Button>
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )
        )}
      </CardContent>
    </Card>
  );
}
