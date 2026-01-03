import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Target, TrendingUp, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { AddGoalDialog } from "./AddGoalDialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SalesGoalsProps {
  agencyId: string | null;
}

interface SalesGoal {
  id: string;
  agency_id: string;
  team_member_id: string | null;
  goal_name: string;
  goal_focus: string;
  goal_type?: string | null;
  measurement: string;
  target_value: number;
  time_period: string;
  effective_month: string | null;
  effective_year: number | null;
  rank: number | null;
  is_active: boolean;
  team_member?: { name: string } | null;
  sales_goal_assignments?: { team_member_id: string; team_member: { name: string } | null }[];
}

interface GoalProgress {
  target: number;
  current: number;
  remaining: number;
  percentComplete: number;
  dailyPace: number;
  businessDaysLeft: number;
  onPace: boolean;
}

function getBusinessDays(start: Date, end: Date): number {
  if (end < start) return 0;
  const days = eachDayOfInterval({ start, end });
  return days.filter(d => !isWeekend(d)).length;
}

function getPeriodDates(timePeriod: string): { start: Date; end: Date } {
  const today = new Date();
  
  switch (timePeriod) {
    case "weekly":
      return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
    case "quarterly":
      return { start: startOfQuarter(today), end: endOfQuarter(today) };
    case "annual":
      return { start: startOfYear(today), end: new Date(today.getFullYear(), 11, 31) };
    case "monthly":
    default:
      return { start: startOfMonth(today), end: endOfMonth(today) };
  }
}

function calculateGoalProgress(goal: SalesGoal, currentValue: number): GoalProgress {
  const { start, end } = getPeriodDates(goal.time_period);
  const today = new Date();
  
  const remaining = Math.max(0, goal.target_value - currentValue);
  const percentComplete = goal.target_value > 0 ? (currentValue / goal.target_value) * 100 : 0;
  
  const totalBusinessDays = getBusinessDays(start, end);
  const businessDaysElapsed = getBusinessDays(start, today > end ? end : today);
  const businessDaysLeft = getBusinessDays(today, end);
  
  const dailyPace = businessDaysLeft > 0 ? remaining / businessDaysLeft : remaining;
  
  const expectedPercent = totalBusinessDays > 0 ? (businessDaysElapsed / totalBusinessDays) * 100 : 0;
  const onPace = percentComplete >= expectedPercent;
  
  return {
    target: goal.target_value,
    current: currentValue,
    remaining,
    percentComplete: Math.min(100, percentComplete),
    dailyPace,
    businessDaysLeft,
    onPace,
  };
}

