import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, X } from "lucide-react";

const STORAGE_KEY = "staff_banner_dismissed_challenge_2_launch";

export function StaffChallengeBanner() {
  const [dismissed, setDismissed] = useState(() => {
    return !!localStorage.getItem(STORAGE_KEY);
  });

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <Card className="border-sky-500/40 bg-gradient-to-r from-[#1e283a] to-[#020817] text-white relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
      <CardContent className="py-5 pr-10">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-sky-500/20 p-2 mt-0.5 shrink-0">
            <Zap className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h3 className="font-semibold text-base leading-tight">
              The 6 Week Producer Challenge 2.0 is Here
            </h3>
            <p className="text-sm text-gray-300 mt-1">
              Build the daily habits, personal targets, and discipline that turn good producers into great ones — at the agency and in life. Ask your agency owner about getting enrolled.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
