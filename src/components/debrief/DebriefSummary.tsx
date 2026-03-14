import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Heart, Brain, Scale, Briefcase } from "lucide-react";
import { DebriefScoreRing } from "./DebriefScoreRing";
import type { WeekSummaryData } from "@/hooks/useWeekSummary";
import type { DomainReflection } from "@/hooks/useWeeklyDebrief";
import { cn } from "@/lib/utils";

const DOMAIN_META = [
  { key: "body", label: "Body", icon: Heart, color: "text-red-400" },
  { key: "being", label: "Being", icon: Brain, color: "text-purple-400" },
  { key: "balance", label: "Balance", icon: Scale, color: "text-blue-400" },
  { key: "business", label: "Business", icon: Briefcase, color: "text-amber-400" },
] as const;

interface DebriefSummaryProps {
  weekSummary: WeekSummaryData;
  weekLabel: string;
  domainReflections: Record<string, DomainReflection>;
  gratitudeNote: string | null;
  nextWeekOBT: string | null;
  onNext: () => void;
  onBack: () => void;
}

export function DebriefSummary({
  weekSummary,
  weekLabel,
  domainReflections,
  gratitudeNote,
  nextWeekOBT,
  onNext,
  onBack,
}: DebriefSummaryProps) {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-foreground">Your Debrief Summary</h2>
        <p className="text-sm text-muted-foreground mt-1">{weekLabel}</p>
      </div>

      {/* Score */}
      <div className="flex justify-center">
        <DebriefScoreRing total={weekSummary.totalPoints} max={56} size="md" />
      </div>

      <div className="flex justify-center gap-6 text-center">
        <div>
          <p className="text-lg font-bold text-foreground">{weekSummary.core4Points}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Core 4</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{weekSummary.flowPoints}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Flows</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{weekSummary.playbookPoints}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Playbook</p>
        </div>
      </div>

      {/* Domain Ratings */}
      <div className="bg-foreground/5 rounded-xl p-4 border border-border space-y-3">
        <p className="text-sm font-semibold text-foreground">Domain Ratings</p>
        <div className="grid grid-cols-2 gap-3">
          {DOMAIN_META.map(({ key, label, icon: Icon, color }) => {
            const reflection = domainReflections[key];
            return (
              <div
                key={key}
                className="flex items-center gap-2 bg-foreground/5 rounded-lg p-3"
              >
                <Icon className={cn("h-4 w-4", color)} />
                <span className="text-sm text-muted-foreground flex-1">{label}</span>
                <span className="text-lg font-bold text-foreground">
                  {reflection?.rating || "-"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Course Corrections */}
      {Object.entries(domainReflections).some(([, r]) => r.course_correction && r.course_correction_note) && (
        <div className="bg-foreground/5 rounded-xl p-4 border border-border space-y-2">
          <p className="text-sm font-semibold text-foreground">Course Corrections</p>
          {DOMAIN_META.map(({ key, label, color }) => {
            const reflection = domainReflections[key];
            if (!reflection?.course_correction || !reflection?.course_correction_note) return null;
            return (
              <div key={key} className="text-xs">
                <span className={cn("font-medium", color)}>{label}:</span>{" "}
                <span className="text-muted-foreground">{reflection.course_correction_note}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Gratitude */}
      {gratitudeNote && (
        <div className="bg-foreground/5 rounded-xl p-4 border border-border">
          <p className="text-sm font-semibold text-foreground mb-1">Gratitude</p>
          <p className="text-sm text-muted-foreground">{gratitudeNote}</p>
        </div>
      )}

      {/* Next Week OBT */}
      {nextWeekOBT && (
        <div className="bg-foreground/5 rounded-xl p-4 border border-border">
          <p className="text-sm font-semibold text-foreground mb-1">Next Week's One Big Thing</p>
          <p className="text-sm text-amber-400 font-medium">{nextWeekOBT}</p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6"
        >
          Get Your Coaching Analysis
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
