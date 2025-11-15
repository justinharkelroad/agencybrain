import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { DailyActionsSelector } from "@/components/life-targets/DailyActionsSelector";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargets } from "@/hooks/useQuarterlyTargets";
import { useDailyActions } from "@/hooks/useDailyActions";
import { toast } from "sonner";

export default function LifeTargetsDaily() {
  const navigate = useNavigate();
  const { 
    currentQuarter, 
    dailyActions, 
    selectedDailyActions,
    setDailyActions,
    setSelectedDailyActions 
  } = useLifeTargetsStore();
  const { data: targets } = useQuarterlyTargets(currentQuarter);
  const generateActions = useDailyActions();

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

    try {
      const results = await generateActions.mutateAsync(params);
      setDailyActions(results);
      toast.success('Daily actions generated successfully!');
    } catch (error) {
      console.error('Failed to generate daily actions:', error);
      toast.error('Failed to generate daily actions');
    }
  };

  const handleContinue = () => {
    // GATE 3: Navigate to cascade view instead of saving
    navigate('/life-targets/cascade');
  };

  const hasGeneratedActions = dailyActions && Object.values(dailyActions).some(
    actions => actions && actions.length > 0
  );

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/life-targets/missions')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Step 4: Daily Actions</h1>
            <p className="text-muted-foreground mt-1">
              Select the daily habits that will drive your quarterly targets
            </p>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generateActions.isPending || !targets}
          variant="outline"
        >
          {generateActions.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              {hasGeneratedActions ? 'Regenerate' : 'Generate'} Actions
            </>
          )}
        </Button>
      </div>

      {/* Actions Selector */}
      {hasGeneratedActions && dailyActions ? (
        <DailyActionsSelector
          actions={dailyActions}
          selectedActions={selectedDailyActions}
          onSelectionsChange={setSelectedDailyActions}
          onContinue={handleContinue}
        />
      ) : (
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">
            Click "Generate Actions" to get AI-powered daily habit suggestions
          </p>
        </div>
      )}
    </div>
  );
}
