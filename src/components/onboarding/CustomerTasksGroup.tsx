import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronDown, ChevronRight, User, AlertCircle, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OnboardingTaskCard } from './OnboardingTaskCard';
import type { OnboardingTask } from '@/hooks/useOnboardingTasks';

interface CustomerTasksGroupProps {
  customerName: string;
  tasks: OnboardingTask[];
  onCompleteTask: (taskId: string, notes?: string) => Promise<void>;
  completingTaskId?: string | null;
  showAssignee?: boolean;
  defaultExpanded?: boolean;
  onReassign?: (instanceId: string, customerName: string, pendingCount: number) => void;
  canReassign?: boolean;
}

export function CustomerTasksGroup({
  customerName,
  tasks,
  onCompleteTask,
  completingTaskId,
  showAssignee = false,
  defaultExpanded = true,
  onReassign,
  canReassign = false,
}: CustomerTasksGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Count tasks by status
  const overdueCount = tasks.filter(t => t.status === 'overdue').length;
  const dueCount = tasks.filter(t => t.status === 'due').length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const activeCount = overdueCount + dueCount + pendingCount;

  const hasOverdue = overdueCount > 0;

  // Get the instance ID from the first task (all tasks in group share the same instance)
  const instanceId = tasks[0]?.instance_id;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn(
        'border rounded-lg relative',
        hasOverdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
      )}>
        {/* Group Header */}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-between p-4 h-auto hover:bg-transparent',
              hasOverdue && 'hover:bg-red-50/50'
            )}
          >
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{customerName}</span>
              </div>

              {hasOverdue && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </div>

            <div className="flex items-center gap-2">
              {overdueCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {overdueCount} overdue
                </Badge>
              )}
              {dueCount > 0 && (
                <Badge variant="default" className="text-xs">
                  {dueCount} due today
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {pendingCount} upcoming
                </Badge>
              )}
              {completedCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {completedCount} done
                </Badge>
              )}
            </div>
          </Button>
        </CollapsibleTrigger>

        {/* Reassign Button */}
        {canReassign && onReassign && instanceId && activeCount > 0 && (
          <div className="absolute right-4 top-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReassign(instanceId, customerName, activeCount);
                    }}
                  >
                    <UserCog className="h-4 w-4" />
                    <span className="sr-only">Reassign</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reassign to another team member</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Tasks */}
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-3">
            {tasks.map((task) => (
              <OnboardingTaskCard
                key={task.id}
                task={task}
                onComplete={onCompleteTask}
                isCompleting={completingTaskId === task.id}
                showAssignee={showAssignee}
                showCustomer={false}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Helper function to group tasks by customer
export function groupTasksByCustomer(tasks: OnboardingTask[]): Map<string, OnboardingTask[]> {
  const groups = new Map<string, OnboardingTask[]>();

  for (const task of tasks) {
    const customerName = task.instance?.customer_name || 'Unknown Customer';
    const existing = groups.get(customerName) || [];
    existing.push(task);
    groups.set(customerName, existing);
  }

  // Sort groups by priority (overdue tasks first)
  const sortedGroups = new Map(
    [...groups.entries()].sort((a, b) => {
      const aOverdue = a[1].some(t => t.status === 'overdue');
      const bOverdue = b[1].some(t => t.status === 'overdue');
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      const aDue = a[1].some(t => t.status === 'due');
      const bDue = b[1].some(t => t.status === 'due');
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;

      return a[0].localeCompare(b[0]);
    })
  );

  return sortedGroups;
}
