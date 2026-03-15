import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { DebriefWelcome } from "./DebriefWelcome";
import { DebriefAccomplishments } from "./DebriefAccomplishments";
import { DebriefDomainReflection } from "./DebriefDomainReflection";
import { DebriefNextWeekPlanning } from "./DebriefNextWeekPlanning";
import { DebriefSummary } from "./DebriefSummary";
import { DebriefCoachingAnalysis } from "./DebriefCoachingAnalysis";
import type { WeekSummaryData } from "@/hooks/useWeekSummary";
import type { DomainReflection, WeeklyReview } from "@/hooks/useWeeklyDebrief";
import type { DebriefStatsData } from "@/hooks/useDebriefStats";
import confetti from "canvas-confetti";

// 0: Welcome, 1: Accomplishments, 2: Domains, 3: Next Week, 4: Summary, 5: Coaching + Seal
const TOTAL_STEPS = 6;
const STEP_LABELS = ["Welcome", "Accomplishments", "Reflections", "Next Week", "Summary", "Coaching"];

interface DebriefWizardProps {
  weekLabel: string;
  weekSummary: WeekSummaryData;
  stats: DebriefStatsData;
  review: WeeklyReview | null;
  isLoading: boolean;
  agencyId: string | null;
  exitPath: string;
  onCreateOrResume: (agencyId: string | null) => Promise<unknown>;
  onSaveStep: (step: number) => void;
  onSaveGratitudeNote: (note: string) => void;
  onSaveDomainReflection: (domain: string, reflection: DomainReflection) => void;
  onAddToBench: (title: string, domain: string) => void;
  onSaveNextWeekOBT: (obt: string) => void;
  onRequestAnalysis: (reviewId: string) => Promise<string>;
  onCompleteDebrief: (scores: {
    core4Points: number;
    flowPoints: number;
    playbookPoints: number;
    totalPoints: number;
  }) => Promise<void>;
}

export function DebriefWizard({
  weekLabel,
  weekSummary,
  stats,
  review,
  isLoading,
  agencyId,
  exitPath,
  onCreateOrResume,
  onSaveStep,
  onSaveGratitudeNote,
  onSaveDomainReflection,
  onAddToBench,
  onSaveNextWeekOBT,
  onRequestAnalysis,
  onCompleteDebrief,
}: DebriefWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [sealing, setSealing] = useState(false);

  // Resume at saved step if review exists
  useEffect(() => {
    if (review && review.status === "in_progress" && review.current_step > 0) {
      setStep(review.current_step);
    }
  }, [review?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const goToStep = useCallback(
    (newStep: number) => {
      setStep(newStep);
      if (review) {
        onSaveStep(newStep);
      }
    },
    [review, onSaveStep]
  );

  const handleBegin = async () => {
    if (!review) {
      try {
        await onCreateOrResume(agencyId);
      } catch (err) {
        console.error("Failed to create debrief record:", err);
      }
    }
    goToStep(1);
  };

  const handleSeal = async () => {
    setSealing(true);
    try {
      await onCompleteDebrief({
        core4Points: weekSummary.core4Points,
        flowPoints: weekSummary.flowPoints,
        playbookPoints: weekSummary.playbookPoints,
        totalPoints: weekSummary.totalPoints,
      });

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#34d399", "#60a5fa", "#fbbf24", "#f472b6"],
      });

      toast.success("Debrief sealed! Check your email for the full report.");

      setTimeout(() => {
        navigate(exitPath);
      }, 2500);
    } catch {
      toast.error("Failed to seal debrief");
    } finally {
      setSealing(false);
    }
  };

  const handleExit = () => {
    navigate(exitPath);
  };

  if (isLoading || weekSummary.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">The Debrief</span>
              {step > 0 && (
                <span className="text-xs text-muted-foreground/70">
                  {STEP_LABELS[step]}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExit}
              className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {step > 0 && (
            <Progress value={progress} className="h-1 bg-muted [&>div]:bg-foreground/40" />
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {step === 0 && (
          <DebriefWelcome
            weekSummary={weekSummary}
            weekLabel={weekLabel}
            stats={stats}
            onBegin={handleBegin}
            onViewDebrief={(weekKey) => {
              toast.info(`Viewing ${weekKey} — coming soon`);
            }}
          />
        )}

        {step === 1 && (
          <DebriefAccomplishments
            weekSummary={weekSummary}
            gratitudeNote={review?.gratitude_note || ""}
            onGratitudeChange={onSaveGratitudeNote}
            onNext={() => goToStep(2)}
          />
        )}

        {step === 2 && (
          <DebriefDomainReflection
            weekSummary={weekSummary}
            domainReflections={review?.domain_reflections || {}}
            onSaveDomainReflection={onSaveDomainReflection}
            onAddToBench={onAddToBench}
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
          />
        )}

        {step === 3 && (
          <DebriefNextWeekPlanning
            agencyId={agencyId}
            nextWeekOBT={review?.next_week_one_big_thing || ""}
            onSaveOBT={onSaveNextWeekOBT}
            onNext={() => goToStep(4)}
            onBack={() => goToStep(2)}
          />
        )}

        {step === 4 && (
          <DebriefSummary
            weekSummary={weekSummary}
            weekLabel={weekLabel}
            domainReflections={review?.domain_reflections || {}}
            gratitudeNote={review?.gratitude_note || null}
            nextWeekOBT={review?.next_week_one_big_thing || null}
            onNext={() => goToStep(5)}
            onBack={() => goToStep(3)}
          />
        )}

        {step === 5 && (
          <DebriefCoachingAnalysis
            weekSummary={weekSummary}
            reviewId={review?.id || null}
            existingAnalysis={(review as unknown as Record<string, unknown>)?.coaching_analysis as string | null ?? null}
            onRequestAnalysis={() => {
              if (!review?.id) return Promise.reject(new Error("No review"));
              return onRequestAnalysis(review.id);
            }}
            onSeal={handleSeal}
            onBack={() => goToStep(4)}
            sealing={sealing}
          />
        )}
      </main>
    </div>
  );
}
