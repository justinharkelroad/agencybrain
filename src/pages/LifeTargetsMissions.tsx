import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { MonthlyMissionsTimeline } from "@/components/life-targets/MonthlyMissionsTimeline";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargets, useSaveQuarterlyTargets } from "@/hooks/useQuarterlyTargets";
import { useMonthlyMissions } from "@/hooks/useMonthlyMissions";
import { toast } from "sonner";

export default function LifeTargetsMissions() {
  const navigate = useNavigate();
  const { currentQuarter, monthlyMissions, setMonthlyMissions, setCurrentStep } = useLifeTargetsStore();
  const { data: targets } = useQuarterlyTargets(currentQuarter);
  const generateMissions = useMonthlyMissions();
  const saveTargets = useSaveQuarterlyTargets();
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [primarySelections, setPrimarySelections] = useState<Record<string, boolean | null>>({
    body: null,
    being: null,
    balance: null,
    business: null,
  });
  const missionsRef = useRef<HTMLDivElement>(null);
  const hasGeneratedRef = useRef(false);

  // Helper function to check if missions data actually exists
  const hasMissionsData = (missions: any): boolean => {
    if (!missions) return false;
    
    // Check if any domain has actual mission data
    return Object.values(missions).some(domain => {
      if (!domain || typeof domain !== 'object') return false;
      
      // Check target1 and target2 for month data
      return Object.values(domain).some(target => {
        if (!target || typeof target !== 'object') return false;
        return Object.keys(target).length > 0;
      });
    });
  };

  // Prepare target texts for inline display
  const targetTexts = targets ? {
    body: {
      target1: targets.body_target,
      target2: targets.body_target2,
    },
    being: {
      target1: targets.being_target,
      target2: targets.being_target2,
    },
    balance: {
      target1: targets.balance_target,
      target2: targets.balance_target2,
    },
    business: {
      target1: targets.business_target,
      target2: targets.business_target2,
    },
  } : null;

  // Load missions from database if they exist
  useEffect(() => {
    if (targets) {
      const missions = {
        body: targets.body_monthly_missions,
        being: targets.being_monthly_missions,
        balance: targets.balance_monthly_missions,
        business: targets.business_monthly_missions,
      };
      if (Object.values(missions).some(m => m && Object.keys(m).length > 0)) {
        setMonthlyMissions(missions as any);
      }

      // Load primary selections from database
      setPrimarySelections({
        body: targets.body_primary_is_target1,
        being: targets.being_primary_is_target1,
        balance: targets.balance_primary_is_target1,
        business: targets.business_primary_is_target1,
      });
    }
  }, [targets, setMonthlyMissions]);

  // Auto-generate missions if user arrives from lock-in flow
  useEffect(() => {
    if (targets && !hasMissionsData(monthlyMissions) && !hasGeneratedRef.current) {
      hasGeneratedRef.current = true;
      handleGenerate();
    }
  }, [targets, monthlyMissions]);

  const handleGenerate = async () => {
    if (!targets) {
      toast.error('Please set your quarterly targets first');
      return;
    }

    const params: any = { quarter: currentQuarter };

    if (targets.body_target) {
      params.body = {
        target1: targets.body_target,
        target2: targets.body_target2 || undefined,
        narrative: targets.body_narrative || undefined,
      };
    }
    if (targets.being_target) {
      params.being = {
        target1: targets.being_target,
        target2: targets.being_target2 || undefined,
        narrative: targets.being_narrative || undefined,
      };
    }
    if (targets.balance_target) {
      params.balance = {
        target1: targets.balance_target,
        target2: targets.balance_target2 || undefined,
        narrative: targets.balance_narrative || undefined,
      };
    }
    if (targets.business_target) {
      params.business = {
        target1: targets.business_target,
        target2: targets.business_target2 || undefined,
        narrative: targets.business_narrative || undefined,
      };
    }

    try {
      const results = await generateMissions.mutateAsync(params);
      setMonthlyMissions(results);

      // Save missions to database
      const updatedTargets = {
        ...targets,
        body_monthly_missions: results.body,
        being_monthly_missions: results.being,
        balance_monthly_missions: results.balance,
        business_monthly_missions: results.business,
      };

      await saveTargets.mutateAsync({ data: updatedTargets, showToast: false });
      setCurrentStep('primary');
      
      // Auto-scroll to missions after generation
      setTimeout(() => {
        missionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      console.error('Failed to generate missions:', error);
    }
  };

  const handleSavePrimary = async (domain: string, isPrimaryTarget1: boolean) => {
    if (!targets) return;

    const updatedTargets = {
      ...targets,
      [`${domain}_primary_is_target1`]: isPrimaryTarget1,
    };

    try {
      await saveTargets.mutateAsync({ data: updatedTargets, showToast: true });
      setPrimarySelections(prev => ({ ...prev, [domain]: isPrimaryTarget1 }));
      toast.success('Primary target saved');
    } catch (error) {
      console.error('Failed to save primary selection:', error);
      toast.error('Failed to save selection');
    }
  };

  const handleEditMission = async (
    domain: string,
    targetType: 'target1' | 'target2',
    month: string,
    newMission: string,
    newWhy: string
  ) => {
    if (!targets) return;

    const updatedMissions = {
      ...monthlyMissions,
      [domain]: {
        ...monthlyMissions[domain],
        [targetType]: {
          ...monthlyMissions[domain]?.[targetType],
          [month]: { mission: newMission, why: newWhy }
        }
      }
    };

    setMonthlyMissions(updatedMissions as any);

    await saveTargets.mutateAsync({
      data: {
        ...targets,
        [`${domain}_monthly_missions`]: updatedMissions[domain]
      },
      showToast: true
    });
  };

  const handleContinue = () => {
    setCurrentStep('actions');
    navigate('/life-targets/daily');
  };

  const hasTargets = targets && [
    targets.body_target,
    targets.body_target2,
    targets.being_target,
    targets.being_target2,
    targets.balance_target,
    targets.balance_target2,
    targets.business_target,
    targets.business_target2,
  ].some(Boolean);

  const domainsWithMultipleTargets = targets ? [
    { key: 'body', label: 'Body', target1: targets.body_target, target2: targets.body_target2 },
    { key: 'being', label: 'Being', target1: targets.being_target, target2: targets.being_target2 },
    { key: 'balance', label: 'Balance', target1: targets.balance_target, target2: targets.balance_target2 },
    { key: 'business', label: 'Business', target1: targets.business_target, target2: targets.business_target2 },
  ].filter(d => d.target1 && d.target2) : [];

  const canContinue = hasMissionsData(monthlyMissions) && (
    domainsWithMultipleTargets.length === 0 || 
    domainsWithMultipleTargets.every(d => primarySelections[d.key] !== null && primarySelections[d.key] !== undefined)
  );

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/life-targets')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Monthly Missions</h1>
            <p className="text-muted-foreground">
              Your quarterly targets broken into monthly action plans
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedDomain} onValueChange={setSelectedDomain}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              <SelectItem value="body">Body</SelectItem>
              <SelectItem value="being">Being</SelectItem>
              <SelectItem value="balance">Balance</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleGenerate}
            disabled={!hasTargets || generateMissions.isPending}
            variant={hasMissionsData(monthlyMissions) ? "outline" : "default"}
          >
            {generateMissions.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {hasMissionsData(monthlyMissions) ? 'Regenerate' : 'Generate Missions'}
              </>
            )}
          </Button>
        </div>
      </div>

      {!hasTargets && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4">Please set your quarterly targets first</p>
          <Button onClick={() => navigate('/life-targets/quarterly')}>
            Set Targets
          </Button>
        </div>
      )}

      <div className="space-y-6" ref={missionsRef}>
        <MonthlyMissionsTimeline
          missions={monthlyMissions || {}}
          selectedDomain={selectedDomain === 'all' ? undefined : selectedDomain}
          targetTexts={targetTexts}
          primarySelections={primarySelections}
          onLockIn={handleSavePrimary}
          onEditMission={handleEditMission}
          isLoading={generateMissions.isPending}
          quarter={currentQuarter}
        />
        
        {hasMissionsData(monthlyMissions) && (
          <div className="flex justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={!canContinue ? "cursor-not-allowed inline-block" : ""}>
                    <Button 
                      onClick={handleContinue}
                      disabled={!canContinue}
                      size="lg"
                      className={canContinue ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {canContinue && <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Continue to Daily Actions
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canContinue && (
                  <TooltipContent>
                    Please select primary targets for domains with 2 targets
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
}
