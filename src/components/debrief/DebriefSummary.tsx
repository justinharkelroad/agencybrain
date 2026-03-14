import { Button } from "@/components/ui/button";
import { ArrowLeft, Stamp, Heart, Brain, Scale, Briefcase } from "lucide-react";
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
  onSeal: () => void;
  onBack: () => void;
  sealing: boolean;
}

export function DebriefSummary({
  weekSummary,
  weekLabel,
  domainReflections,
  gratitudeNote,
  nextWeekOBT,
  onSeal,
  onBack,
  sealing,
}: DebriefSummaryProps) {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-white">Your Debrief Summary</h2>
        <p className="text-sm text-white/50 mt-1">{weekLabel}</p>
      </div>

      {/* Score */}
      <div className="flex justify-center">
        <DebriefScoreRing total={weekSummary.totalPoints} max={55} size="md" />
      </div>

      <div className="flex justify-center gap-6 text-center">
        <div>
          <p className="text-lg font-bold text-white">{weekSummary.core4Points}</p>
          <p className="text-[10px] text-white/40 uppercase">Core 4</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white">{weekSummary.flowPoints}</p>
          <p className="text-[10px] text-white/40 uppercase">Flows</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white">{weekSummary.playbookPoints}</p>
          <p className="text-[10px] text-white/40 uppercase">Playbook</p>
        </div>
      </div>

      {/* Domain Ratings */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
        <p className="text-sm font-semibold text-white">Domain Ratings</p>
        <div className="grid grid-cols-2 gap-3">
          {DOMAIN_META.map(({ key, label, icon: Icon, color }) => {
            const reflection = domainReflections[key];
            return (
              <div
                key={key}
                className="flex items-center gap-2 bg-white/5 rounded-lg p-3"
              >
                <Icon className={cn("h-4 w-4", color)} />
                <span className="text-sm text-white/70 flex-1">{label}</span>
                <span className="text-lg font-bold text-white">
                  {reflection?.rating || "-"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Reflections */}
      {Object.entries(domainReflections).some(([, r]) => r.carry_forward) && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2">
          <p className="text-sm font-semibold text-white">Carrying Forward</p>
          {DOMAIN_META.map(({ key, label, color }) => {
            const reflection = domainReflections[key];
            if (!reflection?.carry_forward) return null;
            return (
              <div key={key} className="text-xs">
                <span className={cn("font-medium", color)}>{label}:</span>{" "}
                <span className="text-white/60">{reflection.carry_forward}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Gratitude */}
      {gratitudeNote && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-sm font-semibold text-white mb-1">Gratitude</p>
          <p className="text-sm text-white/60">{gratitudeNote}</p>
        </div>
      )}

      {/* Next Week OBT */}
      {nextWeekOBT && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-sm font-semibold text-white mb-1">Next Week's One Big Thing</p>
          <p className="text-sm text-amber-400 font-medium">{nextWeekOBT}</p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-white/60 hover:text-white hover:bg-white/10 rounded-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onSeal}
          disabled={sealing}
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 rounded-full"
        >
          <Stamp className="mr-2 h-5 w-5" />
          {sealing ? "Sealing..." : "Seal Your Debrief"}
        </Button>
      </div>
    </div>
  );
}
