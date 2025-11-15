import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertCircle, Sparkles, Lock } from "lucide-react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { 
  useBrainstormTargets, 
  useUpdateBrainstormTarget,
  useLockInSelections
} from "@/hooks/useBrainstormTargets";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DOMAINS = [
  { key: 'body', label: 'Body', icon: '💪' },
  { key: 'being', label: 'Being', icon: '🧘' },
  { key: 'balance', label: 'Balance', icon: '⚖️' },
  { key: 'business', label: 'Business', icon: '💼' },
] as const;

type Domain = typeof DOMAINS[number]['key'];

function getScoreColor(score: number | null): string {
  if (!score) return 'text-muted-foreground';
  if (score >= 8) return 'text-green-600 dark:text-green-400';
  if (score >= 5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreLabel(score: number | null): string {
  if (!score) return 'Not analyzed';
  if (score >= 8) return 'Excellent';
  if (score >= 5) return 'Needs work';
  return 'Too vague';
}

export default function LifeTargetsSelection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentQuarter, currentSessionId, setCurrentSessionId } = useLifeTargetsStore();
  
  // Sync session from URL if present
  useEffect(() => {
    const sessionFromUrl = searchParams.get('session');
    if (sessionFromUrl && sessionFromUrl !== currentSessionId) {
      setCurrentSessionId(sessionFromUrl);
    }
  }, [searchParams, currentSessionId, setCurrentSessionId]);
  
  const { data: brainstormTargets, isLoading } = useBrainstormTargets(currentQuarter, currentSessionId);
  const updateMutation = useUpdateBrainstormTarget();
  const lockInMutation = useLockInSelections();

  const [selections, setSelections] = useState<Record<Domain, Set<string>>>({
    body: new Set(),
    being: new Set(),
    balance: new Set(),
    business: new Set(),
  });

  // Group and sort targets by domain and clarity score
  const targetsByDomain = useMemo(() => {
    const grouped: Record<Domain, typeof brainstormTargets> = {
      body: [],
      being: [],
      balance: [],
      business: [],
    };
    
    brainstormTargets?.forEach(target => {
      if (target.domain in grouped) {
        grouped[target.domain as Domain].push(target);
      }
    });
    
    // Sort by clarity score (high to low)
    Object.keys(grouped).forEach(domain => {
      grouped[domain as Domain].sort((a, b) => 
        (b.clarity_score || 0) - (a.clarity_score || 0)
      );
    });
    
    return grouped;
  }, [brainstormTargets]);

  // Check if we can lock in (at least 1 selected per domain, max 2 per domain)
  const canLockIn = useMemo(() => {
    return Object.values(selections).every(set => set.size >= 1 && set.size <= 2);
  }, [selections]);

  const handleToggleSelection = (domain: Domain, targetId: string) => {
    setSelections(prev => {
      const newSet = new Set(prev[domain]);
      
      if (newSet.has(targetId)) {
        // Deselect
        newSet.delete(targetId);
      } else {
        // Check if already at max (2)
        if (newSet.size >= 2) {
          toast.error('You can select a maximum of 2 targets per domain');
          return prev;
        }
        newSet.add(targetId);
      }
      
      return { ...prev, [domain]: newSet };
    });
  };

  const handleApplySuggestion = async (targetId: string, rewrittenText: string) => {
    try {
      await updateMutation.mutateAsync({
        id: targetId,
        target_text: rewrittenText,
      });
      toast.success('Applied AI suggestion');
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const handleLockIn = async () => {
    if (!canLockIn) {
      toast.error('Please select 1-2 targets per domain');
      return;
    }

    try {
      // First, update all targets to mark selected ones
      const selectedIds = new Set<string>();
      Object.values(selections).forEach(set => set.forEach(id => selectedIds.add(id)));

      // Update is_selected for all brainstorm targets
      const updatePromises = brainstormTargets!.map(target => {
        return updateMutation.mutateAsync({
          id: target.id,
          is_selected: selectedIds.has(target.id),
        });
      });

      await Promise.all(updatePromises);

      // Now lock in the selections
      await lockInMutation.mutateAsync({
        quarter: currentQuarter,
        sessionId: currentSessionId!,
      });
      
      toast.success('Targets locked in! Continuing to missions...');
      setTimeout(() => {
        navigate('/life-targets/missions');
      }, 1000);
    } catch (error) {
      // Error already handled by mutation
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle missing session
  if (!currentSessionId) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>No Active Brainstorm Session</CardTitle>
            <CardDescription>
              Start a Brain Dump session to begin analyzing your life targets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/life-targets/brainstorm')}>
              Start Brain Dump
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!brainstormTargets || brainstormTargets.length === 0) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">No analyzed targets in this session. Go back and add targets.</p>
            <Button onClick={() => navigate('/life-targets/brainstorm')} className="mt-4">
              Back to Brain Dump
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Select Your Top 2</h1>
          <Badge variant="outline" className="ml-2">{currentQuarter} 2025</Badge>
        </div>
        <p className="text-muted-foreground">
          Review the AI analysis and select your top 1-2 targets per domain. You can apply AI suggestions to improve clarity.
        </p>
      </div>

      {/* Domain Sections */}
      <div className="grid gap-6">
        {DOMAINS.map(({ key, label, icon }) => {
          const targets = targetsByDomain[key];
          const selectedCount = selections[key].size;
          
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{icon}</span>
                    <span>{label}</span>
                  </div>
                  <Badge variant={selectedCount >= 1 && selectedCount <= 2 ? "default" : "secondary"}>
                    {selectedCount} of 2 selected
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Choose your top {selectedCount === 0 ? '1-2' : selectedCount === 1 ? '1 more or continue' : ''} {label.toLowerCase()} target{selectedCount !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {targets.map((target) => {
                  const isSelected = selections[key].has(target.id);
                  const score = target.clarity_score;
                  
                  return (
                    <div
                      key={target.id}
                      className={cn(
                        "p-4 rounded-lg border transition-colors",
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "hover:bg-accent/5"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelection(key, target.id)}
                          className="mt-1"
                        />
                        
                        <div className="flex-1 space-y-2">
                          {/* Original Target */}
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              "text-sm",
                              score && score < 5 && "line-through text-muted-foreground"
                            )}>
                              {target.target_text}
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                              {score && score >= 8 && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
                              {score && score < 5 && <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                              <span className={cn("text-xs font-semibold", getScoreColor(score))}>
                                {score?.toFixed(1) || 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* Clarity Badge */}
                          <Badge variant="outline" className={getScoreColor(score)}>
                            {getScoreLabel(score)}
                          </Badge>

                          {/* AI Suggestion */}
                          {target.rewritten_target && target.rewritten_target !== target.target_text && (
                            <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">AI Suggestion:</p>
                              <p className="text-sm text-foreground">{target.rewritten_target}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApplySuggestion(target.id, target.rewritten_target!)}
                                disabled={updateMutation.isPending}
                                className="text-xs"
                              >
                                {updateMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Sparkles className="h-3 w-3 mr-1" />
                                )}
                                Apply Suggestion
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lock In Button */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Ready to lock in your selections?
              </h3>
              <p className="text-sm text-muted-foreground">
                {canLockIn 
                  ? 'Your selections will be saved as your quarterly targets.'
                  : 'Select at least 1 target per domain (max 2) to continue.'
                }
              </p>
            </div>
            <Button 
              size="lg"
              disabled={!canLockIn || lockInMutation.isPending}
              onClick={handleLockIn}
              className="gap-2"
            >
              {lockInMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Locking In...
                </>
              ) : (
                <>
                  Lock In Selections
                  <CheckCircle2 className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
