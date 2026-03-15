import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getStepConfig } from "@/components/onboarding-wizard/stepConfig";
import type { SalesManagerData, SalesManagerResult } from "@/components/onboarding-wizard/StepSalesManager";
import type { QuestionnaireAnswers } from "@/components/onboarding-wizard/StepQuestionnaire";

export interface TokenData {
  valid: boolean;
  email: string;
  agency_name: string | null;
  tier: string;
  metadata: Record<string, unknown>;
}

export interface TeamMemberResult {
  name: string;
  email: string;
  team_member_id: string;
  invite_token?: string;
  invite_url?: string;
}

type WizardStatus = "loading" | "valid" | "invalid" | "expired" | "used" | "error";

export function useOnboardingWizard(token: string | null) {
  const [status, setStatus] = useState<WizardStatus>("loading");
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberResult[]>([]);
  const [managerTeamMemberId, setManagerTeamMemberId] = useState<string | null>(null);
  const [managerPhone, setManagerPhone] = useState<string | null>(null);
  const [salesManagerResult, setSalesManagerResult] = useState<SalesManagerResult | null>(null);

  // Get the step config for the current tier
  const stepConfig = tokenData ? getStepConfig(tokenData.tier) : null;

  // Find the index of a step by its ID
  const findStepIndex = useCallback(
    (stepId: string) => stepConfig?.findIndex((s) => s.id === stepId) ?? -1,
    [stepConfig]
  );

  // Advance to the next step after the given step ID
  const advancePast = useCallback(
    (stepId: string) => {
      const idx = findStepIndex(stepId);
      if (idx >= 0 && stepConfig && idx + 1 < stepConfig.length) {
        setStep(idx + 1);
      }
    },
    [findStepIndex, stepConfig]
  );

  const validateToken = useCallback(async () => {
    if (!token) {
      setStatus("invalid");
      setError("No onboarding token provided");
      return;
    }

    setStatus("loading");
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "validate-onboarding-token",
        { body: { token } }
      );

      if (fnError) {
        const errorBody = fnError.context?.json ? await fnError.context.json().catch(() => null) : null;
        if (errorBody?.error?.includes("already been used")) {
          setStatus("used");
          setError("This onboarding link has already been used");
        } else if (errorBody?.error?.includes("expired")) {
          setStatus("expired");
          setError("This onboarding link has expired");
        } else {
          setStatus("invalid");
          setError(errorBody?.error || "Invalid onboarding link");
        }
        return;
      }

      if (data?.valid) {
        setTokenData(data);
        setStatus("valid");
      } else {
        setStatus("invalid");
        setError(data?.error || "Invalid token");
      }
    } catch (err) {
      console.error("Token validation error:", err);
      setStatus("error");
      setError("Failed to validate onboarding link");
    }
  }, [token]);

  const createAccount = useCallback(
    async (password: string, fullName: string, agencyName?: string, timezone?: string) => {
      if (!token) throw new Error("No token");
      setIsSubmitting(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "self-signup-onboarding",
          {
            body: {
              token,
              password,
              full_name: fullName,
              agency_name: agencyName,
              timezone,
            },
          }
        );

        if (fnError) {
          const errorBody = fnError.context?.json ? await fnError.context.json().catch(() => null) : null;
          throw new Error(errorBody?.error || fnError.message || "Account creation failed");
        }

        if (!data?.success) {
          throw new Error(data?.error || "Account creation failed");
        }

        setAgencyId(data.agency_id);

        // Set session if returned (immediate sign-in)
        if (data.session?.access_token) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }

        setStep(1);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Account creation failed";
        setError(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [token]
  );

  const saveAgencyDetails = useCallback(
    async (agencyName: string, timezone: string, phone?: string) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "complete-onboarding-step",
          {
            body: {
              step: "agency_details",
              data: { agency_name: agencyName, timezone, phone },
            },
          }
        );

        if (fnError) {
          const errorBody = fnError.context?.json ? await fnError.context.json().catch(() => null) : null;
          throw new Error(errorBody?.error || "Failed to save agency details");
        }

        advancePast("agency_details");
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save agency details";
        setError(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [advancePast]
  );

  const saveSalesManager = useCallback(
    async (managerData: SalesManagerData) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "complete-onboarding-step",
          {
            body: {
              step: "sales_manager",
              data: managerData,
            },
          }
        );

        if (fnError) {
          const errorBody = fnError.context?.json ? await fnError.context.json().catch(() => null) : null;
          throw new Error(errorBody?.error || "Failed to save sales manager");
        }

        if (data?.manager_team_member_id) {
          setManagerTeamMemberId(data.manager_team_member_id);
          setManagerPhone(managerData.manager?.phone || null);
          setSalesManagerResult({
            name: managerData.manager!.name,
            email: managerData.manager!.email,
            invite_url: data.invite_url,
            manager_team_member_id: data.manager_team_member_id,
          });
        } else {
          // Owner on calls — no delegate, advance immediately
          advancePast("sales_manager");
        }

        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save sales manager";
        setError(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [advancePast]
  );

  const addTeamMembers = useCallback(
    async (members: Array<{ name: string; email: string; role: string }>) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "complete-onboarding-step",
          {
            body: {
              step: "add_team_members",
              data: { members },
            },
          }
        );

        if (fnError) {
          const errorBody = fnError.context?.json ? await fnError.context.json().catch(() => null) : null;
          throw new Error(errorBody?.error || "Failed to add team members");
        }

        if (data?.members) {
          setTeamMembers(data.members);
        }

        // Don't advance here — the results screen has a "Continue" button
        // that calls onSkip which advances past add_team
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add team members";
        setError(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const saveWhatToExpect = useCallback(
    async (data: { startDate: string }) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const { data: result, error: fnError } = await supabase.functions.invoke(
          "complete-onboarding-step",
          {
            body: {
              step: "what_to_expect",
              data: {
                start_date: data.startDate,
                manager_team_member_id: managerTeamMemberId,
              },
            },
          }
        );

        if (fnError) {
          const errorBody = fnError.context?.json ? await fnError.context.json().catch(() => null) : null;
          throw new Error(errorBody?.error || "Failed to save start date");
        }

        advancePast("what_to_expect");
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save start date";
        setError(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [advancePast, managerTeamMemberId]
  );

  const saveQuestionnaire = useCallback(
    async (answers: QuestionnaireAnswers) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "complete-onboarding-step",
          {
            body: {
              step: "questionnaire",
              data: { ...answers, manager_phone: managerPhone },
            },
          }
        );

        if (fnError) {
          const errorBody = fnError.context?.json ? await fnError.context.json().catch(() => null) : null;
          throw new Error(errorBody?.error || "Failed to save questionnaire");
        }

        advancePast("questionnaire");
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save questionnaire";
        setError(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [advancePast, managerPhone]
  );

  const completeOnboarding = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await supabase.functions.invoke("complete-onboarding-step", {
        body: {
          step: "complete",
          data: { tier: tokenData?.tier },
        },
      });
      // Stay on complete step — user navigates away via buttons
    } catch (err) {
      console.error("Complete onboarding error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [tokenData?.tier]);

  return {
    status,
    tokenData,
    error,
    step,
    setStep,
    isSubmitting,
    agencyId,
    teamMembers,
    salesManagerResult,
    validateToken,
    createAccount,
    saveAgencyDetails,
    saveSalesManager,
    addTeamMembers,
    saveWhatToExpect,
    saveQuestionnaire,
    completeOnboarding,
  };
}
