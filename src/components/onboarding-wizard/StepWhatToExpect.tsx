import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  ExternalLink,
  Download,
  Calendar,
  ClipboardList,
  BarChart3,
  ListOrdered,
} from "lucide-react";
import { format, getDay } from "date-fns";

const BOOKING_LINK = "https://AGENCYCOACHING.as.me/30MIN8WEEK";
const PDF_URL =
  "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/onboarding-assets/8%20Week%20Sales%20Experience%20Sales%20Process%20Example.pdf";

interface StepWhatToExpectProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (data: { startDate: string }) => void;
  onBack: () => void;
}

export function StepWhatToExpect({
  isSubmitting,
  error,
  onSubmit,
  onBack,
}: StepWhatToExpectProps) {
  const [startDate, setStartDate] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!startDate) {
      setLocalError("Please select a start date");
      return;
    }

    // Validate it's a Monday (getDay: 0=Sun, 1=Mon)
    const parsed = new Date(startDate + "T00:00:00");
    if (getDay(parsed) !== 1) {
      setLocalError("Start date must be a Monday");
      return;
    }

    onSubmit({ startDate });
  };

  // Format for display if a date is selected
  const dateDisplay = startDate
    ? format(new Date(startDate + "T00:00:00"), "EEEE, MMMM d, yyyy")
    : null;

  const displayError = localError || error;

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">What to Expect</h1>
        <p className="text-muted-foreground">
          Here's how your 8-Week Experience works
        </p>
      </div>

      <div className="space-y-6">
        {/* Coaching Calls */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3 mb-3">
              <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  Book Your Coaching Calls
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You have <span className="font-medium text-foreground">8 coaching calls</span>, each{" "}
                  <span className="font-medium text-foreground">45 minutes</span>, spread
                  over 8 weeks or longer. You're responsible for booking these
                  — we recommend pre-booking all 8 now so they're on the
                  calendar.
                </p>
              </div>
            </div>
            <a
              href={BOOKING_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline ml-8"
            >
              Book Your Calls
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardContent>
        </Card>

        {/* Sales Process PDF */}
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3 mb-3">
              <Download className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm mb-1">
                  Download: Sales Process Example
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This is our sales process framework. Review it before your
                  first call — by the end of 8 weeks, you'll have built your
                  own version customized for your agency.
                </p>
              </div>
            </div>
            <a
              href={PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline ml-8"
            >
              Download PDF
              <Download className="h-3.5 w-3.5" />
            </a>
          </CardContent>
        </Card>

        {/* Deliverables */}
        <Card>
          <CardContent className="pt-5 pb-5">
            <h3 className="font-semibold text-sm mb-3">
              Your 3 Deliverables
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Over the 8 weeks, you'll build these three foundational
              documents for your agency:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <ClipboardList className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Sales Process</p>
                  <p className="text-xs text-muted-foreground">
                    Your walk-and-talk framework — rapport, coverage review,
                    and closing scripts
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Accountability Metrics</p>
                  <p className="text-xs text-muted-foreground">
                    The daily activity requirements and tracking standards for
                    your team
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ListOrdered className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Consequence Ladder</p>
                  <p className="text-xs text-muted-foreground">
                    A progressive discipline framework for holding your team
                    accountable
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Start Date Picker */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="border-primary/20">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3 mb-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">
                    When Do You Start?
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    Book your first coaching call, then select the Monday of
                    that week below. That will be Week 1 of your 8-Week
                    Experience.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date (Monday)</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setLocalError(null);
                      }}
                    />
                    {dateDisplay && (
                      <p className="text-xs text-muted-foreground">
                        {dateDisplay}
                        {startDate && getDay(new Date(startDate + "T00:00:00")) !== 1 && (
                          <span className="text-destructive ml-1">
                            — not a Monday
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {displayError && (
            <p className="text-sm text-destructive">{displayError}</p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isSubmitting}
              className="flex-1"
            >
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
