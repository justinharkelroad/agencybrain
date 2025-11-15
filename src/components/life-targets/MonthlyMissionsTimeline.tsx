import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Lightbulb, Check, Loader2 } from "lucide-react";
import type { MonthlyMissionsOutput, DomainMissions } from "@/hooks/useMonthlyMissions";

interface TargetTexts {
  [domain: string]: {
    target1?: string;
    target2?: string;
  };
}

interface PrimarySelections {
  [domain: string]: boolean;
}

interface MonthlyMissionsTimelineProps {
  missions: MonthlyMissionsOutput;
  selectedDomain?: string;
  targetTexts?: TargetTexts | null;
  primarySelections?: PrimarySelections;
  onLockIn?: (domain: string, isTarget1: boolean) => void;
  isLoading?: boolean;
}

const DOMAINS = [
  { key: 'body', label: 'Body', color: 'text-blue-600 dark:text-blue-400' },
  { key: 'being', label: 'Being', color: 'text-purple-600 dark:text-purple-400' },
  { key: 'balance', label: 'Balance', color: 'text-green-600 dark:text-green-400' },
  { key: 'business', label: 'Business', color: 'text-orange-600 dark:text-orange-400' },
] as const;

function MissionCard({ 
  month, 
  mission, 
  why 
}: { 
  month: string; 
  mission: string; 
  why: string;
}) {
  return (
    <div className="p-4 rounded-lg border bg-card space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Badge variant="outline">{month}</Badge>
      </div>
      <div>
        <p className="font-medium mb-2">{mission}</p>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>{why}</p>
        </div>
      </div>
    </div>
  );
}

function DomainMissions({ 
  domainKey, 
  label, 
  color, 
  domainMissions,
  targetTexts,
  primarySelections,
  onLockIn
}: { 
  domainKey: string;
  label: string;
  color: string;
  domainMissions: DomainMissions;
  targetTexts?: TargetTexts | null;
  primarySelections?: PrimarySelections;
  onLockIn?: (domain: string, isTarget1: boolean) => void;
}) {
  const hasTarget1 = domainMissions.target1 && Object.keys(domainMissions.target1).length > 0;
  const hasTarget2 = domainMissions.target2 && Object.keys(domainMissions.target2).length > 0;

  if (!hasTarget1 && !hasTarget2) return null;

  const hasBothTargets = hasTarget1 && hasTarget2;
  const target1Text = targetTexts?.[domainKey]?.target1;
  const target2Text = targetTexts?.[domainKey]?.target2;
  const isTarget1Primary = primarySelections?.[domainKey];
  const isTarget2Primary = primarySelections?.[domainKey] === false;

  // Target 1 is greyed out if Target 2 is locked
  const target1GreyedOut = hasBothTargets && isTarget2Primary;
  // Target 2 is greyed out if Target 1 is locked
  const target2GreyedOut = hasBothTargets && isTarget1Primary;

  return (
    <div className="space-y-4">
      <h3 className={`text-lg font-semibold ${color}`}>{label}</h3>
      
      {hasTarget1 && (
        <div className={`space-y-3 transition-opacity ${target1GreyedOut ? 'opacity-40' : ''}`}>
          {hasBothTargets && (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {target1Text || 'Target 1'}
              </p>
              {onLockIn && (
                <div>
                  {isTarget1Primary ? (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />
                      Locked
                    </Badge>
                  ) : !isTarget2Primary ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onLockIn(domainKey, true)}
                    >
                      Lock in
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(domainMissions.target1!).map(([month, data]) => (
              <MissionCard
                key={month}
                month={month}
                mission={data.mission}
                why={data.why}
              />
            ))}
          </div>
        </div>
      )}

      {hasTarget2 && (
        <div className={`space-y-3 transition-opacity ${target2GreyedOut ? 'opacity-40' : ''}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {target2Text || 'Target 2'}
            </p>
            {onLockIn && (
              <div>
                {isTarget2Primary ? (
                  <Badge variant="default" className="gap-1">
                    <Check className="h-3 w-3" />
                    Locked
                  </Badge>
                ) : !isTarget1Primary ? (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onLockIn(domainKey, false)}
                  >
                    Lock in
                  </Button>
                ) : null}
              </div>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {Object.entries(domainMissions.target2!).map(([month, data]) => (
              <MissionCard
                key={month}
                month={month}
                mission={data.mission}
                why={data.why}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MonthlyMissionsTimeline({ 
  missions, 
  selectedDomain,
  targetTexts,
  primarySelections,
  onLockIn,
  isLoading = false
}: MonthlyMissionsTimelineProps) {
  // Helper to check if missions have data
  const hasMissionsData = (missions: any): boolean => {
    if (!missions) return false;
    return Object.values(missions).some(domain => {
      if (!domain || typeof domain !== 'object') return false;
      return Object.values(domain).some(target => {
        if (!target || typeof target !== 'object') return false;
        return Object.keys(target).length > 0;
      });
    });
  };

  // Show empty/loading state if no missions data
  if (isLoading || !hasMissionsData(missions)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Missions Timeline</CardTitle>
          <CardDescription>
            Your quarterly targets broken down into actionable monthly missions
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p>Generating missions...</p>
            </div>
          ) : (
            <p>Missions will appear here after generation</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const filteredDomains = selectedDomain
    ? DOMAINS.filter(d => d.key === selectedDomain)
    : DOMAINS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Missions Timeline</CardTitle>
        <CardDescription>
          Your quarterly targets broken down into actionable monthly missions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {filteredDomains.map((domain) => {
          const domainMissions = missions[domain.key as keyof MonthlyMissionsOutput];
          if (!domainMissions) return null;

          return (
            <DomainMissions
              key={domain.key}
              domainKey={domain.key}
              label={domain.label}
              color={domain.color}
              domainMissions={domainMissions}
              targetTexts={targetTexts}
              primarySelections={primarySelections}
              onLockIn={onLockIn}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
