import { useMemo, useState, useEffect } from 'react';
import { Navigate, Link, useParams, useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, Workflow, Target, ListOrdered, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSalesExperienceAccess } from '@/hooks/useSalesExperienceAccess';
import {
  useSalesExperienceDeliverables,
  useSaveDeliverableContent,
  deliverableInfo,
  type DeliverableType,
  type DeliverableContent,
  type SalesProcessContent,
  type AccountabilityMetricsContent,
  type ConsequenceLadderContent,
} from '@/hooks/useSalesExperienceDeliverables';
import {
  SalesProcessEditor,
  AccountabilityEditor,
  ConsequenceLadderEditor,
} from '@/components/sales-experience/deliverables';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  workflow: Workflow,
  target: Target,
  'list-ordered': ListOrdered,
};

export default function SalesExperienceDeliverableEdit() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAccess, isLoading: accessLoading } = useSalesExperienceAccess();
  const { data: deliverables, isLoading: deliverablesLoading } = useSalesExperienceDeliverables();
  const saveContent = useSaveDeliverableContent();

  const validTypes: DeliverableType[] = ['sales_process', 'accountability_metrics', 'consequence_ladder'];
  const deliverableType = type as DeliverableType;
  const isValidType = validTypes.includes(deliverableType);

  const deliverable = useMemo(() => {
    return deliverables?.find(d => d.deliverable_type === deliverableType);
  }, [deliverables, deliverableType]);

  // Local state for editing
  const [content, setContent] = useState<DeliverableContent | null>(null);

  // Initialize content from deliverable
  useEffect(() => {
    if (deliverable?.content_json) {
      setContent(deliverable.content_json);
    }
  }, [deliverable?.content_json]);

  const handleSave = async (markComplete = false) => {
    if (!deliverable || !content) return;

    try {
      await saveContent.mutateAsync({
        deliverable_id: deliverable.id,
        content,
        mark_complete: markComplete,
      });

      toast({
        title: markComplete ? 'Marked as complete!' : 'Saved successfully',
        description: markComplete
          ? 'Your deliverable has been saved and marked complete.'
          : 'Your changes have been saved.',
      });

      if (markComplete) {
        navigate('/sales-experience/deliverables');
      }
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (accessLoading || deliverablesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isValidType) {
    return <Navigate to="/sales-experience/deliverables" replace />;
  }

  if (!deliverable || !content) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <p className="text-muted-foreground">Deliverable not found. Please try again.</p>
        <Link to="/sales-experience/deliverables" className="text-primary hover:underline">
          Back to Deliverables
        </Link>
      </div>
    );
  }

  const info = deliverableInfo[deliverableType];
  const Icon = iconMap[info.icon] || Workflow;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Back Link */}
      <Link
        to="/sales-experience/deliverables"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Deliverables
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{info.title}</h1>
              <p className="text-muted-foreground text-sm">{info.description}</p>
            </div>
          </div>
          <Link
            to={`/sales-experience/deliverables/${deliverableType}`}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Sparkles className="h-4 w-4" />
            Use AI Builder
          </Link>
        </div>
      </div>

      {/* Editor based on type */}
      {deliverableType === 'sales_process' && (
        <SalesProcessEditor
          content={content as SalesProcessContent}
          onChange={(newContent) => setContent(newContent)}
          onSave={handleSave}
          isSaving={saveContent.isPending}
        />
      )}

      {deliverableType === 'accountability_metrics' && (
        <AccountabilityEditor
          content={content as AccountabilityMetricsContent}
          onChange={(newContent) => setContent(newContent)}
          onSave={handleSave}
          isSaving={saveContent.isPending}
        />
      )}

      {deliverableType === 'consequence_ladder' && (
        <ConsequenceLadderEditor
          content={content as ConsequenceLadderContent}
          onChange={(newContent) => setContent(newContent)}
          onSave={handleSave}
          isSaving={saveContent.isPending}
        />
      )}
    </div>
  );
}
