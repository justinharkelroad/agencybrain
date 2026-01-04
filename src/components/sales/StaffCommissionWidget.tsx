import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, TrendingUp, DollarSign, Target, Award, BarChart3, CheckCircle2, Building } from "lucide-react";
import { 
  getBusinessDaysInMonth, 
  getBusinessDaysElapsed 
} from "@/utils/businessDays";

interface StaffCommissionWidgetProps {
  sessionToken: string;
}

interface CommissionData {
  plan: {
    id: string;
    name: string;
    payout_type: string;
    tier_metric: string;
    brokered_payout_type: string | null;
    brokered_counts_toward_tier: boolean | null;
    brokered_flat_rate: number | null;
  } | null;
  tiers: Array<{
    min_threshold: number;
    commission_value: number;
    sort_order: number;
  }>;
  brokered_tiers: Array<{
    min_threshold: number;
    commission_value: number;
    sort_order: number;
  }>;
  current_payout: {
    written_premium: number;
    written_items: number;
    written_policies: number;
    written_households: number;
    net_premium: number;
    tier_threshold_met: number | null;
    tier_commission_value: number | null;
    total_payout: number;
    status: string;
  } | null;
  current_month_written_premium: number;
  current_month_written_items: number;
  current_month_written_policies: number;
  current_month_written_households: number;
  team_member_name: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Helper functions for dynamic display
function getMetricValue(data: CommissionData): number {
  switch (data.plan?.tier_metric) {
    case 'items': return data.current_month_written_items;
    case 'policies': return data.current_month_written_policies;
    case 'households': return data.current_month_written_households;
    case 'premium':
    default: return data.current_month_written_premium;
  }
}

function getMetricLabel(tierMetric: string): string {
  switch (tierMetric) {
    case 'items': return 'items';
    case 'policies': return 'policies';
    case 'households': return 'households';
    case 'points': return 'points';
    default: return '';
  }
}

function formatCommissionValue(value: number, payoutType: string): string {
  switch (payoutType) {
    case 'percent_of_premium': return `${value}%`;
    case 'flat_per_item': return `$${value}/item`;
    case 'flat_per_policy': return `$${value}/policy`;
    case 'flat_per_household': return `$${value}/HH`;
    default: return `${value}%`;
  }
}

function formatThreshold(threshold: number, tierMetric: string): string {
  if (tierMetric === 'premium') {
    return `$${threshold.toLocaleString()}+`;
  }
  return `${threshold.toLocaleString()}+ ${getMetricLabel(tierMetric)}`;
}

function formatMetricDisplay(value: number, tierMetric: string): string {
  if (tierMetric === 'premium') {
    return `$${value.toLocaleString()}`;
  }
  return value.toLocaleString();
}

function getProductionLabel(tierMetric: string): string {
  switch (tierMetric) {
    case 'items': return 'Written Items';
    case 'policies': return 'Written Policies';
    case 'households': return 'Households';
    case 'points': return 'Points';
    case 'premium':
    default: return 'Written Premium';
  }
}

function calculatePayout(
  metricValue: number, 
  premium: number,
  items: number,
  policies: number,
  households: number,
  commissionValue: number, 
  payoutType: string
): number {
  switch (payoutType) {
    case 'percent_of_premium':
      return premium * (commissionValue / 100);
    case 'flat_per_item':
      return items * commissionValue;
    case 'flat_per_policy':
      return policies * commissionValue;
    case 'flat_per_household':
      return households * commissionValue;
    default:
      return premium * (commissionValue / 100);
  }
}

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

  const { plan, tiers, brokered_tiers, current_payout, current_month_written_premium, current_month_written_items, current_month_written_policies, current_month_written_households } = data;
  const periodLabel = `${MONTHS[currentMonth - 1]} ${currentYear}`;

  // Get the correct metric value based on plan settings
  const metricValue = getMetricValue(data);
  const sortedTiers = [...tiers].sort((a, b) => a.min_threshold - b.min_threshold);
  const sortedBrokeredTiers = [...(brokered_tiers || [])].sort((a, b) => a.min_threshold - b.min_threshold);
  
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

  // Estimate payout based on current production
  const estimatedPayout = currentTier
    ? calculatePayout(
        metricValue,
        current_month_written_premium,
        current_month_written_items,
        current_month_written_policies,
        current_month_written_households,
        currentTier.commission_value,
        plan.payout_type
      )
    : 0;

  // ========== PROJECTION CALCULATIONS ==========
  const businessDaysInMonth = getBusinessDaysInMonth(today);
  const businessDaysElapsed = getBusinessDaysElapsed(today);
  
