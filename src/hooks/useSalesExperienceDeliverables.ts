import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useSalesExperienceAccess } from './useSalesExperienceAccess';

export type DeliverableType = 'sales_process' | 'accountability_metrics' | 'consequence_ladder';
export type DeliverableStatus = 'draft' | 'in_progress' | 'complete';

export interface SalesProcessContent {
  rapport: string[];
  coverage: string[];
  closing: string[];
}

export interface AccountabilityMetricsContent {
  categories: Array<{
    name: string;
    items: string[];
  }>;
}

export interface ConsequenceLadderContent {
  steps: Array<{
    incident: number;
    title: string;
    description: string;
  }>;
}

export type DeliverableContent = SalesProcessContent | AccountabilityMetricsContent | ConsequenceLadderContent;

export interface Deliverable {
  id: string;
  assignment_id: string;
  deliverable_type: DeliverableType;
  status: DeliverableStatus;
  content_json: DeliverableContent;
  updated_at: string;
  created_at: string;
}

export interface DeliverableSession {
  id: string;
  deliverable_id: string;
  user_id: string;
  messages_json: Array<{ role: 'user' | 'assistant'; content: string }>;
  generated_content_json: DeliverableContent | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  created_at: string;
  updated_at: string;
}

// Deliverable display info
export const deliverableInfo: Record<DeliverableType, { title: string; description: string; icon: string }> = {
  sales_process: {
    title: 'Sales Process',
    description: 'Define your Rapport → Coverage → Closing framework',
    icon: 'workflow',
  },
  accountability_metrics: {
    title: 'Accountability Metrics',
    description: 'Set up categories and metrics to track performance',
    icon: 'target',
  },
  consequence_ladder: {
    title: 'Consequence Ladder',
    description: 'Create progressive steps for addressing performance issues',
    icon: 'list-ordered',
  },
};

/**
 * Hook to fetch all deliverables for the current agency's assignment
 */
export function useSalesExperienceDeliverables() {
  const { session, isAdmin } = useAuth();
  const { hasAccess, assignment } = useSalesExperienceAccess();

  return useQuery({
    queryKey: ['sales-experience-deliverables', assignment?.id],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-deliverable-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'list' }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch deliverables');
      }

      const data = await response.json();
      return data.deliverables as Deliverable[];
    },
    enabled: !!session?.access_token && hasAccess && !!assignment?.id,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to save deliverable content
 */
export function useSaveDeliverableContent() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deliverable_id,
      content,
      mark_complete = false,
    }: {
      deliverable_id: string;
      content: DeliverableContent;
      mark_complete?: boolean;
    }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-deliverable-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ deliverable_id, content, mark_complete }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save content');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-experience-deliverables'] });
    },
  });
}

/**
 * Hook to generate PDF of all deliverables
 */
export function useGenerateDeliverablesPdf() {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (assignment_id?: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-deliverables-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ assignment_id }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate PDF');
      }

      return response.json() as Promise<{
        html: string;
        agency_name: string;
        generated_date: string;
      }>;
    },
  });
}

/**
 * Calculate progress for a single deliverable
 */
export function getDeliverableProgress(deliverable: Deliverable): number {
  const content = deliverable.content_json;

  switch (deliverable.deliverable_type) {
    case 'sales_process': {
      const sp = content as SalesProcessContent;
      const total = 3; // 3 sections
      let filled = 0;
      if (sp.rapport?.length > 0) filled++;
      if (sp.coverage?.length > 0) filled++;
      if (sp.closing?.length > 0) filled++;
      return Math.round((filled / total) * 100);
    }
    case 'accountability_metrics': {
      const am = content as AccountabilityMetricsContent;
      if (!am.categories?.length) return 0;
      const hasItems = am.categories.filter(c => c.items?.length > 0).length;
      return Math.round((hasItems / am.categories.length) * 100);
    }
    case 'consequence_ladder': {
      const cl = content as ConsequenceLadderContent;
      const target = 4; // Typical 4 steps
      const count = cl.steps?.length || 0;
      return Math.min(100, Math.round((count / target) * 100));
    }
    default:
      return 0;
  }
}

/**
 * Get overall progress across all deliverables
 */
export function getOverallProgress(deliverables: Deliverable[]): number {
  if (!deliverables?.length) return 0;

  const totalProgress = deliverables.reduce((sum, d) => sum + getDeliverableProgress(d), 0);
  return Math.round(totalProgress / deliverables.length);
}
