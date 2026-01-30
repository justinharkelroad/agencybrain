import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, subMonths } from "date-fns";
import { LeaderboardPodium } from "./LeaderboardPodium";
import { LeaderboardList, LeaderboardListMobile } from "./LeaderboardList";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MetricToggle, MetricType } from "./MetricToggle";
import { calculateCountableTotals } from "@/lib/product-constants";

type RankMetric = MetricType;
type Period = "this_month" | "last_month" | "this_quarter" | "ytd";

interface LeaderboardEntry {
  team_member_id: string;
  name: string;
  premium: number;
  items: number;
  points: number;
  policies: number;
  households: number;
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

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export function SalesLeaderboard({ agencyId, staffSessionToken }: SalesLeaderboardProps) {
  const { user } = useAuth();
  const [rankBy, setRankBy] = useState<RankMetric>("items");
  const [period, setPeriod] = useState<Period>("this_month");
  const [businessFilter, setBusinessFilter] = useState<string>("all");
  const isMobile = useMediaQuery("(max-width: 768px)");

  const { start, end } = getPeriodDates(period);
  const periodLabel = getPeriodLabel(period);

  // Get current user's team_member_id for highlighting
  const { data: currentUserTeamMemberId } = useQuery({
    queryKey: ["current-user-team-member", user?.id, staffSessionToken],
    queryFn: async () => {
      if (staffSessionToken) {
        const { data } = await supabase.functions.invoke('get_staff_sales', {
          headers: { 'x-staff-session': staffSessionToken },
          body: { date_start: start, date_end: end, include_leaderboard: false }
        });
        return data?.team_member_id || null;
      }

      if (!user?.id) return null;
      
      const { data: staffData } = await supabase
        .from("staff_users")
        .select("team_member_id")
        .eq("id", user.id)
        .maybeSingle();
      if (staffData?.team_member_id) return staffData.team_member_id;
      
      const { data: profileData } = await supabase
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profileData?.agency_id) return null;
      
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

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ["sales-leaderboard", agencyId, start, end, staffSessionToken, businessFilter],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      if (staffSessionToken) {
        const { data, error } = await supabase.functions.invoke('get_staff_sales', {
          headers: { 'x-staff-session': staffSessionToken },
          body: {
            date_start: start,
            date_end: end,
            include_leaderboard: true,
            business_filter: businessFilter
          }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        return data.leaderboard || [];
      }

      if (!agencyId) return [];

      const { data: teamMembers, error: tmError } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("agency_id", agencyId)
        .eq("status", "active");

      if (tmError) throw tmError;

      let salesQuery = supabase
        .from("sales")
        .select(`
          team_member_id,
          customer_name,
          sale_policies(id, policy_type_name, total_premium, total_items, total_points)
        `)
        .eq("agency_id", agencyId)
        .gte("sale_date", start)
        .lte("sale_date", end);

      // Filter by business type (regular vs brokered)
      if (businessFilter === "regular") {
        salesQuery = salesQuery.is("brokered_carrier_id", null);
      } else if (businessFilter === "brokered") {
        salesQuery = salesQuery.not("brokered_carrier_id", "is", null);
      }

      const { data: sales, error: salesError } = await salesQuery;

      if (salesError) throw salesError;

      const aggregated: Record<string, LeaderboardEntry & { customerNames: Set<string> }> = {};

      for (const tm of teamMembers || []) {
        aggregated[tm.id] = {
          team_member_id: tm.id,
          name: tm.name,
          premium: 0,
          items: 0,
          points: 0,
          policies: 0,
          households: 0,
          customerNames: new Set(),
        };
      }

      for (const sale of sales || []) {
        if (sale.team_member_id && aggregated[sale.team_member_id]) {
          // Calculate totals excluding Motor Club and other excluded products
          const policies = (sale.sale_policies as any[]) || [];
          const countable = calculateCountableTotals(policies);
          
          aggregated[sale.team_member_id].premium += countable.premium;
          aggregated[sale.team_member_id].items += countable.items;
          aggregated[sale.team_member_id].points += countable.points;
          aggregated[sale.team_member_id].policies += countable.policyCount;
          
          // Track unique households (only if sale has countable policies)
          if (countable.policyCount > 0) {
            const customerName = sale.customer_name?.toLowerCase().trim();
            if (customerName) {
              aggregated[sale.team_member_id].customerNames.add(customerName);
            }
          }
        }
      }

      // Convert to LeaderboardEntry array
      return Object.values(aggregated).map(entry => ({
        team_member_id: entry.team_member_id,
        name: entry.name,
        premium: entry.premium,
        items: entry.items,
        points: entry.points,
        policies: entry.policies,
        households: entry.customerNames.size,
      }));
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
        case "households":
          return b.households - a.households;
        case "policies":
          return b.policies - a.policies;
        case "premium":
        default:
          return b.premium - a.premium;
      }
    });

    return sorted.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      isCurrentUser: entry.team_member_id === currentUserTeamMemberId,
    }));
  }, [leaderboardData, rankBy, currentUserTeamMemberId]);

  // Split into podium (top 3) and rest
  const topThree = useMemo(() => {
    return rankedData.slice(0, 3).map(entry => {
      let value = entry.premium;
      if (rankBy === 'items') value = entry.items;
      else if (rankBy === 'points') value = entry.points;
      else if (rankBy === 'households') value = entry.households;
      else if (rankBy === 'policies') value = entry.policies;
      
      return {
        rank: entry.rank as 1 | 2 | 3,
        name: entry.name,
        initials: getInitials(entry.name),
        value,
        metric: rankBy,
        isCurrentUser: entry.isCurrentUser,
        premium: entry.premium,
        items: entry.items,
        points: entry.points,
        policies: entry.policies,
        households: entry.households,
      };
    });
  }, [rankedData, rankBy]);

  const restOfList = useMemo(() => {
    return rankedData.slice(3);
  }, [rankedData]);

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
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          {/* Title and Period */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-xl font-bold">Leaderboard</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{periodLabel}</p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Period Selector */}
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

              {/* Business Type Filter */}
              <Select value={businessFilter} onValueChange={setBusinessFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All Business" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Business</SelectItem>
                  <SelectItem value="regular">Regular Only</SelectItem>
                  <SelectItem value="brokered">Brokered Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Metric Toggle */}
          <MetricToggle 
            value={rankBy} 
            onChange={setRankBy}
            availableMetrics={["items", "premium", "points", "policies", "households"]}
          />
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : rankedData.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg mb-2">No producers found</p>
            <p className="text-sm">Start making sales to appear on the leaderboard!</p>
          </div>
        ) : (
          <div>
            {/* Podium */}
            <LeaderboardPodium topThree={topThree} metric={rankBy} />
            
            {/* Divider */}
            {restOfList.length > 0 && (
              <div className="border-t border-border/50 my-4" />
            )}
            
            {/* Rest of List */}
            {isMobile ? (
              <LeaderboardListMobile 
                producers={restOfList} 
                startRank={4} 
                metric={rankBy} 
              />
            ) : (
              <LeaderboardList 
                producers={restOfList} 
                startRank={4} 
                metric={rankBy} 
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
