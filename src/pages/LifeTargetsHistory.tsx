import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Eye, Download, Trash2, Calendar } from "lucide-react";
import { useQuarterlyTargetsHistory, useDeleteQuarterlyTargets, QuarterlyTargetsSummary } from "@/hooks/useQuarterlyTargetsHistory";
import { exportLifeTargetsPDF } from "@/utils/exportLifeTargetsPDF";
import { toast } from "sonner";
import { format } from "date-fns";

const QUARTER_MONTHS: Record<string, string[]> = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December'],
};

function QuarterCard({ plan }: { plan: QuarterlyTargetsSummary }) {
  const navigate = useNavigate();
  const deleteMutation = useDeleteQuarterlyTargets();

  const quarterMatch = plan.quarter.match(/Q[1-4]/);
  const quarterKey = quarterMatch?.[0] || 'Q1';
  const yearMatch = plan.quarter.match(/^(\d{4})/);
  const year = yearMatch?.[1] || '';
  const quarterNum = quarterKey.replace('Q', '');

  const getPrimaryTarget = (
    target1: string | null,
    target2: string | null,
    isPrimary1: boolean | null
  ) => {
    if (isPrimary1) return target1;
    if (isPrimary1 === false) return target2;
    return target1 || target2;
  };

  const bodyTarget = getPrimaryTarget(plan.body_target, plan.body_target2, plan.body_primary_is_target1);
  const beingTarget = getPrimaryTarget(plan.being_target, plan.being_target2, plan.being_primary_is_target1);
  const balanceTarget = getPrimaryTarget(plan.balance_target, plan.balance_target2, plan.balance_primary_is_target1);
  const businessTarget = getPrimaryTarget(plan.business_target, plan.business_target2, plan.business_primary_is_target1);

  const handleView = () => {
    navigate(`/life-targets/cascade?quarter=${plan.quarter}`);
  };

  const handleExportPDF = () => {
    try {
      exportLifeTargetsPDF(plan, {}, plan.quarter);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate(plan.id);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl">
              {year} Quarter {quarterNum}
            </CardTitle>
            <CardDescription className="mt-1">
              {QUARTER_MONTHS[quarterKey]?.join(' • ')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(plan.updated_at), 'MMM d, yyyy')}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          {bodyTarget && (
            <div className="flex gap-2">
              <span className="font-semibold text-orange-600 dark:text-orange-400 shrink-0">Body:</span>
              <span className="text-muted-foreground line-clamp-1">{bodyTarget}</span>
            </div>
          )}
          {beingTarget && (
            <div className="flex gap-2">
              <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0">Being:</span>
              <span className="text-muted-foreground line-clamp-1">{beingTarget}</span>
            </div>
          )}
          {balanceTarget && (
            <div className="flex gap-2">
              <span className="font-semibold text-green-600 dark:text-green-400 shrink-0">Balance:</span>
              <span className="text-muted-foreground line-clamp-1">{balanceTarget}</span>
            </div>
          )}
          {businessTarget && (
            <div className="flex gap-2">
              <span className="font-semibold text-purple-600 dark:text-purple-400 shrink-0">Business:</span>
              <span className="text-muted-foreground line-clamp-1">{businessTarget}</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-4 border-t">
        <Button onClick={handleView} className="flex-1" size="sm">
          <Eye className="mr-2 h-4 w-4" />
          View Full Plan
        </Button>
        <Button onClick={handleExportPDF} variant="outline" size="sm">
          <Download className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={deleteMutation.isPending}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this quarterly plan?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your {year} Quarter {quarterNum} targets, missions, and daily actions. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

export default function LifeTargetsHistory() {
  const navigate = useNavigate();
  const { data: plans, isLoading } = useQuarterlyTargetsHistory();

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Quarterly Plans Archive</h1>
          <p className="text-muted-foreground mt-1">
            View and manage your past quarterly life targets
          </p>
        </div>
        <Button onClick={() => navigate('/life-targets')}>
          Create New Plan
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-8 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-3/4 mt-2" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-4 bg-muted rounded" />
                <div className="h-4 bg-muted rounded" />
                <div className="h-4 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !plans || plans.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="space-y-4">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">No Quarterly Plans Yet</h3>
              <p className="text-muted-foreground mt-2">
                Start creating your first quarterly life targets plan to see them here.
              </p>
            </div>
            <Button onClick={() => navigate('/life-targets')}>
              Create Your First Plan
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <QuarterCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
