import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getWeekKey } from "@/lib/date-utils";
import { format, startOfWeek } from "date-fns";
import { DebriefWizard } from "@/components/debrief/DebriefWizard";
import { useWeekSummary } from "@/hooks/useWeekSummary";
import { useWeeklyDebrief } from "@/hooks/useWeeklyDebrief";
import { Loader2 } from "lucide-react";

export default function WeeklyDebrief() {
  const { user, isKeyEmployee, keyEmployeeAgencyId, loading: authLoading } = useAuth();
  const [agencyId, setAgencyId] = useState<string | null>(null);

  // Current ISO week
  const now = new Date();
  const weekKey = getWeekKey(now);
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const weekLabel = `Week of ${format(monday, "MMMM d, yyyy")}`;

  // Resolve agency ID
  useEffect(() => {
    if (isKeyEmployee && keyEmployeeAgencyId) {
      setAgencyId(keyEmployeeAgencyId);
      return;
    }
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.agency_id) setAgencyId(data.agency_id);
      });
  }, [user?.id, isKeyEmployee, keyEmployeeAgencyId]);

  const weekSummary = useWeekSummary(weekKey);
  const {
    review,
    isLoading,
    createOrResume,
    saveStep,
    saveGratitudeNote,
    saveDomainReflection,
    saveNextWeekOBT,
    completeDebrief,
  } = useWeeklyDebrief(weekKey);

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
      review={review}
      isLoading={isLoading}
      agencyId={agencyId}
      exitPath="/weekly-playbook"
      onCreateOrResume={(aid) => createOrResume.mutateAsync(aid)}
      onSaveStep={(step) => saveStep.mutate(step)}
      onSaveGratitudeNote={(note) => saveGratitudeNote.mutate(note)}
      onSaveDomainReflection={(domain, reflection) => saveDomainReflection.mutate({ domain, reflection })}
      onSaveNextWeekOBT={(obt) => saveNextWeekOBT.mutate(obt)}
      onCompleteDebrief={(scores) => completeDebrief.mutateAsync(scores)}
    />
  );
}
