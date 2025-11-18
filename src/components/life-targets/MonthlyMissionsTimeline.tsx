import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Lightbulb, Check, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
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

export interface MonthlyMissionsTimelineProps {
  missions: MonthlyMissionsOutput;
  selectedDomain?: string;
  targetTexts?: TargetTexts | null;
  primarySelections?: PrimarySelections;
  onLockIn?: (domain: string, isTarget1: boolean) => void;
  onEditMission?: (domain: string, target: 'target1' | 'target2', month: string, mission: string, why: string) => void;
  isLoading?: boolean;
  quarter: string;
}

const DOMAINS = [
  { key: 'body', label: 'Body', color: 'text-blue-600 dark:text-blue-400' },
  { key: 'being', label: 'Being', color: 'text-purple-600 dark:text-purple-400' },
  { key: 'balance', label: 'Balance', color: 'text-green-600 dark:text-green-400' },
  { key: 'business', label: 'Business', color: 'text-orange-600 dark:text-orange-400' },
] as const;

const QUARTER_MONTHS: Record<string, string[]> = {
  'Q1': ['January', 'February', 'March'],
  'Q2': ['April', 'May', 'June'],
  'Q3': ['July', 'August', 'September'],
  'Q4': ['October', 'November', 'December'],
};

function sortMonthEntries(entries: [string, any][], quarter: string): [string, any][] {
  const quarterPart = quarter.split('-')[1] as keyof typeof QUARTER_MONTHS;
  const orderedMonths = QUARTER_MONTHS[quarterPart] || [];
  return entries.sort((a, b) => {
    const indexA = orderedMonths.indexOf(a[0]);
    const indexB = orderedMonths.indexOf(b[0]);
    return indexA - indexB;
  });
}

function MissionCard({ 
  month, 
  mission, 
  why,
  onEdit
}: { 
  month: string; 
  mission: string; 
  why: string;
  onEdit?: (newMission: string, newWhy: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editMission, setEditMission] = useState(mission);
  const [editWhy, setEditWhy] = useState(why);

  const handleSave = () => {
    if (!editMission.trim() || !editWhy.trim()) {
      toast.error('Mission and why cannot be empty');
      return;
    }
    onEdit?.(editMission, editWhy);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditMission(mission);
    setEditWhy(why);
    setIsEditing(false);
  };

  return (
    <div className={`p-4 rounded-lg border bg-card space-y-3 group ${isEditing ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline">{month}</Badge>
        </div>
        {onEdit && !isEditing && (
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div>
        {isEditing ? (
          <Textarea
            value={editMission}
            onChange={(e) => setEditMission(e.target.value)}
            className="min-h-[60px] mb-2"
            placeholder="Enter mission..."
          />
        ) : (
          <p className="font-medium mb-2">{mission}</p>
        )}
        <div className="flex gap-2 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {isEditing ? (
            <Textarea
              value={editWhy}
              onChange={(e) => setEditWhy(e.target.value)}
              className="min-h-[60px]"
              placeholder="Enter why..."
            />
          ) : (
            <p>{why}</p>
          )}
        </div>
      </div>
      {isEditing && (
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave}>Save</Button>
          <Button size="sm" variant="ghost" onClick={handleCancel}>Cancel</Button>
        </div>
      )}
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
  onLockIn,
  onEditMission,
  quarter
}: { 
  domainKey: string;
  label: string;
  color: string;
  domainMissions: DomainMissions;
  targetTexts?: TargetTexts | null;
  primarySelections?: PrimarySelections;
  onLockIn?: (domain: string, isTarget1: boolean) => void;
  onEditMission?: (target: 'target1' | 'target2', month: string, mission: string, why: string) => void;
  quarter: string;
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
            <div className="flex items-center gap-2">
              {target1Text && (
                <p className="text-sm text-muted-foreground flex-1">
                  <span className="font-medium">Target 1:</span> {target1Text}
                </p>
              )}
              {onLockIn && (
                <Button
                  size="sm"
                  variant={isTarget1Primary ? "default" : "outline"}
                  onClick={() => onLockIn(domainKey, true)}
                  disabled={isTarget1Primary}
                  className="shrink-0"
                >
                  {isTarget1Primary ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Primary Target
                    </>
                  ) : (
                    'Set as Primary'
                  )}
                </Button>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortMonthEntries(Object.entries(domainMissions.target1 || {}), quarter).map(([month, data]) => (
              <MissionCard 
                key={month} 
                month={month} 
                mission={data.mission} 
                why={data.why}
                onEdit={onEditMission ? (m, w) => onEditMission('target1', month, m, w) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {hasTarget2 && (
        <div className={`space-y-3 transition-opacity ${target2GreyedOut ? 'opacity-40' : ''}`}>
          {hasBothTargets && (
            <div className="flex items-center gap-2">
              {target2Text && (
                <p className="text-sm text-muted-foreground flex-1">
                  <span className="font-medium">Target 2:</span> {target2Text}
                </p>
              )}
              {onLockIn && (
                <Button
                  size="sm"
                  variant={isTarget2Primary ? "default" : "outline"}
                  onClick={() => onLockIn(domainKey, false)}
                  disabled={isTarget2Primary}
                  className="shrink-0"
                >
                  {isTarget2Primary ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Primary Target
                    </>
                  ) : (
                    'Set as Primary'
                  )}
                </Button>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortMonthEntries(Object.entries(domainMissions.target2 || {}), quarter).map(([month, data]) => (
              <MissionCard 
                key={month} 
                month={month} 
                mission={data.mission} 
                why={data.why}
                onEdit={onEditMission ? (m, w) => onEditMission('target2', month, m, w) : undefined}
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
  selectedDomain = 'all',
  targetTexts,
  primarySelections,
  onLockIn,
  onEditMission,
  isLoading = false,
  quarter
}: MonthlyMissionsTimelineProps) {
  const hasMissionsData = (missions: MonthlyMissionsOutput): boolean => {
    if (!missions) return false;
    
    return Object.values(missions).some(domain => {
      if (!domain || typeof domain !== 'object') return false;
      return Object.values(domain).some(target => {
        if (!target || typeof target !== 'object') return false;
        return Object.keys(target).length > 0;
      });
    });
  };

  const filteredDomains = selectedDomain === 'all' 
    ? DOMAINS 
    : DOMAINS.filter(d => d.key === selectedDomain);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Missions Timeline</CardTitle>
        <CardDescription>
          Your monthly missions break down each quarterly target into actionable monthly goals with clear reasoning.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating your monthly missions...</p>
            </div>
          </div>
        ) : !hasMissionsData(missions) ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No missions generated yet. Click "Generate Missions" to create your monthly breakdown.</p>
          </div>
        ) : (
          filteredDomains.map(domain => {
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
                onEditMission={onEditMission ? (target, month, mission, why) => onEditMission(domain.key, target, month, mission, why) : undefined}
                quarter={quarter}
              />
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
