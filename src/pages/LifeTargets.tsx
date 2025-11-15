import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, Calendar, Zap, CheckCircle2, Lock } from "lucide-react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargets } from "@/hooks/useQuarterlyTargets";
import { QuarterSelector } from "@/components/life-targets/QuarterSelector";
import { formatQuarterDisplay } from "@/lib/quarterUtils";

export default function LifeTargets() {
  const navigate = useNavigate();
  const { currentQuarter, currentStep, setCurrentStep } = useLifeTargetsStore();
  const { data: targets, isLoading } = useQuarterlyTargets(currentQuarter);

  const targetsSet = useMemo(() => 
    targets ? [
      targets.body_target,
      targets.being_target,
      targets.balance_target,
      targets.business_target,
    ].filter(Boolean).length : 0,
    [targets]
  );

  const hasMissions = useMemo(() => 
    targets ? [
      targets.body_monthly_missions,
      targets.being_monthly_missions,
      targets.balance_monthly_missions,
      targets.business_monthly_missions,
    ].some(m => m && Object.keys(m).length > 0) : false,
    [targets]
  );

  const hasHabits = useMemo(() => 
    targets ? [
      targets.body_daily_habit,
      targets.being_daily_habit,
      targets.balance_daily_habit,
      targets.business_daily_habit,
    ].filter(Boolean).length : 0,
    [targets]
  );

  const domainsWithMultipleTargets = useMemo(() => 
    targets ? [
      { target1: targets.body_target, target2: targets.body_target2 },
      { target1: targets.being_target, target2: targets.being_target2 },
      { target1: targets.balance_target, target2: targets.balance_target2 },
      { target1: targets.business_target, target2: targets.business_target2 },
    ].filter(d => d.target1 && d.target2).length : 0,
    [targets]
  );

  const hasPrimarySelections = useMemo(() => {
    if (!targets) return false;
    
    // Get domains that have both targets
    const domainsNeedingSelection = [
      { key: 'body', hasMultiple: targets.body_target && targets.body_target2, selected: targets.body_primary_is_target1 },
      { key: 'being', hasMultiple: targets.being_target && targets.being_target2, selected: targets.being_primary_is_target1 },
      { key: 'balance', hasMultiple: targets.balance_target && targets.balance_target2, selected: targets.balance_primary_is_target1 },
      { key: 'business', hasMultiple: targets.business_target && targets.business_target2, selected: targets.business_primary_is_target1 },
    ].filter(d => d.hasMultiple);
    
    // If no domains have multiple targets, return true (nothing to select)
    if (domainsNeedingSelection.length === 0) return true;
    
    // All domains with multiple targets must have a selection
    return domainsNeedingSelection.every(d => d.selected !== null && d.selected !== undefined);
  }, [targets]);

  // Auto-advance step based on completion
  useEffect(() => {
    if (!targets) return;

    if (hasHabits > 0 && currentStep !== 'complete') {
      setCurrentStep('complete');
    } else if (domainsWithMultipleTargets > 0 && hasPrimarySelections && currentStep === 'primary') {
      setCurrentStep('actions');
    } else if (hasMissions && currentStep === 'targets') {
      setCurrentStep(domainsWithMultipleTargets > 0 ? 'primary' : 'actions');
    }
  }, [targets, targetsSet, hasMissions, domainsWithMultipleTargets, hasPrimarySelections, hasHabits, currentStep, setCurrentStep]);

  const steps = [
    {
      id: 'brainstorm',
      title: 'Brain Dump',
      description: 'Enter all your potential targets for the quarter',
      icon: Target,
      status: targetsSet > 0 ? 'complete' : 'current',
      onClick: () => navigate('/life-targets/brainstorm'),
      badge: undefined,
    },
    {
      id: 'selection',
      title: 'Select Top 2',
      description: 'Review AI analysis and choose your best targets',
      icon: Target,
      status: targetsSet > 0 ? 'complete' : 'locked',
      onClick: () => targetsSet > 0 ? navigate('/life-targets/selection') : null,
      badge: targetsSet > 0 ? `${targetsSet} selected` : undefined,
    },
    {
      id: 'targets',
      title: 'Set Quarterly Targets',
      description: 'Define your goals for Body, Being, Balance, and Business',
      icon: Target,
      status: targetsSet > 0 ? 'complete' : 'current',
      onClick: () => navigate('/life-targets/quarterly'),
      badge: targetsSet > 0 ? `${targetsSet}/4 set` : undefined,
    },
    {
      id: 'missions',
      title: 'Generate Monthly Missions',
      description: 'Break down targets into 3-month action plans',
      icon: Calendar,
      status: hasMissions ? 'complete' : targetsSet > 0 ? 'current' : 'locked',
      onClick: () => targetsSet > 0 && navigate('/life-targets/missions'),
      badge: hasMissions ? 'Generated' : undefined,
    },
    {
      id: 'primary',
      title: 'Select Primary Targets',
      description: 'Choose which target to focus on for daily habits',
      icon: Target,
      status: hasPrimarySelections ? 'complete' : (hasMissions && domainsWithMultipleTargets > 0) ? 'current' : 'locked',
      onClick: () => hasMissions && domainsWithMultipleTargets > 0 && navigate('/life-targets/missions'),
      badge: domainsWithMultipleTargets === 0 ? 'Not needed' : hasPrimarySelections ? 'Selected' : undefined,
      hidden: domainsWithMultipleTargets === 0,
    },
    {
      id: 'actions',
      title: 'Get Daily Actions',
      description: 'Discover 10 actionable habits per domain',
      icon: Zap,
      status: hasHabits > 0 ? 'complete' : (hasMissions && (domainsWithMultipleTargets === 0 || hasPrimarySelections)) ? 'current' : 'locked',
      onClick: () => (hasMissions && (domainsWithMultipleTargets === 0 || hasPrimarySelections)) && navigate('/life-targets/daily'),
      badge: hasHabits > 0 ? `${hasHabits} habits set` : undefined,
    },
  ];

  const completedSteps = steps.filter(s => !s.hidden && s.status === 'complete').length;
  const totalSteps = steps.filter(s => !s.hidden).length;
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <div className="container max-w-4xl py-8 space-y-8 animate-fade-in">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Life Targets</h1>
          <QuarterSelector />
        </div>
        <p className="text-muted-foreground mb-4">
          Plan and track your quarterly life goals across four key domains
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{completedSteps} of {totalSteps} steps complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      <div className="space-y-4">
        {steps.filter(s => !s.hidden).map((step, index) => {
          const Icon = step.icon;
          const isLocked = step.status === 'locked';
          const isComplete = step.status === 'complete';
          const isCurrent = step.status === 'current';

          return (
            <Card 
              key={step.id}
              className={`transition-all ${
                isLocked ? 'opacity-50' : 'hover:shadow-md cursor-pointer'
              } ${isCurrent ? 'ring-2 ring-primary' : ''}`}
              onClick={!isLocked ? step.onClick : undefined}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isComplete ? 'bg-primary text-primary-foreground' :
                    isCurrent ? 'bg-primary/10 text-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {isComplete ? <CheckCircle2 className="h-6 w-6" /> :
                     isLocked ? <Lock className="h-6 w-6" /> :
                     <Icon className="h-6 w-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{step.title}</h3>
                      {step.badge && (
                        <Badge variant={isComplete ? "default" : "secondary"}>
                          {step.badge}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{step.description}</CardDescription>
                  </div>
                  {!isLocked && (
                    <Button 
                      variant={isCurrent ? "default" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation();
                        step.onClick();
                      }}
                    >
                      {isComplete ? 'Review' : isCurrent ? 'Continue' : 'Start'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {progress === 100 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
            <h3 className="text-xl font-semibold mb-2">Quarter Setup Complete!</h3>
            <p className="text-muted-foreground">
              You've completed all steps for {formatQuarterDisplay(currentQuarter)}. Keep building your daily habits!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
