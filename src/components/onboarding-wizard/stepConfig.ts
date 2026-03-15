export type StepId =
  | "create_account"
  | "agency_details"
  | "sales_manager"
  | "add_team"
  | "what_to_expect"
  | "questionnaire"
  | "complete";

export interface StepDef {
  id: StepId;
  label: string;
}

const STEP_CONFIGS: Record<string, StepDef[]> = {
  Boardroom: [
    { id: "create_account", label: "Create Account" },
    { id: "agency_details", label: "Agency Details" },
    { id: "add_team", label: "Add Team" },
    { id: "complete", label: "Complete" },
  ],
  "1:1 Coaching": [
    { id: "create_account", label: "Create Account" },
    { id: "agency_details", label: "Agency Details" },
    { id: "sales_manager", label: "Sales Manager" },
    { id: "add_team", label: "Add Team" },
    { id: "what_to_expect", label: "What to Expect" },
    { id: "questionnaire", label: "Questionnaire" },
    { id: "complete", label: "Complete" },
  ],
};

export function getStepConfig(tier: string): StepDef[] {
  return STEP_CONFIGS[tier] || STEP_CONFIGS.Boardroom;
}
