import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, LogIn } from "lucide-react";

export default function AcceptKeyEmployeeInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "validating" | "accepting" | "success" | "error" | "login_required">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [agencyName, setAgencyName] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    document.title = "Accept Invitation | AgencyBrain";
  }, []);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid invitation link. No token provided.");
      return;
    }

    // If user is not logged in, show login prompt
    if (!user) {
      setStatus("login_required");
      return;
    }

    // User is logged in, try to accept the invite
    acceptInvite();
  }, [authLoading, user, token]);

  const acceptInvite = async () => {
    if (!token || !user) return;

    setStatus("accepting");

    try {
      const { data, error } = await supabase.functions.invoke("accept_key_employee_invite", {
        body: { token },
      });

      if (error) {
        const errorData = await error.context?.json?.() || {};
        throw new Error(errorData.error || error.message || "Failed to accept invitation");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setAgencyName(data.agency_name || "the agency");
      setStatus("success");
      toast.success(data.message || "You are now a key employee!");

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error: any) {
      console.error("Accept invite error:", error);
      setStatus("error");
      setErrorMessage(error.message || "Failed to accept invitation");
    }
  };

  // Loading state
  if (status === "loading" || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Login required
  if (status === "login_required") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <LogIn className="h-6 w-6" />
              Login Required
            </CardTitle>
            <CardDescription>
              Please log in or create an account to accept this invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              You've been invited to join an agency as a Key Employee. To accept this invitation, you need to be logged in to your AgencyBrain account.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link to={`/auth?redirect=${encodeURIComponent(`/accept-key-employee-invite?token=${token}`)}`}>
                  Log In or Sign Up
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Accepting state
  if (status === "accepting" || status === "validating") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Accepting invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle>Welcome to {agencyName}!</CardTitle>
            <CardDescription>
              You are now a Key Employee with full access to the agency dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Redirecting to dashboard...
            </p>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle>Invitation Error</CardTitle>
          <CardDescription>
            {errorMessage || "Something went wrong with this invitation."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            This could happen if the invitation has expired, already been used, or is invalid. Please contact the agency owner for a new invitation.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full">
              Go to Dashboard
            </Button>
            <Button onClick={() => navigate("/")} variant="ghost" className="w-full">
              Go to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
