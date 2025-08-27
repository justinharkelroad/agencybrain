import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
}

const defaultSalesKPIs: KPITarget[] = [
  { id: "outbound_calls", label: "Outbound Calls", value: 20, isDefault: true },
  { id: "talk_minutes", label: "Talk Minutes", value: 60, isDefault: true },
  { id: "quoted_count", label: "Quoted Count", value: 3, isDefault: true },
  { id: "sold_premium", label: "Sold Premium ($)", value: 500, isDefault: true },
];

const defaultServiceKPIs: KPITarget[] = [
  { id: "outbound_calls", label: "Outbound Calls", value: 15, isDefault: true },
  { id: "talk_minutes", label: "Talk Minutes", value: 45, isDefault: true },
  { id: "cross_sells_uncovered", label: "Cross-sells Uncovered", value: 2, isDefault: true },
  { id: "mini_reviews", label: "Mini Reviews", value: 5, isDefault: true },
];

export function EnhancedKPIConfigDialog({ title, type, children }: EnhancedKPIConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [kpis, setKpis] = useState<KPITarget[]>(
    type === "sales" ? [...defaultSalesKPIs] : [...defaultServiceKPIs]
  );

  const handleSave = () => {
    // TODO: Save to database
    toast.success(`${type === "sales" ? "Sales" : "Service"} KPI targets saved!`);
    setIsOpen(false);
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
            <Button onClick={handleSave}>Save Targets</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}