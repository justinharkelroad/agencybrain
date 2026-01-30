import React, { useState } from 'react';
import { ChevronDown, ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard, OnboardingTask } from "./TaskCard";
import { Badge } from "@/components/ui/badge";

interface CustomerTaskGroupProps {
  customerName: string;
  tasks: OnboardingTask[];
  onCompleteTask: (taskId: string) => void;
  onCustomerClick?: (customerName: string) => void;
  onSequenceClick?: (sequenceName: string) => void;
  currentUserName?: string;
  showAssignee?: boolean;
  defaultExpanded?: boolean;
}

export function CustomerTaskGroup({
  customerName,
  tasks,
  onCompleteTask,
  onCustomerClick,
  onSequenceClick,
  currentUserName,
  showAssignee = false,
  defaultExpanded = true,
}: CustomerTaskGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const overdueCount = tasks.filter(t => t.status === 'overdue').length;
  const dueTodayCount = tasks.filter(t => t.status === 'due_today').length;
  const pendingCount = tasks.filter(t => t.status !== 'completed').length;

  // Get unique sequence names for this customer
  const sequenceNames = [...new Set(tasks.map(t => t.sequenceName).filter(Boolean))];
  const hasMultipleSequences = sequenceNames.length > 1;

  const handleCustomerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCustomerClick) {
      onCustomerClick(customerName);
    }
  };

  return (
    <div className="mb-6">
      {/* Customer Header */}
      <div
        className="flex items-center gap-3 w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors mb-2"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        <button
          onClick={handleCustomerClick}
          className="flex items-center gap-2 hover:text-primary transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <User className="w-4 h-4 text-primary" />
          </div>
          <span className="font-medium group-hover:underline">{customerName}</span>
        </button>

        {/* Show sequence names when customer has multiple */}
        {hasMultipleSequences && (
          <div className="flex items-center gap-1.5">
            {sequenceNames.map(name => (
              <Badge
                key={name}
                variant="outline"
                className={cn(
                  "text-xs font-normal",
                  onSequenceClick && "cursor-pointer hover:bg-muted"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onSequenceClick?.(name);
                }}
              >
                {name}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {overdueCount > 0 && (
            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
              {overdueCount} overdue
            </Badge>
          )}
          {dueTodayCount > 0 && (
            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">
              {dueTodayCount} due today
            </Badge>
          )}
          <Badge className="bg-muted text-muted-foreground text-xs">
            {pendingCount} task{pendingCount !== 1 ? 's' : ''} remaining
          </Badge>
        </div>
      </div>

      {/* Tasks List */}
      {isExpanded && (
        <div className={cn(
          "space-y-3 pl-10 transition-all duration-300",
          isExpanded ? "opacity-100" : "opacity-0"
        )}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onCompleteTask}
              onSequenceClick={onSequenceClick}
              currentUserName={currentUserName}
              showAssignee={showAssignee}
            />
          ))}
        </div>
      )}
    </div>
  );
}
