import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface DailyAgencyGoalsConfigProps {
  agencyId: string;
}

export function DailyAgencyGoalsConfig({ agencyId }: DailyAgencyGoalsConfigProps) {
  const [dailyQuotedTarget, setDailyQuotedTarget] = useState(15);
  const [dailySoldTarget, setDailySoldTarget] = useState(8);

  useEffect(() => {
    if (!agencyId) return;
    
    const fetchTargets = async () => {
      const { data } = await supabase
        .from("agencies")
        .select("daily_quoted_households_target, daily_sold_items_target")
        .eq("id", agencyId)
        .single();
      
      if (data) {
        setDailyQuotedTarget(data.daily_quoted_households_target ?? 15);
        setDailySoldTarget(data.daily_sold_items_target ?? 8);
      }
    };
    
    fetchTargets();
  }, [agencyId]);

  const updateTarget = async (field: string, value: number) => {
    const { error } = await supabase
      .from("agencies")
      .update({ [field]: value })
      .eq("id", agencyId);
    
    if (error) {
      console.error("Failed to update target:", error);
      toast.error("Failed to save target");
    } else {
      toast.success("Target updated");
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quoted-target">Quoted Households Target</Label>
            <Input
              id="quoted-target"
              type="number"
              min={1}
              max={100}
              value={dailyQuotedTarget}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 15;
                setDailyQuotedTarget(val);
                updateTarget("daily_quoted_households_target", val);
              }}
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
              value={dailySoldTarget}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 8;
                setDailySoldTarget(val);
                updateTarget("daily_sold_items_target", val);
              }}
            />
            <p className="text-xs text-muted-foreground">
              How many items should be sold per day
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
