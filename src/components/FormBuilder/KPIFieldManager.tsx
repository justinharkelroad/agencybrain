import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { deduplicateKpisBySlug } from "@/utils/kpiUtils";

interface KPIField {
  key: string;
  label: string;
  required: boolean;
  type: 'number' | 'currency' | 'percentage';
  selectedKpiId?: string; // Links to actual agency KPI
  selectedKpiSlug?: string; // KPI slug for submission mapping
  target?: {
    minimum?: number;
    goal?: number;
    excellent?: number;
  };
}

interface AgencyKPI {
  kpi_id: string;
  slug: string;
  label: string;
  active: boolean;
}

interface KPIFieldManagerProps {
  kpis: KPIField[];
  availableKpis: AgencyKPI[];
  onUpdateLabel: (index: number, label: string) => void;
  onToggleRequired: (index: number) => void;
  onUpdateType: (index: number, type: 'number' | 'currency' | 'percentage') => void;
  onUpdateTarget: (index: number, target: { minimum?: number; goal?: number; excellent?: number }) => void;
  onUpdateKpiSelection: (index: number, kpiId: string, slug: string, label: string) => void;
  onAddField: () => void;
  onRemoveField: (index: number) => void;
}

export default function KPIFieldManager({
  kpis,
  availableKpis,
  onUpdateLabel,
  onToggleRequired,
  onUpdateType,
  onUpdateTarget,
  onUpdateKpiSelection,
  onAddField,
  onRemoveField
}: KPIFieldManagerProps) {
  // Defensive deduplication: prevent duplicate KPIs from appearing in dropdown
  // even if the database returns duplicates (e.g., due to role mismatches)
  const uniqueAvailableKpis = useMemo(() => 
    deduplicateKpisBySlug(availableKpis || []),
    [availableKpis]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          KPI Fields
          <Button onClick={onAddField} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add KPI
          </Button>
        </CardTitle>
        <CardDescription>
          Configure the KPI fields for your form
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {kpis.map((kpi, index) => (
          <div key={`kpi-field-${index}`} className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select KPI</Label>
                  <Select 
                    value={kpi.selectedKpiId || ''} 
                    onValueChange={(kpiId) => {
                      const selectedKpi = availableKpis.find(k => k.kpi_id === kpiId);
                      if (selectedKpi) {
                        onUpdateKpiSelection(index, kpiId, selectedKpi.slug, selectedKpi.label);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a KPI" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueAvailableKpis.map(availKpi => (
                        <SelectItem key={availKpi.kpi_id} value={availKpi.kpi_id}>
                          {availKpi.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                 <Input
                   value={kpi.label}
                   onChange={(e) => onUpdateLabel(index, e.target.value)}
                   placeholder="Display Label"
                 />
                <div className="flex items-center gap-2">
                  <Select 
                    value={kpi.type} 
                    onValueChange={(value: 'number' | 'currency' | 'percentage') => 
                      onUpdateType(index, value)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="currency">Currency</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary">{kpi.selectedKpiSlug || kpi.key}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={kpi.required}
                  onCheckedChange={() => onToggleRequired(index)}
                />
                <Label className="text-sm">Required</Label>
              </div>
              <Button
                onClick={() => onRemoveField(index)}
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            {/* KPI Targets */}
            <div className="border-t pt-3">
              <Label className="text-sm font-medium mb-2 block">Performance Targets</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Minimum</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={kpi.target?.minimum || ''}
                    onChange={(e) => onUpdateTarget(index, {
                      ...kpi.target,
                      minimum: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Goal</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={kpi.target?.goal || ''}
                    onChange={(e) => onUpdateTarget(index, {
                      ...kpi.target,
                      goal: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Excellent</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={kpi.target?.excellent || ''}
                    onChange={(e) => onUpdateTarget(index, {
                      ...kpi.target,
                      excellent: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}