import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface KPIConfigDialogProps {
  title: string;
  type: "sales" | "service";
  children: React.ReactNode;
}

export function KPIConfigDialog({ title, type, children }: KPIConfigDialogProps) {
  const [targets, setTargets] = useState({
    outbound_calls: 20,
    talk_minutes: 60,
    quoted_count: 3,
    sold_items: 2,
    sold_policies: 1,
    sold_premium: 500,
    cross_sells_uncovered: type === "service" ? 2 : 0,
    mini_reviews: type === "service" ? 5 : 0
  });

  const handleSave = () => {
    // TODO: Implement actual KPI targets save
    toast.success(`${type === "sales" ? "Sales" : "Service"} KPI targets saved!`);
  };

  const updateTarget = (key: keyof typeof targets, value: number) => {
    setTargets(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog>
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
            <Button variant="outline" onClick={() => {}}>Cancel</Button>
            <Button onClick={handleSave}>Save Targets</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}