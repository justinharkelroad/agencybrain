import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, CheckCircle2, Heart, Brain, Scale, Briefcase, Flame, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeekSummaryData } from "@/hooks/useWeekSummary";

const DOMAIN_META: Record<string, { icon: typeof Heart; color: string; label: string }> = {
  body: { icon: Heart, color: "text-red-400 bg-red-500/20", label: "Body" },
  being: { icon: Brain, color: "text-purple-400 bg-purple-500/20", label: "Being" },
  balance: { icon: Scale, color: "text-blue-400 bg-blue-500/20", label: "Balance" },
  business: { icon: Briefcase, color: "text-amber-400 bg-amber-500/20", label: "Business" },
};

interface DebriefAccomplishmentsProps {
  weekSummary: WeekSummaryData;
  gratitudeNote: string;
  onGratitudeChange: (note: string) => void;
  onNext: () => void;
}

export function DebriefAccomplishments({
  weekSummary,
  gratitudeNote,
  onGratitudeChange,
  onNext,
}: DebriefAccomplishmentsProps) {
  const [localNote, setLocalNote] = useState(gratitudeNote);

  // Sync when prop changes (e.g. navigating back after save)
  useEffect(() => {
    setLocalNote(gratitudeNote);
  }, [gratitudeNote]);

  const handleNext = () => {
    if (localNote !== gratitudeNote) {
      onGratitudeChange(localNote);
    }
    onNext();
  };

  const { completedPowerPlays, oneBigThing, flowSessionCount, core4Entries } = weekSummary;
  const core4DaysCompleted = core4Entries.filter(
    (e) => e.body && e.being && e.balance && e.business
  ).length;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-foreground">Your Accomplishments</h2>
        <p className="text-sm text-muted-foreground mt-1">Here's what you got done this week</p>
      </div>

      {/* Core 4 Summary */}
      {core4DaysCompleted > 0 && (
        <div className="bg-foreground/5 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-semibold text-foreground">Core 4</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {core4DaysCompleted === 7 ? (
              <span className="text-emerald-400 font-medium">Perfect week! All 4 domains every day.</span>
            ) : (
              <>Completed all 4 domains on <span className="text-foreground font-medium">{core4DaysCompleted}</span> day{core4DaysCompleted !== 1 ? "s" : ""}</>
            )}
          </p>
        </div>
      )}

      {/* Flow Sessions */}
      {flowSessionCount > 0 && (
        <div className="bg-foreground/5 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-foreground">Flows</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Completed <span className="text-foreground font-medium">{flowSessionCount}</span> flow session{flowSessionCount !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* One Big Thing */}
      {oneBigThing && (
        <div className="bg-foreground/5 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-foreground">One Big Thing</span>
          </div>
          <div className="flex items-center gap-2">
            {oneBigThing.completed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <div className="h-4 w-4 rounded-full border border-border shrink-0" />
            )}
            <span className={cn("text-sm", oneBigThing.completed ? "text-foreground" : "text-muted-foreground")}>
              {oneBigThing.title}
            </span>
          </div>
        </div>
      )}

      {/* Completed Power Plays by Domain */}
      {completedPowerPlays.length > 0 && (
        <div className="bg-foreground/5 rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-foreground">
              Completed Power Plays ({completedPowerPlays.length})
            </span>
          </div>
          <div className="space-y-2">
            {completedPowerPlays.map((pp) => {
              const dm = pp.domain ? DOMAIN_META[pp.domain] : null;
              return (
                <div key={pp.id} className="flex items-center gap-2">
                  {dm && (
                    <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium", dm.color)}>
                      <dm.icon className="h-3 w-3" />
                      {dm.label}
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">{pp.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gratitude Note */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          What are you grateful for this week?
        </label>
        <Textarea
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          placeholder="Take a moment to acknowledge what went well..."
          className="bg-foreground/5 border-border text-foreground placeholder:text-muted-foreground min-h-[100px] resize-none"
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleNext}
          className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6"
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
