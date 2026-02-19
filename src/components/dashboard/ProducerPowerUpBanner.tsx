import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

const BANNER_KEY = "challenge_2_launch";
const SESSION_KEY = `banner_dismissed_${BANNER_KEY}`;

export function ProducerPowerUpBanner() {
  const { user } = useAuth();
  // Check sessionStorage first for instant cross-navigation persistence
  const [dismissed, setDismissed] = useState<boolean | null>(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return true;
    return null; // loading — will check DB
  });

  useEffect(() => {
    // Already dismissed in this session, skip DB check
    if (dismissed === true) return;
    if (!user?.id) return;

    supabase
      .from("banner_dismissals")
      .select("id")
      .eq("user_id", user.id)
      .eq("banner_key", BANNER_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          sessionStorage.setItem(SESSION_KEY, "1");
          setDismissed(true);
        } else {
          setDismissed(false);
        }
      });
  }, [user?.id]);

  const handleDismiss = async () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
    if (user?.id) {
      await supabase.from("banner_dismissals").upsert(
        { user_id: user.id, banner_key: BANNER_KEY },
        { onConflict: "user_id,banner_key" }
      );
    }
  };

  // Hide while loading or if dismissed
  if (dismissed !== false) return null;

  return (
    <Card className="border-sky-500/40 bg-gradient-to-r from-[#1e283a] to-[#020817] text-white relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5 pr-10">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-sky-500/20 p-2 mt-0.5 shrink-0">
            <Zap className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h3 className="font-semibold text-base leading-tight">
              The 6 Week Producer Challenge 2.0 is LIVE inside AgencyBrain
            </h3>
            <p className="text-sm text-gray-300 mt-1">
              A structured 6-week challenge that turns your producers' daily agency habits into a system — and builds the kind of discipline that changes everything else too.
            </p>
          </div>
        </div>
        <Button
          asChild
          className="bg-sky-500 hover:bg-sky-600 text-white shrink-0 w-full sm:w-auto"
        >
          <Link to="/training/challenge">
            Learn More
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
