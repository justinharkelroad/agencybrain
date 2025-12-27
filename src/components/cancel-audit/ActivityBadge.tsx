import { cn } from '@/lib/utils';
import { MessageSquare, Sparkles } from 'lucide-react';

interface ActivityBadgeProps {
  activityCount: number;
  lastActivityAt: string | null;
}

export function ActivityBadge({ activityCount, lastActivityAt }: ActivityBadgeProps) {
  if (activityCount === 0) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
        'bg-muted text-muted-foreground'
      )}>
        <Sparkles className="h-3 w-3" />
        New
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
      'bg-green-500/10 text-green-400 border border-green-500/20'
    )}>
      <MessageSquare className="h-3 w-3" />
      {activityCount} {activityCount === 1 ? 'contact' : 'contacts'}
    </span>
  );
}