  const dailyAverage = businessDaysElapsed > 0 
    ? metricValue / businessDaysElapsed 
    : 0;
  
  const projectedMonthEnd = dailyAverage * businessDaysInMonth;
  
  // Find projected tier
  let projectedTier: typeof sortedTiers[0] | null = null;
  for (let i = sortedTiers.length - 1; i >= 0; i--) {
    if (projectedMonthEnd >= sortedTiers[i].min_threshold) {
      projectedTier = sortedTiers[i];
      break;
    }
  }
  
  // Calculate projected values for payout calculation
  const projectedPremium = plan.tier_metric === 'premium' 
    ? projectedMonthEnd 
    : (businessDaysElapsed > 0 ? (current_month_written_premium / businessDaysElapsed) * businessDaysInMonth : 0);
  const projectedItems = plan.tier_metric === 'items' 
    ? projectedMonthEnd 
    : (businessDaysElapsed > 0 ? (current_month_written_items / businessDaysElapsed) * businessDaysInMonth : 0);
  const projectedPolicies = plan.tier_metric === 'policies' 
    ? projectedMonthEnd 
    : (businessDaysElapsed > 0 ? (current_month_written_policies / businessDaysElapsed) * businessDaysInMonth : 0);
  const projectedHouseholds = plan.tier_metric === 'households' 
    ? projectedMonthEnd 
    : (businessDaysElapsed > 0 ? (current_month_written_households / businessDaysElapsed) * businessDaysInMonth : 0);
  
  const projectedPayout = projectedTier
    ? calculatePayout(
        projectedMonthEnd,
        projectedPremium,
        projectedItems,
        projectedPolicies,
        projectedHouseholds,
        projectedTier.commission_value,
        plan.payout_type
      )
    : 0;
  
  // Determine projection message
  const getProjectionMessage = () => {
    if (!projectedTier && sortedTiers.length > 0) {
      const firstTier = sortedTiers[0];
      const neededDaily = firstTier.min_threshold / businessDaysInMonth;
      const formattedNeeded = plan.tier_metric === 'premium' 
        ? `$${neededDaily.toLocaleString(undefined, { maximumFractionDigits: 0 })}` 
        : neededDaily.toLocaleString(undefined, { maximumFractionDigits: 0 });
      return `Increase daily average to ${formattedNeeded} to reach the ${formatThreshold(firstTier.min_threshold, plan.tier_metric)} tier`;
    }
    if (projectedTier && currentTier && projectedTier.min_threshold === currentTier.min_threshold) {
      return `On track to stay at ${formatCommissionValue(projectedTier.commission_value, plan.payout_type)}`;
    }
    if (projectedTier && (!currentTier || projectedTier.min_threshold > currentTier.min_threshold)) {
      return `Keep this pace to unlock the ${formatCommissionValue(projectedTier.commission_value, plan.payout_type)} tier!`;
    }
    if (nextTier && projectedTier && projectedTier.min_threshold < nextTier.min_threshold) {
      return `Push a bit harder to reach the ${formatThreshold(nextTier.min_threshold, plan.tier_metric)} tier!`;
    }
    return null;
  };
  
  // Show projection only if at least 1 business day elapsed and some production
  const showProjection = businessDaysElapsed >= 1 && metricValue > 0;

