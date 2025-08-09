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

  const Comp: any = asLink ? Link : "div";

  return (
    <Comp
      to={asLink ? to : undefined}
      aria-label="Agency Brain"
      className={cn(
        "inline-flex items-center gap-1 rounded-full glass-surface elevate hover:scale-105 active:scale-95 select-none",
        "border border-border/60 shadow-elegant",
        sizeClasses,
        className
      )}
    >
      <span className="font-semibold tracking-wide text-foreground/90">Agency</span>
      <span className="font-semibold tracking-wide text-foreground/90">Br</span>
      <span role="img" aria-label="brain" className="mx-0.5">🧠</span>
      <span className="font-semibold tracking-wide text-foreground/90">in</span>
    </Comp>
  );
}
