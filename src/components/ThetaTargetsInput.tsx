import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useThetaStore } from "@/lib/thetaTrackStore";
import { useCreateTargets } from "@/hooks/useThetaTargets";
import { getOrCreateSessionId } from "@/lib/sessionUtils";
import { toast } from "sonner";

const MAX_CHARS = 500;

const categories = [
  {
    key: 'body' as const,
    label: 'Body',
    placeholder: 'Physical health, fitness routines, nutrition goals, energy levels...',
    description: 'Your physical health and wellness targets'
  },
  {
    key: 'being' as const,
    label: 'Being',
    placeholder: 'Mental health, mindfulness, spiritual practices, personal growth...',
    description: 'Your mental and spiritual growth aspirations'
  },
  {
    key: 'balance' as const,
    label: 'Balance',
    placeholder: 'Work-life harmony, time management, boundaries, relationships...',
    description: 'Your equilibrium and life harmony goals'
  },
  {
    key: 'business' as const,
    label: 'Business',
    placeholder: 'Career goals, income targets, skill development, professional growth...',
    description: 'Your professional and financial objectives'
  }
];

export function ThetaTargetsInput() {
  const { targets, setTargets, sessionId, setSessionId, setCurrentStep } = useThetaStore();
  const createTargets = useCreateTargets();
  const [charCounts, setCharCounts] = useState({
    body: targets.body.length,
    being: targets.being.length,
    balance: targets.balance.length,
    business: targets.business.length
  });

  useEffect(() => {
    if (!sessionId) {
      const newSessionId = getOrCreateSessionId();
      setSessionId(newSessionId);
    }
  }, [sessionId, setSessionId]);

  const handleChange = (key: 'body' | 'being' | 'balance' | 'business', value: string) => {
    if (value.length <= MAX_CHARS) {
      setTargets({ [key]: value });
      setCharCounts(prev => ({ ...prev, [key]: value.length }));
    }
  };

  const filledCount = [targets.body, targets.being, targets.balance, targets.business]
    .filter(v => v.trim().length > 0).length;
  const canContinue = filledCount >= 2;

  const handleContinue = async () => {
    if (!canContinue) return;

    try {
      await createTargets.mutateAsync({
        sessionId,
        body: targets.body,
        being: targets.being,
        balance: targets.balance,
        business: targets.business
      });
      
      toast.success("Targets saved successfully!");
      setCurrentStep(2);
    } catch (error) {
      console.error("Error saving targets:", error);
      toast.error("Failed to save targets. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold mb-2">Define Your 4B Targets</h2>
        <p className="text-muted-foreground">
          Enter at least 2 areas to continue. Each target will be transformed into personalized affirmations.
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={category.key} className="text-base font-semibold">
                {category.label}
              </Label>
              <span 
                className={`text-sm ${
                  charCounts[category.key] > MAX_CHARS * 0.9 
                    ? 'text-destructive' 
                    : 'text-muted-foreground'
                }`}
              >
                {charCounts[category.key]}/{MAX_CHARS}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{category.description}</p>
            <Textarea
              id={category.key}
              placeholder={category.placeholder}
              value={targets[category.key]}
              onChange={(e) => handleChange(category.key, e.target.value)}
              className="min-h-[120px] resize-none"
              maxLength={MAX_CHARS}
            />
          </div>
        ))}
      </div>

      <div className="pt-4">
        <Button
          onClick={handleContinue}
          disabled={!canContinue || createTargets.isPending}
          className="w-full"
          size="lg"
        >
          {createTargets.isPending ? "Saving..." : `Continue (${filledCount}/4 areas filled)`}
        </Button>
        {!canContinue && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            Fill at least 2 areas to continue
          </p>
        )}
      </div>
    </div>
  );
}
