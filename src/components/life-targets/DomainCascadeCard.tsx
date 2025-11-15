import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Save, X } from "lucide-react";
import { DailyActionsManager } from "./DailyActionsManager";

interface DomainCascadeCardProps {
  domainKey: string;
  domainLabel: string;
  color: string;
  textColor: string;
  quarterlyTarget: string;
  narrative: string | null;
  monthlyMissions: any;
  dailyActions: string[];
}

export function DomainCascadeCard({
  domainKey,
  domainLabel,
  color,
  textColor,
  quarterlyTarget,
  narrative,
  monthlyMissions,
  dailyActions,
}: DomainCascadeCardProps) {
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [editedTarget, setEditedTarget] = useState(quarterlyTarget);
  const [isEditingNarrative, setIsEditingNarrative] = useState(false);
  const [editedNarrative, setEditedNarrative] = useState(narrative || '');

  const handleSaveTarget = () => {
    // TODO: Save to database in future enhancement
    setIsEditingTarget(false);
  };

  const handleCancelTarget = () => {
    setEditedTarget(quarterlyTarget);
    setIsEditingTarget(false);
  };

  const handleSaveNarrative = () => {
    // TODO: Save to database in future enhancement
    setIsEditingNarrative(false);
  };

  const handleCancelNarrative = () => {
    setEditedNarrative(narrative || '');
    setIsEditingNarrative(false);
  };

  return (
    <Card className={`border-2 ${color}`}>
      <CardHeader>
        <CardTitle className={`text-xl ${textColor}`}>{domainLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quarterly Target */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase">
              Quarterly Target
            </h3>
            {!isEditingTarget && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingTarget(true)}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {isEditingTarget ? (
            <div className="space-y-2">
              <Textarea
                value={editedTarget}
                onChange={(e) => setEditedTarget(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveTarget}>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelTarget}>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-foreground">{quarterlyTarget}</p>
          )}
        </div>

        {/* Narrative */}
        {narrative && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                Why This Matters
              </h3>
              {!isEditingNarrative && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingNarrative(true)}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            {isEditingNarrative ? (
              <div className="space-y-2">
                <Textarea
                  value={editedNarrative}
                  onChange={(e) => setEditedNarrative(e.target.value)}
                  className="min-h-[80px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNarrative}>
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelNarrative}>
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">{narrative}</p>
            )}
          </div>
        )}

        {/* Monthly Missions */}
        {monthlyMissions && (
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground uppercase mb-2">
              Monthly Missions
            </h3>
            <div className="space-y-2">
              {Object.entries(monthlyMissions).map(([month, mission]: [string, any]) => (
                <div key={month} className="flex gap-2">
                  <span className="font-medium text-sm min-w-[60px]">
                    {month}:
                  </span>
                  <span className="text-sm text-foreground">{mission}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Actions */}
        <DailyActionsManager
          domainKey={domainKey}
          dailyActions={dailyActions}
          textColor={textColor}
        />
      </CardContent>
    </Card>
  );
}
