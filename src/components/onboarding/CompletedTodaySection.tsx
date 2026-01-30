import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { OnboardingTaskCard } from './OnboardingTaskCard';
import type { OnboardingTask } from '@/hooks/useOnboardingTasks';

interface CompletedTodaySectionProps {
  tasks: OnboardingTask[];
  showAssignee?: boolean;
}

export function CompletedTodaySection({
  tasks,
  showAssignee = false,
}: CompletedTodaySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="border border-green-200 rounded-lg bg-green-50/30">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto hover:bg-green-50/50"
          >
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}

              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-700">Completed Today</span>
              </div>
            </div>

            <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </Badge>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-3">
            {tasks.map((task) => (
              <OnboardingTaskCard
                key={task.id}
                task={task}
                onComplete={async () => {}}
                showAssignee={showAssignee}
                showCustomer={true}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
