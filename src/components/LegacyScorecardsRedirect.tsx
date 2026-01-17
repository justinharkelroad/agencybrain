import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { hasStaffToken } from "@/lib/staffRequest";

/**
 * Redirects legacy /scorecards/submissions URL to the correct modern route.
 * Staff users go to /staff/metrics?tab=submissions, others to /metrics?tab=submissions.
 */
export const LegacyScorecardsSubmissionsRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const isStaffUser = hasStaffToken();
    navigate(isStaffUser ? '/staff/metrics?tab=submissions' : '/metrics?tab=submissions', { replace: true });
  }, [navigate]);
  
  return null;
};
