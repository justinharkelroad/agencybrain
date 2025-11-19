import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargets } from "@/hooks/useQuarterlyTargets";
import { useSaveDailyActions } from "@/hooks/useSaveDailyActions";

export function DataStatusIndicator() {
  const { currentQuarter, selectedDailyActions } = useLifeTargetsStore();
  const { data: targets } = useQuarterlyTargets(currentQuarter);
  const saveDailyActions = useSaveDailyActions();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (!targets) {
      setHasUnsavedChanges(false);
      return;
    }

    // Check if there are daily actions in store but not in DB
    const storeHasActions = Object.values(selectedDailyActions).some(arr => arr.length > 0);
    const dbHasActions = 
      (targets.body_daily_actions && Array.isArray(targets.body_daily_actions) && targets.body_daily_actions.length > 0) ||
      (targets.being_daily_actions && Array.isArray(targets.being_daily_actions) && targets.being_daily_actions.length > 0) ||
      (targets.balance_daily_actions && Array.isArray(targets.balance_daily_actions) && targets.balance_daily_actions.length > 0) ||
      (targets.business_daily_actions && Array.isArray(targets.business_daily_actions) && targets.business_daily_actions.length > 0);

    // Compare store vs DB
    const storeBody = selectedDailyActions.body || [];
    const storeeBeing = selectedDailyActions.being || [];
    const storeBalance = selectedDailyActions.balance || [];
    const storeBusiness = selectedDailyActions.business || [];

    const dbBody = targets.body_daily_actions || [];
    const dbBeing = targets.being_daily_actions || [];
    const dbBalance = targets.balance_daily_actions || [];
    const dbBusiness = targets.business_daily_actions || [];

    const isDifferent = 
      JSON.stringify(storeBody) !== JSON.stringify(dbBody) ||
      JSON.stringify(storeeBeing) !== JSON.stringify(dbBeing) ||
      JSON.stringify(storeBalance) !== JSON.stringify(dbBalance) ||
      JSON.stringify(storeBusiness) !== JSON.stringify(dbBusiness);

    setHasUnsavedChanges(storeHasActions && (!dbHasActions || isDifferent));
  }, [selectedDailyActions, targets]);

  const handleSyncToDatabase = () => {
    saveDailyActions.mutate({
      quarter: currentQuarter,
      selectedActions: selectedDailyActions,
      showToast: true,
    });
  };

  if (!hasUnsavedChanges && !saveDailyActions.isPending) return null;

  return (
    <Alert className={`mb-4 ${hasUnsavedChanges ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-green-500/50 bg-green-500/10'}`}>
      {hasUnsavedChanges ? (
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
      )}
      <AlertDescription className="flex items-center justify-between gap-4">
        <div className="flex-1">
          {saveDailyActions.isPending ? (
            <p className="font-medium text-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving to database...
            </p>
          ) : hasUnsavedChanges ? (
            <>
              <p className="font-medium text-foreground mb-1">
                Unsaved daily actions
              </p>
              <p className="text-sm text-muted-foreground">
                Your daily actions are only in your browser. Click "Sync to Database" to save them permanently.
              </p>
            </>
          ) : (
            <p className="font-medium text-foreground">
              All changes saved ✓
            </p>
          )}
        </div>
        {hasUnsavedChanges && !saveDailyActions.isPending && (
          <Button
            onClick={handleSyncToDatabase}
            size="sm"
            variant="default"
          >
            Sync to Database
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
