import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Calendar, ExternalLink } from "lucide-react";
import confetti from "canvas-confetti";

const BOARDROOM_ZOOM_LINK =
  "https://us06web.zoom.us/j/86232632504?pwd=MibtJb0wP8N0wt2md2hm8ECK9CAAY3.1";

interface StepCompleteProps {
  onComplete: () => void;
}

export function StepComplete({ onComplete }: StepCompleteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#34d399", "#60a5fa", "#fbbf24", "#f472b6"],
    });

    onComplete();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-center">
      <div className="mb-8">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">You're All Set!</h1>
        <p className="text-muted-foreground">
          Your AgencyBrain account is ready to go.
        </p>
      </div>

      {/* Boardroom Call Card */}
      <Card className="mb-8 text-left border-primary/20 bg-primary/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3 mb-3">
            <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm mb-1">
                Book Your Boardroom Call
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your Boardroom membership includes access to our monthly 2-hour
                group coaching call, typically held on the second Tuesday of each
                month. Please check the schedule as dates may shift due to
                events and conferences.
              </p>
            </div>
          </div>
          <a
            href={BOARDROOM_ZOOM_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline ml-8"
          >
            Join the Boardroom Zoom
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>

      {/* Tips */}
      <div className="mb-8 text-left space-y-3 text-sm text-muted-foreground">
        <p>
          As you explore, look for the <span className="font-medium text-foreground">play icons</span> in
          the top navigation — these are short help videos that walk you through
          each feature.
        </p>
        <p>
          Questions? Email us anytime at{" "}
          <a
            href="mailto:info@standardplaybook.com"
            className="font-medium text-primary hover:underline"
          >
            info@standardplaybook.com
          </a>
        </p>
        <p>
          Run into a bug? Use the <span className="font-medium text-foreground">bug button</span> in
          the bottom-right corner of any page to report it.
        </p>
      </div>

      <Button
        onClick={() => navigate("/dashboard")}
        className="w-full"
        size="lg"
      >
        Enter AgencyBrain
      </Button>
    </div>
  );
}
