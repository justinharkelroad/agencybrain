import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import lightModeLogo from "@/assets/agencybrain-landing-logo.png";

// Dark mode logo (white text)
const DARK_LOGO_URL = "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/AgencyBrain%20Logo/Agency%20Brain%20Logo%20Stan.png";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
  asLink?: boolean;
  to?: string;
};

export function AgencyBrainBadge({ size = "md", className, asLink = false, to = "/dashboard" }: Props) {
  const imageHeight = {
    sm: "max-h-8",
    md: "max-h-10",
    lg: "max-h-14",
  }[size];

  const Comp: any = asLink ? Link : "div";

  return (
    <Comp
      to={asLink ? to : undefined}
      aria-label="Agency Brain"
      className={cn(
        "inline-flex items-center justify-center",
        className
      )}
    >
      {/* Light mode logo (black text) - hidden in dark mode */}
      <img
        src={lightModeLogo}
        alt="AgencyBrain logo"
        className={cn("w-auto object-contain dark:hidden", imageHeight)}
      />
      {/* Dark mode logo (white text) - hidden in light mode */}
      <img
        src={DARK_LOGO_URL}
        alt="AgencyBrain logo"
        className={cn("w-auto object-contain hidden dark:block", imageHeight)}
      />
    </Comp>
  );
}
