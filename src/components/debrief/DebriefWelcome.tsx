import { DebriefScoreRing } from "./DebriefScoreRing";
import { DebriefHistory } from "./DebriefHistory";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import type { WeekSummaryData } from "@/hooks/useWeekSummary";

interface DebriefWelcomeProps {
  weekSummary: WeekSummaryData;
  weekLabel: string;
  onBegin: () => void;
  onViewDebrief?: (weekKey: string) => void;
}

function getMessage(pct: number): string {
  if (pct >= 0.9) return "Outstanding week. You brought the fire.";
  if (pct >= 0.7) return "Strong week. Momentum is building.";
  if (pct >= 0.5) return "Solid progress. Every point counts.";
  if (pct >= 0.3) return "You showed up. That matters.";
  return "A new week is a new opportunity.";
}

export function DebriefWelcome({ weekSummary, weekLabel, onBegin, onViewDebrief }: DebriefWelcomeProps) {
  const { core4Points, flowPoints, playbookPoints, totalPoints } = weekSummary;
  const pct = totalPoints / 55;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6 animate-in fade-in duration-700">
      <div className="mb-2">
        <Sparkles className="h-6 w-6 text-amber-400 mx-auto mb-4 animate-pulse" />
        <p className="text-xs text-white/40 uppercase tracking-[0.2em] mb-1">Week in Review</p>
        <p className="text-sm text-white/60 font-medium">{weekLabel}</p>
      </div>

      <div className="my-8">
        <DebriefScoreRing total={totalPoints} max={55} size="lg" />
      </div>

      <p className="text-lg text-white/80 font-medium mb-6 max-w-sm">
        {getMessage(pct)}
      </p>

      <div className="flex gap-6 text-center mb-10">
        <div>
          <p className="text-xl font-bold text-white">{core4Points}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Core 4 / 28</p>
        </div>
        <div className="w-px bg-white/10" />
        <div>
          <p className="text-xl font-bold text-white">{flowPoints}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Flows / 7</p>
        </div>
        <div className="w-px bg-white/10" />
        <div>
          <p className="text-xl font-bold text-white">{playbookPoints}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Playbook / 20</p>
        </div>
      </div>

      <Button
        onClick={onBegin}
        size="lg"
        className="bg-white text-[#020817] hover:bg-white/90 font-semibold px-8 rounded-full"
      >
        Begin Your Debrief
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      {onViewDebrief && <DebriefHistory onViewDebrief={onViewDebrief} />}
    </div>
  );
}
