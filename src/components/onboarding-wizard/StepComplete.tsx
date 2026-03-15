import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Users,
  LayoutDashboard,
  Phone,
} from "lucide-react";
import confetti from "canvas-confetti";

interface StepCompleteProps {
  onComplete: () => void;
}

export function StepComplete({ onComplete }: StepCompleteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    // Fire confetti on mount
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#34d399", "#60a5fa", "#fbbf24", "#f472b6"],
    });

    // Mark onboarding complete
    onComplete();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const quickLinks = [
    {
      icon: Users,
      label: "Invite your team to the staff portal",
      href: "/agency",
    },
    {
      icon: LayoutDashboard,
      label: "Explore your dashboard",
      href: "/dashboard",
    },
    {
      icon: Phone,
      label: "Set up AI Call Scoring",
      href: "/call-scoring",
    },
  ];

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-center">
      <div className="mb-6">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">You're All Set!</h1>
        <p className="text-muted-foreground">
          Your AgencyBrain account is ready. Here are some things to do next:
        </p>
      </div>

      <div className="space-y-3 mb-8 text-left">
        {quickLinks.map((link) => (
          <button
            key={link.href}
            onClick={() => navigate(link.href)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
          >
            <link.icon className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{link.label}</span>
          </button>
        ))}
      </div>

      <Button
        onClick={() => navigate("/dashboard")}
        className="w-full"
        size="lg"
      >
        Go to Dashboard
      </Button>
    </div>
  );
}
