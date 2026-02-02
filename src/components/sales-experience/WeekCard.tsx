import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Lock, ChevronRight } from 'lucide-react';
import { pillarColors, pillarLabels, type Pillar } from './constants';

interface WeekCardProps {
  weekNumber: number;
  title: string;
  description: string;
  pillar: Pillar;
  isUnlocked: boolean;
  isCurrent: boolean;
  isCompleted: boolean;
  linkTo?: string;
}

/**
 * Week timeline card for the 8-Week Sales Experience overview.
 * Shows week status (locked, current, completed) with pillar badge.
 */
export function WeekCard({
  weekNumber,
  title,
  description,
  pillar,
  isUnlocked,
  isCurrent,
  isCompleted,
  linkTo,
}: WeekCardProps) {
  const content = (
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
        <div
          className={`h-10 w-10 rounded-full flex items-center justify-center ${
            isCompleted
              ? 'bg-green-500/10'
              : isCurrent
              ? 'bg-primary/10'
              : 'bg-muted'
          }`}
        >
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
            <span className="font-semibold">Week {weekNumber}</span>
            <Badge
              variant="outline"
              className={`text-xs ${pillarColors[pillar]} bg-opacity-10`}
            >
              {pillarLabels[pillar]}
            </Badge>
            {isCurrent && (
              <Badge className="bg-primary text-primary-foreground">
                Current
              </Badge>
            )}
          </div>
          <h4 className="font-medium truncate">{title}</h4>
          <p className="text-sm text-muted-foreground truncate">
            {description}
          </p>
        </div>

        {/* Arrow */}
        {isUnlocked && (
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}
      </CardContent>
    </Card>
  );

  if (linkTo && isUnlocked) {
    return <Link to={linkTo}>{content}</Link>;
  }

  return (
    <div className={!isUnlocked ? 'cursor-not-allowed' : ''}>
      {content}
    </div>
  );
}
