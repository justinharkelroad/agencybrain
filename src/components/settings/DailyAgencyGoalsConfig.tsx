import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getAgencyGoals, updateAgencyGoals } from "@/lib/scorecardsApi";

interface DailyAgencyGoalsConfigProps {
  agencyId: string;
}

export function DailyAgencyGoalsConfig({ agencyId }: DailyAgencyGoalsConfigProps) {
  const [dailyQuotedTarget, setDailyQuotedTarget] = useState(15);
  const [dailySoldTarget, setDailySoldTarget] = useState(8);
  const [dailyPremiumTarget, setDailyPremiumTarget] = useState('');
  const [initialQuoted, setInitialQuoted] = useState(15);
  const [initialSold, setInitialSold] = useState(8);
  const [initialPremium, setInitialPremium] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const hasChanges = dailyQuotedTarget !== initialQuoted
    || dailySoldTarget !== initialSold
    || dailyPremiumTarget !== initialPremium;

  useEffect(() => {
    if (!agencyId) return;

    const fetchTargets = async () => {
      try {
        setLoading(true);
        const data = await getAgencyGoals(agencyId);

        if (data) {
          const quoted = data.daily_quoted_households_target ?? 15;
          const sold = data.daily_sold_items_target ?? 8;
          const premiumCents = data.daily_written_premium_target_cents;
          const premiumStr = premiumCents ? (premiumCents / 100).toString() : '';
          setDailyQuotedTarget(quoted);
          setDailySoldTarget(sold);
          setDailyPremiumTarget(premiumStr);
          setInitialQuoted(quoted);
          setInitialSold(sold);
          setInitialPremium(premiumStr);
        }
      } catch (error) {
        console.error("Failed to fetch targets:", error);
        toast.error("Failed to load agency goals");
      } finally {
        setLoading(false);
      }
    };

    fetchTargets();
  }, [agencyId]);

  const saveTargets = async () => {
    setSaving(true);
    try {
      const premiumDollars = parseFloat(dailyPremiumTarget);
      const premiumCents = !isNaN(premiumDollars) && premiumDollars > 0
        ? Math.round(premiumDollars * 100)
        : null;

      await updateAgencyGoals({
        daily_quoted_households_target: dailyQuotedTarget,
        daily_sold_items_target: dailySoldTarget,
        daily_written_premium_target_cents: premiumCents,
      }, agencyId);

      setInitialQuoted(dailyQuotedTarget);
      setInitialSold(dailySoldTarget);
      setInitialPremium(dailyPremiumTarget);
      toast.success("Targets saved");
    } catch (error) {
      console.error("Failed to update targets:", error);
      toast.error("Failed to save targets");
    } finally {
      setSaving(false);
    }
  };

  if (!agencyId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Agency Goals</CardTitle>
        <CardDescription>
          Set daily targets for your team. Progress displays on the metrics dashboard and staff portal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="quoted-target">Quoted Households Target</Label>
                <Input
                  id="quoted-target"
                  type="number"
                  min={1}
                  max={100}
                  value={dailyQuotedTarget === 0 ? "" : dailyQuotedTarget}
                  onChange={(e) => setDailyQuotedTarget(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  How many households should be quoted per day
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sold-target">Sold Items Target</Label>
                <Input
                  id="sold-target"
                  type="number"
                  min={1}
                  max={100}
                  value={dailySoldTarget === 0 ? "" : dailySoldTarget}
                  onChange={(e) => setDailySoldTarget(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  How many items should be sold per day
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="premium-target">Written Premium Target ($)</Label>
                <Input
                  id="premium-target"
                  type="number"
                  min={0}
                  step={100}
                  placeholder="e.g. 5000"
                  value={dailyPremiumTarget}
                  onChange={(e) => setDailyPremiumTarget(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Daily written premium target in dollars
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveTargets} disabled={!hasChanges || saving}>
                {saving ? "Saving..." : "Save Targets"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
