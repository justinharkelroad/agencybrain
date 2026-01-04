import { useCompPlans } from "@/hooks/useCompPlans";
import { CompPlanCard } from "./CompPlanCard";
import { Loader2, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompPlansTabProps {
  agencyId: string | null;
}

export function CompPlansTab({ agencyId }: CompPlansTabProps) {
  const { data: plans, isLoading, error } = useCompPlans(agencyId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Failed to load compensation plans</p>
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-medium">No Compensation Plans</h3>
          <p className="text-muted-foreground mt-1">
            Create your first compensation plan to start tracking staff payouts.
          </p>
        </div>
        <Button className="mt-4">
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Compensation Plans</h2>
          <p className="text-sm text-muted-foreground">
            {plans.length} plan{plans.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      <div className="grid gap-4">
        {plans.map((plan) => (
          <CompPlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  );
}
