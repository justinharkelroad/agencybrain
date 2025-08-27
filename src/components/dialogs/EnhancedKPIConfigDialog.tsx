import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface KPITarget {
  id: string;
  label: string;
  value: number;
  isDefault: boolean;
}

interface EnhancedKPIConfigDialogProps {
  title: string;
  type: "sales" | "service";
  children: React.ReactNode;
  agencyId?: string;
}

const defaultSalesKPIs: KPITarget[] = [
  { id: "outbound_calls", label: "Outbound Calls", value: 100, isDefault: true },
  { id: "talk_minutes", label: "Talk Minutes", value: 180, isDefault: true },
  { id: "quoted_count", label: "Quoted Count", value: 5, isDefault: true },
  { id: "sold_items", label: "Items Sold", value: 2, isDefault: true },
];

const defaultServiceKPIs: KPITarget[] = [
  { id: "outbound_calls", label: "Outbound Calls", value: 30, isDefault: true },
  { id: "talk_minutes", label: "Talk Minutes", value: 180, isDefault: true },
  { id: "cross_sells_uncovered", label: "Cross-sells", value: 2, isDefault: true },
  { id: "mini_reviews", label: "Mini-reviews", value: 5, isDefault: true },
];

export function EnhancedKPIConfigDialog({ title, type, children, agencyId }: EnhancedKPIConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [kpis, setKpis] = useState<KPITarget[]>(
    type === "sales" ? [...defaultSalesKPIs] : [...defaultServiceKPIs]
  );
  const [loading, setLoading] = useState(false);

  // Load existing targets when dialog opens
  useEffect(() => {
    if (isOpen && agencyId) {
      loadExistingTargets();
    }
  }, [isOpen, agencyId]);

  const loadExistingTargets = async () => {
    if (!agencyId) return;
    
    try {
      const { data: targets } = await supabase
        .from('targets')
        .select('metric_key, value_number')
        .eq('agency_id', agencyId)
        .is('team_member_id', null);

      if (targets && targets.length > 0) {
        const defaults = type === "sales" ? [...defaultSalesKPIs] : [...defaultServiceKPIs];
        const updatedKpis = defaults.map(kpi => {
          const existingTarget = targets.find(t => t.metric_key === kpi.id);
          return existingTarget ? { ...kpi, value: existingTarget.value_number } : kpi;
        });
        setKpis(updatedKpis);
      }
    } catch (error) {
      console.error('Error loading targets:', error);
    }
  };

  const handleSave = async () => {
    if (!agencyId) {
      toast.error("Agency ID not found");
      return;
    }

    setLoading(true);
    try {
      // Delete existing targets for this agency and type
      await supabase
        .from('targets')
        .delete()
        .eq('agency_id', agencyId)
        .is('team_member_id', null)
        .in('metric_key', kpis.map(kpi => kpi.id));

      // Insert new targets
      const targetsToInsert = kpis.map(kpi => ({
        agency_id: agencyId,
        metric_key: kpi.id,
        value_number: kpi.value,
        team_member_id: null
      }));

      const { error } = await supabase
        .from('targets')
        .insert(targetsToInsert);

      if (error) throw error;

      toast.success(`${type === "sales" ? "Sales" : "Service"} KPI targets saved!`);
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving targets:', error);
      toast.error("Failed to save targets");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  const updateKPIValue = (id: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setKpis(prev => prev.map(kpi => 
      kpi.id === id ? { ...kpi, value: numValue } : kpi
    ));
  };

  const addCustomKPI = () => {
    const newId = `custom_${Date.now()}`;
    const newKPI: KPITarget = {
      id: newId,
      label: "New KPI",
      value: 1,
      isDefault: false
    };
    setKpis(prev => [...prev, newKPI]);
  };

  const removeKPI = (id: string) => {
    setKpis(prev => prev.filter(kpi => kpi.id !== id));
  };

  const updateKPILabel = (id: string, label: string) => {
    setKpis(prev => prev.map(kpi => 
      kpi.id === id ? { ...kpi, label } : kpi
    ));
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
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

          <div className="space-y-3">
            {kpis.map((kpi) => (
              <Card key={kpi.id} className={kpi.isDefault ? "border-primary/20" : "border-muted"}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      {kpi.isDefault ? (
                        <Label className="font-medium">{kpi.label}</Label>
                      ) : (
                        <Input
                          value={kpi.label}
                          onChange={(e) => updateKPILabel(kpi.id, e.target.value)}
                          className="font-medium h-8"
                          placeholder="KPI Name"
                        />
                      )}
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        value={kpi.value}
                        onChange={(e) => updateKPIValue(kpi.id, e.target.value)}
                        onFocus={handleInputFocus}
                        className="text-center"
                        min="0"
                      />
                    </div>
                    {!kpi.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeKPI(kpi.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <Button
              variant="outline"
              onClick={addCustomKPI}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Custom KPI
            </Button>
          </div>

          <Separator />

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Targets"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}