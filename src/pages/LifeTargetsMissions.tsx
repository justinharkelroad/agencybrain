import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, Loader2, Target } from "lucide-react";
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
  const [primarySelections, setPrimarySelections] = useState<Record<string, boolean>>({
    body: true,
    being: true,
    balance: true,
    business: true,
  });

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
        body: targets.body_primary_is_target1 ?? true,
        being: targets.being_primary_is_target1 ?? true,
        balance: targets.balance_primary_is_target1 ?? true,
        business: targets.business_primary_is_target1 ?? true,
      });
    }
  }, [targets, setMonthlyMissions]);

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

      await saveTargets.mutateAsync(updatedTargets);
      setCurrentStep('primary');
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
      await saveTargets.mutateAsync(updatedTargets);
      setPrimarySelections(prev => ({ ...prev, [domain]: isPrimaryTarget1 }));
      toast.success('Primary target saved');
    } catch (error) {
      console.error('Failed to save primary selection:', error);
      toast.error('Failed to save selection');
    }
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

  const canContinue = domainsWithMultipleTargets.length === 0 || 
    domainsWithMultipleTargets.every(d => primarySelections[d.key] !== undefined);

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
        <div className="space-y-6">
          {domainsWithMultipleTargets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Select Primary Target for Daily Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground mb-4">
                  For domains with 2 targets, choose which one to prioritize for your daily actions.
                  This helps you focus your energy where it matters most.
                </p>
                {domainsWithMultipleTargets.map(({ key, label, target1, target2 }) => (
                  <div key={key} className="space-y-3">
                    <h3 className="font-semibold text-lg">{label}</h3>
                    <RadioGroup
                      value={primarySelections[key] ? 'target1' : 'target2'}
                      onValueChange={(value) => handleSavePrimary(key, value === 'target1')}
                    >
                      <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="target1" id={`${key}-1`} />
                        <Label htmlFor={`${key}-1`} className="flex-1 cursor-pointer">
                          <span className="font-medium">Target #1:</span> {target1}
                        </Label>
                      </div>
                      <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                        <RadioGroupItem value="target2" id={`${key}-2`} />
                        <Label htmlFor={`${key}-2`} className="flex-1 cursor-pointer">
                          <span className="font-medium">Target #2:</span> {target2}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <MonthlyMissionsTimeline
            missions={monthlyMissions}
            selectedDomain={selectedDomain === 'all' ? undefined : selectedDomain}
          />
          
          {domainsWithMultipleTargets.length > 0 && (
            <div className="flex justify-end">
              <Button 
                onClick={handleContinue}
                disabled={!canContinue}
                size="lg"
              >
                Continue to Daily Actions
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
