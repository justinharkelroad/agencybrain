import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { MonthlyMissionsTimeline } from "@/components/life-targets/MonthlyMissionsTimeline";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargets, useSaveQuarterlyTargets } from "@/hooks/useQuarterlyTargets";
import { useMonthlyMissions } from "@/hooks/useMonthlyMissions";
import { toast } from "sonner";

export default function LifeTargetsMissions() {
  const navigate = useNavigate();
  const { currentQuarter, monthlyMissions, setMonthlyMissions } = useLifeTargetsStore();
  const { data: targets } = useQuarterlyTargets(currentQuarter);
  const generateMissions = useMonthlyMissions();
  const saveTargets = useSaveQuarterlyTargets();
  const [selectedDomain, setSelectedDomain] = useState<string>('all');

  // Load missions from database if they exist
  useEffect(() => {
    if (targets && !monthlyMissions) {
      const dbMissions: any = {};
      if (targets.body_monthly_missions) dbMissions.body = targets.body_monthly_missions;
      if (targets.being_monthly_missions) dbMissions.being = targets.being_monthly_missions;
      if (targets.balance_monthly_missions) dbMissions.balance = targets.balance_monthly_missions;
      if (targets.business_monthly_missions) dbMissions.business = targets.business_monthly_missions;

      if (Object.keys(dbMissions).length > 0) {
        setMonthlyMissions(dbMissions);
      }
    }
  }, [targets, monthlyMissions, setMonthlyMissions]);

  const handleGenerate = async () => {
    if (!targets) {
      toast.error('Please set your quarterly targets first');
      return;
    }

    const params: any = { quarter: currentQuarter };

    if (targets.body_target) {
      params.body = {
        target1: targets.body_target,
        narrative: targets.body_narrative || undefined,
      };
    }
    if (targets.being_target) {
      params.being = {
        target1: targets.being_target,
        narrative: targets.being_narrative || undefined,
      };
    }
    if (targets.balance_target) {
      params.balance = {
        target1: targets.balance_target,
        narrative: targets.balance_narrative || undefined,
      };
    }
    if (targets.business_target) {
      params.business = {
        target1: targets.business_target,
        narrative: targets.business_narrative || undefined,
      };
    }

    try {
      const results = await generateMissions.mutateAsync(params);
      setMonthlyMissions(results);

      // Save missions to database
      const updatedTargets = {
        ...targets,
        body_monthly_missions: results.body || null,
        being_monthly_missions: results.being || null,
        balance_monthly_missions: results.balance || null,
        business_monthly_missions: results.business || null,
      };

      await saveTargets.mutateAsync(updatedTargets);
    } catch (error) {
      console.error('Failed to generate missions:', error);
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
            variant={monthlyMissions ? "outline" : "default"}
          >
            {generateMissions.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {monthlyMissions ? 'Regenerate' : 'Generate Missions'}
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

      {monthlyMissions && (
        <MonthlyMissionsTimeline
          missions={monthlyMissions}
          selectedDomain={selectedDomain === 'all' ? undefined : selectedDomain}
        />
      )}
    </div>
  );
}
