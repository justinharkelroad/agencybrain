import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

type SmartBackButtonProps = {
  className?: string;
};

/**
 * Smart back button that navigates to:
 * - /dashboard if user is authenticated
 * - /auth if user is not authenticated
 */
export function SmartBackButton({ className }: SmartBackButtonProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBack = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/auth");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={className}
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back to {user ? "Dashboard" : "Login"}
    </Button>
  );
}
