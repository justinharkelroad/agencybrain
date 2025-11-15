import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2 } from "lucide-react";
import type { DailyActionsOutput } from "@/hooks/useDailyActions";

interface DailyActionsSelectorProps {
  actions: DailyActionsOutput;
  onSaveHabit?: (domain: string, action: string) => void;
  savedHabits?: Record<string, string>;
}

const DOMAINS = [
  { key: 'body', label: 'Body', color: 'text-blue-600 dark:text-blue-400' },
  { key: 'being', label: 'Being', color: 'text-purple-600 dark:text-purple-400' },
  { key: 'balance', label: 'Balance', color: 'text-green-600 dark:text-green-400' },
  { key: 'business', label: 'Business', color: 'text-orange-600 dark:text-orange-400' },
] as const;

function DomainActions({
  domainKey,
  label,
  color,
  actions,
  selectedAction,
  savedHabit,
  onSelect,
  onSave,
}: {
  domainKey: string;
  label: string;
  color: string;
  actions: string[];
  selectedAction: string | null;
  savedHabit?: string;
  onSelect: (action: string) => void;
  onSave?: () => void;
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${color}`}>{label}</h3>
        {savedHabit && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Habit saved</span>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action, index) => {
          const isSelected = selectedAction === action;
          const isSaved = savedHabit === action;

          return (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : isSaved
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(action)}
                className="mt-0.5"
              />
              <p className="text-sm flex-1">{action}</p>
            </div>
          );
        })}
      </div>

      {selectedAction && !savedHabit && onSave && (
        <Button onClick={onSave} size="sm" className="w-full">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Set as Daily Habit
        </Button>
      )}

      {savedHabit && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm font-medium mb-1">Current Daily Habit:</p>
          <p className="text-sm text-muted-foreground">{savedHabit}</p>
        </div>
      )}
    </div>
  );
}

export function DailyActionsSelector({
  actions,
  onSaveHabit,
  savedHabits = {},
}: DailyActionsSelectorProps) {
  const [selectedActions, setSelectedActions] = useState<Record<string, string | null>>({
    body: null,
    being: null,
    balance: null,
    business: null,
  });

  const handleSelect = (domain: string, action: string) => {
    setSelectedActions((prev) => ({
      ...prev,
      [domain]: prev[domain] === action ? null : action,
    }));
  };

  const handleSave = (domain: string) => {
    const action = selectedActions[domain];
    if (action && onSaveHabit) {
      onSaveHabit(domain, action);
      setSelectedActions((prev) => ({ ...prev, [domain]: null }));
    }
  };

  const hasAnyActions = DOMAINS.some(
    (domain) => actions[domain.key as keyof DailyActionsOutput]?.length > 0
  );

  if (!hasAnyActions) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No daily actions available yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Action Options</CardTitle>
        <CardDescription>
          Choose one daily habit from each domain to help achieve your targets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {DOMAINS.map((domain) => {
          const domainActions = actions[domain.key as keyof DailyActionsOutput];
          if (!domainActions) return null;

          return (
            <DomainActions
              key={domain.key}
              domainKey={domain.key}
              label={domain.label}
              color={domain.color}
              actions={domainActions}
              selectedAction={selectedActions[domain.key]}
              savedHabit={savedHabits[domain.key]}
              onSelect={(action) => handleSelect(domain.key, action)}
              onSave={() => handleSave(domain.key)}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
