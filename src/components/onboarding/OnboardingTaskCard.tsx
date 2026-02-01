import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Phone,
  MessageSquare,
  Mail,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
  FileText,
  Loader2,
} from 'lucide-react';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { OnboardingTask, ActionType } from '@/hooks/useOnboardingTasks';
import { TaskCompleteDialog } from './TaskCompleteDialog';

interface OnboardingTaskCardProps {
  task: OnboardingTask;
  onComplete: (taskId: string, notes?: string) => Promise<void>;
  isCompleting?: boolean;
  showAssignee?: boolean;
  showCustomer?: boolean;
}

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  other: MoreHorizontal,
};

const ACTION_COLORS: Record<ActionType, string> = {
  call: 'bg-green-500/10 text-green-500',
  text: 'bg-purple-500/10 text-purple-500',
  email: 'bg-blue-500/10 text-blue-500',
  other: 'bg-gray-500/10 text-gray-400',
};

const ACTION_LABELS: Record<ActionType, string> = {
  call: 'Call',
  text: 'Text',
  email: 'Email',
  other: 'Task',
};

function getStatusStyles(task: OnboardingTask): { border: string; bg: string; badge: string; badgeClass: string } {
  if (task.status === 'completed') {
    return {
      border: 'border-l-4 border-l-green-500',
      bg: '',
      badge: 'Completed',
      badgeClass: 'bg-green-500/10 text-green-500 border-green-500/20',
    };
  }

  const dueDate = parseISO(task.due_date);

  if (task.status === 'overdue' || (isPast(dueDate) && !isToday(dueDate))) {
    return {
      border: 'border-l-4 border-l-red-500',
      bg: '',
      badge: 'Overdue',
      badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
  }

  if (isToday(dueDate) || task.status === 'due') {
    return {
      border: 'border-l-4 border-l-blue-500',
      bg: '',
      badge: 'Due Today',
      badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    };
  }

  // Upcoming
  return {
    border: 'border-l-4 border-l-gray-400',
    bg: '',
    badge: 'Upcoming',
    badgeClass: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };
}

function formatRelativeDate(dueDate: Date, status: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(dueDate);
  taskDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
  if (diffDays <= 7) return `In ${diffDays} days`;

  return '';
}

export function OnboardingTaskCard({
  task,
  onComplete,
  isCompleting = false,
  showAssignee = false,
  showCustomer = true,
}: OnboardingTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  const ActionIcon = ACTION_ICONS[task.action_type] || MoreHorizontal;
  const actionColor = ACTION_COLORS[task.action_type] || ACTION_COLORS.other;
  const actionLabel = ACTION_LABELS[task.action_type] || 'Task';
  const statusStyles = getStatusStyles(task);

  const handleCheckboxChange = () => {
    if (completing || isCompleting) return;
    // For call tasks, show the dialog to require notes
    if (task.action_type === 'call') {
      setShowCompleteDialog(true);
    } else {
      // For other tasks, complete immediately
      handleComplete();
    }
  };

  const handleComplete = async (notes?: string) => {
    if (completing || isCompleting) return;
    setCompleting(true);
    try {
      await onComplete(task.id, notes);
    } finally {
      setCompleting(false);
    }
  };

  const dueDate = parseISO(task.due_date);
  const isTaskCompleting = completing || isCompleting;

  const relativeDate = formatRelativeDate(dueDate, task.status);
  const isOverdue = task.status === 'overdue' || (isPast(dueDate) && !isToday(dueDate) && task.status !== 'completed');

  return (
    <Card
      className={cn(
        'transition-all duration-300 hover:shadow-md',
        statusStyles.border,
        statusStyles.bg,
        isTaskCompleting && 'opacity-50',
        task.status === 'completed' && 'opacity-60'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="pt-1">
            {isTaskCompleting ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Checkbox
                checked={task.status === 'completed'}
                disabled={task.status === 'completed' || isTaskCompleting}
                onCheckedChange={handleCheckboxChange}
                className="h-5 w-5"
              />
            )}
          </div>

          {/* Action Type Icon - Bigger and more vibrant */}
          <div className={cn(
            'flex items-center justify-center w-10 h-10 rounded-full shrink-0',
            actionColor
          )}>
            <ActionIcon className="h-5 w-5" />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Title Row with Badge */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className={cn(
                'font-medium text-sm',
                task.status === 'completed' && 'line-through text-muted-foreground'
              )}>
                {task.title}
              </h4>
              <Badge className={cn('text-xs', statusStyles.badgeClass)}>
                {statusStyles.badge}
              </Badge>
            </div>

            {/* Description - shown directly */}
            {task.description && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Meta Info Row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {/* Due Date with relative time */}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                  {format(dueDate, 'MMM d')}
                </span>
                {relativeDate && (
                  <span className={cn(
                    'text-muted-foreground/60',
                    isOverdue && 'text-red-400'
                  )}>
                    ({relativeDate})
                  </span>
                )}
              </div>

              {/* Action Type Label */}
              <span className="capitalize">{actionLabel}</span>

              {/* Assignee */}
              {showAssignee && (task.assignee || task.assigneeProfile) && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {task.assignee 
                    ? (task.assignee.display_name || task.assignee.username)
                    : (task.assigneeProfile?.full_name || task.assigneeProfile?.email || 'Unknown')}
                </span>
              )}

              {/* Sequence Name */}
              {task.instance?.sequence && (
                <Badge variant="outline" className="text-xs font-normal">
                  {task.instance.sequence.name}
                </Badge>
              )}
            </div>

            {/* Contact Info - shown as text */}
            {task.instance && (task.instance.customer_phone || task.instance.customer_email) && (
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/70">
                {task.instance.customer_phone && (
                  <a href={`tel:${task.instance.customer_phone}`} className="hover:text-foreground">
                    {task.instance.customer_phone}
                  </a>
                )}
                {task.instance.customer_email && (
                  <a href={`mailto:${task.instance.customer_email}`} className="hover:text-foreground">
                    {task.instance.customer_email}
                  </a>
                )}
              </div>
            )}

            {/* Script (Expandable) - only for scripts, not description */}
            {task.script_template && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 mt-2 text-xs"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 mr-1" />
                    ) : (
                      <ChevronRight className="h-3 w-3 mr-1" />
                    )}
                    View Script
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="bg-muted/50 rounded-md p-3">
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                      <FileText className="h-3 w-3" />
                      Script
                    </div>
                    <p className="text-sm whitespace-pre-wrap">
                      {task.script_template}
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Completed Info */}
            {task.status === 'completed' && task.completed_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Completed {format(parseISO(task.completed_at), 'MMM d, h:mm a')}
              </p>
            )}
          </div>
        </div>
      </CardContent>

      {/* Complete Task Dialog (for call tasks that require notes) */}
      <TaskCompleteDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        taskId={task.id}
        taskTitle={task.title}
        customerName={task.instance?.customer_name || 'Unknown'}
        actionType={task.action_type}
        onComplete={handleComplete}
      />
    </Card>
  );
}
