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
  call: 'text-green-600 bg-green-100',
  text: 'text-blue-600 bg-blue-100',
  email: 'text-purple-600 bg-purple-100',
  other: 'text-gray-600 bg-gray-100',
};

const ACTION_LABELS: Record<ActionType, string> = {
  call: 'Call',
  text: 'Text',
  email: 'Email',
  other: 'Task',
};

function getStatusStyles(task: OnboardingTask): { border: string; bg: string; badge: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (task.status === 'completed') {
    return {
      border: 'border-border',
      bg: 'bg-muted/50',
      badge: 'Completed',
      badgeVariant: 'secondary',
    };
  }

  const dueDate = parseISO(task.due_date);

  if (task.status === 'overdue' || (isPast(dueDate) && !isToday(dueDate))) {
    return {
      border: 'border-red-500/50 border-2',
      bg: 'bg-red-500/10',
      badge: 'Overdue',
      badgeVariant: 'destructive',
    };
  }

  if (isToday(dueDate) || task.status === 'due') {
    return {
      border: 'border-blue-500/50 border-2',
      bg: 'bg-blue-500/10',
      badge: 'Due Today',
      badgeVariant: 'default',
    };
  }

  // Upcoming
  return {
    border: 'border-border',
    bg: 'bg-card',
    badge: 'Upcoming',
    badgeVariant: 'outline',
  };
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

  const ActionIcon = ACTION_ICONS[task.action_type] || MoreHorizontal;
  const actionColor = ACTION_COLORS[task.action_type] || ACTION_COLORS.other;
  const actionLabel = ACTION_LABELS[task.action_type] || 'Task';
  const statusStyles = getStatusStyles(task);

  const handleComplete = async () => {
    if (completing || isCompleting) return;
    setCompleting(true);
    try {
      await onComplete(task.id);
    } finally {
      setCompleting(false);
    }
  };

  const dueDate = parseISO(task.due_date);
  const isTaskCompleting = completing || isCompleting;

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        statusStyles.border,
        statusStyles.bg,
        isTaskCompleting && 'opacity-50'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="pt-0.5">
            {isTaskCompleting ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Checkbox
                checked={task.status === 'completed'}
                disabled={task.status === 'completed' || isTaskCompleting}
                onCheckedChange={handleComplete}
                className="h-5 w-5"
              />
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Action Type Icon */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn('p-1.5 rounded-md', actionColor)}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{actionLabel}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Title */}
              <h4 className={cn(
                'font-medium text-sm flex-1',
                task.status === 'completed' && 'line-through text-muted-foreground'
              )}>
                {task.title}
              </h4>

              {/* Status Badge */}
              <Badge variant={statusStyles.badgeVariant} className="text-xs">
                {statusStyles.badge}
              </Badge>
            </div>

            {/* Meta Info */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              {/* Customer Name */}
              {showCustomer && task.instance && (
                <span className="font-medium text-foreground">
                  {task.instance.customer_name}
                </span>
              )}

              {/* Due Date */}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(dueDate, 'MMM d')}
              </span>

              {/* Day Number */}
              <span>Day {task.day_number}</span>

              {/* Assignee */}
              {showAssignee && task.assignee && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {task.assignee.display_name || task.assignee.username}
                </span>
              )}

              {/* Sequence Name */}
              {task.instance?.sequence && (
                <span className="text-muted-foreground/70">
                  {task.instance.sequence.name}
                </span>
              )}
            </div>

            {/* Description & Script (Expandable) */}
            {(task.description || task.script_template) && (
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
                    {task.script_template ? 'View Script' : 'View Details'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {task.description && (
                    <p className="text-sm text-muted-foreground">
                      {task.description}
                    </p>
                  )}
                  {task.script_template && (
                    <div className="bg-muted/50 rounded-md p-3">
                      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                        <FileText className="h-3 w-3" />
                        Script
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {task.script_template}
                      </p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Contact Info Quick Actions */}
            {task.status !== 'completed' && task.instance && (
              <div className="flex items-center gap-2 mt-2">
                {task.instance.customer_phone && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          asChild
                        >
                          <a href={`tel:${task.instance.customer_phone}`}>
                            <Phone className="h-3 w-3 mr-1" />
                            {task.instance.customer_phone}
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Click to call</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {task.instance.customer_email && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          asChild
                        >
                          <a href={`mailto:${task.instance.customer_email}`}>
                            <Mail className="h-3 w-3 mr-1" />
                            Email
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{task.instance.customer_email}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
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
    </Card>
  );
}
