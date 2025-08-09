import * as React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type EnvStatus = "safe" | "unstable" | "unknown";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  status: EnvStatus;
  note?: string;
  updatedAt?: string;
  source?: "override" | "computed";
  compact?: boolean;
  linkTo?: string;
  className?: string;
}

const labelMap: Record<EnvStatus, string> = {
  safe: "Safe & Stable",
  unstable: "Unstable",
  unknown: "Unknown",
};

function variantFor(status: EnvStatus): "default" | "destructive" | "outline" {
  switch (status) {
    case "safe":
      return "default"; // uses primary semantic token
    case "unstable":
      return "destructive";
    default:
      return "outline";
  }
}

function DotAndLabel({ status, compact }: { status: EnvStatus; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center", compact ? "text-xs" : "text-sm")}
      aria-live="polite"
    >
      <span aria-hidden className="mr-2 inline-block h-2 w-2 rounded-full bg-current" />
      <span>{labelMap[status]}</span>
    </span>
  );
}

export default function EnvironmentStatusBadge({
  status,
  note,
  updatedAt,
  source,
  compact,
  linkTo,
  className,
  ...rest
}: Props) {
  const badge = (
    <Badge
      variant={variantFor(status)}
      className={cn(compact ? "px-2 py-0.5" : "px-2.5 py-0.5", className)}
    >
      <DotAndLabel status={status} compact={compact} />
    </Badge>
  );

  const content = linkTo ? (
    <Link to={linkTo} aria-label="View environment health">{badge}</Link>
  ) : (
    badge
  );

  const hasExtra = Boolean(note || updatedAt || source === "override");

  if (!hasExtra) return <div {...rest}>{content}</div>;

  return (
    <div {...rest}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <div>Status source: {source || "computed"}</div>
            {note && <div className="mt-1">Note: {note}</div>}
            {updatedAt && (
              <div className="mt-1">Updated: {new Date(updatedAt).toLocaleString()}</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
