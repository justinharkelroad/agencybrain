import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { DailyActionsOutput } from "@/hooks/useDailyActions";

interface DailyActionsSelectorProps {
  actions: DailyActionsOutput;
  selectedActions?: Record<string, string[]>;
  onSelectionsChange?: (selections: Record<string, string[]>) => void;
  onContinue?: () => void;
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
  selectedActions,
  onToggle,
}: {
  domainKey: string;
  label: string;
  color: string;
  actions: string[];
  selectedActions: string[];
  onToggle: (action: string) => void;
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${color}`}>{label}</h3>
        {selectedActions.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>{selectedActions.length} selected</span>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action, index) => {
          const isSelected = selectedActions.includes(action);

          return (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
              onClick={() => onToggle(action)}
            >
              <Checkbox
                checked={isSelected}
                className="mt-0.5 pointer-events-none"
              />
              <p className="text-sm flex-1">{action}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DailyActionsSelector({
  actions,
  selectedActions: externalSelections,
  onSelectionsChange,
  onContinue,
}: DailyActionsSelectorProps) {
  const [selectedActions, setSelectedActions] = useState<Record<string, string[]>>(
    externalSelections || {
      body: [],
      being: [],
      balance: [],
      business: [],
    }
  );

  useEffect(() => {
    if (externalSelections) {
      setSelectedActions(externalSelections);
    }
  }, [externalSelections]);

  const handleToggle = (domain: string, action: string) => {
    setSelectedActions((prev) => {
      const domainSelections = prev[domain] || [];
      const isSelected = domainSelections.includes(action);
      
      const newSelections = {
        ...prev,
        [domain]: isSelected
          ? domainSelections.filter(a => a !== action)
          : [...domainSelections, action]
      };

      onSelectionsChange?.(newSelections);
      return newSelections;
    });
  };

  const totalSelected = Object.values(selectedActions).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  const hasActiveTargets = DOMAINS.some(domain => 
    actions[domain.key] && actions[domain.key].length > 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Your Daily Actions</CardTitle>
        <CardDescription>
          Choose one or more daily actions for each domain. These will form your daily habits to achieve your quarterly targets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {DOMAINS.map((domain) => {
          const domainActions = actions[domain.key];
          if (!domainActions || domainActions.length === 0) return null;

          return (
            <DomainActions
              key={domain.key}
              domainKey={domain.key}
              label={domain.label}
              color={domain.color}
              actions={domainActions}
              selectedActions={selectedActions[domain.key] || []}
              onToggle={(action) => handleToggle(domain.key, action)}
            />
          );
        })}

        {!hasActiveTargets && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No daily actions available. Please set your quarterly targets first.</p>
          </div>
        )}

        {hasActiveTargets && onContinue && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {totalSelected === 0 
                  ? 'Select at least one action to continue' 
                  : `${totalSelected} action${totalSelected === 1 ? '' : 's'} selected`}
              </p>
            </div>
            <Button
              onClick={onContinue}
              disabled={totalSelected === 0}
              className="w-full"
              size="lg"
            >
              Continue to Cascade View
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
