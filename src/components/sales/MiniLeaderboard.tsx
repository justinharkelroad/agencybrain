import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LeaderboardEntry, RankMetric } from "@/hooks/useSalesLeaderboard";

interface MiniLeaderboardProps {
  entries: LeaderboardEntry[];
  currentTeamMemberId?: string | null;
  metric?: RankMetric;
  maxEntries?: number;
  showCurrentUserIfNotInTop?: boolean;
  className?: string;
}

const medalEmojis: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

function formatMetricValue(value: number, metric: RankMetric): string {
  if (metric === "premium") {
    if (value >= 1000) {
      return `$${Math.round(value / 1000)}k`;
    }
    return `$${value.toLocaleString()}`;
  }
  return value.toLocaleString();
}

function getMetricLabel(metric: RankMetric): string {
  switch (metric) {
    case "premium":
      return "premium";
    case "items":
      return "items";
    case "points":
      return "pts";
    case "policies":
      return "policies";
    case "households":
      return "HH";
    default:
      return "";
  }
}

function getMetricValue(entry: LeaderboardEntry, metric: RankMetric): number {
  switch (metric) {
    case "premium":
      return entry.premium;
    case "items":
      return entry.items;
    case "points":
      return entry.points;
    case "policies":
      return entry.policies;
    case "households":
      return entry.households;
    default:
      return entry.items;
  }
}

export function MiniLeaderboard({
  entries,
  currentTeamMemberId,
  metric = "items",
  maxEntries = 4,
  showCurrentUserIfNotInTop = true,
  className,
}: MiniLeaderboardProps) {
  if (!entries || entries.length === 0) {
    return (
      <div className={cn("text-center text-muted-foreground text-sm py-4", className)}>
        No sales data yet
      </div>
    );
  }

  // Get display entries
  let displayEntries = entries.slice(0, maxEntries);
  const currentUserInTop = displayEntries.some(
    (e) => e.team_member_id === currentTeamMemberId
  );

  // If current user isn't in top entries, add them at the end
  if (showCurrentUserIfNotInTop && currentTeamMemberId && !currentUserInTop) {
    const currentUserEntry = entries.find(
      (e) => e.team_member_id === currentTeamMemberId
    );
    if (currentUserEntry) {
      displayEntries = [...displayEntries.slice(0, maxEntries - 1), currentUserEntry];
    }
  }

  // Split into two columns for display
  const midpoint = Math.ceil(displayEntries.length / 2);
  const leftColumn = displayEntries.slice(0, midpoint);
  const rightColumn = displayEntries.slice(midpoint);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Top Producers
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {/* Left column */}
        <div className="space-y-1">
          {leftColumn.map((entry, index) => (
            <LeaderboardRow
              key={entry.team_member_id}
              entry={entry}
              metric={metric}
              isCurrentUser={entry.team_member_id === currentTeamMemberId}
              animationDelay={index * 0.05}
            />
          ))}
        </div>
        {/* Right column */}
        <div className="space-y-1">
          {rightColumn.map((entry, index) => (
            <LeaderboardRow
              key={entry.team_member_id}
              entry={entry}
              metric={metric}
              isCurrentUser={entry.team_member_id === currentTeamMemberId}
              animationDelay={(midpoint + index) * 0.05}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  metric: RankMetric;
  isCurrentUser: boolean;
  animationDelay?: number;
}

function LeaderboardRow({
  entry,
  metric,
  isCurrentUser,
  animationDelay = 0,
}: LeaderboardRowProps) {
  const rank = entry.rank || 0;
  const medal = medalEmojis[rank];
  const value = getMetricValue(entry, metric);

  // Truncate name
  const displayName = entry.name.length > 12
    ? entry.name.slice(0, 10) + "..."
    : entry.name;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: animationDelay, duration: 0.2 }}
      className={cn(
        "flex items-center justify-between text-sm py-0.5 px-1.5 rounded",
        isCurrentUser && "bg-primary/10 border border-primary/30"
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {medal ? (
          <span className="text-base w-5 text-center">{medal}</span>
        ) : (
          <span className="text-xs text-muted-foreground w-5 text-center font-medium">
            {rank}.
          </span>
        )}
        <span
          className={cn(
            "truncate",
            isCurrentUser ? "font-semibold text-foreground" : "text-foreground/80"
          )}
        >
          {isCurrentUser ? "You" : displayName}
        </span>
        {isCurrentUser && (
          <span className="text-[10px] text-primary font-medium">←</span>
        )}
      </div>
      <div className={cn(
        "text-xs font-medium whitespace-nowrap ml-2",
        isCurrentUser ? "text-primary" : "text-muted-foreground"
      )}>
        {formatMetricValue(value, metric)} {getMetricLabel(metric)}
      </div>
    </motion.div>
  );
}

// Vertical variant for mobile
export function MiniLeaderboardVertical({
  entries,
  currentTeamMemberId,
  metric = "items",
  maxEntries = 4,
  className,
}: MiniLeaderboardProps) {
  if (!entries || entries.length === 0) {
    return (
      <div className={cn("text-center text-muted-foreground text-sm py-4", className)}>
        No sales data yet
      </div>
    );
  }

  const displayEntries = entries.slice(0, maxEntries);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Agency Leaderboard
      </div>
      <div className="space-y-1">
        {displayEntries.map((entry, index) => (
          <LeaderboardRow
            key={entry.team_member_id}
            entry={entry}
            metric={metric}
            isCurrentUser={entry.team_member_id === currentTeamMemberId}
            animationDelay={index * 0.05}
          />
        ))}
      </div>
    </div>
  );
}
