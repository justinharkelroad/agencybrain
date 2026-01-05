import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Trophy } from "lucide-react";
import { format, addDays } from "date-fns";
import { todayLocal } from "@/lib/utils";
import { PromoGoalWithProgress } from "@/hooks/usePromoGoals";

interface CreatePromoGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  editGoal?: PromoGoalWithProgress | null;
}

export function CreatePromoGoalModal({ 
  open, 
  onOpenChange, 
  agencyId, 
  editGoal 
}: CreatePromoGoalModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editGoal;

  // Form state
  const [goalName, setGoalName] = useState("");
  const [description, setDescription] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [startDate, setStartDate] = useState(format(todayLocal(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(addDays(todayLocal(), 30), "yyyy-MM-dd"));
  const [promoSource, setPromoSource] = useState<"sales" | "metrics">("sales");
  const [measurement, setMeasurement] = useState("premium");
  const [productTypeId, setProductTypeId] = useState<string>("all");
  const [kpiSlug, setKpiSlug] = useState("outbound_calls");
  const [targetValue, setTargetValue] = useState("");
  const [isAgencyWide, setIsAgencyWide] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-for-promo", agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("agency_id", agencyId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && !!agencyId,
  });

  // Fetch product types
  const { data: productTypes = [] } = useQuery({
    queryKey: ["product-types-for-promo", agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_types")
        .select("id, name")
        .or(`agency_id.is.null,agency_id.eq.${agencyId}`)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open && !!agencyId && promoSource === "sales",
  });

  // Fetch KPIs for metrics source
  const { data: kpis = [] } = useQuery({
    queryKey: ["kpis-for-promo", agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpis")
        .select("id, slug, label")
        .eq("agency_id", agencyId)
        .eq("is_active", true)
        .order("label");
      if (error) throw error;
      return data;
    },
    enabled: open && !!agencyId && promoSource === "metrics",
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (editGoal) {
        setGoalName(editGoal.goal_name);
        setDescription(editGoal.description || "");
        setBonusAmount(editGoal.bonus_amount_cents ? (editGoal.bonus_amount_cents / 100).toString() : "");
        setStartDate(editGoal.start_date);
        setEndDate(editGoal.end_date);
        setPromoSource(editGoal.promo_source || "sales");
        setMeasurement(editGoal.measurement);
        setProductTypeId(editGoal.product_type_id || "all");
        setKpiSlug(editGoal.kpi_slug || "outbound_calls");
        setTargetValue(editGoal.target_value.toString());
        // Agency-wide if no assignments
        const hasAssignments = editGoal.assignments && editGoal.assignments.length > 0;
        setIsAgencyWide(!hasAssignments);
        setSelectedMembers(editGoal.assignments?.map(a => a.team_member_id) || []);
      } else {
        setGoalName("");
        setDescription("");
        setBonusAmount("");
        setStartDate(format(todayLocal(), "yyyy-MM-dd"));
        setEndDate(format(addDays(todayLocal(), 30), "yyyy-MM-dd"));
        setPromoSource("sales");
        setMeasurement("premium");
        setProductTypeId("all");
        setKpiSlug("outbound_calls");
        setTargetValue("");
        setIsAgencyWide(false);
        setSelectedMembers([]);
      }
    }
  }, [open, editGoal]);

  const savePromoMutation = useMutation({
    mutationFn: async () => {
      // Normalize product_type_id: never send empty string to UUID column
      let normalizedProductTypeId: string | null = null;
      if (promoSource === "sales" && productTypeId && productTypeId !== "all" && productTypeId !== "") {
        normalizedProductTypeId = productTypeId;
      }

      const goalData = {
        agency_id: agencyId,
        goal_type: "promo" as const,
        goal_name: goalName,
        description: description || null,
        bonus_amount_cents: bonusAmount ? Math.round(parseFloat(bonusAmount) * 100) : null,
        start_date: startDate,
        end_date: endDate,
        promo_source: promoSource,
        measurement: promoSource === "sales" ? measurement : "count",
        product_type_id: normalizedProductTypeId,
        kpi_slug: promoSource === "metrics" ? kpiSlug : null,
        target_value: parseFloat(targetValue) || 0,
        goal_focus: "all",
        time_period: "custom",
        is_active: true,
      };

      let goalId: string;

      if (isEditing && editGoal) {
        const { error } = await supabase
          .from("sales_goals")
          .update(goalData)
          .eq("id", editGoal.id);
        if (error) throw error;
        goalId = editGoal.id;

        // Delete existing assignments
        await supabase
          .from("sales_goal_assignments")
          .delete()
          .eq("sales_goal_id", goalId);
      } else {
        const { data, error } = await supabase
          .from("sales_goals")
          .insert(goalData)
          .select("id")
          .single();
        if (error) throw error;
        goalId = data.id;
      }

      // Create new assignments (only if not agency-wide)
      if (!isAgencyWide && selectedMembers.length > 0) {
        const assignments = selectedMembers.map(memberId => ({
          sales_goal_id: goalId,
          team_member_id: memberId,
        }));

        const { error: assignError } = await supabase
          .from("sales_goal_assignments")
          .insert(assignments);
        if (assignError) throw assignError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promo-goals"] });
      queryClient.invalidateQueries({ queryKey: ["promo-goals-member"] });
      // Invalidate dashboard promo widgets so progress refreshes immediately
      queryClient.invalidateQueries({ queryKey: ["admin-promo-goals-widget"] });
      queryClient.invalidateQueries({ queryKey: ["sales-dashboard-widget"] });
      queryClient.invalidateQueries({ queryKey: ["staff-promo-goals"] });
      toast.success(isEditing ? "Promo goal updated" : "Promo goal created");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`${isEditing ? "Failed to update promo goal" : "Failed to create promo goal"}: ${error.message}`);
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!goalName.trim()) {
      toast.error("Please enter a goal name");
      return;
    }

    if (!targetValue || parseFloat(targetValue) <= 0) {
      toast.error("Please enter a valid target value");
      return;
    }

    if (!isAgencyWide && selectedMembers.length === 0) {
      toast.error("Please select at least one team member or choose 'Entire Agency'");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error("End date must be after start date");
      return;
    }

    savePromoMutation.mutate();
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectAll = () => {
    if (selectedMembers.length === teamMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(teamMembers.map(m => m.id));
    }
  };

  const salesMeasurements = [
    { value: "premium", label: "Premium ($)" },
    { value: "items", label: "Items" },
    { value: "points", label: "Points" },
    { value: "policies", label: "Policies" },
    { value: "households", label: "Households" },
  ];

  const defaultKpis = [
    { slug: "outbound_calls", label: "Outbound Calls" },
    { slug: "talk_minutes", label: "Talk Minutes" },
    { slug: "quoted_count", label: "Quoted Households" },
    { slug: "sold_items", label: "Sold Items" },
    { slug: "cross_sells_uncovered", label: "Cross-Sells Uncovered" },
    { slug: "mini_reviews", label: "Mini Reviews" },
  ];

  const kpiOptions = kpis.length > 0 ? kpis : defaultKpis.map(k => ({ ...k, id: k.slug }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Promo Goal" : "Create Promo Goal"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Goal Name */}
          <div className="space-y-2">
            <Label htmlFor="goal-name">Goal Name *</Label>
            <Input
              id="goal-name"
              placeholder="e.g., Umbrella Push Q1"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Write 10 umbrella policies this month..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Bonus Amount */}
          <div className="space-y-2">
            <Label htmlFor="bonus">Bonus Amount ($)</Label>
            <Input
              id="bonus"
              type="number"
              placeholder="1000"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date *</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <hr className="border-border" />

          {/* Data Source */}
          <div className="space-y-2">
            <Label>Data Source *</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  checked={promoSource === "sales"}
                  onChange={() => setPromoSource("sales")}
                  className="w-4 h-4"
                />
                <span>📊 Sales Data</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  checked={promoSource === "metrics"}
                  onChange={() => setPromoSource("metrics")}
                  className="w-4 h-4"
                />
                <span>📋 Scorecard Metrics</span>
              </label>
            </div>
          </div>

          {/* Sales-specific fields */}
          {promoSource === "sales" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Measurement *</Label>
                <Select value={measurement} onValueChange={setMeasurement}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {salesMeasurements.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Product Filter</Label>
                <Select value={productTypeId} onValueChange={setProductTypeId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {productTypes.map(pt => (
                      <SelectItem key={pt.id} value={pt.id}>
                        {pt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Metrics-specific fields */}
          {promoSource === "metrics" && (
            <div className="space-y-2">
              <Label>Metric *</Label>
              <Select value={kpiSlug} onValueChange={setKpiSlug}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kpiOptions.map(kpi => (
                    <SelectItem key={kpi.slug || kpi.id} value={kpi.slug}>
                      {kpi.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <hr className="border-border" />

          {/* Target Value */}
          <div className="space-y-2">
            <Label htmlFor="target">Target Value *</Label>
            <Input
              id="target"
              type="number"
              placeholder={measurement === "premium" ? "50000" : "10"}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
          </div>

          {/* Assignment Type */}
          <div className="space-y-3">
            <Label>Assign To *</Label>
            
            {/* Agency-Wide Toggle */}
            <label className="flex items-center gap-3 p-3 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={isAgencyWide}
                onCheckedChange={(checked) => {
                  setIsAgencyWide(!!checked);
                  if (checked) {
                    setSelectedMembers([]);
                  }
                }}
              />
              <div>
                <span className="text-sm font-medium">Entire Agency</span>
                <p className="text-xs text-muted-foreground">
                  All team member sales count toward this goal
                </p>
              </div>
            </label>
            
            {/* Individual Team Member Selection */}
            {!isAgencyWide && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Or select specific team members:</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                  >
                    {selectedMembers.length === teamMembers.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <div className="border border-border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {teamMembers.map(member => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                    >
                      <Checkbox
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={() => toggleMember(member.id)}
                      />
                      <span className="text-sm">{member.name}</span>
                    </label>
                  ))}
                  {teamMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground">No active team members found</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedMembers.length} of {teamMembers.length} selected
                </p>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savePromoMutation.isPending}>
              {savePromoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Update Promo" : "Create Promo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
