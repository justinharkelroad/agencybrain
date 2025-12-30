import { Navigate } from "react-router-dom";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { getStaffHomePath } from "@/utils/tierAccess";
import { Loader2 } from "lucide-react";

/**
 * Smart redirect for /staff index route
 * Waits for auth to load, then redirects based on user's tier
 */
export function StaffIndexRedirect() {
  const { user, loading } = useStaffAuth();

  // Wait for auth to finish loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Redirect to the appropriate home path based on tier
  return <Navigate to={getStaffHomePath(user?.agency_membership_tier)} replace />;
}
