import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
  asLink?: boolean;
  to?: string;
};

export function AgencyBrainBadge({ size = "md", className, asLink = false, to = "/dashboard" }: Props) {
  const sizeClasses = {
    sm: "text-sm px-3 py-1",
    md: "text-base px-4 py-1.5",
    lg: "text-lg px-5 py-2",
  }[size];

  const imageHeight = {
    sm: "h-6",
    md: "h-7",
    lg: "h-10",
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
        src="/lovable-uploads/agencybrain-logo.png"
        alt="AgencyBrain logo"
        className="w-full h-auto max-h-12 object-contain"
      />
    </Comp>
  );
}
