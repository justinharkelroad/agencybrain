import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Lightbulb } from "lucide-react";
import type { MonthlyMissionsOutput, DomainMissions } from "@/hooks/useMonthlyMissions";

interface MonthlyMissionsTimelineProps {
  missions: MonthlyMissionsOutput;
  selectedDomain?: string;
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
  domainMissions 
}: { 
  domainKey: string;
  label: string;
  color: string;
  domainMissions: DomainMissions;
}) {
  const hasTarget1 = domainMissions.target1 && Object.keys(domainMissions.target1).length > 0;
  const hasTarget2 = domainMissions.target2 && Object.keys(domainMissions.target2).length > 0;

  if (!hasTarget1 && !hasTarget2) return null;

  return (
    <div className="space-y-4">
      <h3 className={`text-lg font-semibold ${color}`}>{label}</h3>
      
      {hasTarget1 && (
        <div className="space-y-3">
          {domainMissions.target2 && <p className="text-sm font-medium text-muted-foreground">Target 1</p>}
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
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Target 2</p>
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
  selectedDomain 
}: MonthlyMissionsTimelineProps) {
  const hasAnyMissions = DOMAINS.some(
    domain => missions[domain.key as keyof MonthlyMissionsOutput]
  );

  if (!hasAnyMissions) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No missions generated yet</p>
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
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