export function SalesGoals({ agencyId }: SalesGoalsProps) {
  const { user, isAgencyOwner, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SalesGoal | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  const canManageGoals = isAgencyOwner || isAdmin;
  const today = new Date();
  const monthLabel = format(today, "MMMM yyyy");

  // Fetch staff team_member_id
  const { data: staffData } = useQuery({
    queryKey: ["staff-user-for-goals", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("staff_users")
        .select("team_member_id")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !isAgencyOwner && !isAdmin,
  });

  const teamMemberId = staffData?.team_member_id;
  const isStaff = !isAgencyOwner && !isAdmin;

  // Fetch goals
  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ["sales-goals", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      
      const { data, error } = await supabase
        .from("sales_goals")
        .select(`
          *,
          team_member:team_members(name),
          sales_goal_assignments(team_member_id, team_member:team_members(name))
        `)
        .eq("agency_id", agencyId)
        .eq("is_active", true)
        .order("rank", { ascending: true, nullsFirst: true });

      if (error) throw error;
      return data as SalesGoal[];
    },
    enabled: !!agencyId,
  });

  // Fetch current values for each measurement type
  const { data: salesTotals, isLoading: totalsLoading } = useQuery({
    queryKey: ["sales-totals-for-goals", agencyId, teamMemberId, isStaff],
    queryFn: async () => {
      if (!agencyId) return null;

      const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

      let query = supabase
        .from("sales")
        .select(`
          total_premium,
          total_items,
          total_points,
          sale_policies(id, is_vc_qualifying),
          sale_items:sale_policies(sale_items(is_vc_qualifying, item_count, premium, points))
        `)
        .eq("agency_id", agencyId)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd);

      // Staff only sees their own
      if (isStaff && teamMemberId) {
        query = query.eq("team_member_id", teamMemberId);
      }

      const { data, error } = await query;
      if (error) throw error;

      let totalPremium = 0;
      let totalItems = 0;
      let totalPoints = 0;
      let totalPolicies = 0;
      let vcPremium = 0;
      let vcItems = 0;
      let vcPoints = 0;
      let nonVcPremium = 0;
      let nonVcItems = 0;
      let nonVcPoints = 0;

      for (const sale of data || []) {
        totalPremium += sale.total_premium || 0;
        totalItems += sale.total_items || 0;
        totalPoints += sale.total_points || 0;
        totalPolicies += sale.sale_policies?.length || 0;

        // Parse VC vs non-VC from sale_items
        for (const policy of sale.sale_items || []) {
          for (const item of policy.sale_items || []) {
            if (item.is_vc_qualifying) {
              vcItems += item.item_count || 0;
              vcPremium += item.premium || 0;
              vcPoints += item.points || 0;
            } else {
              nonVcItems += item.item_count || 0;
              nonVcPremium += item.premium || 0;
              nonVcPoints += item.points || 0;
            }
          }
        }
      }

      return {
        all: { premium: totalPremium, items: totalItems, points: totalPoints, policies: totalPolicies },
        vc_qualifying: { premium: vcPremium, items: vcItems, points: vcPoints, policies: 0 },
        non_vc: { premium: nonVcPremium, items: nonVcItems, points: nonVcPoints, policies: 0 },
      };
    },
    enabled: !!agencyId,
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from("sales_goals")
        .update({ is_active: false })
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-goals"] });
      toast.success("Goal deleted");
      setDeletingGoalId(null);
    },
    onError: (error) => {
      toast.error("Failed to delete goal");
      console.error(error);
    },
  });

  function getCurrentValue(goal: SalesGoal): number {
    if (!salesTotals) return 0;
    
    const focusData = salesTotals[goal.goal_focus as keyof typeof salesTotals] || salesTotals.all;
    
    switch (goal.measurement) {
      case "premium": return focusData.premium;
      case "items": return focusData.items;
      case "points": return focusData.points;
      case "policies": return focusData.policies;
      default: return 0;
    }
  }

  function formatValue(value: number, measurement: string): string {
    if (measurement === "premium") {
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return value.toLocaleString();
  }

  function getMeasurementLabel(measurement: string): string {
    switch (measurement) {
      case "premium": return "Premium";
      case "items": return "Items";
      case "points": return "Points";
      case "policies": return "Policies";
      default: return measurement;
    }
  }

  const isLoading = goalsLoading || totalsLoading;

  // Filter goals based on user role
  const displayGoals = goals?.filter(goal => {
    if (canManageGoals) return true;
    // Staff sees agency-wide goals or their own
    return goal.team_member_id === null || goal.team_member_id === teamMemberId;
  }) || [];

  // Separate agency-wide and individual goals
  // For promo goals (goal_type = 'promo'), check assignments table instead of team_member_id
  const agencyGoals = displayGoals.filter(g => {
    if (g.goal_type === 'promo') {
      // Promo is agency-wide only if it has NO assignments
      return !g.sales_goal_assignments || g.sales_goal_assignments.length === 0;
    }
    return g.team_member_id === null;
  });
  const individualGoals = displayGoals.filter(g => {
    if (g.goal_type === 'promo') {
      // Promo is individual if it has at least one assignment
      return g.sales_goal_assignments && g.sales_goal_assignments.length > 0;
    }
    return g.team_member_id !== null;
  });

  if (!agencyId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No agency selected
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {isStaff ? "Goals" : "Agency Goals"} - {monthLabel}
            </CardTitle>
            {canManageGoals && (
              <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Goal
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : displayGoals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No goals set yet</p>
              {canManageGoals && (
                <Button onClick={() => setIsAddDialogOpen(true)} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-1" />
                  Create First Goal
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Agency Goals */}
              {agencyGoals.length > 0 && (
                <div className="space-y-4">
                  {!isStaff && agencyGoals.length > 0 && individualGoals.length > 0 && (
                    <h3 className="text-sm font-medium text-muted-foreground">Agency-wide Goals</h3>
                  )}
                  {agencyGoals.map(goal => {
                    const currentValue = getCurrentValue(goal);
                    const progress = calculateGoalProgress(goal, currentValue);
                    
                    return (
                      <GoalCard 
                        key={goal.id} 
                        goal={goal} 
                        progress={progress} 
                        currentValue={currentValue}
                        formatValue={formatValue}
                        getMeasurementLabel={getMeasurementLabel}
                        canEdit={canManageGoals}
                        onEdit={() => setEditingGoal(goal)}
                        onDelete={() => setDeletingGoalId(goal.id)}
                      />
                    );
                  })}
                </div>
              )}

              {/* Individual Goals */}
              {individualGoals.length > 0 && (
                <div className="space-y-4">
                  {agencyGoals.length > 0 && (
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {isStaff ? "Your Goals" : "Individual Goals"}
                    </h3>
                  )}
                  {individualGoals.map(goal => {
                    const currentValue = getCurrentValue(goal);
                    const progress = calculateGoalProgress(goal, currentValue);
                    
                    return (
                      <GoalCard 
                        key={goal.id} 
                        goal={goal} 
                        progress={progress}
                        currentValue={currentValue}
                        formatValue={formatValue}
                        getMeasurementLabel={getMeasurementLabel}
                        canEdit={canManageGoals}
                        onEdit={() => setEditingGoal(goal)}
                        onDelete={() => setDeletingGoalId(goal.id)}
                        showAssignee={canManageGoals}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddGoalDialog 
        open={isAddDialogOpen || !!editingGoal}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) setEditingGoal(null);
        }}
        agencyId={agencyId}
        editGoal={editingGoal}
      />

      <AlertDialog open={!!deletingGoalId} onOpenChange={(open) => !open && setDeletingGoalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this goal? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingGoalId && deleteGoalMutation.mutate(deletingGoalId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface GoalCardProps {
  goal: SalesGoal;
  progress: GoalProgress;
  currentValue: number;
  formatValue: (value: number, measurement: string) => string;
  getMeasurementLabel: (measurement: string) => string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  showAssignee?: boolean;
}

function GoalCard({ goal, progress, currentValue, formatValue, getMeasurementLabel, canEdit, onEdit, onDelete, showAssignee }: GoalCardProps) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{goal.goal_name}</h4>
            {goal.goal_focus !== "all" && (
              <Badge variant="outline" className="text-xs">
                {goal.goal_focus === "vc_qualifying" ? "VC Only" : "Non-VC"}
              </Badge>
            )}
          </div>
          {showAssignee && (goal.team_member || (goal.sales_goal_assignments && goal.sales_goal_assignments.length > 0)) && (
            <p className="text-sm text-muted-foreground">
              Assigned to: {
                goal.team_member 
                  ? goal.team_member.name 
                  : goal.sales_goal_assignments?.map(a => a.team_member?.name).filter(Boolean).join(", ")
              }
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span>
          <span className="text-muted-foreground">Target:</span>{" "}
          <span className="font-medium">{formatValue(progress.target, goal.measurement)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Current:</span>{" "}
          <span className="font-medium">{formatValue(progress.current, goal.measurement)}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Still Need:</span>{" "}
          <span className={cn("font-medium", progress.remaining > 0 ? "text-amber-500" : "text-green-500")}>
            {formatValue(progress.remaining, goal.measurement)}
          </span>
        </span>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className={cn(
            "flex items-center gap-1",
            progress.onPace ? "text-green-500" : "text-amber-500"
          )}>
            {progress.onPace ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {progress.onPace ? "On Pace" : "Behind Pace"}
          </span>
          <span className="font-medium">{progress.percentComplete.toFixed(0)}%</span>
        </div>
        <Progress value={progress.percentComplete} className="h-2" />
      </div>
      
      <div className="text-xs text-muted-foreground">
        Daily Pace: {formatValue(progress.dailyPace, goal.measurement)} needed/day ({progress.businessDaysLeft} business days left)
      </div>
    </div>
  );
}
