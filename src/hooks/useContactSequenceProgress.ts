// Stub module for contact sequence progress tracking

export interface SequenceTaskInfo {
  id: string;
  title: string;
  action_type: string;
  actionType: string;
  due_date: string;
  dueDate: string;
  status: string;
  completed_at: string | null;
  completedAt: string | null;
  sortOrder: number;
  day_number: number;
}

export interface SequenceInstanceInfo {
  instanceId: string;
  sequenceId: string;
  sequenceName: string;
  status: string;
  startedAt: string;
  tasks: SequenceTaskInfo[];
  completedCount: number;
  totalCount: number;
}

export function mapSequenceInstances(_tasks: any[]): SequenceInstanceInfo[] {
  return [];
}

export function useContactSequenceProgress(
  _contactId: string | null,
  _agencyId: string | null,
  _prefetchedData?: SequenceInstanceInfo[] | null
) {
  return {
    data: [] as SequenceInstanceInfo[],
    instances: [] as SequenceInstanceInfo[],
    isLoading: false,
  };
}
