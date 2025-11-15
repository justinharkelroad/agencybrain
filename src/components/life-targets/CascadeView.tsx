import { DomainCascadeCard } from "./DomainCascadeCard";
import type { QuarterlyTargets } from "@/hooks/useQuarterlyTargets";

interface CascadeViewProps {
  targets: QuarterlyTargets;
  selectedDailyActions: Record<string, string[]>;
  quarter: string;
}

const DOMAINS = [
  { 
    key: 'body', 
    label: 'Body', 
    color: 'border-blue-500/50 bg-blue-500/5',
    textColor: 'text-blue-600 dark:text-blue-400'
  },
  { 
    key: 'being', 
    label: 'Being', 
    color: 'border-purple-500/50 bg-purple-500/5',
    textColor: 'text-purple-600 dark:text-purple-400'
  },
  { 
    key: 'balance', 
    label: 'Balance', 
    color: 'border-green-500/50 bg-green-500/5',
    textColor: 'text-green-600 dark:text-green-400'
  },
  { 
    key: 'business', 
    label: 'Business', 
    color: 'border-orange-500/50 bg-orange-500/5',
    textColor: 'text-orange-600 dark:text-orange-400'
  },
] as const;

export function CascadeView({ targets, selectedDailyActions, quarter }: CascadeViewProps) {
  return (
    <div className="space-y-6">
      {/* Quarter Info */}
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h2 className="text-lg font-semibold mb-1">Planning Period</h2>
        <p className="text-muted-foreground">{quarter} 2025 - Your 90-Day Focus</p>
      </div>

      {/* Domain Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {DOMAINS.map((domain) => {
          const primaryIsTarget1 = targets[`${domain.key}_primary_is_target1` as keyof QuarterlyTargets] ?? true;
          const primaryTarget = primaryIsTarget1 
            ? targets[`${domain.key}_target` as keyof QuarterlyTargets]
            : targets[`${domain.key}_target2` as keyof QuarterlyTargets];
          const primaryNarrative = primaryIsTarget1
            ? targets[`${domain.key}_narrative` as keyof QuarterlyTargets]
            : targets[`${domain.key}_narrative2` as keyof QuarterlyTargets];

          // Skip if no primary target
          if (!primaryTarget) return null;

          return (
            <DomainCascadeCard
              key={domain.key}
              domainKey={domain.key}
              domainLabel={domain.label}
              color={domain.color}
              textColor={domain.textColor}
              quarterlyTarget={primaryTarget as string}
              narrative={primaryNarrative as string}
              monthlyMissions={targets[`${domain.key}_monthly_missions` as keyof QuarterlyTargets] as any}
              dailyActions={selectedDailyActions[domain.key] || []}
            />
          );
        })}
      </div>
    </div>
  );
}
