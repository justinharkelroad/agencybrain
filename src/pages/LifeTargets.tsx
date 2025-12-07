import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, Calendar, Zap, CheckCircle2, Lock, Download, Eye, Archive, RotateCcw, Calendar as CalendarIcon } from "lucide-react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { useQuarterlyTargets } from "@/hooks/useQuarterlyTargets";
import { useQuarterlyTargetsHistory } from "@/hooks/useQuarterlyTargetsHistory";
import { QuarterSelector } from "@/components/life-targets/QuarterSelector";
import { QuarterStatusAlert } from "@/components/life-targets/QuarterStatusAlert";
import { formatQuarterDisplay } from "@/lib/quarterUtils";
import { useQuarterAutoSwitch } from "@/hooks/useQuarterAutoSwitch";
import { exportLifeTargetsPDF } from "@/utils/exportLifeTargetsPDF";
import { toast } from "sonner";
import { useResetQuarter } from "@/hooks/useResetQuarter";
import { useChangeQuarterLabel } from "@/hooks/useChangeQuarterLabel";
import { useFixQuarterMonths } from "@/hooks/useFixQuarterMonths";
import { MoveQuarterDialog } from "@/components/life-targets/MoveQuarterDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function LifeTargets() {
  const navigate = useNavigate();
  const { currentQuarter, currentStep, setCurrentStep, selectedDailyActions, currentSessionId, changeQuarter, selectionSource } = useLifeTargetsStore();
  const { data: targets, isLoading } = useQuarterlyTargets(currentQuarter);
  const { data: historyTargets } = useQuarterlyTargetsHistory();
  const [downloadingQuarter, setDownloadingQuarter] = useState<string | null>(null);
  const [showMoveQuarterDialog, setShowMoveQuarterDialog] = useState(false);
  const resetQuarter = useResetQuarter();
  const changeQuarterLabel = useChangeQuarterLabel();
  const fixQuarterMonths = useFixQuarterMonths();

  // Auto-switch to quarter with data if current quarter is empty
  useQuarterAutoSwitch(!!targets, isLoading);

  const handleReset = () => {
    resetQuarter.mutate({
      quarter: currentQuarter,
      quarterlyTargetId: targets?.id || null,
      sessionId: currentSessionId,
    });
  };

  const handleDownloadPDF = async () => {
    if (!targets) return;
    
    setDownloadingQuarter(currentQuarter);
    try {
      exportLifeTargetsPDF(targets, selectedDailyActions, currentQuarter);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloadingQuarter(null);
    }
  };

  const handleMoveQuarter = async (newQuarter: string) => {
    await changeQuarterLabel.mutateAsync({ 
      fromQuarter: currentQuarter, 
      toQuarter: newQuarter 
    });
    changeQuarter(newQuarter);
    setShowMoveQuarterDialog(false);
  };

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
      targets.body_daily_actions,
      targets.being_daily_actions,
      targets.balance_daily_actions,
      targets.business_daily_actions,
    ].filter(arr => Array.isArray(arr) && arr.length > 0).length : 0,
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

  // Get quarters that have data (excluding current quarter)
  const availableQuarters = useMemo(() => {
    if (!historyTargets) return [];
    return historyTargets
      .filter(h => h.quarter !== currentQuarter)
      .map(h => h.quarter);
  }, [historyTargets, currentQuarter]);

  return (
    <div className="container max-w-4xl py-8 space-y-8 animate-fade-in">
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
          <h1 className="text-3xl font-bold">Create Your Targets</h1>
          <QuarterSelector />
        </div>
        <p className="text-muted-foreground mb-4">
          Plan your entire 90 days target action map. Set the big quarterly, choose how to break it down monthly and then select as many daily habits to utilize as you need
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{completedSteps} of {totalSteps} steps complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Show alert if current quarter has no data but other quarters do */}
      {!targets && !isLoading && availableQuarters.length > 0 && selectionSource !== 'manual' && (
        <QuarterStatusAlert 
          currentQuarter={currentQuarter} 
          availableQuarters={availableQuarters} 
        />
      )}

      {/* Show create plan message if user manually selected empty quarter */}
      {!targets && !isLoading && selectionSource === 'manual' && (
        <div className="rounded-lg border border-border/10 bg-card/50 p-6 space-y-3">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-medium">No Plan Exists for {formatQuarterDisplay(currentQuarter)}</h3>
              <p className="text-sm text-muted-foreground">
                You've selected an empty quarter. Start by setting your quarterly targets below to create a new 90-day plan.
              </p>
            </div>
          </div>
        </div>
      )}

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
                {(step.id === 'brainstorm' || step.id === 'targets') && (
                  <div className="mb-3">
                    <Badge variant="outline" className="text-xs font-normal">
                      {step.id === 'brainstorm' 
                        ? 'Start here if you need guidance on your 90 day targets'
                        : 'Start here if you are certain your 90 day targets are ready'}
                    </Badge>
                  </div>
                )}
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
          <CardContent className="p-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <div>
              <h3 className="text-xl font-semibold mb-2">Quarter Setup Complete!</h3>
              <p className="text-muted-foreground">
                You've completed all steps for {formatQuarterDisplay(currentQuarter)}. Keep building your daily habits!
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center pt-2">
              <Button
                variant="default"
                onClick={() => navigate('/life-targets/cascade')}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Your Plan
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadPDF}
                disabled={downloadingQuarter === currentQuarter}
              >
                <Download className="h-4 w-4 mr-2" />
                {downloadingQuarter === currentQuarter ? 'Generating...' : 'Download PDF'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowMoveQuarterDialog(true)}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Move to Different Quarter
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Start Over This Quarter
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Start Over This Quarter?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your {formatQuarterDisplay(currentQuarter)} plan 
                      and all associated data. You'll start with a fresh slate. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleReset} 
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={resetQuarter.isPending}
                    >
                      {resetQuarter.isPending ? 'Resetting...' : 'Yes, Start Over'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      <MoveQuarterDialog
        open={showMoveQuarterDialog}
        onOpenChange={setShowMoveQuarterDialog}
        currentQuarter={currentQuarter}
        onConfirm={handleMoveQuarter}
        isPending={changeQuarterLabel.isPending}
      />

      {progress === 100 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Past Quarters Archive</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/life-targets/history')}
              >
                View All History
              </Button>
            </div>
            {historyTargets && historyTargets.length > 0 ? (
              <div className="space-y-3">
                {historyTargets
                  .filter(t => t.quarter !== currentQuarter)
                  .slice(0, 3)
                  .map((quarterData) => {
                  const isDownloading = downloadingQuarter === quarterData.quarter;
                  
                  // Get selected daily actions
                  const selectedActions = {
                    body: Array.isArray(quarterData.body_daily_actions) ? quarterData.body_daily_actions : [],
                    being: Array.isArray(quarterData.being_daily_actions) ? quarterData.being_daily_actions : [],
                    balance: Array.isArray(quarterData.balance_daily_actions) ? quarterData.balance_daily_actions : [],
                    business: Array.isArray(quarterData.business_daily_actions) ? quarterData.business_daily_actions : [],
                  };

                  const handleDownload = async () => {
                    setDownloadingQuarter(quarterData.quarter);
                    try {
                      exportLifeTargetsPDF(quarterData, selectedActions, quarterData.quarter);
                      toast.success('PDF downloaded successfully');
                    } catch (error) {
                      console.error('PDF generation error:', error);
                      toast.error('Failed to generate PDF');
                    } finally {
                      setDownloadingQuarter(null);
                    }
                  };

                  return (
                    <div 
                      key={quarterData.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{formatQuarterDisplay(quarterData.quarter)}</p>
                        <p className="text-sm text-muted-foreground">
                          Last updated: {new Date(quarterData.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownload}
                          disabled={isDownloading}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {isDownloading ? 'Generating...' : 'Download PDF'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/life-targets/cascade')}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Plan
                        </Button>
                      </div>
                    </div>
                  );
                  })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No past quarters yet. This will be your first!
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
