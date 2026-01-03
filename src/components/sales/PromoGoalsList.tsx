import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Trophy, Plus, Loader2, Pencil, Trash2, Users, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { usePromoGoals, PromoGoalWithProgress } from "@/hooks/usePromoGoals";
import { CreatePromoGoalModal } from "./CreatePromoGoalModal";
import { cn } from "@/lib/utils";

interface PromoGoalsListProps {
  agencyId: string | null;
}

export function PromoGoalsList({ agencyId }: PromoGoalsListProps) {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PromoGoalWithProgress | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  const { data: promoGoals = [], isLoading } = usePromoGoals(agencyId);

  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from("sales_goals")
        .update({ is_active: false })
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promo-goals"] });
      toast.success("Promo goal deleted");
      setDeletingGoalId(null);
    },
    onError: (error) => {
      toast.error("Failed to delete promo goal");
      console.error(error);
    },
  });

  const formatBonus = (cents: number): string => {
    return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatValue = (value: number, measurement: string): string => {
    if (measurement === 'premium') {
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return value.toLocaleString();
  };

  const getMeasurementLabel = (measurement: string): string => {
    const labels: Record<string, string> = {
      premium: "Premium",
      items: "Items",
      points: "Points",
      policies: "Policies",
      households: "Households",
      count: "Count",
    };
    return labels[measurement] || measurement;
  };

  // Separate goals by status
  const activeGoals = promoGoals.filter(g => g.status === 'active');
  const upcomingGoals = promoGoals.filter(g => g.status === 'upcoming');
  const endedGoals = promoGoals.filter(g => g.status === 'ended');

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
              <Trophy className="h-5 w-5 text-primary" />
              Promo Goals & Contests
            </CardTitle>
            <Button onClick={() => setIsCreateOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Create Promo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : promoGoals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No promo goals created yet</p>
              <p className="text-sm mt-1">Create incentive goals to motivate your team!</p>
              <Button onClick={() => setIsCreateOpen(true)} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-1" />
                Create First Promo
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Promos */}
              {activeGoals.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Active ({activeGoals.length})
                  </h3>
                  {activeGoals.map(goal => (
                    <PromoGoalRow
                      key={goal.id}
                      goal={goal}
                      formatBonus={formatBonus}
                      formatValue={formatValue}
                      getMeasurementLabel={getMeasurementLabel}
                      onEdit={() => setEditingGoal(goal)}
                      onDelete={() => setDeletingGoalId(goal.id)}
                    />
                  ))}
                </div>
              )}

              {/* Upcoming Promos */}
              {upcomingGoals.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Upcoming ({upcomingGoals.length})
                  </h3>
                  {upcomingGoals.map(goal => (
                    <PromoGoalRow
                      key={goal.id}
                      goal={goal}
                      formatBonus={formatBonus}
                      formatValue={formatValue}
                      getMeasurementLabel={getMeasurementLabel}
                      onEdit={() => setEditingGoal(goal)}
                      onDelete={() => setDeletingGoalId(goal.id)}
                    />
                  ))}
                </div>
              )}

              {/* Ended Promos */}
              {endedGoals.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                    Ended ({endedGoals.length})
                  </h3>
                  {endedGoals.map(goal => (
                    <PromoGoalRow
                      key={goal.id}
                      goal={goal}
                      formatBonus={formatBonus}
                      formatValue={formatValue}
                      getMeasurementLabel={getMeasurementLabel}
                      onEdit={() => setEditingGoal(goal)}
                      onDelete={() => setDeletingGoalId(goal.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <CreatePromoGoalModal
        open={isCreateOpen || !!editingGoal}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) setEditingGoal(null);
        }}
        agencyId={agencyId}
        editGoal={editingGoal}
      />

      <AlertDialog open={!!deletingGoalId} onOpenChange={(open) => !open && setDeletingGoalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promo Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this promo goal? This action cannot be undone.
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

interface PromoGoalRowProps {
  goal: PromoGoalWithProgress;
  formatBonus: (cents: number) => string;
  formatValue: (value: number, measurement: string) => string;
  getMeasurementLabel: (measurement: string) => string;
  onEdit: () => void;
  onDelete: () => void;
}

function PromoGoalRow({ 
  goal, 
  formatBonus, 
  formatValue, 
  getMeasurementLabel, 
  onEdit, 
  onDelete 
}: PromoGoalRowProps) {
  return (
    <div className={cn(
      "bg-muted/30 rounded-lg p-4 border-l-4",
      goal.status === 'active' ? "border-l-green-500" : 
      goal.status === 'upcoming' ? "border-l-blue-500" : "border-l-muted-foreground"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium">{goal.goal_name}</h4>
            <Badge variant="outline" className="text-xs">
              {goal.promo_source === 'sales' ? '📊 Sales' : '📋 Metrics'}
            </Badge>
            {goal.status === 'upcoming' && (
              <Badge variant="secondary" className="text-xs">
                Starts in {goal.daysRemaining} days
              </Badge>
            )}
            {goal.status === 'ended' && (
              <Badge variant="secondary" className="text-xs">
                Ended
              </Badge>
            )}
          </div>
          
          {goal.description && (
            <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
          )}
          
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {format(parseISO(goal.start_date), "MMM d")} - {format(parseISO(goal.end_date), "MMM d, yyyy")}
            </span>
            <span>
              <span className="text-muted-foreground">Target:</span>{" "}
              <span className="font-medium">{formatValue(goal.target_value, goal.measurement)}</span>
              <span className="text-muted-foreground ml-1">{getMeasurementLabel(goal.measurement)}</span>
            </span>
            {goal.bonus_amount_cents && goal.bonus_amount_cents > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <DollarSign className="h-3.5 w-3.5" />
                {formatBonus(goal.bonus_amount_cents)} Bonus
              </span>
            )}
            <span className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {goal.assignments?.length || 0} assigned
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
