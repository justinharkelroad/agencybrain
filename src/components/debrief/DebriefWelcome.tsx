import { DebriefScoreRing } from "./DebriefScoreRing";
import { DebriefHistory } from "./DebriefHistory";
import { DebriefStatsView } from "./DebriefStatsView";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import type { WeekSummaryData } from "@/hooks/useWeekSummary";
import type { DebriefStatsData } from "@/hooks/useDebriefStats";

interface DebriefWelcomeProps {
  weekSummary: WeekSummaryData;
  weekLabel: string;
  stats: DebriefStatsData;
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

export function DebriefWelcome({ weekSummary, weekLabel, stats, onBegin, onViewDebrief }: DebriefWelcomeProps) {
  const { core4Points, flowPoints, playbookPoints, totalPoints } = weekSummary;
  const pct = totalPoints / 56;

  return (
    <div className="flex flex-col items-center text-center px-6 py-8 animate-in fade-in duration-700">
      <div className="mb-2">
        <Sparkles className="h-6 w-6 text-amber-400 mx-auto mb-4 animate-pulse" />
        <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-1">Week in Review</p>
        <p className="text-sm text-muted-foreground font-medium">{weekLabel}</p>
      </div>

      <div className="my-6">
        <DebriefScoreRing total={totalPoints} max={56} size="lg" />
      </div>

      <p className="text-lg text-foreground/80 font-medium mb-4 max-w-sm">
        {getMessage(pct)}
      </p>

      <div className="flex gap-6 text-center mb-8">
        <div>
          <p className="text-xl font-bold text-foreground">{core4Points}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Core 4 / 28</p>
        </div>
        <div className="w-px bg-border" />
        <div>
          <p className="text-xl font-bold text-foreground">{flowPoints}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Flows / 7</p>
        </div>
        <div className="w-px bg-border" />
        <div>
          <p className="text-xl font-bold text-foreground">{playbookPoints}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Playbook / 21</p>
        </div>
      </div>

      {/* Stats dashboard */}
      <div className="w-full max-w-2xl mb-8">
        <DebriefStatsView stats={stats} />
      </div>

      <Button
        onClick={onBegin}
        size="lg"
        className="bg-foreground text-background hover:bg-foreground/90 font-semibold px-8 rounded-full"
      >
        Begin Your Debrief
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      {onViewDebrief && <DebriefHistory onViewDebrief={onViewDebrief} />}
    </div>
  );
}
