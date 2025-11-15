import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { DailyActionsSelector } from "@/components/life-targets/DailyActionsSelector";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargets, useSaveQuarterlyTargets } from "@/hooks/useQuarterlyTargets";
import { useDailyActions } from "@/hooks/useDailyActions";
import { toast } from "sonner";

export default function LifeTargetsDaily() {
  const navigate = useNavigate();
  const { currentQuarter, dailyActions, setDailyActions } = useLifeTargetsStore();
  const { data: targets } = useQuarterlyTargets(currentQuarter);
  const generateActions = useDailyActions();
  const saveTargets = useSaveQuarterlyTargets();

  const [savedHabits, setSavedHabits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (targets) {
      setSavedHabits({
        body: targets.body_daily_habit || '',
        being: targets.being_daily_habit || '',
        balance: targets.balance_daily_habit || '',
        business: targets.business_daily_habit || '',
      });
    }
  }, [targets]);

  const handleGenerate = async () => {
    if (!targets) {
      toast.error('Please set your quarterly targets first');
      return;
    }

    const params: any = {};

    // Use primary target based on selection (default to target1 if not set)
    if (targets.body_target || targets.body_target2) {
      const isPrimaryTarget1 = targets.body_primary_is_target1 ?? true;
      const primaryTarget = isPrimaryTarget1 ? targets.body_target : targets.body_target2;
      const primaryNarrative = isPrimaryTarget1 ? targets.body_narrative : targets.body_narrative2;
      
      if (primaryTarget) {
        params.body = {
          target: primaryTarget,
          monthlyMissions: targets.body_monthly_missions || undefined,
          narrative: primaryNarrative || undefined,
        };
      }
    }

    if (targets.being_target || targets.being_target2) {
      const isPrimaryTarget1 = targets.being_primary_is_target1 ?? true;
      const primaryTarget = isPrimaryTarget1 ? targets.being_target : targets.being_target2;
      const primaryNarrative = isPrimaryTarget1 ? targets.being_narrative : targets.being_narrative2;
      
      if (primaryTarget) {
        params.being = {
          target: primaryTarget,
          monthlyMissions: targets.being_monthly_missions || undefined,
          narrative: primaryNarrative || undefined,
        };
      }
    }

    if (targets.balance_target || targets.balance_target2) {
      const isPrimaryTarget1 = targets.balance_primary_is_target1 ?? true;
      const primaryTarget = isPrimaryTarget1 ? targets.balance_target : targets.balance_target2;
      const primaryNarrative = isPrimaryTarget1 ? targets.balance_narrative : targets.balance_narrative2;
      
      if (primaryTarget) {
        params.balance = {
          target: primaryTarget,
          monthlyMissions: targets.balance_monthly_missions || undefined,
          narrative: primaryNarrative || undefined,
        };
      }
    }

    if (targets.business_target || targets.business_target2) {
      const isPrimaryTarget1 = targets.business_primary_is_target1 ?? true;
      const primaryTarget = isPrimaryTarget1 ? targets.business_target : targets.business_target2;
      const primaryNarrative = isPrimaryTarget1 ? targets.business_narrative : targets.business_narrative2;
      
      if (primaryTarget) {
        params.business = {
          target: primaryTarget,
          monthlyMissions: targets.business_monthly_missions || undefined,
          narrative: primaryNarrative || undefined,
        };
      }
    }

    try {
      const results = await generateActions.mutateAsync(params);
      setDailyActions(results);
    } catch (error) {
      console.error('Failed to generate daily actions:', error);
    }
  };

  const handleSaveHabit = async (domain: string, action: string) => {
    if (!targets) return;

    const updatedTargets = {
      ...targets,
      [`${domain}_daily_habit`]: action,
    };

    try {
      await saveTargets.mutateAsync(updatedTargets);
      setSavedHabits((prev) => ({ ...prev, [domain]: action }));
    } catch (error) {
      console.error('Failed to save habit:', error);
    }
  };

  const hasTargets = targets && [
    targets.body_target,
    targets.being_target,
    targets.balance_target,
    targets.business_target,
  ].some(Boolean);

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/life-targets')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Daily Actions</h1>
            <p className="text-muted-foreground">
              Choose daily habits to support your quarterly targets
            </p>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!hasTargets || generateActions.isPending}
          variant={dailyActions ? "outline" : "default"}
        >
          {generateActions.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              {dailyActions ? 'Refresh Suggestions' : 'Generate Actions'}
            </>
          )}
        </Button>
      </div>

      {!hasTargets && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4">Please set your quarterly targets first</p>
          <Button onClick={() => navigate('/life-targets/quarterly')}>
            Set Targets
          </Button>
        </div>
      )}

      {dailyActions && (
        <DailyActionsSelector
          actions={dailyActions}
          onSaveHabit={handleSaveHabit}
          savedHabits={savedHabits}
        />
      )}
    </div>
  );
}
