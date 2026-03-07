import { format, parseISO, isPast, isToday } from 'date-fns';
import { Phone, MessageSquare, Mail, MoreHorizontal, Check, CheckCircle2, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SequenceInstanceInfo, SequenceTaskInfo } from '@/hooks/useContactSequenceProgress';

interface SequenceProgressTrackerProps {
  instances: SequenceInstanceInfo[];
  currentTaskId?: string;
  onCompleteSequence?: (instanceId: string, sequenceName: string, remainingCount: number) => void;
  onPauseSequence?: (instanceId: string, sequenceName: string) => void;
  onResumeSequence?: (instanceId: string, sequenceName: string) => void;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  other: MoreHorizontal,
};

function getStepColor(task: SequenceTaskInfo, isCurrent: boolean): {
  dot: string;
  line: string;
  ring: string;
} {
  if (task.status === 'completed') {
    return { dot: 'bg-green-500', line: 'border-green-300', ring: '' };
  }
  if (isCurrent) {
    return { dot: 'bg-blue-500', line: 'border-blue-300', ring: 'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-background' };
  }
  if (task.status === 'overdue' || (isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)))) {
    return { dot: 'bg-red-500', line: 'border-red-300', ring: '' };
  }
  if (task.status === 'due' || isToday(parseISO(task.due_date))) {
    return { dot: 'bg-blue-500', line: 'border-blue-300', ring: '' };
  }
  return { dot: 'bg-gray-300 dark:bg-gray-600', line: 'border-gray-200 dark:border-gray-700', ring: '' };
}

export function SequenceProgressTracker({
  instances,
  currentTaskId,
  onCompleteSequence,
  onPauseSequence,
  onResumeSequence,
}: SequenceProgressTrackerProps) {
  if (instances.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        No active sequences
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {instances.map((instance) => {
        const remainingTasks = instance.tasks.filter(t => t.status !== 'completed');
        const hasActions = instance.status === 'active' || instance.status === 'paused';

        return (
          <div key={instance.instanceId}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">{instance.sequenceName}</span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                instance.status === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                instance.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                instance.status === 'paused' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              )}>
                {instance.status}
              </span>

              {/* Sequence Actions Menu */}
              {hasActions && (onCompleteSequence || onPauseSequence || onResumeSequence) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {instance.status === 'active' && onCompleteSequence && (
                      <DropdownMenuItem
                        onClick={() => onCompleteSequence(instance.instanceId, instance.sequenceName, remainingTasks.length)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Complete Sequence
                      </DropdownMenuItem>
                    )}
                    {instance.status === 'active' && onPauseSequence && (
                      <DropdownMenuItem
                        onClick={() => onPauseSequence(instance.instanceId, instance.sequenceName)}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Pause Sequence
                      </DropdownMenuItem>
                    )}
                    {instance.status === 'paused' && onResumeSequence && (
                      <DropdownMenuItem
                        onClick={() => onResumeSequence(instance.instanceId, instance.sequenceName)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Resume Sequence
                      </DropdownMenuItem>
                    )}
                    {instance.status === 'paused' && onCompleteSequence && (
                      <DropdownMenuItem
                        onClick={() => onCompleteSequence(instance.instanceId, instance.sequenceName, remainingTasks.length)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Complete Sequence
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="relative ml-3">
              {instance.tasks.map((task, idx) => {
                const isCurrent = task.id === currentTaskId;
                const isLast = idx === instance.tasks.length - 1;
                const colors = getStepColor(task, isCurrent);
                const Icon = ACTION_ICONS[task.action_type] || MoreHorizontal;

                return (
                  <div key={task.id} className="relative flex items-start gap-3 pb-3">
                    {/* Vertical line */}
                    {!isLast && (
                      <div className={cn(
                        'absolute left-[9px] top-5 bottom-0 border-l-2',
                        colors.line
                      )} />
                    )}

                    {/* Dot */}
                    <div className={cn(
                      'relative z-10 w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 mt-0.5',
                      colors.dot,
                      colors.ring,
                    )}>
                      {task.status === 'completed' ? (
                        <Check className="h-3 w-3 text-white" />
                      ) : (
                        <Icon className="h-2.5 w-2.5 text-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className={cn(
                      'flex-1 min-w-0',
                      isCurrent && 'bg-blue-50 dark:bg-blue-500/10 -mx-1 px-1 py-0.5 rounded'
                    )}>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-sm',
                          task.status === 'completed' && 'text-muted-foreground line-through',
                          isCurrent && 'font-medium',
                        )}>
                          {task.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Day {task.day_number}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {task.status === 'completed' && task.completed_at
                          ? `Done ${format(parseISO(task.completed_at), 'MMM d')}`
                          : format(parseISO(task.due_date), 'MMM d')
                        }
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
