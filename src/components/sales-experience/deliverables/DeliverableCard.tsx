import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Workflow,
  Target,
  ListOrdered,
  Sparkles,
  Edit,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import type { Deliverable, DeliverableType } from '@/hooks/useSalesExperienceDeliverables';
import { deliverableInfo, getDeliverableProgress } from '@/hooks/useSalesExperienceDeliverables';

interface DeliverableCardProps {
  deliverable: Deliverable;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  workflow: Workflow,
  target: Target,
  'list-ordered': ListOrdered,
};

const statusConfig = {
  draft: {
    label: 'Not Started',
    variant: 'secondary' as const,
    icon: FileText,
  },
  in_progress: {
    label: 'In Progress',
    variant: 'default' as const,
    icon: Clock,
  },
  complete: {
    label: 'Complete',
    variant: 'outline' as const,
    icon: CheckCircle2,
  },
};

export function DeliverableCard({ deliverable }: DeliverableCardProps) {
  const info = deliverableInfo[deliverable.deliverable_type];
  const Icon = iconMap[info.icon] || FileText;
  const progress = getDeliverableProgress(deliverable);
  const status = statusConfig[deliverable.status];
  const StatusIcon = status.icon;

  const isComplete = deliverable.status === 'complete';
  const isDraft = deliverable.status === 'draft';

  return (
    <Card className={`transition-all ${isComplete ? 'border-green-500/30 bg-green-50/30 dark:bg-green-950/10' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              isComplete
                ? 'bg-green-500/10 text-green-600'
                : 'bg-primary/10 text-primary'
            }`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{info.title}</CardTitle>
              <CardDescription className="text-sm">{info.description}</CardDescription>
            </div>
          </div>
          <Badge variant={status.variant} className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!isDraft && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="flex gap-2">
          <Link to={`/sales-experience/deliverables/${deliverable.deliverable_type}`} className="flex-1">
            <Button variant="default" className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              {isDraft ? 'Build with AI' : 'Continue Building'}
            </Button>
          </Link>
          <Link to={`/sales-experience/deliverables/${deliverable.deliverable_type}/edit`}>
            <Button variant="outline" size="icon">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
