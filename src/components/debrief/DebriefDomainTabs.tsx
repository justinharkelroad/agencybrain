import { cn } from "@/lib/utils";
import { Heart, Brain, Scale, Briefcase } from "lucide-react";

const DOMAINS = [
  { key: "body", label: "Body", icon: Heart, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { key: "being", label: "Being", icon: Brain, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { key: "balance", label: "Balance", icon: Scale, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { key: "business", label: "Business", icon: Briefcase, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
] as const;

interface DebriefDomainTabsProps {
  activeDomain: string;
  onDomainChange: (domain: string) => void;
  completedDomains?: string[];
}

export function DebriefDomainTabs({ activeDomain, onDomainChange, completedDomains = [] }: DebriefDomainTabsProps) {
  return (
    <div className="flex gap-2">
      {DOMAINS.map(({ key, label, icon: Icon, color }) => {
        const isActive = activeDomain === key;
        const isCompleted = completedDomains.includes(key);

        return (
          <button
            key={key}
            onClick={() => onDomainChange(key)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all",
              isActive
                ? color + " border-current"
                : "bg-foreground/5 text-muted-foreground border-border hover:bg-foreground/10"
            )}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {isCompleted && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
              )}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
