import { useMemo } from 'react';
import { Navigate, Link, useParams } from 'react-router-dom';
import { Loader2, ChevronLeft, Workflow, Target, ListOrdered } from 'lucide-react';
import { useSalesExperienceAccess } from '@/hooks/useSalesExperienceAccess';
import {
  useSalesExperienceDeliverables,
  deliverableInfo,
  type DeliverableType,
} from '@/hooks/useSalesExperienceDeliverables';
import { DeliverableBuilderChat } from '@/components/sales-experience/deliverables';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  workflow: Workflow,
  target: Target,
  'list-ordered': ListOrdered,
};

export default function SalesExperienceDeliverableBuilder() {
  const { type } = useParams<{ type: string }>();
  const { hasAccess, isLoading: accessLoading } = useSalesExperienceAccess();
  const { data: deliverables, isLoading: deliverablesLoading } = useSalesExperienceDeliverables();

  const validTypes: DeliverableType[] = ['sales_process', 'accountability_metrics', 'consequence_ladder'];
  const deliverableType = type as DeliverableType;
  const isValidType = validTypes.includes(deliverableType);

  const deliverable = useMemo(() => {
    return deliverables?.find(d => d.deliverable_type === deliverableType);
  }, [deliverables, deliverableType]);

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

  if (!deliverable) {
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
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{info.title}</h1>
            <p className="text-muted-foreground text-sm">{info.description}</p>
          </div>
        </div>
      </div>

      {/* AI Builder Chat */}
      <DeliverableBuilderChat
        deliverableId={deliverable.id}
        deliverableType={deliverableType}
        onContentApplied={() => {
          // Could navigate to edit page or show success message
        }}
      />

      {/* Link to direct edit */}
      <div className="mt-4 text-center">
        <Link
          to={`/sales-experience/deliverables/${deliverableType}/edit`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Prefer to edit directly? Switch to manual editor
        </Link>
      </div>
    </div>
  );
}
