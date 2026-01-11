import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const STAN_LOGO_URL = "https://wjqyccbytctqwceuhzhk.supabase.co/storage/v1/object/public/file-uploads/Agency%20Brain%20Logo%20Stan.png";

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
      <img
        src={STAN_LOGO_URL}
        alt="AgencyBrain logo"
        className={cn("w-auto object-contain", imageHeight)}
      />
    </Comp>
  );
}
