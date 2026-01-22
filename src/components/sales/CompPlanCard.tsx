import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompPlan } from "@/hooks/useCompPlans";
import { Users, DollarSign, Percent, TrendingUp, FileText, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CompPlanCardProps {
  plan: CompPlan;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

const TIER_METRIC_LABELS: Record<string, string> = {
  items: "Items Written",
  policies: "Policies",
  premium: "Premium",
  points: "Points",
  households: "Households",
};

const PAYOUT_TYPE_LABELS: Record<string, string> = {
  flat_per_item: "Flat $ per Item",
  percent_of_premium: "% of Premium",
  flat_per_policy: "Flat $ per Policy",
  flat_per_household: "Flat $ per Household",
};

const CHARGEBACK_LABELS: Record<string, string> = {
  none: "No Chargebacks",
  full: "Full Chargeback",
  three_month: "3-Month Rule",
};

export function CompPlanCard({ plan, onEdit, onDelete, isDeleting }: CompPlanCardProps) {
  const formatValue = (value: number, type: string) => {
    if (type === "percent_of_premium") {
      return `${value}%`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatThreshold = (threshold: number, metric: string) => {
    if (metric === "premium") {
      return `$${threshold.toLocaleString()}`;
    }
    return threshold.toLocaleString();
  };

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">{plan.name}</CardTitle>
            {plan.description && (
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={plan.is_active ? "default" : "secondary"}>
              {plan.is_active ? "Active" : "Inactive"}
            </Badge>
            {onEdit && (
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isDeleting}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Compensation Plan</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{plan.name}"? This will also remove all tier configurations and staff assignments. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Payout:</span>
            <span className="font-medium">
              {PAYOUT_TYPE_LABELS[plan.payout_type] || plan.payout_type}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Metric:</span>
            <span className="font-medium">
              {TIER_METRIC_LABELS[plan.tier_metric] || plan.tier_metric}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Chargeback:</span>
            <span className="font-medium">
              {CHARGEBACK_LABELS[plan.chargeback_rule] || plan.chargeback_rule}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Assigned:</span>
            <span className="font-medium">{plan.assigned_count} staff</span>
          </div>
        </div>

        {/* Policy Type Filter */}
        {plan.policy_type_filter && plan.policy_type_filter.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Applies to:</span>
            <div className="flex flex-wrap gap-1">
              {plan.policy_type_filter.map((type) => (
                <Badge key={type} variant="outline" className="text-xs">
                  {type}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Brokered Business */}
        {plan.brokered_flat_rate !== null && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Brokered Rate:</span>
            <span className="font-medium">${plan.brokered_flat_rate.toFixed(2)}/item</span>
            {plan.brokered_counts_toward_tier && (
              <Badge variant="outline" className="text-xs">Counts toward tier</Badge>
            )}
          </div>
        )}

        {/* Bundle Type Configurations */}
        {plan.bundle_configs && (
          plan.bundle_configs.monoline?.enabled ||
          plan.bundle_configs.standard?.enabled ||
          plan.bundle_configs.preferred?.enabled
        ) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium">Bundle Type Rates:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {plan.bundle_configs.monoline?.enabled && (
                <Badge variant="outline" className="text-xs">
                  Monoline:{" "}
                  {plan.bundle_configs.monoline.payout_type === "percent_of_premium"
                    ? `${plan.bundle_configs.monoline.rate}%`
                    : `$${plan.bundle_configs.monoline.rate}/item`}
                </Badge>
              )}
              {plan.bundle_configs.standard?.enabled && (
                <Badge variant="outline" className="text-xs">
                  Standard:{" "}
                  {plan.bundle_configs.standard.payout_type === "percent_of_premium"
                    ? `${plan.bundle_configs.standard.rate}%`
                    : `$${plan.bundle_configs.standard.rate}/item`}
                </Badge>
              )}
              {plan.bundle_configs.preferred?.enabled && (
                <Badge variant="outline" className="text-xs">
                  Preferred:{" "}
                  {plan.bundle_configs.preferred.payout_type === "percent_of_premium"
                    ? `${plan.bundle_configs.preferred.rate}%`
                    : `$${plan.bundle_configs.preferred.rate}/item`}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Product-Specific Rates */}
        {plan.product_rates && Object.keys(plan.product_rates).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium">Product Rates:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(plan.product_rates).map(([product, config]) => (
                <Badge key={product} variant="secondary" className="text-xs">
                  {product}:{" "}
                  {config.payout_type === "percent_of_premium"
                    ? `${config.rate}%`
                    : `$${config.rate}/item`}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tiers Table */}
        {plan.tiers.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Tier</TableHead>
                  <TableHead>
                    Min {TIER_METRIC_LABELS[plan.tier_metric] || plan.tier_metric}
                  </TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.tiers.map((tier, index) => (
                  <TableRow key={tier.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      {formatThreshold(tier.min_threshold, plan.tier_metric)}+
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatValue(tier.commission_value, plan.payout_type)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
