import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { Loader2 } from "lucide-react";

// Stable empty arrays to avoid new references each render
const EMPTY_TEAM_MEMBERS: { id: string; name: string }[] = [];
const EMPTY_ASSIGNMENTS: string[] = [];
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CompPlan, BundleConfigs, BundleTypeConfig, ProductRates, PointValues, BundlingMultipliers, CommissionModifiers } from "@/hooks/useCompPlans";
import { useCompPlanMutations, TierFormData } from "@/hooks/useCompPlanMutations";
import { CommissionTierEditor } from "./CommissionTierEditor";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Pre-fill config from AI assistant
export interface CompPlanPrefillConfig {
  name?: string;
  description?: string;
  is_active?: boolean;
  payout_type?: string;
  tier_metric?: string;
  chargeback_rule?: string;
  tiers?: Array<{ min_threshold: number; commission_value: number; sort_order?: number }>;
  brokered_payout_type?: string;
  brokered_flat_rate?: number;
  brokered_counts_toward_tier?: boolean;
  brokered_tiers?: Array<{ min_threshold: number; commission_value: number; sort_order?: number }>;
  bundle_configs?: BundleConfigs;
  product_rates?: ProductRates;
  point_values?: PointValues;
  bundling_multipliers?: BundlingMultipliers;
  commission_modifiers?: CommissionModifiers;
}

interface CreateCompPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string | null;
  editPlan?: CompPlan | null;
  prefillConfig?: CompPlanPrefillConfig | null;
  showAIBanner?: boolean;
}

const PAYOUT_TYPES = [
  { value: "flat_per_item", label: "Flat $ per Item" },
  { value: "percent_of_premium", label: "% of Premium" },
  { value: "flat_per_policy", label: "Flat $ per Policy" },
  { value: "flat_per_household", label: "Flat $ per Household" },
];

const BROKERED_PAYOUT_TYPES = [
  { value: "flat_per_item", label: "Flat Rate per Item" },
  { value: "percent_of_premium", label: "% of Premium" },
  { value: "tiered", label: "Tiered" },
];

const TIER_METRICS = [
  { value: "items", label: "Items Written" },
  { value: "policies", label: "Policies Written" },
  { value: "premium", label: "Written Premium" },
  { value: "points", label: "Points Earned" },
  { value: "households", label: "Households Sold" },
];

const CHARGEBACK_RULES = [
  { value: "none", label: "No Chargebacks" },
  { value: "full", label: "Full Chargeback" },
  { value: "three_month", label: "3-Month Rule" },
];

