import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { User, Users } from "lucide-react";

export type ViewMode = "personal" | "agency";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center p-1 rounded-lg bg-muted/50 border border-border/50",
        className
      )}
    >
      <ToggleButton
        active={value === "personal"}
        onClick={() => onChange("personal")}
        icon={User}
        label="My View"
      />
      <ToggleButton
        active={value === "agency"}
        onClick={() => onChange("agency")}
        icon={Users}
        label="Agency View"
      />
    </div>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  icon: typeof User;
  label: string;
}

function ToggleButton({ active, onClick, icon: Icon, label }: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium",
        "transition-colors duration-200",
        active
          ? "text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {active && (
        <motion.div
          layoutId="viewToggleActive"
          className="absolute inset-0 bg-primary rounded-md"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <Icon className={cn("h-4 w-4 relative z-10")} />
      <span className="relative z-10">{label}</span>
    </button>
  );
}

// Compact version for mobile
export function ViewToggleCompact({
  value,
  onChange,
  className,
}: ViewToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center p-0.5 rounded-md bg-muted/50 border border-border/50",
        className
      )}
    >
      <button
        onClick={() => onChange("personal")}
        className={cn(
          "p-1.5 rounded",
          "transition-colors duration-200",
          value === "personal"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="My View"
      >
        <User className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange("agency")}
        className={cn(
          "p-1.5 rounded",
          "transition-colors duration-200",
          value === "agency"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        title="Agency View"
      >
        <Users className="h-4 w-4" />
      </button>
    </div>
  );
}
