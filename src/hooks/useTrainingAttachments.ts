import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TrainingAttachment {
  id: string;
  agency_id: string;
  lesson_id: string;
  name: string;
  file_type: string;
  file_url: string;
  file_size_bytes: number | null;
  is_external_link: boolean | null;
  sort_order: number | null;
  created_at: string;
}

export interface TrainingAttachmentInsert {
  agency_id: string;
  lesson_id: string;
  name: string;
  file_type: string;
  file_url: string;
  file_size_bytes?: number | null;
  is_external_link: boolean;
  sort_order?: number | null;
}

export function useTrainingAttachments(lessonId?: string, agencyId?: string) {
  const queryClient = useQueryClient();

  // Fetch attachments for a lesson
  const {
    data: attachments = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["training-attachments", lessonId],
    queryFn: async () => {
      if (!lessonId) return [];

      const { data, error } = await supabase
        .from("training_attachments")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TrainingAttachment[];
    },
    enabled: !!lessonId,
  });

  // Create attachment
  const createAttachment = useMutation({
    mutationFn: async (attachment: TrainingAttachmentInsert) => {
      const { data, error } = await supabase
        .from("training_attachments")
        .insert(attachment)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["training-attachments", data.lesson_id] });
      toast.success("Attachment added");
    },
    onError: (error: any) => {
      console.error("Create attachment error:", error);
      toast.error(error.message || "Failed to add attachment");
    },
  });

  // Delete attachment
  const deleteAttachment = useMutation({
    mutationFn: async ({ id, fileUrl, isExternal }: { id: string; fileUrl: string; isExternal: boolean }) => {
      // Delete from database
      const { error: dbError } = await supabase
        .from("training_attachments")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      // Delete from storage if not external link
      if (!isExternal) {
        const { error: storageError } = await supabase.storage
          .from("training-files")
          .remove([fileUrl]);

        if (storageError) {
          console.error("Storage delete error:", storageError);
          // Don't throw - file might not exist
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-attachments"] });
      toast.success("Attachment deleted");
    },
    onError: (error: any) => {
      console.error("Delete attachment error:", error);
      toast.error(error.message || "Failed to delete attachment");
    },
  });

  // Get signed URL for file download
  const getDownloadUrl = async (fileUrl: string, isExternal: boolean): Promise<string> => {
    if (isExternal) {
      return fileUrl; // External links are already URLs
    }

    const { data, error } = await supabase.storage
      .from("training-files")
      .createSignedUrl(fileUrl, 3600); // 1 hour expiry

    if (error) {
      console.error("Get signed URL error:", error);
      throw error;
    }

    return data.signedUrl;
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
