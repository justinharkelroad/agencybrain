import { Navigate, Link } from 'react-router-dom';
import { Loader2, Trophy, ChevronLeft, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useSalesExperienceAccess } from '@/hooks/useSalesExperienceAccess';
import {
  useSalesExperienceDeliverables,
  getOverallProgress,
} from '@/hooks/useSalesExperienceDeliverables';
import { DeliverableCard, DeliverablesPDFDialog } from '@/components/sales-experience/deliverables';

export default function SalesExperienceDeliverables() {
  const { hasAccess, isLoading: accessLoading } = useSalesExperienceAccess();
  const { data: deliverables, isLoading: deliverablesLoading } = useSalesExperienceDeliverables();

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  const isLoading = deliverablesLoading;
  const overallProgress = deliverables ? getOverallProgress(deliverables) : 0;
  const completeCount = deliverables?.filter(d => d.status === 'complete').length || 0;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Back Link */}
      <Link
        to="/sales-experience"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Overview
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-8 w-8 text-amber-500" />
          <h1 className="text-3xl font-bold">Your Deliverables</h1>
        </div>
        <p className="text-muted-foreground">
          Build these three key documents throughout your 8-Week Sales Experience. Use the AI
          builder for guided creation or edit directly.
        </p>
      </div>

      {/* Progress Overview */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Overall Progress</CardTitle>
              <CardDescription>
                {completeCount} of 3 deliverables complete
              </CardDescription>
            </div>
            <DeliverablesPDFDialog>
              <Button
                variant="outline"
                className="gap-2"
                disabled={completeCount === 0}
              >
                <FileText className="h-4 w-4" />
                Generate PDF
              </Button>
            </DeliverablesPDFDialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={overallProgress} className="flex-1 h-3" />
            <span className="text-2xl font-bold w-16 text-right">{overallProgress}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Deliverable Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {deliverables?.map((deliverable) => (
            <DeliverableCard key={deliverable.id} deliverable={deliverable} />
          ))}
        </div>
      )}

      {/* Help Text */}
      <Card className="mt-8 border-dashed">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">How to use deliverables</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  <strong>Build with AI:</strong> Start a guided conversation that helps you
                  articulate your process step by step
                </li>
                <li>
                  <strong>Edit directly:</strong> Manually add, remove, and reorder items with
                  drag-and-drop
                </li>
                <li>
                  <strong>Generate PDF:</strong> Download a professional document with your
                  agency branding once complete
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
