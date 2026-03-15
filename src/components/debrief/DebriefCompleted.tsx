import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles, ArrowLeft } from "lucide-react";
import { DebriefScoreRing } from "./DebriefScoreRing";
import { DebriefStatsView } from "./DebriefStatsView";
import { DebriefHistory } from "./DebriefHistory";
import { toast } from "sonner";
import type { WeeklyReview } from "@/hooks/useWeeklyDebrief";
import type { DebriefStatsData } from "@/hooks/useDebriefStats";

interface DebriefCompletedProps {
  review: WeeklyReview;
  weekLabel: string;
  stats: DebriefStatsData;
  exitPath: string;
}

const DOMAIN_LABELS: Record<string, string> = {
  body: "Body",
  being: "Being",
  balance: "Balance",
  business: "Business",
};

export function DebriefCompleted({ review, weekLabel, stats, exitPath }: DebriefCompletedProps) {
  const navigate = useNavigate();
  const analysis = (review as unknown as Record<string, unknown>)?.coaching_analysis as string | null ?? null;
  const reflections = review.domain_reflections || {};

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-muted-foreground">The Debrief</span>
            <span className="text-xs text-emerald-400 font-medium">Completed</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(exitPath)}
            className="h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center text-center px-6 py-8 animate-in fade-in duration-500">
          {/* Score + Week label */}
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-3" />
          <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-1">Debrief Sealed</p>
          <p className="text-sm text-muted-foreground font-medium mb-6">{weekLabel}</p>

          <DebriefScoreRing total={review.total_points || 0} max={56} size="lg" />

          <div className="flex gap-6 text-center my-6">
            <div>
              <p className="text-xl font-bold text-foreground">{review.core4_points || 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Core 4 / 28</p>
            </div>
            <div className="w-px bg-border" />
            <div>
              <p className="text-xl font-bold text-foreground">{review.flow_points || 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Flows / 7</p>
            </div>
            <div className="w-px bg-border" />
            <div>
              <p className="text-xl font-bold text-foreground">{review.playbook_points || 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Playbook / 21</p>
            </div>
          </div>

          {/* Stats dashboard */}
          <div className="w-full max-w-2xl mb-8">
            <DebriefStatsView stats={stats} />
          </div>

          {/* Coaching analysis */}
          {analysis && (
            <div className="w-full max-w-2xl mb-8">
              <div className="flex items-center gap-2 justify-center mb-4">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coach's Analysis</p>
              </div>
              <div className="bg-gradient-to-br from-foreground/[0.08] to-foreground/[0.03] rounded-xl p-6 border border-border text-left">
                {analysis.split('\n\n').map((paragraph, i) => (
                  <p key={i} className="text-sm text-foreground/80 leading-relaxed mb-4 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Gratitude note */}
          {review.gratitude_note && (
            <div className="w-full max-w-2xl mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-3">Gratitude</p>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-left">
                <p className="text-sm text-foreground/80 italic">"{review.gratitude_note}"</p>
              </div>
            </div>
          )}

          {/* Domain reflections */}
          {Object.keys(reflections).length > 0 && (
            <div className="w-full max-w-2xl mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-3">Reflections</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(reflections).map(([domain, r]) => {
                  if (!r) return null;
                  const ref = r as { rating?: number; wins?: string; course_correction?: boolean; course_correction_note?: string };
                  const ratingColor = (ref.rating || 0) >= 7 ? "text-emerald-400" : (ref.rating || 0) >= 4 ? "text-amber-400" : "text-red-400";
                  return (
                    <div key={domain} className="bg-foreground/5 border border-border rounded-xl p-4 text-left">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-foreground capitalize">{DOMAIN_LABELS[domain] || domain}</span>
                        <span className={`text-lg font-bold ${ratingColor}`}>{ref.rating || "-"}/10</span>
                      </div>
                      {ref.wins && (
                        <p className="text-xs text-muted-foreground mb-1"><span className="font-medium text-foreground/70">Wins:</span> {ref.wins}</p>
                      )}
                      {ref.course_correction && ref.course_correction_note && (
                        <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground/70">Course correction:</span> {ref.course_correction_note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Next week OBT */}
          {review.next_week_one_big_thing && (
            <div className="w-full max-w-2xl mb-8">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-3">Next Week's One Big Thing</p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-sm font-semibold text-foreground">{review.next_week_one_big_thing}</p>
              </div>
            </div>
          )}

          {/* Past debriefs */}
          <DebriefHistory onViewDebrief={(weekKey) => toast.info(`Viewing ${weekKey} — coming soon`)} />
        </div>
      </main>
    </div>
  );
}
