import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as trainingApi from '@/lib/trainingAdminApi';
import type { TrainingCategory, TrainingCategoryInsert } from '@/lib/trainingAdminApi';

export type { TrainingCategory, TrainingCategoryInsert };

export interface TrainingCategoryUpdate {
  name?: string;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

export function useTrainingCategories(agencyId?: string) {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ['training-categories', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      return trainingApi.listCategories(agencyId);
    },
    enabled: !!agencyId,
  });

  const createCategory = useMutation({
    mutationFn: async (category: TrainingCategoryInsert) => {
      return trainingApi.createCategory(category);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-categories'] });
      toast.success('Category created successfully');
    },
    onError: (error: Error) => {
      console.error('Error creating category:', error);
      toast.error(error.message || 'Failed to create category');
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TrainingCategoryUpdate }) => {
      return trainingApi.updateCategory(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-categories'] });
      toast.success('Category updated successfully');
    },
    onError: (error: Error) => {
      console.error('Error updating category:', error);
      toast.error(error.message || 'Failed to update category');
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      return trainingApi.deleteCategory(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-categories'] });
      toast.success('Category deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Error deleting category:', error);
      toast.error(error.message || 'Failed to delete category');
    },
  });

  return {
    categories,
    isLoading,
    error,
    createCategory: createCategory.mutate,
    updateCategory: updateCategory.mutate,
    deleteCategory: deleteCategory.mutate,
    isCreating: createCategory.isPending,
    isUpdating: updateCategory.isPending,
    isDeleting: deleteCategory.isPending,
  };
}
