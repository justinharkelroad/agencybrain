import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as trainingApi from '@/lib/trainingAdminApi';
import type { TrainingAttachment, TrainingAttachmentInsert } from '@/lib/trainingAdminApi';

export type { TrainingAttachment, TrainingAttachmentInsert };

export function useTrainingAttachments(lessonId?: string, agencyId?: string) {
  const queryClient = useQueryClient();

  const { data: attachments = [], isLoading, error } = useQuery({
    queryKey: ['training-attachments', lessonId],
    queryFn: async () => {
      if (!lessonId) return [];
      return trainingApi.listAttachments(lessonId);
    },
    enabled: !!lessonId,
  });

  const createAttachment = useMutation({
    mutationFn: async (attachment: TrainingAttachmentInsert) => {
      return trainingApi.createAttachment(attachment);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['training-attachments', data.lesson_id] });
      toast.success('Attachment added');
    },
    onError: (error: Error) => {
      console.error('Create attachment error:', error);
      toast.error(error.message || 'Failed to add attachment');
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async ({ id, fileUrl, isExternal }: { id: string; fileUrl: string; isExternal: boolean }) => {
      return trainingApi.deleteAttachment(id, fileUrl, isExternal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-attachments'] });
      toast.success('Attachment deleted');
    },
    onError: (error: Error) => {
      console.error('Delete attachment error:', error);
      toast.error(error.message || 'Failed to delete attachment');
    },
  });

  const getDownloadUrl = async (fileUrl: string, isExternal: boolean): Promise<string> => {
    if (isExternal) {
      return fileUrl;
    }
    return trainingApi.getSignedDownloadUrl(fileUrl);
  };

  return {
    attachments,
    isLoading,
    error,
    createAttachment: createAttachment.mutate,
    deleteAttachment: deleteAttachment.mutate,
    getDownloadUrl,
    isCreating: createAttachment.isPending,
    isDeleting: deleteAttachment.isPending,
  };
}
