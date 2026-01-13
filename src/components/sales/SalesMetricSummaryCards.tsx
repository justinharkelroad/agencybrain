import { DollarSign, Package, FileText, Trophy, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBusinessDaysInMonth,
  getBusinessDaysElapsed,
  calculateProjection,
  formatProjection,
} from "@/utils/businessDays";

interface SalesMetricSummaryCardsProps {
  premium: number;
  items: number;
  policies: number;
  points: number;
  isLoading?: boolean;
  showProjections?: boolean;
}

const metrics = [
  {
    key: "premium",
    label: "Premium",
    icon: DollarSign,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    format: (value: number) =>
      value >= 1000
        ? `$${(value / 1000).toFixed(1)}K`
        : `$${value.toLocaleString()}`,
    projectionPrefix: "$",
  },
  {
    key: "items",
    label: "Items",
    icon: Package,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    format: (value: number) => value.toLocaleString(),
    projectionPrefix: "",
  },
  {
    key: "policies",
    label: "Policies",
    icon: FileText,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    format: (value: number) => value.toLocaleString(),
    projectionPrefix: "",
  },
  {
    key: "points",
    label: "Points",
    icon: Trophy,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    format: (value: number) =>
      value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString(),
    projectionPrefix: "",
  },
] as const;

export function SalesMetricSummaryCards({
  premium,
  items,
  policies,
  points,
  isLoading = false,
  showProjections = false,
}: SalesMetricSummaryCardsProps) {
  const values = { premium, items, policies, points };

  // Calculate projections based on business days
  const now = new Date();
  const totalBusinessDays = getBusinessDaysInMonth(now);
  const elapsedBusinessDays = getBusinessDaysElapsed(now);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const value = values[metric.key];
        const projection = showProjections
          ? calculateProjection(value, elapsedBusinessDays, totalBusinessDays)
          : null;

        return (
          <Card
            key={metric.key}
            className={`${metric.bgColor} ${metric.borderColor} border backdrop-blur-sm`}
          >
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`p-1.5 rounded-md ${metric.bgColor}`}
                    >
                      <Icon className={`h-4 w-4 ${metric.color}`} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {metric.label}
                    </span>
                  </div>

                  <div className={`text-2xl font-bold ${metric.color}`}>
                    {metric.format(value)}
                  </div>

                  {showProjections && projection !== null && (
                    <div className="flex items-center gap-1 mt-1">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatProjection(projection, metric.projectionPrefix)} projected
                      </span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
