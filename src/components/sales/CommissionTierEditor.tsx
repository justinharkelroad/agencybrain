import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { TierFormData } from "@/hooks/useCompPlanMutations";

interface CommissionTierEditorProps {
  tiers: TierFormData[];
  onChange: (tiers: TierFormData[]) => void;
  payoutType: string;
  tierMetric: string;
}

const TIER_METRIC_LABELS: Record<string, string> = {
  items: "Items Written",
  policies: "Policies",
  premium: "Premium ($)",
  points: "Points",
  households: "Households",
};

// Key format: "tierIndex-fieldName"
type DraftKey = `${number}-${"min_threshold" | "commission_value"}`;

export function CommissionTierEditor({
  tiers,
  onChange,
  payoutType,
  tierMetric,
}: CommissionTierEditorProps) {
  const isPercent = payoutType === "percent_of_premium";
  const isPremiumMetric = tierMetric === "premium";

  // Local draft state for inputs while user is typing
  const [drafts, setDrafts] = useState<Record<DraftKey, string>>({});

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const step = isPremiumMetric ? 10000 : 10;
    const newThreshold = lastTier ? lastTier.min_threshold + step : 0;
    const newValue = lastTier ? lastTier.commission_value : 0;

    onChange([
      ...tiers,
      { min_threshold: newThreshold, commission_value: newValue, sort_order: tiers.length },
    ]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return;
    const newTiers = tiers.filter((_, i) => i !== index);
    onChange(newTiers.map((t, i) => ({ ...t, sort_order: i })));
    // Clear any drafts for removed tier
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[`${index}-min_threshold`];
      delete next[`${index}-commission_value`];
      return next;
    });
  };

  // Handle input change - store raw string in draft
  const handleInputChange = (
    index: number,
    field: "min_threshold" | "commission_value",
    value: string
  ) => {
    const key: DraftKey = `${index}-${field}`;
    setDrafts((prev) => ({ ...prev, [key]: value }));
  };

  // Handle blur - commit numeric value to tiers
  const handleInputBlur = (
    index: number,
    field: "min_threshold" | "commission_value"
  ) => {
    const key: DraftKey = `${index}-${field}`;
    const draftValue = drafts[key];

    // If no draft exists, nothing to commit
    if (draftValue === undefined) return;

    // Parse the value, default to 0 if empty or invalid
    const numValue = draftValue === "" ? 0 : parseFloat(draftValue);
    const finalValue = Number.isFinite(numValue) ? numValue : 0;

    // Update tiers
    const newTiers = tiers.map((t, i) =>
      i === index ? { ...t, [field]: finalValue } : t
    );
    onChange(newTiers);

    // Clear the draft
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Get displayed value for an input
  const getDisplayValue = (
    index: number,
    field: "min_threshold" | "commission_value",
    numericValue: number
  ): string => {
    const key: DraftKey = `${index}-${field}`;
    // If actively editing (draft exists), show draft
    if (drafts[key] !== undefined) {
      return drafts[key];
    }
    // If value is 0, show empty string so placeholder appears
    if (numericValue === 0) {
      return "";
    }
    return String(numericValue);
  };

  // Get placeholder for an input
  const getPlaceholder = (field: "min_threshold" | "commission_value"): string => {
    if (field === "min_threshold") {
      return "0";
    }
    // commission_value
    return isPercent ? "0" : "0.00";
  };

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
          <div className="grid grid-cols-[1fr_1fr_40px] gap-3 px-2 text-xs font-medium text-muted-foreground">
            <div>Min {TIER_METRIC_LABELS[tierMetric] || tierMetric}</div>
            <div>Commission {isPercent ? "(%)" : "($)"}</div>
            <div />
          </div>

          {/* Tier rows */}
          {tiers.map((tier, index) => (
            <div
              key={tier.id || `tier-${index}`}
              className="grid grid-cols-[1fr_1fr_40px] gap-3 items-center p-2 rounded-lg border bg-card"
            >
              <div className="relative">
                {isPremiumMetric && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                )}
                <Input
                  type="number"
                  value={getDisplayValue(index, "min_threshold", tier.min_threshold)}
                  onChange={(e) => handleInputChange(index, "min_threshold", e.target.value)}
                  onBlur={() => handleInputBlur(index, "min_threshold")}
                  placeholder={getPlaceholder("min_threshold")}
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
                  value={getDisplayValue(index, "commission_value", tier.commission_value)}
                  onChange={(e) => handleInputChange(index, "commission_value", e.target.value)}
                  onBlur={() => handleInputBlur(index, "commission_value")}
                  placeholder={getPlaceholder("commission_value")}
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
                onClick={() => removeTier(index)}
                className="text-muted-foreground hover:text-destructive"
                disabled={tiers.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
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
