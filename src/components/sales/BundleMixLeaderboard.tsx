import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useBundleMixLeaderboard, BundleMixEntry } from "@/hooks/useBundleMixLeaderboard";
import { DrillDownTable } from "./DrillDownTable";
import { Badge } from "@/components/ui/badge";

type SortKey = "preferredPct" | "standardPct" | "monolinePct" | "totalHouseholds";

interface BundleMixLeaderboardProps {
  agencyId: string | null;
  startDate: string;
  endDate: string;
  businessFilter?: string;
  staffSessionToken?: string;
  currentTeamMemberId?: string | null;
  canEditAllSales?: boolean;
  leadSources?: { id: string; name: string }[];
}

const BUNDLE_FILTER_OPTIONS = ["All", "Preferred", "Standard", "Monoline"] as const;

export function BundleMixLeaderboard({
  agencyId,
  startDate,
  endDate,
  businessFilter = "all",
  staffSessionToken,
  currentTeamMemberId,
  canEditAllSales,
  leadSources = [],
}: BundleMixLeaderboardProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sortKey, setSortKey] = useState<SortKey>("preferredPct");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [bundleFilter, setBundleFilter] = useState<string>("All");
  const [drillPage, setDrillPage] = useState(1);

  const { data: entries, isLoading } = useBundleMixLeaderboard({
    agencyId,
    startDate,
    endDate,
    businessFilter,
    staffSessionToken,
    currentTeamMemberId,
  });

  const sorted = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort((a, b) => {
      const diff = sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey];
      if (diff !== 0) return diff;
      return b.totalHouseholds - a.totalHouseholds;
    });
  }, [entries, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const handleRowClick = (teamMemberId: string) => {
    if (expandedMemberId === teamMemberId) {
      setExpandedMemberId(null);
    } else {
      setExpandedMemberId(teamMemberId);
      setBundleFilter("All");
      setDrillPage(1);
    }
  };

  const getDrillDownFilter = () => {
    if (bundleFilter === "All") {
      return { type: "bundle_type" as const, value: "__all__", displayLabel: "All Bundles" };
    }
    return { type: "bundle_type" as const, value: bundleFilter, displayLabel: bundleFilter };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg mb-2">No producers found</p>
        <p className="text-sm">Start making sales to see bundle mix data!</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <MobileView
        entries={sorted}
        currentTeamMemberId={currentTeamMemberId}
        expandedMemberId={expandedMemberId}
        onRowClick={handleRowClick}
        bundleFilter={bundleFilter}
        onBundleFilterChange={setBundleFilter}
        drillPage={drillPage}
        onDrillPageChange={setDrillPage}
        agencyId={agencyId}
        startDate={startDate}
        endDate={endDate}
        staffSessionToken={staffSessionToken}
        canEditAllSales={canEditAllSales}
        leadSources={leadSources}
        getDrillDownFilter={getDrillDownFilter}
      />
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {/* Header */}
      <div className="flex gap-2 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <div className="w-10 shrink-0">#</div>
        <div className="flex-1 min-w-0">Name</div>
        <SortableHeader
          label="HH"
          sortKey="totalHouseholds"
          currentSortKey={sortKey}
          sortAsc={sortAsc}
          onClick={handleSort}
          width="w-14"
        />
        <SortableHeader
          label="Preferred"
          sortKey="preferredPct"
          currentSortKey={sortKey}
          sortAsc={sortAsc}
          onClick={handleSort}
          width="w-28"
        />
        <SortableHeader
          label="Standard"
          sortKey="standardPct"
          currentSortKey={sortKey}
          sortAsc={sortAsc}
          onClick={handleSort}
          width="w-28"
        />
        <SortableHeader
          label="Monoline"
          sortKey="monolinePct"
          currentSortKey={sortKey}
          sortAsc={sortAsc}
          onClick={handleSort}
          width="w-28"
        />
      </div>

      {/* Rows */}
      {sorted.map((entry, index) => {
        const isExpanded = expandedMemberId === entry.team_member_id;
        const isCurrentUser = entry.team_member_id === currentTeamMemberId;

        return (
          <div key={entry.team_member_id}>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.2 + index * 0.04,
                ease: [0.4, 0, 0.2, 1],
              }}
              onClick={() => handleRowClick(entry.team_member_id)}
              className={cn(
                "flex gap-2 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer",
                "hover:translate-x-1 hover:shadow-md",
                "bg-card/50 backdrop-blur-sm border border-border/50",
                index % 2 === 0 ? "bg-muted/5" : "bg-transparent",
                isCurrentUser && "border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.15)]",
                isExpanded && "border-primary/30 shadow-md"
              )}
            >
              {/* Rank */}
              <div className="w-10 shrink-0 flex items-center">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold",
                    "bg-muted text-muted-foreground",
                    isCurrentUser && "bg-primary/20 text-primary"
                  )}
                >
                  {index + 1}
                </div>
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0 flex items-center">
                <span className={cn("font-medium truncate", isCurrentUser && "text-primary")}>
                  {entry.name}
                </span>
                {isCurrentUser && (
                  <span className="ml-2 text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0">
                    YOU
                  </span>
                )}
                <span className="ml-2 text-muted-foreground">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </div>

              {/* Households */}
              <div className="w-14 shrink-0 flex items-center justify-end text-sm font-medium">
                {entry.totalHouseholds}
              </div>

              {/* Preferred */}
              <div className="w-28 shrink-0 flex items-center justify-end gap-1.5">
                <PercentBar pct={entry.preferredPct} color="bg-green-500" />
                <span className="text-sm w-16 text-right">
                  <span className="font-semibold">{entry.preferredPct}%</span>
                  <span className="text-muted-foreground text-xs ml-0.5">({entry.preferred})</span>
                </span>
              </div>

              {/* Standard */}
              <div className="w-28 shrink-0 flex items-center justify-end gap-1.5">
                <PercentBar pct={entry.standardPct} color="bg-blue-500" />
                <span className="text-sm w-16 text-right">
                  <span className="font-semibold">{entry.standardPct}%</span>
                  <span className="text-muted-foreground text-xs ml-0.5">({entry.standard})</span>
                </span>
              </div>

              {/* Monoline */}
              <div className="w-28 shrink-0 flex items-center justify-end gap-1.5">
                <PercentBar pct={entry.monolinePct} color="bg-amber-500" />
                <span className="text-sm w-16 text-right">
                  <span className="font-semibold">{entry.monolinePct}%</span>
                  <span className="text-muted-foreground text-xs ml-0.5">({entry.monoline})</span>
                </span>
              </div>
            </motion.div>

            {/* Drill-down */}
            <AnimatePresence>
              {isExpanded && agencyId && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pl-12 pr-4 pb-4">
                    {/* Bundle filter chips */}
                    <div className="flex gap-2 mt-3 mb-1">
                      {BUNDLE_FILTER_OPTIONS.map((opt) => (
                        <Badge
                          key={opt}
                          variant={bundleFilter === opt ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBundleFilter(opt);
                            setDrillPage(1);
                          }}
                        >
                          {opt}
                        </Badge>
                      ))}
                    </div>

                    <DrillDownTable
                      filter={getDrillDownFilter()}
                      agencyId={agencyId}
                      startDate={startDate}
                      endDate={endDate}
                      page={drillPage}
                      pageSize={10}
                      onPageChange={setDrillPage}
                      onClear={() => setExpandedMemberId(null)}
                      staffSessionToken={staffSessionToken}
                      canEditAllSales={canEditAllSales}
                      currentTeamMemberId={currentTeamMemberId || undefined}
                      leadSources={leadSources}
                      teamMemberId={entry.team_member_id}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  sortAsc,
  onClick,
  width,
}: {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  sortAsc: boolean;
  onClick: (key: SortKey) => void;
  width: string;
}) {
  const isActive = currentSortKey === sortKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={cn(
        width,
        "shrink-0 text-right flex items-center justify-end gap-0.5 hover:text-foreground transition-colors",
        isActive && "text-foreground font-bold"
      )}
    >
      {label}
      {isActive ? (
        sortAsc ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function PercentBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-12 h-2 rounded-full bg-muted overflow-hidden hidden lg:block">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// Mobile card layout
function MobileView({
  entries,
  currentTeamMemberId,
  expandedMemberId,
  onRowClick,
  bundleFilter,
  onBundleFilterChange,
  drillPage,
  onDrillPageChange,
  agencyId,
  startDate,
  endDate,
  staffSessionToken,
  canEditAllSales,
  leadSources,
  getDrillDownFilter,
}: {
  entries: BundleMixEntry[];
  currentTeamMemberId?: string | null;
  expandedMemberId: string | null;
  onRowClick: (id: string) => void;
  bundleFilter: string;
  onBundleFilterChange: (v: string) => void;
  drillPage: number;
  onDrillPageChange: (p: number) => void;
  agencyId: string | null;
  startDate: string;
  endDate: string;
  staffSessionToken?: string;
  canEditAllSales?: boolean;
  leadSources?: { id: string; name: string }[];
  getDrillDownFilter: () => { type: "bundle_type"; value: string; displayLabel: string };
}) {
  return (
    <div className="space-y-3 mt-2">
      {entries.map((entry, index) => {
        const isCurrentUser = entry.team_member_id === currentTeamMemberId;
        const isExpanded = expandedMemberId === entry.team_member_id;

        return (
          <div key={entry.team_member_id}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + index * 0.04 }}
              onClick={() => onRowClick(entry.team_member_id)}
              className={cn(
                "p-4 rounded-xl transition-all duration-200 cursor-pointer",
                "bg-card/50 backdrop-blur-sm border border-border/50",
                isCurrentUser && "border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.15)]",
                isExpanded && "border-primary/30 shadow-md"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                      "bg-muted text-muted-foreground",
                      isCurrentUser && "bg-primary/20 text-primary"
                    )}
                  >
                    #{index + 1}
                  </div>
                  <span className={cn("font-semibold", isCurrentUser && "text-primary")}>
                    {entry.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isCurrentUser && (
                    <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      YOU
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{entry.totalHouseholds} HH</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              <div className="space-y-2">
                <MobileBar label="Preferred" pct={entry.preferredPct} count={entry.preferred} color="bg-green-500" />
                <MobileBar label="Standard" pct={entry.standardPct} count={entry.standard} color="bg-blue-500" />
                <MobileBar label="Monoline" pct={entry.monolinePct} count={entry.monoline} color="bg-amber-500" />
              </div>
            </motion.div>

            <AnimatePresence>
              {isExpanded && agencyId && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-2 pb-4">
                    <div className="flex gap-2 mt-3 mb-1 flex-wrap">
                      {BUNDLE_FILTER_OPTIONS.map((opt) => (
                        <Badge
                          key={opt}
                          variant={bundleFilter === opt ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBundleFilterChange(opt);
                            onDrillPageChange(1);
                          }}
                        >
                          {opt}
                        </Badge>
                      ))}
                    </div>

                    <DrillDownTable
                      filter={getDrillDownFilter()}
                      agencyId={agencyId}
                      startDate={startDate}
                      endDate={endDate}
                      page={drillPage}
                      pageSize={10}
                      onPageChange={onDrillPageChange}
                      onClear={() => onRowClick(entry.team_member_id)}
                      staffSessionToken={staffSessionToken}
                      canEditAllSales={canEditAllSales}
                      currentTeamMemberId={currentTeamMemberId || undefined}
                      leadSources={leadSources}
                      teamMemberId={entry.team_member_id}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function MobileBar({ label, pct, count, color }: { label: string; pct: number; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium w-16 text-right shrink-0">
        {pct}% ({count})
      </span>
    </div>
  );
}
