import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { TierFormData } from "@/hooks/useCompPlanMutations";

interface CommissionTierEditorProps {
  tiers: TierFormData[];
  onChange: (tiers: TierFormData[]) => void;
  payoutType: string;
  tierMetric: string;
}

const TIER_METRIC_LABELS: Record<string, string> = {
  items: "Items",
  policies: "Policies",
  premium: "Premium ($)",
  points: "Points",
  households: "Households",
};

// Separate component for tier row to handle local editing state
function TierRow({
  tier,
  index,
  onUpdate,
  onRemove,
  isPercent,
  isPremiumMetric,
  canRemove,
}: {
  tier: TierFormData;
  index: number;
  onUpdate: (index: number, field: keyof TierFormData, value: number) => void;
  onRemove: (index: number) => void;
  isPercent: boolean;
  isPremiumMetric: boolean;
  canRemove: boolean;
}) {
  const [thresholdValue, setThresholdValue] = useState(tier.min_threshold.toString());
  const [commissionValue, setCommissionValue] = useState(tier.commission_value.toString());

  const handleThresholdChange = (value: string) => {
    setThresholdValue(value);
  };

  const handleThresholdBlur = () => {
    const numValue = thresholdValue === "" ? 0 : parseFloat(thresholdValue);
    const finalValue = isNaN(numValue) ? 0 : numValue;
    setThresholdValue(finalValue.toString());
    onUpdate(index, "min_threshold", finalValue);
  };

  const handleCommissionChange = (value: string) => {
    setCommissionValue(value);
  };

  const handleCommissionBlur = () => {
    const numValue = commissionValue === "" ? 0 : parseFloat(commissionValue);
    const finalValue = isNaN(numValue) ? 0 : numValue;
    setCommissionValue(finalValue.toString());
    onUpdate(index, "commission_value", finalValue);
  };

  return (
    <div className="grid grid-cols-[24px_1fr_1fr_40px] gap-3 items-center p-2 rounded-lg border bg-card">
      <div className="flex items-center justify-center text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </div>
      
      <div className="relative">
        {isPremiumMetric && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
        )}
        <Input
          type="number"
          value={thresholdValue}
          onChange={(e) => handleThresholdChange(e.target.value)}
          onBlur={handleThresholdBlur}
          className={isPremiumMetric ? "pl-7" : ""}
          min={0}
          step={isPremiumMetric ? 100 : 1}
        />
      </div>
      
      <div className="relative">
        {!isPercent && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
        )}
        <Input
          type="number"
          value={commissionValue}
          onChange={(e) => handleCommissionChange(e.target.value)}
          onBlur={handleCommissionBlur}
          className={!isPercent ? "pl-7" : ""}
          min={0}
          step={isPercent ? 0.5 : 0.25}
        />
        {isPercent && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            %
          </span>
        )}
      </div>
      
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(index)}
        className="text-muted-foreground hover:text-destructive"
        disabled={!canRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function CommissionTierEditor({
  tiers,
  onChange,
  payoutType,
  tierMetric,
}: CommissionTierEditorProps) {
  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newThreshold = lastTier ? lastTier.min_threshold + 10 : 0;
    const newValue = lastTier ? lastTier.commission_value : 0;
    
    onChange([
      ...tiers,
      {
        min_threshold: newThreshold,
        commission_value: newValue,
        sort_order: tiers.length,
      },
    ]);
  };

  const removeTier = (index: number) => {
    const newTiers = tiers.filter((_, i) => i !== index);
    onChange(newTiers.map((t, i) => ({ ...t, sort_order: i })));
  };

  const updateTier = (index: number, field: keyof TierFormData, value: number) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    onChange(newTiers);
  };

  const isPercent = payoutType === "percent_of_premium";
  const isPremiumMetric = tierMetric === "premium";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Commission Tiers</Label>
        <Button type="button" variant="outline" size="sm" onClick={addTier}>
          <Plus className="h-4 w-4 mr-1" />
          Add Tier
        </Button>
      </div>

      {tiers.length === 0 ? (
        <div className="text-center py-6 border border-dashed rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            No tiers configured. Add at least one tier.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[24px_1fr_1fr_40px] gap-3 px-2 text-xs font-medium text-muted-foreground">
            <div></div>
            <div>Min {TIER_METRIC_LABELS[tierMetric] || tierMetric}</div>
            <div>Commission {isPercent ? "(%)" : "($)"}</div>
            <div></div>
          </div>

          {/* Tier rows */}
          {tiers.map((tier, index) => (
            <TierRow
              key={tier.id || `tier-${index}`}
              tier={tier}
              index={index}
              onUpdate={updateTier}
              onRemove={removeTier}
              isPercent={isPercent}
              isPremiumMetric={isPremiumMetric}
              canRemove={tiers.length > 1 || index > 0}
            />
          ))}
        </div>
      )}

      {tiers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Tiers are evaluated from highest to lowest threshold. Staff reaching a higher tier earn that commission on all qualifying items.
        </p>
      )}
    </div>
  );
}
