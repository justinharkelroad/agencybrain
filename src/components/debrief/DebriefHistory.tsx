import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DebriefScoreRing } from "./DebriefScoreRing";
import { ChevronRight, Loader2 } from "lucide-react";

interface DebriefHistoryProps {
  onViewDebrief: (weekKey: string) => void;
}

export function DebriefHistory({ onViewDebrief }: DebriefHistoryProps) {
  const { user } = useAuth();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["debrief-history", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("weekly_reviews")
        .select("id, week_key, total_points, core4_points, flow_points, playbook_points, status, completed_at, domain_reflections")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("week_key", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (reviews.length === 0) return null;

  // Calculate average rating per review
  const getAvgRating = (reflections: Record<string, unknown> | null) => {
    if (!reflections) return null;
    const domains = ["body", "being", "balance", "business"];
    const ratings = domains
      .map(d => (reflections[d] as Record<string, unknown> | undefined)?.rating as number | undefined)
      .filter((r): r is number => typeof r === "number");
    if (ratings.length === 0) return null;
    return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
  };

  return (
    <div className="mt-8 w-full max-w-sm mx-auto">
      <p className="text-xs text-white/40 uppercase tracking-wider mb-3 text-center">Past Debriefs</p>
      <div className="space-y-2">
        {reviews.map((r) => (
          <button
            key={r.id}
            onClick={() => onViewDebrief(r.week_key)}
            className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-4 py-3 transition-all text-left group"
          >
            <DebriefScoreRing total={r.total_points ?? 0} max={55} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{r.week_key}</p>
              <p className="text-xs text-white/40">
                {r.core4_points ?? 0}/28 · {r.flow_points ?? 0}/7 · {r.playbook_points ?? 0}/20
                {getAvgRating(r.domain_reflections as Record<string, unknown> | null) && ` · Avg ${getAvgRating(r.domain_reflections as Record<string, unknown> | null)}/10`}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