  // Tier rendering helper
  const renderTierCard = (
    tier: typeof sortedTiers[0], 
    index: number, 
    isCurrent: boolean, 
    isAchieved: boolean, 
    isProjected: boolean,
    tierMetric: string,
    payoutType: string,
    currentValue: number
  ) => {
    const tierProgress = Math.min(100, (currentValue / tier.min_threshold) * 100);
    
    return (
      <div
        key={index}
        className={`p-3 rounded-lg border transition-all ${
          isCurrent
            ? "bg-primary/10 border-primary/30"
            : isAchieved
            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
            : isProjected
            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
            : "bg-muted/30 border-muted"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">
              {formatThreshold(tier.min_threshold, tierMetric)}
            </span>
            {isAchieved && (
              <Badge className="bg-green-600 text-white text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                ACHIEVED
              </Badge>
            )}
            {isProjected && !isAchieved && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 dark:text-amber-400 dark:border-amber-600">
                Projected
              </Badge>
            )}
            {isCurrent && !isAchieved && (
              <Badge className="text-xs">Current</Badge>
            )}
          </div>
          <Badge 
            variant={isAchieved ? "default" : "outline"} 
            className={isAchieved ? "bg-green-600" : ""}
          >
            {formatCommissionValue(tier.commission_value, payoutType)}
          </Badge>
        </div>
        
        {/* Progress bar */}
        <Progress 
          value={tierProgress} 
          className={`h-2 ${isAchieved ? '[&>div]:bg-green-500' : ''}`}
        />
        
        {/* Progress text for unachieved tiers */}
        {!isAchieved && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {formatMetricDisplay(currentValue, tierMetric)} / {formatMetricDisplay(tier.min_threshold, tierMetric)}
            {tierMetric !== 'premium' && ` ${getMetricLabel(tierMetric)}`} ({tierProgress.toFixed(0)}%)
          </p>
        )}
      </div>
    );
  };

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
              <p className="text-sm text-muted-foreground">{getProductionLabel(plan.tier_metric)}</p>
              <p className="text-2xl font-bold">{formatMetricDisplay(metricValue, plan.tier_metric)}</p>
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
                  {formatCommissionValue(currentTier.commission_value, plan.payout_type)}
                </Badge>
              ) : (
                <Badge variant="secondary">No tier reached</Badge>
              )}
            </div>
            {currentTier && (
              <p className="text-sm text-muted-foreground">
                You've reached the {formatThreshold(currentTier.min_threshold, plan.tier_metric)} tier
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
                  {formatThreshold(nextTier.min_threshold, plan.tier_metric)} ({formatCommissionValue(nextTier.commission_value, plan.payout_type)})
                </span>
              </div>
              <Progress value={Math.min(100, (metricValue / nextTier.min_threshold) * 100)} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{Math.min(100, (metricValue / nextTier.min_threshold) * 100).toFixed(0)}% there</span>
                <span>{formatMetricDisplay(Math.max(0, nextTier.min_threshold - metricValue), plan.tier_metric)} to go</span>
              </div>
            </div>
          )}

          {/* ========== MONTH-END PROJECTION SECTION ========== */}
          {showProjection && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="font-medium">Month-End Projection</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {businessDaysElapsed} of {businessDaysInMonth} business days
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Daily Average</p>
                    <p className="text-lg font-semibold">
                      {formatMetricDisplay(Math.round(dailyAverage), plan.tier_metric)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Projected {getProductionLabel(plan.tier_metric)}</p>
                    <p className="text-lg font-semibold">
                      {formatMetricDisplay(Math.round(projectedMonthEnd), plan.tier_metric)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Projected Tier</p>
                    <p className="text-lg font-semibold">
                      {projectedTier 
                        ? `${formatThreshold(projectedTier.min_threshold, plan.tier_metric)}`
                        : "Below tiers"
                      }
                    </p>
                  </div>
                </div>

                {/* Projected Payout Highlight */}
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💰</span>
                      <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          Projected Payout
                        </p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ${projectedPayout.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                  </div>
                  {getProjectionMessage() && (
                    <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                      {getProjectionMessage()}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Show message if no projection yet */}
          {!showProjection && businessDaysElapsed >= 1 && metricValue === 0 && (
            <>
              <Separator />
              <div className="text-center py-4 text-muted-foreground">
                <BarChart3 className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Start selling to see your projection!</p>
              </div>
            </>
          )}

          {/* All Tiers with Individual Progress Bars */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Commission Tiers</span>
            </div>
            <div className="space-y-2">
              {sortedTiers.map((tier, index) => {
                const isCurrent = currentTier?.min_threshold === tier.min_threshold;
                const isAchieved = metricValue >= tier.min_threshold;
                const isProjected = projectedTier?.min_threshold === tier.min_threshold && !isCurrent;
                
                return renderTierCard(
                  tier, 
                  index, 
                  isCurrent, 
                  isAchieved, 
                  isProjected, 
                  plan.tier_metric, 
                  plan.payout_type,
                  metricValue
                );
              })}
            </div>
          </div>

          {/* Brokered Tiers Section */}
          {sortedBrokeredTiers.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Brokered Business Tiers</span>
                </div>
                <div className="space-y-2">
                  {sortedBrokeredTiers.map((tier, index) => {
                    const isAchieved = metricValue >= tier.min_threshold;
                    const brokeredPayoutType = plan.brokered_payout_type || plan.payout_type;
                    
                    return renderTierCard(
                      tier, 
                      index, 
                      false, // Brokered tiers don't have a "current" state in same way
                      isAchieved, 
                      false, 
                      plan.tier_metric, 
                      brokeredPayoutType,
                      metricValue
                    );
                  })}
                </div>
              </div>
            </>
          )}
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
