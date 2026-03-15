import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

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
        // Check error context for specific status codes
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

        setStep(2);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save agency details";
        setError(msg);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
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

        setStep(3);
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

  const completeOnboarding = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await supabase.functions.invoke("complete-onboarding-step", {
        body: { step: "complete", data: {} },
      });
      // Stay on step 3 (StepComplete) — user navigates away via buttons
    } catch (err) {
      console.error("Complete onboarding error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    status,
    tokenData,
    error,
    step,
    setStep,
    isSubmitting,
    agencyId,
    teamMembers,
    validateToken,
    createAccount,
    saveAgencyDetails,
    addTeamMembers,
    completeOnboarding,
  };
}
