import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as trainingApi from '@/lib/trainingAdminApi';
import type { TrainingModule, TrainingModuleInsert } from '@/lib/trainingAdminApi';

export type { TrainingModule, TrainingModuleInsert };

export interface TrainingModuleUpdate {
  name?: string;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export function useTrainingModules(categoryId?: string) {
  const queryClient = useQueryClient();

  const { data: modules = [], isLoading, error } = useQuery({
    queryKey: ['training-modules', categoryId],
    queryFn: async () => {
      if (!categoryId) return [];
      return trainingApi.listModules(categoryId);
    },
    enabled: !!categoryId,
  });

  const createModule = useMutation({
    mutationFn: async (module: TrainingModuleInsert) => {
      return trainingApi.createModule(module);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['training-modules', data.category_id] });
      toast.success('Module created');
    },
    onError: (error: Error) => {
      console.error('Create module error:', error);
      toast.error(error.message || 'Failed to create module');
    },
  });

  const updateModule = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TrainingModuleUpdate }) => {
      return trainingApi.updateModule(id, updates);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['training-modules', data.category_id] });
      toast.success('Module updated');
    },
    onError: (error: Error) => {
      console.error('Update module error:', error);
      toast.error(error.message || 'Failed to update module');
    },
  });

  const deleteModule = useMutation({
    mutationFn: async (id: string) => {
      return trainingApi.deleteModule(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-modules'] });
      toast.success('Module deleted');
    },
    onError: (error: Error) => {
      console.error('Delete module error:', error);
      toast.error(error.message || 'Failed to delete module');
    },
  });

  return {
    modules,
    isLoading,
    error,
    createModule: createModule.mutate,
    updateModule: updateModule.mutate,
    deleteModule: deleteModule.mutate,
    isCreating: createModule.isPending,
    isUpdating: updateModule.isPending,
    isDeleting: deleteModule.isPending,
  };
}
