import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrainingCategory, TrainingCategoryInsert, TrainingCategoryUpdate } from '@/types/training';
import { toast } from 'sonner';

export function useTrainingCategories(agencyId?: string) {
  const queryClient = useQueryClient();

  // Fetch all categories for an agency
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['training-categories', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      
      const { data, error } = await supabase
        .from('training_categories')
        .select('*')
        .eq('agency_id', agencyId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as TrainingCategory[];
    },
    enabled: !!agencyId,
  });

  // Create category mutation
  const createCategory = useMutation({
    mutationFn: async (category: TrainingCategoryInsert) => {
      const { data, error } = await supabase
        .from('training_categories')
        .insert(category)
        .select()
        .single();

      if (error) throw error;
      return data as TrainingCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-categories'] });
      toast.success('Category created successfully');
    },
    onError: (error: Error) => {
      console.error('Error creating category:', error);
      toast.error('Failed to create category');
    },
  });

  // Update category mutation
  const updateCategory = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TrainingCategoryUpdate }) => {
      const { data, error } = await supabase
        .from('training_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as TrainingCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-categories'] });
      toast.success('Category updated successfully');
    },
    onError: (error: Error) => {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
    },
  });

  // Delete category mutation
  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('training_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-categories'] });
      toast.success('Category deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
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
