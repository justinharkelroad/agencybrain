import { useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { StepCreateAccount } from "./StepCreateAccount";
import { StepAgencyDetails } from "./StepAgencyDetails";
import { StepAddTeam } from "./StepAddTeam";
import { StepComplete } from "./StepComplete";
import type { TokenData, TeamMemberResult } from "@/hooks/useOnboardingWizard";

const TOTAL_STEPS = 4;
const STEP_LABELS = ["Create Account", "Agency Details", "Add Team", "Complete"];

interface OnboardingWizardProps {
  step: number;
  setStep: (step: number) => void;
  tokenData: TokenData;
  isSubmitting: boolean;
  error: string | null;
  teamMembers: TeamMemberResult[];
  onCreateAccount: (password: string, fullName: string) => void;
  onSaveAgencyDetails: (agencyName: string, timezone: string, phone?: string) => void;
  onAddTeamMembers: (members: Array<{ name: string; email: string; role: string }>) => void;
  onCompleteOnboarding: () => void;
}

export function OnboardingWizard({
  step,
  setStep,
  tokenData,
  isSubmitting,
  error,
  teamMembers,
  onCreateAccount,
  onSaveAgencyDetails,
  onAddTeamMembers,
  onCompleteOnboarding,
}: OnboardingWizardProps) {
  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const handleSkipTeam = useCallback(() => {
    setStep(3);
  }, [setStep]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                AgencyBrain Setup
              </span>
              <span className="text-xs text-muted-foreground/70">
                {STEP_LABELS[step]}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Step {step + 1} of {TOTAL_STEPS}
            </span>
          </div>
          <Progress
            value={progress}
            className="h-1 bg-muted [&>div]:bg-foreground/40"
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {step === 0 && (
          <StepCreateAccount
            email={tokenData.email}
            defaultAgencyName={tokenData.agency_name}
            isSubmitting={isSubmitting}
            error={error}
            onSubmit={onCreateAccount}
          />
        )}

        {step === 1 && (
          <StepAgencyDetails
            defaultAgencyName={tokenData.agency_name}
            isSubmitting={isSubmitting}
            error={error}
            onSubmit={onSaveAgencyDetails}
            onBack={() => setStep(0)}
          />
        )}

        {step === 2 && (
          <StepAddTeam
            isSubmitting={isSubmitting}
            error={error}
            savedMembers={teamMembers}
            onSubmit={onAddTeamMembers}
            onSkip={handleSkipTeam}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <StepComplete onComplete={onCompleteOnboarding} />
        )}
      </main>
    </div>
  );
}
