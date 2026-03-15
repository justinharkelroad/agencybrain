import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnboardingWizard } from "@/components/onboarding-wizard/OnboardingWizard";
import { useOnboardingWizard } from "@/hooks/useOnboardingWizard";

export default function Onboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const {
    status,
    tokenData,
    error,
    step,
    setStep,
    isSubmitting,
    teamMembers,
    validateToken,
    createAccount,
    saveAgencyDetails,
    addTeamMembers,
    completeOnboarding,
  } = useOnboardingWizard(token);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  // Loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying your onboarding link...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (status === "invalid" || status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-destructive/5">
        <Card className="max-w-md text-center">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invalid Onboarding Link</CardTitle>
            <CardDescription className="text-base">
              {error || "This onboarding link is not valid."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Please contact your administrator for a new onboarding link.
            </p>
            <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
        <Card className="max-w-md text-center">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Link Expired</CardTitle>
            <CardDescription className="text-base">
              This onboarding link has expired. Please contact your administrator for a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "used") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="max-w-md text-center">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Already Onboarded</CardTitle>
            <CardDescription className="text-base">
              This onboarding link has already been used. You can sign in to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid token — show wizard
  if (!tokenData) return null;

  return (
    <OnboardingWizard
      step={step}
      setStep={setStep}
      tokenData={tokenData}
      isSubmitting={isSubmitting}
      error={error}
      teamMembers={teamMembers}
      onCreateAccount={(password, fullName) => createAccount(password, fullName)}
      onSaveAgencyDetails={saveAgencyDetails}
      onAddTeamMembers={addTeamMembers}
      onCompleteOnboarding={completeOnboarding}
    />
  );
}