export function CreateCompPlanModal({
  open,
  onOpenChange,
  agencyId,
  editPlan,
  prefillConfig,
  showAIBanner = false,
}: CreateCompPlanModalProps) {
  const isEditing = !!editPlan;
  const [showPrefillBanner, setShowPrefillBanner] = useState(showAIBanner);
  const { createPlan, updatePlan } = useCompPlanMutations(agencyId);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [payoutType, setPayoutType] = useState("flat_per_item");
  const [tierMetric, setTierMetric] = useState("items");
  const [chargebackRule, setChargebackRule] = useState("none");
  const [isActive, setIsActive] = useState(true);
  const [brokeredPayoutType, setBrokeredPayoutType] = useState("flat_per_item");
  const [brokeredFlatRate, setBrokeredFlatRate] = useState<string>("");
  const [brokeredCountsTowardTier, setBrokeredCountsTowardTier] = useState(false);
  const [brokeredTiers, setBrokeredTiers] = useState<TierFormData[]>([
    { min_threshold: 0, commission_value: 0, sort_order: 0 },
  ]);
  const [tiers, setTiers] = useState<TierFormData[]>([
    { min_threshold: 0, commission_value: 0, sort_order: 0 },
  ]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Advanced compensation configuration state
  const [useBundleConfigs, setUseBundleConfigs] = useState(false);
  const [bundleConfigs, setBundleConfigs] = useState<BundleConfigs>({
    monoline: { enabled: false, payout_type: 'percent_of_premium', rate: 5 },
    standard: { enabled: false, payout_type: 'flat_per_item', rate: 20 },
    preferred: { enabled: false, payout_type: 'flat_per_item', rate: 25 },
  });
  const [expandedBundleTypes, setExpandedBundleTypes] = useState<Record<string, boolean>>({
    monoline: false,
    standard: false,
    preferred: false,
  });

  const [useProductRates, setUseProductRates] = useState(false);
  const [productRates, setProductRates] = useState<ProductRates>({});

  // Extended configuration state (Phase 2)
  const [usePointValues, setUsePointValues] = useState(false);
  const [pointValues, setPointValues] = useState<PointValues>({});
  const [useBundlingMultipliers, setUseBundlingMultipliers] = useState(false);
  const [bundlingMultipliers, setBundlingMultipliers] = useState<BundlingMultipliers>({ thresholds: [] });
  const [useCommissionModifiers, setUseCommissionModifiers] = useState(false);
  const [commissionModifiers, setCommissionModifiers] = useState<CommissionModifiers>({});

  // Fetch team members
  const { data: teamMembersData } = useQuery({
    queryKey: ["team-members-comp", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("agency_id", agencyId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!agencyId && open,
  });
  const teamMembers = teamMembersData ?? EMPTY_TEAM_MEMBERS;

  // Fetch current assignments if editing
  const { data: existingAssignmentsData } = useQuery({
    queryKey: ["comp-plan-assignments", editPlan?.id],
    queryFn: async () => {
      if (!editPlan?.id) return [];
      const { data, error } = await supabase
        .from("comp_plan_assignments")
        .select("team_member_id")
        .eq("comp_plan_id", editPlan.id)
        .is("end_date", null);
      if (error) throw error;
      return data.map((a) => a.team_member_id);
    },
    enabled: !!editPlan?.id && open,
  });
  const existingAssignments = existingAssignmentsData ?? EMPTY_ASSIGNMENTS;

  // Initialize form when editing
  useEffect(() => {
    
    if (editPlan) {
      setName(editPlan.name);
      setDescription(editPlan.description || "");
      setPayoutType(editPlan.payout_type);
      setTierMetric(editPlan.tier_metric);
      setChargebackRule(editPlan.chargeback_rule);
      setIsActive(editPlan.is_active);
      setBrokeredPayoutType(editPlan.brokered_payout_type || "flat_per_item");
      setBrokeredFlatRate(editPlan.brokered_flat_rate?.toString() || "");
      setBrokeredCountsTowardTier(editPlan.brokered_counts_toward_tier || false);
      setTiers(
        editPlan.tiers.length > 0
          ? editPlan.tiers.map((t, i) => ({
              id: t.id,
              min_threshold: t.min_threshold,
              commission_value: t.commission_value,
              sort_order: i,
            }))
          : [{ min_threshold: 0, commission_value: 0, sort_order: 0 }]
      );
      setBrokeredTiers(
        editPlan.brokered_tiers && editPlan.brokered_tiers.length > 0
          ? editPlan.brokered_tiers.map((t, i) => ({
              id: t.id,
              min_threshold: t.min_threshold,
              commission_value: t.commission_value,
              sort_order: i,
            }))
          : [{ min_threshold: 0, commission_value: 0, sort_order: 0 }]
      );

      // Initialize bundle configs if present
      if (editPlan.bundle_configs) {
        setUseBundleConfigs(true);
        setBundleConfigs({
          monoline: editPlan.bundle_configs.monoline || { enabled: false, payout_type: 'percent_of_premium', rate: 5 },
          standard: editPlan.bundle_configs.standard || { enabled: false, payout_type: 'flat_per_item', rate: 20 },
          preferred: editPlan.bundle_configs.preferred || { enabled: false, payout_type: 'flat_per_item', rate: 25 },
        });
      } else {
        setUseBundleConfigs(false);
        setBundleConfigs({
          monoline: { enabled: false, payout_type: 'percent_of_premium', rate: 5 },
          standard: { enabled: false, payout_type: 'flat_per_item', rate: 20 },
          preferred: { enabled: false, payout_type: 'flat_per_item', rate: 25 },
        });
      }

      // Initialize product rates if present
      if (editPlan.product_rates && Object.keys(editPlan.product_rates).length > 0) {
        setUseProductRates(true);
        setProductRates(editPlan.product_rates);
      } else {
        setUseProductRates(false);
        setProductRates({});
      }

      // Initialize point values if present (Phase 2)
      if (editPlan.point_values && Object.keys(editPlan.point_values).length > 0) {
        setUsePointValues(true);
        setPointValues(editPlan.point_values);
      } else {
        setUsePointValues(false);
        setPointValues({});
      }

      // Initialize bundling multipliers if present (Phase 2)
      if (editPlan.bundling_multipliers?.thresholds && editPlan.bundling_multipliers.thresholds.length > 0) {
        setUseBundlingMultipliers(true);
        setBundlingMultipliers(editPlan.bundling_multipliers);
      } else {
        setUseBundlingMultipliers(false);
        setBundlingMultipliers({ thresholds: [] });
      }

      // Initialize commission modifiers if present (Phase 2)
      if (editPlan.commission_modifiers && (editPlan.commission_modifiers.self_gen_requirement || editPlan.commission_modifiers.self_gen_kicker)) {
        setUseCommissionModifiers(true);
        setCommissionModifiers(editPlan.commission_modifiers);
      } else {
        setUseCommissionModifiers(false);
        setCommissionModifiers({});
      }
    } else if (!prefillConfig) {
      resetForm();
    }
  }, [editPlan]);

  // Initialize form when AI assistant provides prefill config
  useEffect(() => {
    if (!prefillConfig || editPlan) return;

    // Apply prefill values
    if (prefillConfig.name) setName(prefillConfig.name);
    if (prefillConfig.description) setDescription(prefillConfig.description);
    if (prefillConfig.payout_type) setPayoutType(prefillConfig.payout_type);
    if (prefillConfig.tier_metric) setTierMetric(prefillConfig.tier_metric);
    if (prefillConfig.chargeback_rule) setChargebackRule(prefillConfig.chargeback_rule);
    if (prefillConfig.is_active !== undefined) setIsActive(prefillConfig.is_active);

    // Tiers
    if (prefillConfig.tiers && prefillConfig.tiers.length > 0) {
      setTiers(prefillConfig.tiers.map((t, i) => ({
        min_threshold: t.min_threshold,
        commission_value: t.commission_value,
        sort_order: t.sort_order ?? i,
      })));
    }

    // Brokered business
    if (prefillConfig.brokered_payout_type) setBrokeredPayoutType(prefillConfig.brokered_payout_type);
    if (prefillConfig.brokered_flat_rate !== undefined) setBrokeredFlatRate(prefillConfig.brokered_flat_rate.toString());
    if (prefillConfig.brokered_counts_toward_tier !== undefined) setBrokeredCountsTowardTier(prefillConfig.brokered_counts_toward_tier);
    if (prefillConfig.brokered_tiers && prefillConfig.brokered_tiers.length > 0) {
      setBrokeredTiers(prefillConfig.brokered_tiers.map((t, i) => ({
        min_threshold: t.min_threshold,
        commission_value: t.commission_value,
        sort_order: t.sort_order ?? i,
      })));
    }

    // Bundle configs
    if (prefillConfig.bundle_configs) {
      setUseBundleConfigs(true);
      setBundleConfigs({
        monoline: prefillConfig.bundle_configs.monoline || { enabled: false, payout_type: 'percent_of_premium', rate: 5 },
        standard: prefillConfig.bundle_configs.standard || { enabled: false, payout_type: 'flat_per_item', rate: 20 },
        preferred: prefillConfig.bundle_configs.preferred || { enabled: false, payout_type: 'flat_per_item', rate: 25 },
      });
    }

    // Product rates
    if (prefillConfig.product_rates && Object.keys(prefillConfig.product_rates).length > 0) {
      setUseProductRates(true);
      setProductRates(prefillConfig.product_rates);
    }

    // Point values
    if (prefillConfig.point_values && Object.keys(prefillConfig.point_values).length > 0) {
      setUsePointValues(true);
      setPointValues(prefillConfig.point_values);
    }

    // Bundling multipliers
    if (prefillConfig.bundling_multipliers?.thresholds && prefillConfig.bundling_multipliers.thresholds.length > 0) {
      setUseBundlingMultipliers(true);
      setBundlingMultipliers(prefillConfig.bundling_multipliers);
    }

    // Commission modifiers
    if (prefillConfig.commission_modifiers) {
      setUseCommissionModifiers(true);
      setCommissionModifiers(prefillConfig.commission_modifiers);
    }

    setShowPrefillBanner(true);
  }, [prefillConfig, editPlan]);

  // Set existing assignments when loaded
  useEffect(() => {
    if (!open || !editPlan?.id) return;
    if (existingAssignments.length === 0) return;

    const sameMembers = (a: string[], b: string[]) => {
      if (a.length !== b.length) return false;
      const setA = new Set(a);
      for (const id of b) {
        if (!setA.has(id)) return false;
      }
      return true;
    };

    setSelectedMembers((prev) => (sameMembers(prev, existingAssignments) ? prev : existingAssignments));
  }, [existingAssignments, open, editPlan?.id]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setPayoutType("flat_per_item");
    setTierMetric("items");
    setChargebackRule("none");
    setIsActive(true);
    setBrokeredPayoutType("flat_per_item");
    setBrokeredFlatRate("");
    setBrokeredCountsTowardTier(false);
    setBrokeredTiers([{ min_threshold: 0, commission_value: 0, sort_order: 0 }]);
    setTiers([{ min_threshold: 0, commission_value: 0, sort_order: 0 }]);
    setSelectedMembers([]);
    // Reset advanced configuration
    setUseBundleConfigs(false);
    setBundleConfigs({
      monoline: { enabled: false, payout_type: 'percent_of_premium', rate: 5 },
      standard: { enabled: false, payout_type: 'flat_per_item', rate: 20 },
      preferred: { enabled: false, payout_type: 'flat_per_item', rate: 25 },
    });
    setExpandedBundleTypes({ monoline: false, standard: false, preferred: false });
    setUseProductRates(false);
    setProductRates({});
    // Reset extended configuration (Phase 2)
    setUsePointValues(false);
    setPointValues({});
    setUseBundlingMultipliers(false);
    setBundlingMultipliers({ thresholds: [] });
    setUseCommissionModifiers(false);
    setCommissionModifiers({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a plan name");
      return;
    }

    if (tiers.length === 0) {
      toast.error("Please add at least one commission tier");
      return;
    }

    // Sort tiers by threshold (ascending)
    const sortedTiers = [...tiers].sort((a, b) => a.min_threshold - b.min_threshold);
    const sortedBrokeredTiers = [...brokeredTiers].sort((a, b) => a.min_threshold - b.min_threshold);

    // Prepare bundle configs only if enabled and at least one bundle type is configured
    const effectiveBundleConfigs = useBundleConfigs && (
      bundleConfigs.monoline?.enabled ||
      bundleConfigs.standard?.enabled ||
      bundleConfigs.preferred?.enabled
    ) ? bundleConfigs : null;

    // Prepare product rates only if enabled and has entries
    const effectiveProductRates = useProductRates && Object.keys(productRates).length > 0
      ? productRates
      : null;

    // Prepare point values only if enabled and has entries (Phase 2)
    const effectivePointValues = usePointValues && Object.keys(pointValues).length > 0
      ? pointValues
      : null;

    // Prepare bundling multipliers only if enabled and has thresholds (Phase 2)
    const effectiveBundlingMultipliers = useBundlingMultipliers && bundlingMultipliers.thresholds.length > 0
      ? bundlingMultipliers
      : null;

    // Prepare commission modifiers only if enabled and has config (Phase 2)
    const effectiveCommissionModifiers = useCommissionModifiers && (
      commissionModifiers.self_gen_requirement || commissionModifiers.self_gen_kicker
    ) ? commissionModifiers : null;

    const formData = {
      id: editPlan?.id,
      name: name.trim(),
      description: description.trim() || null,
      payout_type: payoutType,
      tier_metric: tierMetric,
      chargeback_rule: chargebackRule,
      policy_type_filter: null,
      brokered_payout_type: brokeredPayoutType,
      brokered_flat_rate: brokeredFlatRate ? parseFloat(brokeredFlatRate) : null,
      brokered_counts_toward_tier: brokeredCountsTowardTier,
      is_active: isActive,
      tiers: sortedTiers,
      brokered_tiers: brokeredPayoutType === 'tiered' ? sortedBrokeredTiers : [],
      assigned_member_ids: selectedMembers,
      bundle_configs: effectiveBundleConfigs,
      product_rates: effectiveProductRates,
      point_values: effectivePointValues,
      bundling_multipliers: effectiveBundlingMultipliers,
      commission_modifiers: effectiveCommissionModifiers,
    };

    if (isEditing) {
      updatePlan.mutate(formData, {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      });
    } else {
      createPlan.mutate(formData, {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      });
    }
  };

  const setMemberChecked = useCallback((memberId: string, checked: boolean) => {
    
    setSelectedMembers((prev) => {
      const isCurrentlySelected = prev.includes(memberId);
      // Idempotent: only change if needed
      if (checked && !isCurrentlySelected) {
        return [...prev, memberId];
      }
      if (!checked && isCurrentlySelected) {
        return prev.filter((id) => id !== memberId);
      }
      return prev; // No change needed
    });
  }, []);

  const handleTiersChange = useCallback((newTiers: TierFormData[]) => {
    
    setTiers(newTiers);
  }, []);

  const isPending = createPlan.isPending || updatePlan.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {isEditing ? "Edit Compensation Plan" : "Create Compensation Plan"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update plan settings, tiers, and staff assignments." 
              : "Configure commission structure and assign team members."}
          </DialogDescription>
        </DialogHeader>

        {/* AI Prefill Banner */}
        {showPrefillBanner && prefillConfig && (
          <div className="mx-1 mb-2 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
            <p className="text-sm">
              This form has been pre-filled based on your conversation with the AI assistant. Review and adjust as needed.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPrefillBanner(false)}
            >
              Dismiss
            </Button>
          </div>
        )}

        <div
          className="flex-1 overflow-auto pr-4"
          style={{ maxHeight: "calc(90vh - 120px)" }}
        >
          <form onSubmit={handleSubmit} className="space-y-6 pb-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Standard Agent Commission"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description of this plan"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is-active">Active</Label>
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>

            {/* Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Payout Type</Label>
                <Select value={payoutType} onValueChange={setPayoutType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYOUT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tier Metric</Label>
                <Select value={tierMetric} onValueChange={setTierMetric}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIER_METRICS.map((metric) => (
                      <SelectItem key={metric.value} value={metric.value}>
                        {metric.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Chargeback Rule</Label>
                <Select value={chargebackRule} onValueChange={setChargebackRule}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHARGEBACK_RULES.map((rule) => (
                      <SelectItem key={rule.value} value={rule.value}>
                        {rule.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Brokered Business */}
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <Label className="text-base font-medium">Brokered Business</Label>
              
              {/* Payout Type Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payout Type</Label>
                  <Select value={brokeredPayoutType} onValueChange={setBrokeredPayoutType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BROKERED_PAYOUT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Flat Rate per Item Input */}
                {brokeredPayoutType === 'flat_per_item' && (
                  <div className="space-y-2">
                    <Label htmlFor="brokered-rate">Rate per Item</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="brokered-rate"
                        type="number"
                        value={brokeredFlatRate}
                        onChange={(e) => setBrokeredFlatRate(e.target.value)}
                        className="pl-7"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                )}

                {/* Percent of Premium Input */}
                {brokeredPayoutType === 'percent_of_premium' && (
                  <div className="space-y-2">
                    <Label htmlFor="brokered-percent">Percentage</Label>
                    <div className="relative">
                      <Input
                        id="brokered-percent"
                        type="number"
                        value={brokeredFlatRate}
                        onChange={(e) => setBrokeredFlatRate(e.target.value)}
                        className="pr-7"
                        placeholder="0"
                        step="0.1"
                        min="0"
                        max="100"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tiered Brokered Commission */}
              {brokeredPayoutType === 'tiered' && (
                <div className="space-y-2 pt-2">
                  <Label className="text-sm text-muted-foreground">Brokered Commission Tiers</Label>
                  <CommissionTierEditor
                    tiers={brokeredTiers}
                    onChange={setBrokeredTiers}
                    payoutType="percent_of_premium"
                    tierMetric={tierMetric}
                  />
                </div>
              )}

              {/* Counts toward tier checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="brokered-counts"
                  checked={brokeredCountsTowardTier}
                  onCheckedChange={(checked) =>
                    setBrokeredCountsTowardTier(checked === true)
                  }
                />
                <Label htmlFor="brokered-counts" className="font-normal">
                  Counts toward tier threshold
                </Label>
              </div>
            </div>

            {/* Bundle Type Configuration Section */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="use-bundle-configs"
                    checked={useBundleConfigs}
                    onCheckedChange={setUseBundleConfigs}
                  />
                  <Label htmlFor="use-bundle-configs" className="font-medium">
                    Configure by Bundle Type
                  </Label>
                </div>
                {useBundleConfigs && (
                  <span className="text-xs text-muted-foreground">
                    Pay different rates for Mono/Standard/Preferred
                  </span>
                )}
              </div>

              {useBundleConfigs && (
                <div className="space-y-3 pt-2">
                  {(['monoline', 'standard', 'preferred'] as const).map((bundleType) => {
                    const config = bundleConfigs[bundleType];
                    const isExpanded = expandedBundleTypes[bundleType];
                    const bundleLabel = bundleType === 'monoline' ? 'Monoline' :
                                       bundleType === 'standard' ? 'Standard Bundle' : 'Preferred Bundle';

                    return (
                      <Collapsible
                        key={bundleType}
                        open={isExpanded}
                        onOpenChange={(open) =>
                          setExpandedBundleTypes((prev) => ({ ...prev, [bundleType]: open }))
                        }
                      >
                        <div className="rounded-md border bg-background">
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between p-3 hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <span className="font-medium">{bundleLabel}</span>
                                {config?.enabled && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    {config.payout_type === 'percent_of_premium'
                                      ? `${config.rate || 0}%`
                                      : `$${config.rate || 0}/item`}
                                  </span>
                                )}
                              </div>
                              <Switch
                                checked={config?.enabled || false}
                                onCheckedChange={(checked) => {
                                  setBundleConfigs((prev) => ({
                                    ...prev,
                                    [bundleType]: { ...prev[bundleType]!, enabled: checked },
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </button>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            {config?.enabled && (
                              <div className="space-y-4 p-4 pt-0 border-t">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Payout Type</Label>
                                    <Select
                                      value={config.payout_type}
                                      onValueChange={(value) => {
                                        setBundleConfigs((prev) => ({
                                          ...prev,
                                          [bundleType]: { ...prev[bundleType]!, payout_type: value },
                                        }));
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {PAYOUT_TYPES.map((type) => (
                                          <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>
                                      {config.payout_type === 'percent_of_premium'
                                        ? 'Percentage'
                                        : 'Amount'}
                                    </Label>
                                    <div className="relative">
                                      <Input
                                        type="number"
                                        value={config.rate || ''}
                                        onChange={(e) => {
                                          setBundleConfigs((prev) => ({
                                            ...prev,
                                            [bundleType]: {
                                              ...prev[bundleType]!,
                                              rate: parseFloat(e.target.value) || 0,
                                            },
                                          }));
                                        }}
                                        className={
                                          config.payout_type === 'percent_of_premium'
                                            ? 'pr-7'
                                            : 'pl-6'
                                        }
                                        placeholder="0"
                                        step="0.01"
                                        min="0"
                                      />
                                      {config.payout_type === 'percent_of_premium' ? (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                          %
                                        </span>
                                      ) : (
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                          $
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Product Rates Configuration Section */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="use-product-rates"
                    checked={useProductRates}
                    onCheckedChange={setUseProductRates}
                  />
                  <Label htmlFor="use-product-rates" className="font-medium">
                    Configure by Product
                  </Label>
                </div>
                {useProductRates && (
                  <span className="text-xs text-muted-foreground">
                    Set specific rates per product (overrides bundle rates)
                  </span>
                )}
              </div>

              {useProductRates && (
                <div className="space-y-3 pt-2">
                  {Object.entries(productRates).map(([productName, config]) => (
                    <div
                      key={productName}
                      className="flex items-center gap-3 p-3 rounded-md border bg-background"
                    >
                      <div className="flex-1 grid grid-cols-3 gap-3 items-center">
                        <span className="font-medium">{productName}</span>
                        <Select
                          value={config.payout_type}
                          onValueChange={(value) => {
                            setProductRates((prev) => ({
                              ...prev,
                              [productName]: { ...prev[productName], payout_type: value },
                            }));
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYOUT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="relative">
                          <Input
                            type="number"
                            value={config.rate || ''}
                            onChange={(e) => {
                              setProductRates((prev) => ({
                                ...prev,
                                [productName]: {
                                  ...prev[productName],
                                  rate: parseFloat(e.target.value) || 0,
                                },
                              }));
                            }}
                            className={`h-9 ${
                              config.payout_type === 'percent_of_premium' ? 'pr-7' : 'pl-6'
                            }`}
                            placeholder="0"
                            step="0.01"
                            min="0"
                          />
                          {config.payout_type === 'percent_of_premium' ? (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                              %
                            </span>
                          ) : (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                              $
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        onClick={() => {
                          setProductRates((prev) => {
                            const updated = { ...prev };
                            delete updated[productName];
                            return updated;
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {/* Add Product Button */}
                  <div className="flex gap-2">
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value && !productRates[value]) {
                          setProductRates((prev) => ({
                            ...prev,
                            [value]: { payout_type: 'flat_per_item', rate: 0 },
                          }));
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Add a product..." />
                      </SelectTrigger>
                      <SelectContent>
                        {['Auto', 'Homeowners', 'Renters', 'Condo', 'Umbrella', 'Landlord/Dwelling']
                          .filter((p) => !productRates[p])
                          .map((product) => (
                            <SelectItem key={product} value={product}>
                              {product}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Point Values Configuration (only when tier_metric is 'points') */}
            {tierMetric === 'points' && (
              <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="use-point-values"
                      checked={usePointValues}
                      onCheckedChange={setUsePointValues}
                    />
                    <Label htmlFor="use-point-values" className="font-medium">
                      Custom Point Values
                    </Label>
                  </div>
                  {usePointValues && (
                    <span className="text-xs text-muted-foreground">
                      Assign different point weights per product
                    </span>
                  )}
                </div>

                {usePointValues && (
                  <div className="space-y-3 pt-2">
                    {Object.entries(pointValues).map(([productName, points]) => (
                      <div
                        key={productName}
                        className="flex items-center gap-3 p-3 rounded-md border bg-background"
                      >
                        <span className="flex-1 font-medium">{productName}</span>
                        <div className="w-24">
                          <Input
                            type="number"
                            value={points}
                            onChange={(e) => {
                              setPointValues((prev) => ({
                                ...prev,
                                [productName]: parseFloat(e.target.value) || 0,
                              }));
                            }}
                            className="h-9"
                            placeholder="1"
                            step="0.5"
                            min="0"
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">pts</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                          onClick={() => {
                            setPointValues((prev) => {
                              const updated = { ...prev };
                              delete updated[productName];
                              return updated;
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    {/* Add Product for Points */}
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value && !pointValues[value]) {
                          setPointValues((prev) => ({
                            ...prev,
                            [value]: 1,
                          }));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Add a product..." />
                      </SelectTrigger>
                      <SelectContent>
                        {['Auto', 'Homeowners', 'Renters', 'Life', 'Umbrella', 'Condo']
                          .filter((p) => !pointValues[p])
                          .map((product) => (
                            <SelectItem key={product} value={product}>
                              {product}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Bundling Multipliers Configuration */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="use-bundling-multipliers"
                    checked={useBundlingMultipliers}
                    onCheckedChange={setUseBundlingMultipliers}
                  />
                  <Label htmlFor="use-bundling-multipliers" className="font-medium">
                    Bundling Multipliers
                  </Label>
                </div>
                {useBundlingMultipliers && (
                  <span className="text-xs text-muted-foreground">
                    Bonus multiplier based on bundle %
                  </span>
                )}
              </div>

              {useBundlingMultipliers && (
                <div className="space-y-3 pt-2">
                  {bundlingMultipliers.thresholds.map((threshold, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-md border bg-background"
                    >
                      <span className="text-sm">At</span>
                      <div className="w-20">
                        <Input
                          type="number"
                          value={threshold.min_percent}
                          onChange={(e) => {
                            const newThresholds = [...bundlingMultipliers.thresholds];
                            newThresholds[index] = {
                              ...newThresholds[index],
                              min_percent: parseFloat(e.target.value) || 0,
                            };
                            setBundlingMultipliers({ thresholds: newThresholds });
                          }}
                          className="h-9"
                          placeholder="50"
                          min="0"
                          max="100"
                        />
                      </div>
                      <span className="text-sm">% bundled, apply</span>
                      <div className="w-20">
                        <Input
                          type="number"
                          value={threshold.multiplier}
                          onChange={(e) => {
                            const newThresholds = [...bundlingMultipliers.thresholds];
                            newThresholds[index] = {
                              ...newThresholds[index],
                              multiplier: parseFloat(e.target.value) || 1,
                            };
                            setBundlingMultipliers({ thresholds: newThresholds });
                          }}
                          className="h-9"
                          placeholder="1.1"
                          step="0.05"
                          min="1"
                        />
                      </div>
                      <span className="text-sm">x multiplier</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        onClick={() => {
                          const newThresholds = bundlingMultipliers.thresholds.filter((_, i) => i !== index);
                          setBundlingMultipliers({ thresholds: newThresholds });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBundlingMultipliers({
                        thresholds: [
                          ...bundlingMultipliers.thresholds,
                          { min_percent: 50, multiplier: 1.1 },
                        ],
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Threshold
                  </Button>
                </div>
              )}
            </div>

            {/* Self-Gen Commission Modifiers */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="use-commission-modifiers"
                    checked={useCommissionModifiers}
                    onCheckedChange={setUseCommissionModifiers}
                  />
                  <Label htmlFor="use-commission-modifiers" className="font-medium">
                    Self-Gen Modifiers
                  </Label>
                </div>
                {useCommissionModifiers && (
                  <span className="text-xs text-muted-foreground">
                    Requirements and bonuses for self-generated leads
                  </span>
                )}
              </div>

              {useCommissionModifiers && (
                <div className="space-y-4 pt-2">
                  {/* Self-Gen Requirement */}
                  <div className="space-y-3 p-3 rounded-md border bg-background">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">Self-Gen Requirement</Label>
                      <Switch
                        checked={!!commissionModifiers.self_gen_requirement}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCommissionModifiers((prev) => ({
                              ...prev,
                              self_gen_requirement: {
                                min_percent: 25,
                                source: 'written',
                                affects_qualification: true,
                                affects_payout: false,
                              },
                            }));
                          } else {
                            setCommissionModifiers((prev) => {
                              const { self_gen_requirement, ...rest } = prev;
                              return rest;
                            });
                          }
                        }}
                      />
                    </div>
                    {commissionModifiers.self_gen_requirement && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Min Self-Gen %</Label>
                          <Input
                            type="number"
                            value={commissionModifiers.self_gen_requirement.min_percent}
                            onChange={(e) => {
                              setCommissionModifiers((prev) => ({
                                ...prev,
                                self_gen_requirement: {
                                  ...prev.self_gen_requirement!,
                                  min_percent: parseFloat(e.target.value) || 0,
                                },
                              }));
                            }}
                            className="h-9"
                            min="0"
                            max="100"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Based On</Label>
                          <Select
                            value={commissionModifiers.self_gen_requirement.source}
                            onValueChange={(value: 'written' | 'issued') => {
                              setCommissionModifiers((prev) => ({
                                ...prev,
                                self_gen_requirement: {
                                  ...prev.self_gen_requirement!,
                                  source: value,
                                },
                              }));
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="written">Written Business</SelectItem>
                              <SelectItem value="issued">Issued Business</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Self-Gen Kicker */}
                  <div className="space-y-3 p-3 rounded-md border bg-background">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">Self-Gen Kicker Bonus</Label>
                      <Switch
                        checked={!!commissionModifiers.self_gen_kicker?.enabled}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCommissionModifiers((prev) => ({
                              ...prev,
                              self_gen_kicker: {
                                enabled: true,
                                type: 'per_item',
                                amount: 5,
                                min_self_gen_percent: 30,
                              },
                            }));
                          } else {
                            setCommissionModifiers((prev) => {
                              const { self_gen_kicker, ...rest } = prev;
                              return rest;
                            });
                          }
                        }}
                      />
                    </div>
                    {commissionModifiers.self_gen_kicker?.enabled && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={commissionModifiers.self_gen_kicker.type}
                            onValueChange={(value: 'per_item' | 'per_policy' | 'per_household') => {
                              setCommissionModifiers((prev) => ({
                                ...prev,
                                self_gen_kicker: {
                                  ...prev.self_gen_kicker!,
                                  type: value,
                                },
                              }));
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="per_item">Per Item</SelectItem>
                              <SelectItem value="per_policy">Per Policy</SelectItem>
                              <SelectItem value="per_household">Per Household</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Amount ($)</Label>
                          <Input
                            type="number"
                            value={commissionModifiers.self_gen_kicker.amount}
                            onChange={(e) => {
                              setCommissionModifiers((prev) => ({
                                ...prev,
                                self_gen_kicker: {
                                  ...prev.self_gen_kicker!,
                                  amount: parseFloat(e.target.value) || 0,
                                },
                              }));
                            }}
                            className="h-9"
                            min="0"
                            step="0.50"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Min Self-Gen %</Label>
                          <Input
                            type="number"
                            value={commissionModifiers.self_gen_kicker.min_self_gen_percent}
                            onChange={(e) => {
                              setCommissionModifiers((prev) => ({
                                ...prev,
                                self_gen_kicker: {
                                  ...prev.self_gen_kicker!,
                                  min_self_gen_percent: parseFloat(e.target.value) || 0,
                                },
                              }));
                            }}
                            className="h-9"
                            min="0"
                            max="100"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Commission Tiers */}
            <CommissionTierEditor
              tiers={tiers}
              onChange={handleTiersChange}
              payoutType={payoutType}
              tierMetric={tierMetric}
            />

            {/* Staff Assignment */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Assign Staff</Label>
                <span className="text-sm text-muted-foreground">
                  {selectedMembers.length} selected
                </span>
              </div>

              {teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active team members found.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                  {teamMembers.map((member) => {
                    const isSelected = selectedMembers.includes(member.id);
                    const inputId = `staff-${member.id}`;
                    return (
                      <label
                        key={member.id}
                        htmlFor={inputId}
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          id={inputId}
                          checked={isSelected}
                          onChange={(e) => {
                            
                            setMemberChecked(member.id, e.target.checked);
                          }}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background"
                        />
                        <span className="text-sm truncate">{member.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Update Plan" : "Create Plan"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
