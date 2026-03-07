// Stub module for contact sequence progress tracking
// TODO: Implement full sequence progress logic

export interface SequenceTaskInfo {
  id: string;
  title: string;
  actionType: string;
  dueDate: string | null;
  status: string;
  completedAt: string | null;
  sortOrder: number;
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
  _agencyId: string | null
) {
  return {
    instances: [] as SequenceInstanceInfo[],
    isLoading: false,
  };
}
