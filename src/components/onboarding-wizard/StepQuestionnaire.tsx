import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export interface QuestionnaireAnswers {
  lead_management_system: string;
  current_accountability: string;
  top_struggles: string;
  hoped_outcome: string;
}

interface StepQuestionnaireProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (answers: QuestionnaireAnswers) => void;
  onBack: () => void;
}

export function StepQuestionnaire({
  isSubmitting,
  error,
  onSubmit,
  onBack,
}: StepQuestionnaireProps) {
  const [leadMgmt, setLeadMgmt] = useState("");
  const [accountability, setAccountability] = useState("");
  const [struggles, setStruggles] = useState("");
  const [outcome, setOutcome] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!leadMgmt.trim()) {
      setLocalError("Please answer the lead management question");
      return;
    }
    if (!accountability.trim()) {
      setLocalError("Please answer the accountability question");
      return;
    }
    if (!struggles.trim()) {
      setLocalError("Please describe your top struggles");
      return;
    }
    if (!outcome.trim()) {
      setLocalError("Please share your hoped outcome");
      return;
    }

    onSubmit({
      lead_management_system: leadMgmt.trim(),
      current_accountability: accountability.trim(),
      top_struggles: struggles.trim(),
      hoped_outcome: outcome.trim(),
    });
  };

  const displayError = localError || error;

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Quick Questionnaire</h1>
        <p className="text-muted-foreground">
          Help us prepare for your first coaching call
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="lead-mgmt">
            What system do you use for lead management?
          </Label>
          <Textarea
            id="lead-mgmt"
            value={leadMgmt}
            onChange={(e) => setLeadMgmt(e.target.value)}
            placeholder="e.g., EZLynx, HawkSoft, Applied Epic, spreadsheets..."
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="accountability">
            How do you currently hold your team accountable?
          </Label>
          <Textarea
            id="accountability"
            value={accountability}
            onChange={(e) => setAccountability(e.target.value)}
            placeholder="e.g., daily check-ins, weekly meetings, activity tracking..."
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="struggles">
            What are your top 3 struggles as a sales manager/agency owner with
            your sales team?
          </Label>
          <Textarea
            id="struggles"
            value={struggles}
            onChange={(e) => setStruggles(e.target.value)}
            placeholder="e.g., lack of prospecting activity, inconsistent follow-up, difficulty coaching..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="outcome">
            What do you hope the outcome of this 8-week experience is?
          </Label>
          <Textarea
            id="outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="e.g., a structured sales process, clear accountability metrics, better coaching skills..."
            rows={3}
          />
        </div>

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
                Submitting...
              </>
            ) : (
              "Submit & Finish Setup"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
