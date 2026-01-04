import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, TrendingUp, DollarSign, Target, Award } from "lucide-react";
import { format } from "date-fns";

interface StaffCommissionWidgetProps {
  sessionToken: string;
}

interface CommissionData {
  plan: {
    id: string;
    name: string;
    payout_type: string;
    tier_metric: string;
  } | null;
  tiers: Array<{
    min_threshold: number;
    commission_value: number;
    sort_order: number;
  }>;
  current_payout: {
    written_premium: number;
    written_items: number;
    written_policies: number;
    net_premium: number;
    tier_threshold_met: number | null;
    tier_commission_value: number | null;
    total_payout: number;
    status: string;
  } | null;
  current_month_written_premium: number;
  team_member_name: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function StaffCommissionWidget({ sessionToken }: StaffCommissionWidgetProps) {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const { data, isLoading, error } = useQuery<CommissionData | null>({
    queryKey: ["staff-commission", sessionToken, currentMonth, currentYear],
    enabled: !!sessionToken,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-staff-commission", {
        headers: { "x-staff-session": sessionToken },
        body: { month: currentMonth, year: currentYear },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as CommissionData;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>Unable to load commission data</p>
          <p className="text-sm mt-1">You may not be assigned to a compensation plan yet.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data.plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Compensation
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-8">
          <p>No compensation plan assigned</p>
          <p className="text-sm mt-1">Contact your manager to get assigned to a plan.</p>
        </CardContent>
      </Card>
    );
  }

  const { plan, tiers, current_payout, current_month_written_premium, team_member_name } = data;
  const periodLabel = `${MONTHS[currentMonth - 1]} ${currentYear}`;

  // Find current and next tier based on written premium
  const metricValue = current_month_written_premium;
  const sortedTiers = [...tiers].sort((a, b) => a.min_threshold - b.min_threshold);
  
  let currentTier: typeof sortedTiers[0] | null = null;
  let nextTier: typeof sortedTiers[0] | null = null;
  
  for (let i = sortedTiers.length - 1; i >= 0; i--) {
    if (metricValue >= sortedTiers[i].min_threshold) {
      currentTier = sortedTiers[i];
      nextTier = sortedTiers[i + 1] || null;
      break;
    }
  }

  // If no tier met yet, next tier is the first one
  if (!currentTier && sortedTiers.length > 0) {
    nextTier = sortedTiers[0];
  }

  // Calculate progress to next tier
  const progressToNextTier = nextTier
    ? Math.min(100, (metricValue / nextTier.min_threshold) * 100)
    : 100;

  const amountToNextTier = nextTier
    ? Math.max(0, nextTier.min_threshold - metricValue)
    : 0;

  // Estimate payout based on current production
  const estimatedPayout = currentTier
    ? metricValue * (currentTier.commission_value / 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Current Period Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            My Commission - {periodLabel}
          </CardTitle>
          <CardDescription>
            Based on your current production and assigned plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Info */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Assigned Plan</p>
              <p className="font-medium">{plan.name}</p>
            </div>
            <Badge variant="outline">{plan.tier_metric} based</Badge>
          </div>

          <Separator />

          {/* Current Production */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Written Premium</p>
              <p className="text-2xl font-bold">${metricValue.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Estimated Payout</p>
              <p className="text-2xl font-bold text-green-600">
                ${estimatedPayout.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Current Tier */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                <span className="font-medium">Current Tier</span>
              </div>
              {currentTier ? (
                <Badge className="bg-primary text-primary-foreground">
                  {currentTier.commission_value}% Rate
                </Badge>
              ) : (
                <Badge variant="secondary">No tier reached</Badge>
              )}
            </div>
            {currentTier && (
              <p className="text-sm text-muted-foreground">
                You've reached the ${currentTier.min_threshold.toLocaleString()}+ tier
              </p>
            )}
          </div>

          {/* Next Tier Progress */}
          {nextTier && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Next Tier</span>
                </div>
                <span className="text-sm">
                  ${nextTier.min_threshold.toLocaleString()} ({nextTier.commission_value}%)
                </span>
              </div>
              <Progress value={progressToNextTier} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{progressToNextTier.toFixed(0)}% there</span>
                <span>${amountToNextTier.toLocaleString()} to go</span>
              </div>
            </div>
          )}

          {/* All Tiers */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Commission Tiers</span>
            </div>
            <div className="space-y-2">
              {sortedTiers.map((tier, index) => {
                const isCurrent = currentTier?.min_threshold === tier.min_threshold;
                const isAchieved = metricValue >= tier.min_threshold;
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-2 rounded-md text-sm ${
                      isCurrent
                        ? "bg-primary/10 border border-primary/20"
                        : isAchieved
                        ? "bg-muted/50"
                        : "opacity-60"
                    }`}
                  >
                    <span>
                      ${tier.min_threshold.toLocaleString()}+
                    </span>
                    <Badge variant={isCurrent ? "default" : isAchieved ? "secondary" : "outline"}>
                      {tier.commission_value}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payout Status (if exists) */}
      {current_payout && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payout Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Calculated Payout</p>
                <p className="text-xl font-bold">${current_payout.total_payout.toLocaleString()}</p>
              </div>
              <Badge
                variant={
                  current_payout.status === "paid"
                    ? "default"
                    : current_payout.status === "finalized"
                    ? "secondary"
                    : "outline"
                }
                className={current_payout.status === "paid" ? "bg-green-600" : ""}
              >
                {current_payout.status === "paid"
                  ? "Paid"
                  : current_payout.status === "finalized"
                  ? "Finalized"
                  : "Draft"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
