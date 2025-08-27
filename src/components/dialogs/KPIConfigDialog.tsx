import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface KPIConfigDialogProps {
  title: string;
  type: "sales" | "service";
  children: React.ReactNode;
}

// Default target values based on role
const getDefaultTargets = (type: "sales" | "service") => ({
  outbound_calls: type === "sales" ? 100 : 30,
  talk_minutes: 180,
  quoted_count: type === "sales" ? 5 : 0,
  sold_items: type === "sales" ? 2 : 0,
  sold_policies: type === "sales" ? 1 : 0,
  sold_premium: type === "sales" ? 500 : 0,
  cross_sells_uncovered: type === "service" ? 2 : 0,
  mini_reviews: type === "service" ? 5 : 0
});

export function KPIConfigDialog({ title, type, children }: KPIConfigDialogProps) {
  const [targets, setTargets] = useState(getDefaultTargets(type));
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Load existing targets when dialog opens
  useEffect(() => {
    if (!open) return;
    
    const loadTargets = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        if (!profile?.agency_id) return;

        const { data: existingTargets } = await supabase
          .from('targets')
          .select('metric_key, value_number')
          .eq('agency_id', profile.agency_id)
          .is('team_member_id', null);

        if (existingTargets && existingTargets.length > 0) {
          const loadedTargets = { ...getDefaultTargets(type) };
          existingTargets.forEach(target => {
            if (target.metric_key in loadedTargets) {
              (loadedTargets as any)[target.metric_key] = target.value_number;
            }
          });
          setTargets(loadedTargets);
        }
      } catch (error) {
        console.error('Error loading targets:', error);
      }
    };

    loadTargets();
  }, [open, type]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.agency_id) {
        toast.error('Agency not found');
        return;
      }

      // Get relevant metrics for this role
      const relevantMetrics = type === "sales" 
        ? ['outbound_calls', 'talk_minutes', 'quoted_count', 'sold_items', 'sold_policies', 'sold_premium']
        : ['outbound_calls', 'talk_minutes', 'cross_sells_uncovered', 'mini_reviews'];

      // Delete existing targets for these metrics
      await supabase
        .from('targets')
        .delete()
        .eq('agency_id', profile.agency_id)
        .is('team_member_id', null)
        .in('metric_key', relevantMetrics);

      // Insert/update targets
      const targetRows = relevantMetrics.map(metric => ({
        agency_id: profile.agency_id,
        team_member_id: null,
        metric_key: metric,
        value_number: (targets as any)[metric]
      }));

      const { error } = await supabase
        .from('targets')
        .insert(targetRows);

      if (error) throw error;

      toast.success(`${type === "sales" ? "Sales" : "Service"} KPI targets saved!`);
      setOpen(false);
    } catch (error) {
      console.error('Error saving targets:', error);
      toast.error('Failed to save targets');
    } finally {
      setLoading(false);
    }
  };

  const updateTarget = (key: keyof typeof targets, value: number) => {
    setTargets(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure daily targets for {type} team members. These targets are used to calculate daily scores and achievements.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="outbound_calls">Outbound Calls</Label>
                <Input
                  id="outbound_calls"
                  type="number"
                  value={targets.outbound_calls}
                  onChange={(e) => updateTarget("outbound_calls", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="talk_minutes">Talk Minutes</Label>
                <Input
                  id="talk_minutes"
                  type="number"
                  value={targets.talk_minutes}
                  onChange={(e) => updateTarget("talk_minutes", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Sales-specific KPIs */}
            {type === "sales" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quoted_count">Quoted Count</Label>
                    <Input
                      id="quoted_count"
                      type="number"
                      value={targets.quoted_count}
                      onChange={(e) => updateTarget("quoted_count", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sold_items">Sold Items</Label>
                    <Input
                      id="sold_items"
                      type="number"
                      value={targets.sold_items}
                      onChange={(e) => updateTarget("sold_items", parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sold_policies">Sold Policies</Label>
                    <Input
                      id="sold_policies"
                      type="number"
                      value={targets.sold_policies}
                      onChange={(e) => updateTarget("sold_policies", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sold_premium">Sold Premium ($)</Label>
                    <Input
                      id="sold_premium"
                      type="number"
                      value={targets.sold_premium}
                      onChange={(e) => updateTarget("sold_premium", parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </>
            )}

            {type === "service" && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cross_sells_uncovered">Cross-sells Uncovered</Label>
                    <Input
                      id="cross_sells_uncovered"
                      type="number"
                      value={targets.cross_sells_uncovered}
                      onChange={(e) => updateTarget("cross_sells_uncovered", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mini_reviews">Mini Reviews</Label>
                    <Input
                      id="mini_reviews"
                      type="number"
                      value={targets.mini_reviews}
                      onChange={(e) => updateTarget("mini_reviews", parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Targets"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}