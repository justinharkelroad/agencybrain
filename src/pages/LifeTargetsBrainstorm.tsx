import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Edit2, Sparkles, Brain, ArrowRight } from "lucide-react";
import { useLifeTargetsStore } from "@/lib/lifeTargetsStore";
import { QuarterSelector } from "@/components/life-targets/QuarterSelector";
import { formatQuarterDisplay } from "@/lib/quarterUtils";
import { 
  useBrainstormTargets, 
  useSaveBrainstormTarget, 
  useUpdateBrainstormTarget,
  useDeleteBrainstormTarget,
  useBatchAnalyzeBrainstorm
} from "@/hooks/useBrainstormTargets";
import { toast } from "sonner";

const DOMAINS = [
  { key: 'body', label: 'Body', icon: '💪', color: 'hsl(var(--primary))' },
  { key: 'being', label: 'Being', icon: '🧘', color: 'hsl(var(--accent))' },
  { key: 'balance', label: 'Balance', icon: '⚖️', color: 'hsl(var(--secondary))' },
  { key: 'business', label: 'Business', icon: '💼', color: 'hsl(var(--muted))' },
] as const;

type Domain = typeof DOMAINS[number]['key'];

export default function LifeTargetsBrainstorm() {
  const navigate = useNavigate();
  const { currentQuarter, currentSessionId, setCurrentSessionId, setCurrentStep } = useLifeTargetsStore();
  
  // Generate session ID if not present, persist it in store (include quarter for uniqueness)
  const sessionId = useMemo(() => currentSessionId ?? `${currentQuarter}_${crypto.randomUUID()}`, [currentSessionId, currentQuarter]);
  
  useEffect(() => {
    if (!currentSessionId) {
      setCurrentSessionId(sessionId);
    }
    setCurrentStep('brainstorm');
  }, [currentSessionId, sessionId, setCurrentSessionId, setCurrentStep]);
  
  const { data: brainstormTargets, isLoading } = useBrainstormTargets(currentQuarter, sessionId);
  const saveMutation = useSaveBrainstormTarget();
  const updateMutation = useUpdateBrainstormTarget();
  const deleteMutation = useDeleteBrainstormTarget();
  const analyzeMutation = useBatchAnalyzeBrainstorm();

  const [inputs, setInputs] = useState<Record<Domain, string>>({
    body: '',
    being: '',
    balance: '',
    business: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState<Record<Domain, boolean>>({
    body: false,
    being: false,
    balance: false,
    business: false,
  });

  // Group targets by domain
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
    
    return grouped;
  }, [brainstormTargets]);

  // Count targets per domain
  const counts = useMemo(() => ({
    body: targetsByDomain.body.length,
    being: targetsByDomain.being.length,
    balance: targetsByDomain.balance.length,
    business: targetsByDomain.business.length,
  }), [targetsByDomain]);

  // Check if we can analyze (at least 1 target per domain)
  const canAnalyze = useMemo(() => 
    counts.body > 0 && counts.being > 0 && counts.balance > 0 && counts.business > 0,
    [counts]
  );

  const handleAddTarget = async (domain: Domain) => {
    const text = inputs[domain].trim();
    if (!text) {
      toast.error('Please enter a target');
      return;
    }

    if (isSubmitting[domain]) {
      return; // Prevent duplicate submissions
    }

    setIsSubmitting(prev => ({ ...prev, [domain]: true }));

    try {
      await saveMutation.mutateAsync({
        quarter: currentQuarter,
        domain,
        target_text: text,
        session_id: sessionId,
      });

      setInputs(prev => ({ ...prev, [domain]: '' }));
    } finally {
      setIsSubmitting(prev => ({ ...prev, [domain]: false }));
    }
  };

  const handleStartEdit = (id: string, currentText: string) => {
    setEditingId(id);
    setEditText(currentText);
  };

  const handleSaveEdit = async (id: string) => {
    const text = editText.trim();
    if (!text) {
      toast.error('Target cannot be empty');
      return;
    }

    await updateMutation.mutateAsync({
      id,
      target_text: text,
    });

    setEditingId(null);
    setEditText('');
    toast.success('Target updated');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    toast.success('Target deleted');
  };

  const handleAnalyzeAll = async () => {
    if (!canAnalyze) {
      toast.error('Please add at least 1 target per domain');
      return;
    }

    try {
      await analyzeMutation.mutateAsync({
        quarter: currentQuarter,
        sessionId,
      });
      
      // Persist session and step before navigation
      setCurrentSessionId(sessionId);
      setCurrentStep('selection');
      
      toast.success('Analysis complete! Review your targets.');
      navigate(`/life-targets/selection?session=${sessionId}`);
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

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Brain Dump</h1>
          </div>
          <QuarterSelector />
        </div>
        <p className="text-muted-foreground">
          Enter as many potential targets as you want for each domain. The AI will analyze them all and help you select the best 2.
        </p>
      </div>

      {/* Domain Sections */}
      <div className="grid gap-6">
        {DOMAINS.map(({ key, label, icon }) => (
          <Card key={key} className="relative overflow-hidden">
            <div 
              className="absolute top-0 left-0 w-1 h-full opacity-50"
              style={{ backgroundColor: DOMAINS.find(d => d.key === key)?.color }}
            />
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{icon}</span>
                  <span>{label}</span>
                </div>
                <Badge variant="secondary">
                  {counts[key]} {counts[key] === 1 ? 'target' : 'targets'}
                </Badge>
              </CardTitle>
              <CardDescription>
                What do you want to achieve in your {label.toLowerCase()} life this quarter?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input Field */}
              <div className="flex gap-2">
                <Input
                  placeholder={`Enter a ${label.toLowerCase()} target...`}
                  value={inputs[key]}
                  onChange={(e) => setInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddTarget(key);
                    }
                  }}
                  className="flex-1"
                />
                <Button 
                  onClick={() => handleAddTarget(key)}
                  disabled={!inputs[key].trim() || isSubmitting[key]}
                  size="icon"
                >
                  {isSubmitting[key] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Target List */}
              {targetsByDomain[key].length > 0 ? (
                <div className="space-y-2">
                  {targetsByDomain[key].map((target) => (
                    <div
                      key={target.id}
                      className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                    >
                      {editingId === target.id ? (
                        <>
                          <Input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(target.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="flex-1"
                            autoFocus
                          />
                          <Button 
                            size="sm" 
                            onClick={() => handleSaveEdit(target.id)}
                            disabled={updateMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="flex-1 text-sm">{target.target_text}</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleStartEdit(target.id, target.target_text)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(target.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No targets yet. Start brainstorming! 💭
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analyze Button */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Ready to analyze?
              </h3>
              <p className="text-sm text-muted-foreground">
                {canAnalyze 
                  ? `You've entered ${brainstormTargets?.length || 0} targets. Let AI analyze them for clarity and measurability.`
                  : 'Add at least 1 target per domain to continue.'
                }
              </p>
            </div>
            <Button 
              size="lg"
              disabled={!canAnalyze || analyzeMutation.isPending}
              onClick={handleAnalyzeAll}
              className="gap-2"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Analyze All Targets
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
