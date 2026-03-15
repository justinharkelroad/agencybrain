import { useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { StepCreateAccount } from "./StepCreateAccount";
import { StepAgencyDetails } from "./StepAgencyDetails";
import { StepAddTeam } from "./StepAddTeam";
import { StepComplete } from "./StepComplete";
import { StepSalesManager } from "./StepSalesManager";
import { StepWhatToExpect } from "./StepWhatToExpect";
import { StepQuestionnaire } from "./StepQuestionnaire";
import { getStepConfig } from "./stepConfig";
import type { TokenData, TeamMemberResult } from "@/hooks/useOnboardingWizard";
import type { SalesManagerData, SalesManagerResult } from "./StepSalesManager";
import type { QuestionnaireAnswers } from "./StepQuestionnaire";

interface OnboardingWizardProps {
  step: number;
  setStep: (step: number) => void;
  tokenData: TokenData;
  isSubmitting: boolean;
  error: string | null;
  teamMembers: TeamMemberResult[];
  salesManagerResult: SalesManagerResult | null;
  onCreateAccount: (password: string, fullName: string) => void;
  onSaveAgencyDetails: (agencyName: string, timezone: string, phone?: string) => void;
  onSaveSalesManager: (data: SalesManagerData) => void;
  onAddTeamMembers: (members: Array<{ name: string; email: string; role: string }>) => void;
  onSaveWhatToExpect: (data: { startDate: string }) => void;
  onSaveQuestionnaire: (answers: QuestionnaireAnswers) => void;
  onCompleteOnboarding: () => void;
}

export function OnboardingWizard({
  step,
  setStep,
  tokenData,
  isSubmitting,
  error,
  teamMembers,
  salesManagerResult,
  onCreateAccount,
  onSaveAgencyDetails,
  onSaveSalesManager,
  onAddTeamMembers,
  onSaveWhatToExpect,
  onSaveQuestionnaire,
  onCompleteOnboarding,
}: OnboardingWizardProps) {
  const steps = getStepConfig(tokenData.tier);
  const totalSteps = steps.length;
  const currentStepDef = steps[step];
  const progress = ((step + 1) / totalSteps) * 100;

  const handleSkipTeam = useCallback(() => {
    // Advance to the step after add_team
    const addTeamIdx = steps.findIndex((s) => s.id === "add_team");
    if (addTeamIdx >= 0 && addTeamIdx + 1 < steps.length) {
      setStep(addTeamIdx + 1);
    }
  }, [setStep, steps]);

  // After saving manager, the "Continue" button on the result screen advances
  const handleManagerContinue = useCallback(() => {
    const mgrIdx = steps.findIndex((s) => s.id === "sales_manager");
    if (mgrIdx >= 0 && mgrIdx + 1 < steps.length) {
      setStep(mgrIdx + 1);
    }
  }, [setStep, steps]);

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
                {currentStepDef?.label}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Step {step + 1} of {totalSteps}
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
        {currentStepDef?.id === "create_account" && (
          <StepCreateAccount
            email={tokenData.email}
            defaultAgencyName={tokenData.agency_name}
            isSubmitting={isSubmitting}
            error={error}
            onSubmit={onCreateAccount}
          />
        )}

        {currentStepDef?.id === "agency_details" && (
          <StepAgencyDetails
            defaultAgencyName={tokenData.agency_name}
            isSubmitting={isSubmitting}
            error={error}
            onSubmit={onSaveAgencyDetails}
            onBack={() => setStep(step - 1)}
          />
        )}

        {currentStepDef?.id === "sales_manager" && (
          <StepSalesManager
            isSubmitting={isSubmitting}
            error={error}
            savedManager={salesManagerResult}
            onSubmit={onSaveSalesManager}
            onBack={() => setStep(step - 1)}
            onContinue={handleManagerContinue}
          />
        )}

        {currentStepDef?.id === "add_team" && (
          <StepAddTeam
            isSubmitting={isSubmitting}
            error={error}
            savedMembers={teamMembers}
            tier={tokenData.tier}
            onSubmit={onAddTeamMembers}
            onSkip={handleSkipTeam}
            onBack={() => setStep(step - 1)}
          />
        )}

        {currentStepDef?.id === "what_to_expect" && (
          <StepWhatToExpect
            isSubmitting={isSubmitting}
            error={error}
            onSubmit={onSaveWhatToExpect}
            onBack={() => setStep(step - 1)}
          />
        )}

        {currentStepDef?.id === "questionnaire" && (
          <StepQuestionnaire
            isSubmitting={isSubmitting}
            error={error}
            onSubmit={onSaveQuestionnaire}
            onBack={() => setStep(step - 1)}
          />
        )}

        {currentStepDef?.id === "complete" && (
          <StepComplete
            tier={tokenData.tier}
            onComplete={onCompleteOnboarding}
          />
        )}
      </main>
    </div>
  );
}
