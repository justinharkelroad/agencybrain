import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { isStrictlyOneOnOne } from "@/utils/tierAccess";
import { getWeekKey } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { ClipboardEdit, X } from "lucide-react";

export function DebriefSundayBanner() {
  const { user, membershipTier } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [completed, setCompleted] = useState<boolean | null>(null);

  const today = new Date();
  const isSunday = today.getDay() === 0;
  const weekKey = getWeekKey(today);

  useEffect(() => {
    if (!user?.id || !isSunday || !isStrictlyOneOnOne(membershipTier)) return;

    supabase
      .from("weekly_reviews")
      .select("status")
      .eq("user_id", user.id)
      .eq("week_key", weekKey)
      .maybeSingle()
      .then(({ data }) => {
        setCompleted(data?.status === "completed");
      });
  }, [user?.id, isSunday, weekKey, membershipTier]);

  if (!isSunday || !isStrictlyOneOnOne(membershipTier) || dismissed || completed === true || completed === null) {
    return null;
  }

  return (
    <div className="relative bg-gradient-to-r from-sky-50 to-slate-100 dark:from-[#1e283a] dark:to-[#020817] text-foreground dark:text-white rounded-xl p-5 mb-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="bg-foreground/10 rounded-lg p-2.5">
          <ClipboardEdit className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <p className="font-semibold text-base">Your Weekly Debrief is ready</p>
          <p className="text-sm text-muted-foreground dark:text-white/60 mt-0.5">Reflect on your week, plan the next one, and get your coaching analysis.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => navigate("/debrief")}
          className="bg-foreground text-background hover:bg-foreground/90 font-semibold rounded-full px-6"
        >
          Begin Debrief
        </Button>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground/50 hover:text-muted-foreground dark:text-white/30 dark:hover:text-white/60 p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
