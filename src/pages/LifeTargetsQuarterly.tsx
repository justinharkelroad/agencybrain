import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { QuarterlyTargetsForm } from "@/components/life-targets/QuarterlyTargetsForm";
import { MeasurabilityAnalysisCard } from "@/components/life-targets/MeasurabilityAnalysisCard";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargets, useSaveQuarterlyTargets } from "@/hooks/useQuarterlyTargets";
import { useTargetMeasurability } from "@/hooks/useTargetMeasurability";
import type { QuarterlyTargets } from "@/hooks/useQuarterlyTargets";

export default function LifeTargetsQuarterly() {
  const navigate = useNavigate();
  const { currentQuarter, measurabilityResults, setMeasurabilityResults } = useLifeTargetsStore();
  const { data: targets } = useQuarterlyTargets(currentQuarter);
  const saveTargets = useSaveQuarterlyTargets();
  const analyzeMeasurability = useTargetMeasurability();

  const [localTargets, setLocalTargets] = useState<QuarterlyTargets | null>(null);

  const handleSave = async (formTargets: QuarterlyTargets) => {
    try {
      await saveTargets.mutateAsync(formTargets);
      navigate('/life-targets');
    } catch (error) {
      console.error('Failed to save targets:', error);
    }
  };

  const handleAnalyze = async (formTargets: QuarterlyTargets) => {
    setLocalTargets(formTargets);

    const targetsArray = {
      body: formTargets.body_target ? [formTargets.body_target] : [],
      being: formTargets.being_target ? [formTargets.being_target] : [],
      balance: formTargets.balance_target ? [formTargets.balance_target] : [],
      business: formTargets.business_target ? [formTargets.business_target] : [],
    };

    try {
      const results = await analyzeMeasurability.mutateAsync({ targets: targetsArray });
      setMeasurabilityResults(results);
    } catch (error) {
      console.error('Failed to analyze targets:', error);
    }
  };

  const handleApplySuggestion = (domain: string, _index: number, rewrittenTarget: string) => {
    if (!localTargets) return;

    const updatedTargets = {
      ...localTargets,
      [`${domain}_target`]: rewrittenTarget,
    };

    setLocalTargets(updatedTargets);

    // Clear the analysis so user can re-analyze if needed
    setMeasurabilityResults(null);
  };

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/life-targets')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Set Quarterly Targets</h1>
          <p className="text-muted-foreground">
            Define your goals and analyze their clarity
          </p>
        </div>
      </div>

      <QuarterlyTargetsForm
        initialData={localTargets || targets}
        onSave={handleSave}
        onAnalyze={handleAnalyze}
        isSaving={saveTargets.isPending}
        isAnalyzing={analyzeMeasurability.isPending}
      />

      {measurabilityResults && (
        <MeasurabilityAnalysisCard
          analysis={measurabilityResults}
          onApplySuggestion={handleApplySuggestion}
        />
      )}
    </div>
  );
}
