import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, Plus, Dumbbell, Heart, Briefcase } from "lucide-react";
import { LatinCross } from "@/components/icons/LatinCross";
import { cn } from "@/lib/utils";
import type { FocusItem, PlaybookDomain } from "@/hooks/useFocusItems";
import type { StaffFocusItem } from "@/hooks/useStaffFocusItems";

type AnyFocusItem = FocusItem | StaffFocusItem;

const domainFilters: { key: PlaybookDomain | "all"; label: string; icon?: React.ElementType; color?: string }[] = [
  { key: "all", label: "All" },
  { key: "body", label: "Body", icon: Dumbbell, color: "text-emerald-600" },
  { key: "being", label: "Being", icon: LatinCross, color: "text-purple-600" },
  { key: "balance", label: "Balance", icon: Heart, color: "text-rose-600" },
  { key: "business", label: "Biz", icon: Briefcase, color: "text-blue-600" },
];

interface PlaybookBenchPanelProps {
  items: AnyFocusItem[];
  onSchedule: (id: string) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
}

export function PlaybookBenchPanel({
  items,
  onSchedule,
  onDelete,
  onCreateNew,
}: PlaybookBenchPanelProps) {
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<PlaybookDomain | "all">("all");

  const filtered = items.filter((item) => {
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (domainFilter !== "all" && item.domain !== domainFilter) return false;
    return true;
  });

  const uncompletedItems = filtered.filter((i) => !i.completed);
  const completedItems = filtered.filter((i) => i.completed);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">The Bench</h3>
        <Button variant="ghost" size="sm" onClick={onCreateNew} className="h-7 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" />
          New
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter bench..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Domain filter chips */}
      <div className="flex gap-1 flex-wrap">
        {domainFilters.map((df) => (
          <button
            key={df.key}
            onClick={() => setDomainFilter(df.key)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              domainFilter === df.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {df.icon && <df.icon className={cn("h-3 w-3", domainFilter !== df.key && df.color)} />}
            {df.label}
          </button>
        ))}
      </div>

      {/* Bench items */}
      <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
        {uncompletedItems.length === 0 && completedItems.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {search || domainFilter !== "all" ? "No matching items" : "Your bench is empty"}
          </p>
        ) : (
          <>
            {uncompletedItems.map((item) => (
              <BenchItem key={item.id} item={item} onSchedule={onSchedule} onDelete={onDelete} />
            ))}
            {completedItems.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                  Completed ({completedItems.length})
                </p>
                {completedItems.slice(0, 5).map((item) => (
                  <BenchItem key={item.id} item={item} onSchedule={onSchedule} onDelete={onDelete} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BenchItem({
  item,
  onSchedule,
  onDelete,
}: {
  item: AnyFocusItem;
  onSchedule: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const domainColors: Record<string, string> = {
    body: "bg-emerald-500",
    being: "bg-purple-500",
    balance: "bg-rose-500",
    business: "bg-blue-500",
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-all",
        item.completed ? "bg-muted/30 border-border/50" : "bg-card border-border hover:shadow-sm"
      )}
    >
      {item.domain && (
        <div className={cn("h-2 w-2 rounded-full shrink-0", domainColors[item.domain])} />
      )}
      <span
        className={cn(
          "flex-1 truncate text-xs",
          item.completed && "line-through text-muted-foreground"
        )}
      >
        {item.title}
      </span>
      {!item.completed && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onSchedule(item.id)}
        >
          <Calendar className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
