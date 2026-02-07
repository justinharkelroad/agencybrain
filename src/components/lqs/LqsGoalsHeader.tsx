import { useState } from 'react';
import { Target, TrendingUp, AlertCircle, Pencil, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { updateAgencyGoals } from '@/lib/scorecardsApi';
import { LqsRoiSummary } from '@/hooks/useLqsRoiAnalytics';

interface LqsGoalsHeaderProps {
  summary: LqsRoiSummary | null;
  agencyGoals: {
    dailyQuotedHouseholdsTarget: number | null;
    dailySoldItemsTarget: number | null;
    dailyWrittenPremiumTargetCents: number | null;
  } | null;
  daysInPeriod: number;
  isLoading?: boolean;
  commissionRate: number;
  agencyId: string;
  onGoalsUpdated?: () => void;
}

// Format currency from cents
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Goal metric card
function GoalMetric({
  label,
  current,
  target,
  format = 'number',
  icon: Icon,
}: {
  label: string;
  current: number;
  target: number | null;
  format?: 'number' | 'currency';
  icon: React.ElementType;
}) {
  const hasTarget = target !== null && target > 0;
  const progress = hasTarget ? Math.min((current / target) * 100, 100) : 0;
  const isAhead = hasTarget && current >= target;
  const displayCurrent = format === 'currency' ? formatCurrency(current) : current.toLocaleString();
  const displayTarget = hasTarget
    ? format === 'currency'
      ? formatCurrency(target)
      : target.toLocaleString()
    : 'No target set';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', isAhead ? 'text-green-500' : 'text-muted-foreground')} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(
                'text-sm font-bold',
                isAhead ? 'text-green-500' : hasTarget ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {displayCurrent}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Target: {displayTarget}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {hasTarget ? (
        <div className="flex items-center gap-2">
          <Progress value={progress} className="h-2 flex-1" />
          <span className={cn(
            'text-xs font-medium',
            isAhead ? 'text-green-500' : progress >= 75 ? 'text-amber-500' : 'text-muted-foreground'
          )}>
            {progress.toFixed(0)}%
          </span>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          No target configured
        </div>
      )}
    </div>
  );
}

function EditGoalsPopover({
  agencyGoals,
  agencyId,
  onGoalsUpdated,
}: {
  agencyGoals: LqsGoalsHeaderProps['agencyGoals'];
  agencyId: string;
  onGoalsUpdated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [quotedTarget, setQuotedTarget] = useState(
    agencyGoals?.dailyQuotedHouseholdsTarget ?? 0
  );
  const [soldTarget, setSoldTarget] = useState(
    agencyGoals?.dailySoldItemsTarget ?? 0
  );
  const [premiumTarget, setPremiumTarget] = useState(
    agencyGoals?.dailyWrittenPremiumTargetCents
      ? (agencyGoals.dailyWrittenPremiumTargetCents / 100).toString()
      : ''
  );
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      // Reset to current values when opening
      setQuotedTarget(agencyGoals?.dailyQuotedHouseholdsTarget ?? 0);
      setSoldTarget(agencyGoals?.dailySoldItemsTarget ?? 0);
      setPremiumTarget(
        agencyGoals?.dailyWrittenPremiumTargetCents
          ? (agencyGoals.dailyWrittenPremiumTargetCents / 100).toString()
          : ''
      );
    }
    setOpen(isOpen);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const premiumDollars = parseFloat(premiumTarget);
      const premiumCents = !isNaN(premiumDollars) && premiumDollars > 0
        ? Math.round(premiumDollars * 100)
        : null;

      await updateAgencyGoals({
        daily_quoted_households_target: quotedTarget,
        daily_sold_items_target: soldTarget,
        daily_written_premium_target_cents: premiumCents,
      }, agencyId);

      toast.success('Goals updated');
      setOpen(false);
      onGoalsUpdated?.();
    } catch (err) {
      console.error('Failed to update goals:', err);
      toast.error('Failed to save goals');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Edit Daily Targets</h4>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="edit-quoted" className="text-xs">Daily Quoted Households</Label>
              <Input
                id="edit-quoted"
                type="number"
                min={0}
                max={200}
                value={quotedTarget === 0 ? '' : quotedTarget}
                onChange={(e) => setQuotedTarget(parseInt(e.target.value) || 0)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-sold" className="text-xs">Daily Sold Items</Label>
              <Input
                id="edit-sold"
                type="number"
                min={0}
                max={200}
                value={soldTarget === 0 ? '' : soldTarget}
                onChange={(e) => setSoldTarget(parseInt(e.target.value) || 0)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-premium" className="text-xs">Daily Written Premium ($)</Label>
              <Input
                id="edit-premium"
                type="number"
                min={0}
                step={100}
                placeholder="e.g. 5000"
                value={premiumTarget}
                onChange={(e) => setPremiumTarget(e.target.value)}
                className="h-8"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Commission target auto-calculates from premium x rate.
            </p>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LqsGoalsHeader({
  summary,
  agencyGoals,
  daysInPeriod,
  isLoading,
  commissionRate,
  agencyId,
  onGoalsUpdated,
}: LqsGoalsHeaderProps) {
  if (isLoading || !summary) {
    return null;
  }

  // Calculate period targets from daily targets
  const quotedHHTarget = agencyGoals?.dailyQuotedHouseholdsTarget
    ? agencyGoals.dailyQuotedHouseholdsTarget * daysInPeriod
    : null;

  const soldItemsTarget = agencyGoals?.dailySoldItemsTarget
    ? agencyGoals.dailySoldItemsTarget * daysInPeriod
    : null;

  const writtenPremiumTarget = agencyGoals?.dailyWrittenPremiumTargetCents
    ? agencyGoals.dailyWrittenPremiumTargetCents * daysInPeriod
    : null;

  const commissionTarget = writtenPremiumTarget !== null && commissionRate > 0
    ? Math.round(writtenPremiumTarget * (commissionRate / 100))
    : null;

  // Get current values based on view type
  const quotedHH = summary.isActivityView ? summary.quotesCreated : summary.quotedHouseholds;
  const soldItems = summary.isActivityView ? summary.salesClosed : summary.soldHouseholds;

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Period Goals</h3>
          <span className="text-xs text-muted-foreground">
            ({daysInPeriod} day{daysInPeriod !== 1 ? 's' : ''})
          </span>
          {agencyId && (
            <EditGoalsPopover
              agencyGoals={agencyGoals}
              agencyId={agencyId}
              onGoalsUpdated={onGoalsUpdated}
            />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <GoalMetric
            label="Quoted Households"
            current={quotedHH}
            target={quotedHHTarget}
            icon={Target}
          />
          <GoalMetric
            label="Sold Households"
            current={soldItems}
            target={soldItemsTarget}
            icon={TrendingUp}
          />
          <GoalMetric
            label="Written Premium"
            current={summary.premiumSoldCents}
            target={writtenPremiumTarget}
            format="currency"
            icon={DollarSign}
          />
          <GoalMetric
            label="Commission Earned"
            current={summary.commissionEarned}
            target={commissionTarget}
            format="currency"
            icon={DollarSign}
          />
        </div>
      </CardContent>
    </Card>
  );
}
