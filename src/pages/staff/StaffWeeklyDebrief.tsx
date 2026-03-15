import { useStaffAuth } from "@/hooks/useStaffAuth";
import { getWeekKey } from "@/lib/date-utils";
import { format, startOfWeek } from "date-fns";
import { DebriefWizard } from "@/components/debrief/DebriefWizard";
import { useStaffWeekSummary } from "@/hooks/useStaffWeekSummary";
import { useStaffWeeklyDebrief } from "@/hooks/useStaffWeeklyDebrief";
import { useStaffFocusItems } from "@/hooks/useStaffFocusItems";
import { supabase } from "@/integrations/supabase/client";
import type { WeeklyReview } from "@/hooks/useWeeklyDebrief";
import { Loader2 } from "lucide-react";

export default function StaffWeeklyDebrief() {
  const { user, loading: authLoading } = useStaffAuth();

  // Current ISO week
  const now = new Date();
  const weekKey = getWeekKey(now);
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const weekLabel = `Week of ${format(monday, "MMMM d, yyyy")}`;

  const weekSummary = useStaffWeekSummary(weekKey);
  const {
    review,
    isLoading,
    createOrResume,
    saveStep,
    saveGratitudeNote,
    saveDomainReflection,
    saveNextWeekOBT,
    completeDebrief,
  } = useStaffWeeklyDebrief(weekKey);

  const { createItem } = useStaffFocusItems();

  const handleRequestAnalysis = async (reviewId: string): Promise<string> => {
    // Staff uses the edge function with staff session header
    // For now, the analyze_debrief function requires JWT auth — staff will see a graceful fallback
    const { data, error } = await supabase.functions.invoke("analyze_debrief", {
      body: { review_id: reviewId },
    });
    if (error) throw error;
    return data?.analysis || "";
  };

  const handleAddToBench = (title: string, domain: string) => {
    createItem.mutate({
      title,
      priority_level: "mid",
      zone: "bench",
      domain: domain as "body" | "being" | "balance" | "business",
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DebriefWizard
      weekLabel={weekLabel}
      weekSummary={weekSummary}
      stats={{ total: { current: 0, max: 0, pct: 0, delta: 0, deltaPct: 0 }, core4: { current: 0, max: 0, pct: 0, delta: 0, deltaPct: 0 }, flow: { current: 0, max: 0, pct: 0, delta: 0, deltaPct: 0 }, playbook: { current: 0, max: 0, pct: 0, delta: 0, deltaPct: 0 }, previousWeek: 0, fourWeekAvg: 0, yearAvg: 0, overallAvg: 0 }}
      review={review as unknown as WeeklyReview | null}
      isLoading={isLoading}
      agencyId={user?.agency_id || null}
      exitPath="/staff/weekly-playbook"
      onCreateOrResume={() => createOrResume.mutateAsync()}
      onSaveStep={(step) => saveStep.mutate(step)}
      onSaveGratitudeNote={(note) => saveGratitudeNote.mutate(note)}
      onSaveDomainReflection={(domain, reflection) => saveDomainReflection.mutate({ domain, reflection })}
      onAddToBench={handleAddToBench}
      onSaveNextWeekOBT={(obt) => saveNextWeekOBT.mutate(obt)}
      onRequestAnalysis={handleRequestAnalysis}
      onCompleteDebrief={(scores) => completeDebrief.mutateAsync(scores)}
    />
  );
}
