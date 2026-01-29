import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard, OnboardingTask } from "./TaskCard";
import { Badge } from "@/components/ui/badge";

interface CompletedTodaySectionProps {
  tasks: OnboardingTask[];
  showAssignee?: boolean;
  currentUserName?: string;
}

export function CompletedTodaySection({ tasks, showAssignee = false, currentUserName }: CompletedTodaySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 pt-6 border-t border-border/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 w-full p-3 rounded-lg bg-green-500/5 hover:bg-green-500/10 transition-colors mb-4"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-green-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-green-500" />
        )}

        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <span className="font-medium text-green-500">Completed Today</span>
        </div>

        <Badge className="ml-auto bg-green-500/10 text-green-500 border-green-500/20 text-xs">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </Badge>
      </button>

      {isExpanded && (
        <div className={cn(
          "space-y-3 pl-6 transition-all duration-300",
          isExpanded ? "opacity-100" : "opacity-0"
        )}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={() => {}}
              currentUserName={currentUserName}
              showAssignee={showAssignee}
            />
          ))}
        </div>
      )}
    </div>
  );
}
