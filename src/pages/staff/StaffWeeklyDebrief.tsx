import { useStaffAuth } from "@/hooks/useStaffAuth";
import { getWeekKey } from "@/lib/date-utils";
import { format, startOfWeek } from "date-fns";
import { DebriefWizard } from "@/components/debrief/DebriefWizard";
import { useStaffWeekSummary } from "@/hooks/useStaffWeekSummary";
import { useStaffWeeklyDebrief } from "@/hooks/useStaffWeeklyDebrief";
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#020817] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <DebriefWizard
      weekLabel={weekLabel}
      weekSummary={weekSummary}
      review={review as WeeklyReview | null}
      isLoading={isLoading}
      agencyId={user?.agency_id || null}
      exitPath="/staff/weekly-playbook"
      onCreateOrResume={() => createOrResume.mutateAsync()}
      onSaveStep={(step) => saveStep.mutate(step)}
      onSaveGratitudeNote={(note) => saveGratitudeNote.mutate(note)}
      onSaveDomainReflection={(domain, reflection) => saveDomainReflection.mutate({ domain, reflection })}
      onSaveNextWeekOBT={(obt) => saveNextWeekOBT.mutate(obt)}
      onCompleteDebrief={(scores) => completeDebrief.mutateAsync(scores)}
    />
  );
}
