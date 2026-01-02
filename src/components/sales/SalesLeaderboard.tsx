import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

type RankMetric = "premium" | "items" | "points";
type Period = "this_month" | "last_month" | "this_quarter" | "ytd";

interface LeaderboardEntry {
  team_member_id: string;
  name: string;
  premium: number;
  items: number;
  points: number;
  policies: number;
}

interface SalesLeaderboardProps {
  agencyId: string | null;
  staffSessionToken?: string;
}

function getPeriodDates(period: Period): { start: string; end: string } {
  const today = new Date();
  
  switch (period) {
    case "last_month": {
      const lastMonth = subMonths(today, 1);
      return {
        start: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        end: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
      };
    }
    case "this_quarter": {
      return {
        start: format(startOfQuarter(today), "yyyy-MM-dd"),
        end: format(endOfQuarter(today), "yyyy-MM-dd"),
      };
    }
    case "ytd": {
      return {
        start: format(startOfYear(today), "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      };
    }
    case "this_month":
    default: {
      return {
        start: format(startOfMonth(today), "yyyy-MM-dd"),
        end: format(endOfMonth(today), "yyyy-MM-dd"),
      };
    }
  }
}

function getPeriodLabel(period: Period): string {
  const today = new Date();
  
  switch (period) {
    case "last_month":
      return format(subMonths(today, 1), "MMMM yyyy");
    case "this_quarter":
      return `Q${Math.floor(today.getMonth() / 3) + 1} ${today.getFullYear()}`;
    case "ytd":
      return `YTD ${today.getFullYear()}`;
    case "this_month":
    default:
      return format(today, "MMMM yyyy");
  }
}

export function SalesLeaderboard({ agencyId, staffSessionToken }: SalesLeaderboardProps) {
  const { user } = useAuth();
  const [rankBy, setRankBy] = useState<RankMetric>("premium");
  const [period, setPeriod] = useState<Period>("this_month");

  const { start, end } = getPeriodDates(period);
  const periodLabel = getPeriodLabel(period);

  // Get current user's team_member_id for highlighting
  const { data: currentUserTeamMemberId } = useQuery({
    queryKey: ["current-user-team-member", user?.id, staffSessionToken],
    queryFn: async () => {
      // If using staff session, fetch from edge function response
      if (staffSessionToken) {
        const { data } = await supabase.functions.invoke('get_staff_sales', {
          headers: { 'x-staff-session': staffSessionToken },
          body: { date_start: start, date_end: end, include_leaderboard: false }
        });
        return data?.team_member_id || null;
      }

      if (!user?.id) return null;
      
      // First check staff_users
      const { data: staffData } = await supabase
        .from("staff_users")
        .select("team_member_id")
        .eq("id", user.id)
        .maybeSingle();
      if (staffData?.team_member_id) return staffData.team_member_id;
      
      // Then check profiles -> agency -> team_members
      const { data: profileData } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profileData?.agency_id) return null;
      
      // Try to find a team member with matching email
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.email) return null;
      
      const { data: teamMember } = await supabase
        .from("team_members")
        .select("id")
        .eq("agency_id", profileData.agency_id)
        .eq("email", userData.user.email)
        .maybeSingle();
      
      return teamMember?.id || null;
    },
    enabled: !!user?.id || !!staffSessionToken,
  });

  // Debug logging for client-side
  console.log('[SalesLeaderboard] staffSessionToken present?', !!staffSessionToken);

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ["sales-leaderboard", agencyId, start, end, staffSessionToken],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      // Use edge function for staff users (bypasses RLS)
      if (staffSessionToken) {
        console.log('[SalesLeaderboard] Using edge function for staff user');
        const { data, error } = await supabase.functions.invoke('get_staff_sales', {
          headers: { 'x-staff-session': staffSessionToken },
          body: { 
            date_start: start, 
            date_end: end,
            include_leaderboard: true 
          }
        });

        if (error) {
          console.error('[SalesLeaderboard] Edge function error:', error);
          throw error;
        }

        if (data?.error) {
          console.error('[SalesLeaderboard] Response error:', data.error);
          throw new Error(data.error);
        }

        console.log('[SalesLeaderboard] Success - got leaderboard data:', data.leaderboard?.length || 0, 'entries');
        return data.leaderboard || [];
      }

      // Direct query for admin users (uses RLS)
      if (!agencyId) return [];

      // Get all active team members
      const { data: teamMembers, error: tmError } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("agency_id", agencyId)
        .eq("status", "active");

      if (tmError) throw tmError;

      // Get sales data for the period
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select(`
          team_member_id,
          total_premium,
          total_items,
          total_points,
          sale_policies(id)
        `)
        .eq("agency_id", agencyId)
        .gte("sale_date", start)
        .lte("sale_date", end);

      if (salesError) throw salesError;

      // Aggregate by team member
      const aggregated: Record<string, LeaderboardEntry> = {};

      for (const tm of teamMembers || []) {
        aggregated[tm.id] = {
          team_member_id: tm.id,
          name: tm.name,
          premium: 0,
          items: 0,
          points: 0,
          policies: 0,
        };
      }

      for (const sale of sales || []) {
        if (sale.team_member_id && aggregated[sale.team_member_id]) {
          aggregated[sale.team_member_id].premium += sale.total_premium || 0;
          aggregated[sale.team_member_id].items += sale.total_items || 0;
          aggregated[sale.team_member_id].points += sale.total_points || 0;
          aggregated[sale.team_member_id].policies += (sale.sale_policies as any[])?.length || 0;
        }
      }

      return Object.values(aggregated);
    },
    enabled: !!agencyId || !!staffSessionToken,
  });

  // Sort and rank
  const rankedData = useMemo(() => {
    if (!leaderboardData) return [];
    
    const sorted = [...leaderboardData].sort((a, b) => {
      switch (rankBy) {
        case "items":
          return b.items - a.items;
        case "points":
          return b.points - a.points;
        case "premium":
        default:
          return b.premium - a.premium;
      }
    });

    return sorted;
  }, [leaderboardData, rankBy]);

  const getMedal = (rank: number) => {
    switch (rank) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return rank;
    }
  };

  if (!agencyId && !staffSessionToken) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No agency selected
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle>Leaderboard - {periodLabel}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">Rank By:</span>
              <div className="flex gap-1">
                <Button
                  variant={rankBy === "premium" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRankBy("premium")}
                >
                  Premium
                </Button>
                <Button
                  variant={rankBy === "items" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRankBy("items")}
                >
                  Items
                </Button>
                <Button
                  variant={rankBy === "points" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRankBy("points")}
                >
                  Points
                </Button>
              </div>
            </div>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="this_quarter">This Quarter</SelectItem>
                <SelectItem value="ytd">YTD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rankedData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No producers found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Producer</TableHead>
                  <TableHead className={cn("text-right", rankBy === "premium" && "font-bold")}>Premium</TableHead>
                  <TableHead className={cn("text-right", rankBy === "items" && "font-bold")}>Items</TableHead>
                  <TableHead className={cn("text-right", rankBy === "points" && "font-bold")}>Points</TableHead>
                  <TableHead className="text-right">Policies</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankedData.map((entry, index) => {
                  const rank = index + 1;
                  const isCurrentUser = entry.team_member_id === currentUserTeamMemberId;
                  
                  return (
                    <TableRow 
                      key={entry.team_member_id}
                      className={cn(isCurrentUser && "bg-primary/10")}
                    >
                      <TableCell className="font-medium text-lg">
                        {getMedal(rank)}
                      </TableCell>
                      <TableCell className={cn("font-medium", isCurrentUser && "text-primary")}>
                        {entry.name}
                      </TableCell>
                      <TableCell className={cn("text-right", rankBy === "premium" && "font-bold")}>
                        ${entry.premium.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className={cn("text-right", rankBy === "items" && "font-bold")}>
                        {entry.items}
                      </TableCell>
                      <TableCell className={cn("text-right", rankBy === "points" && "font-bold")}>
                        {entry.points}
                      </TableCell>
                      <TableCell className="text-right">{entry.policies}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
