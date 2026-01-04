import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { DollarSign, Package, FileText, Trophy, Users, Upload, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { useNavigate } from "react-router-dom";
import { GoalProgressRing } from "@/components/sales/GoalProgressRing";
import { StatOrb } from "@/components/sales/StatOrb";
import { StaffPromoGoalsWidget } from "@/components/sales/StaffPromoGoalsWidget";
import { SalesBreakdownTabs } from "@/components/sales/SalesBreakdownTabs";
import { cn } from "@/lib/utils";
import { 
  getBusinessDaysInMonth, 
  getBusinessDaysElapsed, 
  calculateProjection,
  formatProjection 
} from "@/utils/businessDays";

interface StaffSalesSummaryProps {
  agencyId: string;
  teamMemberId: string;
  showViewAll?: boolean;
}

interface SalesTotals {
  premium: number;
  items: number;
  points: number;
  policies: number;
  households: number;
}

export function StaffSalesSummary({ agencyId, teamMemberId, showViewAll = false }: StaffSalesSummaryProps) {
  const { sessionToken } = useStaffAuth();
  const navigate = useNavigate();
  const [showAnalytics, setShowAnalytics] = useState(false);
  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  
  // Use business days instead of calendar days
  const bizDaysElapsed = getBusinessDaysElapsed(today);
  const bizDaysTotal = getBusinessDaysInMonth(today);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-sales-summary", agencyId, teamMemberId, monthStart, monthEnd, sessionToken],
    queryFn: async (): Promise<SalesTotals> => {
      if (sessionToken) {
        const { data, error } = await supabase.functions.invoke('get_staff_sales', {
          headers: { 'x-staff-session': sessionToken },
          body: { 
            date_start: monthStart, 
            date_end: monthEnd,
            include_leaderboard: false 
          }
        });

        if (error) {
          console.error('Error fetching staff sales summary:', error);
          throw error;
        }

        if (data?.error) {
          console.error('Staff sales summary error:', data.error);
          throw new Error(data.error);
        }

        return {
          premium: data.totals?.premium || 0,
          items: data.totals?.items || 0,
          points: data.totals?.points || 0,
          policies: data.totals?.policies || 0,
          households: data.totals?.households || 0,
        };
      }

      const { data: salesData, error } = await supabase
        .from("sales")
        .select(`
          id,
          customer_name,
          total_premium,
          total_items,
          total_points,
          sale_policies(id)
        `)
        .eq("agency_id", agencyId)
        .eq("team_member_id", teamMemberId)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd);

      if (error) throw error;

      const uniqueCustomers = new Set(salesData?.map(s => s.customer_name?.toLowerCase().trim()).filter(Boolean));

      const totals = (salesData || []).reduce(
        (acc, sale) => ({
          premium: acc.premium + (sale.total_premium || 0),
          items: acc.items + (sale.total_items || 0),
          points: acc.points + (sale.total_points || 0),
          policies: acc.policies + ((sale.sale_policies as any[])?.length || 0),
          households: uniqueCustomers.size,
        }),
        { premium: 0, items: 0, points: 0, policies: 0, households: 0 }
      );

      return totals;
    },
    enabled: !!agencyId && !!teamMemberId,
  });

  // Fetch personal or agency goal via edge function (staff users need edge function to bypass RLS)
  const { data: goalData } = useQuery({
    queryKey: ["staff-sales-goal", agencyId, teamMemberId, sessionToken],
    queryFn: async () => {
      if (!sessionToken) {
        return { goal: 0, type: "agency", name: null };
      }

      const { data, error } = await supabase.functions.invoke('get_staff_goal', {
        headers: { 'x-staff-session': sessionToken },
        body: { team_member_id: teamMemberId }
      });

      if (error || data?.error) {
        console.error('Error fetching staff goal:', error || data?.error);
        return { goal: 0, type: "agency", name: null };
      }

      return data || { goal: 0, type: "agency", name: null };
    },
    enabled: !!agencyId && !!teamMemberId && !!sessionToken,
  });

  const premium = data?.premium || 0;
  const items = data?.items || 0;
  const points = data?.points || 0;
  const policies = data?.policies || 0;
  const households = data?.households || 0;
  const goal = goalData?.goal || 0;
  
  // Calculate projections for all metrics using business days
  const premiumProj = calculateProjection(premium, bizDaysElapsed, bizDaysTotal);
  const itemsProj = calculateProjection(items, bizDaysElapsed, bizDaysTotal);
  const pointsProj = calculateProjection(points, bizDaysElapsed, bizDaysTotal);
  const policiesProj = calculateProjection(policies, bizDaysElapsed, bizDaysTotal);
  const householdsProj = calculateProjection(households, bizDaysElapsed, bizDaysTotal);
  
  const dailyRate = bizDaysElapsed > 0 ? premium / bizDaysElapsed : 0;

  if (isLoading) {
    return (
      <div className="sales-widget-glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="flex flex-col items-center gap-6">
          <Skeleton className="h-48 w-48 rounded-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-widget-glass rounded-3xl p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">My Sales</h3>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            {format(today, "MMMM yyyy")}
          </span>
          {showViewAll && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/staff/sales?tab=upload')}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload Sale</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAnalytics(true)}
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center gap-6">
        {/* Center Ring - Smaller on mobile */}
        <div className="flex-shrink-0">
          {goal > 0 ? (
            <GoalProgressRing
              current={premium}
              target={goal}
              label={goalData?.type === "personal" ? "Personal Goal" : "Agency Goal"}
              size="md"
              showPercentage
              animated
            />
          ) : (
            <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
              <svg width={160} height={160} className="transform -rotate-90 opacity-30">
                <circle
                  cx={80}
                  cy={80}
                  r={72}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth={8}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-muted-foreground text-xs">No Goal Set</span>
                <span className="text-2xl font-bold text-foreground mt-1">
                  ${premium.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground mt-1">This Month</span>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid - All orbs in responsive grid */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 w-full">
          <StatOrb
            value={`$${premium.toLocaleString()}`}
            label="Premium"
            icon={DollarSign}
            color="green"
            animationDelay={0}
            projection={formatProjection(premiumProj, '$')}
          />
          <StatOrb
            value={points}
            label="Points"
            icon={Trophy}
            color="orange"
            animationDelay={200}
            projection={pointsProj}
          />
          <StatOrb
            value={households}
            label="Households"
            icon={Users}
            color="cyan"
            animationDelay={250}
            projection={householdsProj}
          />
          <StatOrb
            value={items}
            label="Items"
            icon={Package}
            color="blue"
            animationDelay={100}
            projection={itemsProj}
          />
          <StatOrb
            value={policies}
            label="Policies"
            icon={FileText}
            color="purple"
            animationDelay={300}
            projection={policiesProj}
          />
        </div>
      </div>

      {/* Footer Stats */}
      <div className={cn(
        "mt-8 pt-4 border-t border-border/30",
        "grid grid-cols-2 gap-4 text-center"
      )}>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Biz Day {bizDaysElapsed} of {bizDaysTotal}
          </p>
          <p className="text-lg font-semibold text-foreground mt-1">
            ${Math.round(dailyRate).toLocaleString()}/day
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Projected</p>
          <p className="text-lg font-semibold text-foreground mt-1">
            {formatProjection(premiumProj, '$')}
          </p>
        </div>
      </div>

      {/* Promo Goals Section */}
      <div className="mt-6">
        <StaffPromoGoalsWidget sessionToken={sessionToken} />
      </div>

      {/* Analytics Slide-Over */}
      <Sheet open={showAnalytics} onOpenChange={setShowAnalytics}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-4xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Sales Analytics</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <SalesBreakdownTabs 
              agencyId={agencyId} 
              showLeaderboard={true}
              staffSessionToken={sessionToken || undefined}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
