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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SalesGoal {
  id: string;
  agency_id: string;
  team_member_id: string | null;
  goal_name: string;
  goal_focus: string;
  measurement: string;
  target_value: number;
  time_period: string;
  effective_month: string | null;
  effective_year: number | null;
  rank: number | null;
  is_active: boolean;
}

interface AddGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  editGoal?: SalesGoal | null;
}

export function AddGoalDialog({ open, onOpenChange, agencyId, editGoal }: AddGoalDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editGoal;

  const [goalName, setGoalName] = useState("");
  const [measurement, setMeasurement] = useState<string>("premium");
  const [targetValue, setTargetValue] = useState<string>("");
  const [goalFocus, setGoalFocus] = useState<string>("all");
  const [timePeriod, setTimePeriod] = useState<string>("monthly");
  const [assignTo, setAssignTo] = useState<string>("agency");

  // Fetch team members
  const { data: teamMembers } = useQuery({
    queryKey: ["team-members-for-goals", agencyId],
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

  // Reset form when dialog opens/closes or editGoal changes
  useEffect(() => {
    if (open) {
      if (editGoal) {
        setGoalName(editGoal.goal_name);
        setMeasurement(editGoal.measurement);
        setTargetValue(editGoal.target_value.toString());
        setGoalFocus(editGoal.goal_focus);
        setTimePeriod(editGoal.time_period);
        setAssignTo(editGoal.team_member_id || "agency");
      } else {
        setGoalName("");
        setMeasurement("premium");
        setTargetValue("");
        setGoalFocus("all");
        setTimePeriod("monthly");
        setAssignTo("agency");
      }
    }
  }, [open, editGoal]);

  const saveGoalMutation = useMutation({
    mutationFn: async () => {
      const goalData = {
        agency_id: agencyId,
        team_member_id: assignTo === "agency" ? null : assignTo,
        goal_name: goalName,
        goal_focus: goalFocus,
        measurement,
        target_value: parseFloat(targetValue) || 0,
        time_period: timePeriod,
        is_active: true,
      };

      if (isEditing && editGoal) {
        const { error } = await supabase
          .from("sales_goals")
          .update(goalData)
          .eq("id", editGoal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sales_goals")
          .insert(goalData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-goals"] });
      queryClient.invalidateQueries({ queryKey: ["sales-goal-widget"] });
      toast.success(isEditing ? "Goal updated" : "Goal created");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(isEditing ? "Failed to update goal" : "Failed to create goal");
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

    saveGoalMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Goal" : "Add New Goal"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-name">Goal Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g., January Premium Goal"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Measurement</Label>
              <Select value={measurement} onValueChange={setMeasurement}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">Premium ($)</SelectItem>
                  <SelectItem value="items">Items</SelectItem>
                  <SelectItem value="points">Points</SelectItem>
                  <SelectItem value="policies">Policies</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-value">Target Value</Label>
              <Input
                id="target-value"
                type="number"
                placeholder={measurement === "premium" ? "200000" : "100"}
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Goal Focus</Label>
              <Select value={goalFocus} onValueChange={setGoalFocus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales</SelectItem>
                  <SelectItem value="vc_qualifying">VC Qualifying Only</SelectItem>
                  <SelectItem value="non_vc">Non-VC Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time Period</Label>
              <Select value={timePeriod} onValueChange={setTimePeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Apply To</Label>
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agency">Agency-wide</SelectItem>
                {teamMembers?.map((tm) => (
                  <SelectItem key={tm.id} value={tm.id}>
                    {tm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveGoalMutation.isPending}>
              {saveGoalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Update Goal" : "Create Goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
