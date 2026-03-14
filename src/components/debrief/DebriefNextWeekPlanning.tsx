import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, ArrowLeft, Target } from "lucide-react";
import { format, addDays, startOfWeek, addWeeks } from "date-fns";

interface DebriefNextWeekPlanningProps {
  nextWeekOBT: string;
  onSaveOBT: (obt: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DebriefNextWeekPlanning({
  nextWeekOBT,
  onSaveOBT,
  onNext,
  onBack,
}: DebriefNextWeekPlanningProps) {
  const [localOBT, setLocalOBT] = useState(nextWeekOBT);

  // Sync when prop changes (e.g. navigating back after save)
  useEffect(() => {
    setLocalOBT(nextWeekOBT);
  }, [nextWeekOBT]);

  // Calculate next week's dates
  const currentMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const nextMonday = addWeeks(currentMonday, 1);

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const date = addDays(nextMonday, i);
    return {
      date,
      label: format(date, "EEE"),
      dateStr: format(date, "MMM d"),
    };
  });

  const handleNext = () => {
    if (localOBT !== nextWeekOBT) {
      onSaveOBT(localOBT);
    }
    onNext();
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-white">Plan Next Week</h2>
        <p className="text-sm text-white/50 mt-1">
          Set your intention for {format(nextMonday, "MMM d")} - {format(addDays(nextMonday, 4), "MMM d")}
        </p>
      </div>

      {/* One Big Thing for next week */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-amber-400" />
          <span className="text-sm font-semibold text-white">One Big Thing</span>
        </div>
        <p className="text-xs text-white/50">
          What's the single most important thing you want to accomplish next week?
        </p>
        <Input
          value={localOBT}
          onChange={(e) => setLocalOBT(e.target.value)}
          placeholder="My One Big Thing for next week..."
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      {/* Next week grid preview */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-3">
        <p className="text-sm font-semibold text-white">Next Week at a Glance</p>
        <div className="grid grid-cols-5 gap-2">
          {weekDays.map(({ label, dateStr }) => (
            <div
              key={dateStr}
              className="flex flex-col items-center gap-1 py-3 rounded-lg bg-white/5 border border-white/5"
            >
              <span className="text-xs font-semibold text-white/70">{label}</span>
              <span className="text-[10px] text-white/40">{dateStr}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/40 text-center">
          Schedule your power plays from the Weekly Playbook after sealing your debrief.
        </p>
      </div>

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
          onClick={handleNext}
          className="bg-white text-[#020817] hover:bg-white/90 rounded-full px-6"
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
