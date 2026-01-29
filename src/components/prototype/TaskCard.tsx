import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, Mail, MoreHorizontal, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskStatus = 'overdue' | 'due_today' | 'upcoming' | 'completed';
export type ActionType = 'call' | 'text' | 'email' | 'other';

export interface OnboardingTask {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  title: string;
  description?: string;
  actionType: ActionType;
  dueDate: Date;
  status: TaskStatus;
  assignedTo: string;
  completedAt?: Date;
  script?: string;
  sequenceName?: string;  // e.g., "New Auto Policy", "Home Bundle Upsell"
}

interface TaskCardProps {
  task: OnboardingTask;
  onComplete: (taskId: string, notes?: string) => void;
  onSequenceClick?: (sequenceName: string) => void;
  currentUserName?: string;  // To determine if this user can complete the task
  showAssignee?: boolean;
}

const actionIcons: Record<ActionType, React.ElementType> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  other: MoreHorizontal,
};

const actionLabels: Record<ActionType, string> = {
  call: 'Call',
  text: 'Text',
  email: 'Email',
  other: 'Other',
};

const statusStyles: Record<TaskStatus, { border: string; badge: string; badgeText: string }> = {
  overdue: {
    border: 'border-l-4 border-l-red-500',
    badge: 'bg-red-500/10 text-red-500 border-red-500/20',
    badgeText: 'Overdue',
  },
  due_today: {
    border: 'border-l-4 border-l-blue-500',
    badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    badgeText: 'Due Today',
  },
  upcoming: {
    border: 'border-l-4 border-l-gray-400',
    badge: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    badgeText: 'Upcoming',
  },
  completed: {
    border: 'border-l-4 border-l-green-500',
    badge: 'bg-green-500/10 text-green-500 border-green-500/20',
    badgeText: 'Completed',
  },
};

function formatActualDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatRelativeDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(date);
  taskDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays <= 7) return `In ${diffDays} days`;

  return '';
}

export function TaskCard({
  task,
  onComplete,
  onSequenceClick,
  currentUserName,
  showAssignee = false
}: TaskCardProps) {
  const ActionIcon = actionIcons[task.actionType];
  const styles = statusStyles[task.status];
  const isCompleted = task.status === 'completed';

  // Can only complete tasks assigned to current user
  const isOwnTask = !currentUserName || task.assignedTo === currentUserName;
  const canComplete = isOwnTask && !isCompleted;

  return (
    <Card
      className={cn(
        "transition-all duration-300 hover:shadow-md",
        styles.border,
        isCompleted && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="relative">
            <Checkbox
              checked={isCompleted}
              onCheckedChange={() => canComplete && onComplete(task.id)}
              className={cn(
                "mt-1 h-5 w-5",
                !isOwnTask && !isCompleted && "opacity-40 cursor-not-allowed"
              )}
              disabled={!canComplete}
            />
            {!isOwnTask && !isCompleted && (
              <div className="absolute -bottom-5 left-0 whitespace-nowrap text-[10px] text-muted-foreground/50">
                Not yours
              </div>
            )}
          </div>

          {/* Action Type Icon */}
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
            task.actionType === 'call' && "bg-green-500/10 text-green-500",
            task.actionType === 'text' && "bg-purple-500/10 text-purple-500",
            task.actionType === 'email' && "bg-blue-500/10 text-blue-500",
            task.actionType === 'other' && "bg-gray-500/10 text-gray-400",
          )}>
            <ActionIcon className="w-5 h-5" />
          </div>

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className={cn(
                "font-medium text-sm",
                isCompleted && "line-through text-muted-foreground"
              )}>
                {task.title}
              </h4>
              <Badge className={cn("text-xs", styles.badge)}>
                {styles.badgeText}
              </Badge>
              {task.sequenceName && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-normal",
                    onSequenceClick && "cursor-pointer hover:bg-muted"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSequenceClick?.(task.sequenceName!);
                  }}
                >
                  {task.sequenceName}
                </Badge>
              )}
            </div>

            {task.description && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {task.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {/* Due Date */}
              <div className="flex items-center gap-1.5">
                {task.status === 'overdue' ? (
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
                <span className={task.status === 'overdue' ? 'text-red-500 font-medium' : ''}>
                  {formatActualDate(task.dueDate)}
                </span>
                {formatRelativeDate(task.dueDate) && (
                  <span className={cn(
                    "text-muted-foreground/60",
                    task.status === 'overdue' && "text-red-400"
                  )}>
                    ({formatRelativeDate(task.dueDate)})
                  </span>
                )}
              </div>

              {/* Action Type Label */}
              <span className="capitalize">{actionLabels[task.actionType]}</span>

              {/* Assignee */}
              {showAssignee && (
                <span className="text-muted-foreground/70">
                  Assigned to: {task.assignedTo}
                </span>
              )}
            </div>

            {/* Contact Info */}
            {(task.customerPhone || task.customerEmail) && (
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/70">
                {task.customerPhone && (
                  <span>{task.customerPhone}</span>
                )}
                {task.customerEmail && (
                  <span>{task.customerEmail}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
