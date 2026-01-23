import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types
export interface ChallengeProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_weeks: number;
  total_lessons: number;
  is_active: boolean;
}

export interface ChallengeModule {
  id: string;
  challenge_product_id: string;
  name: string;
  description: string | null;
  week_number: number;
  sort_order: number;
  icon: string | null;
}

export interface ChallengeLesson {
  id: string;
  challenge_product_id: string;
  module_id: string;
  title: string;
  day_number: number;
  week_number: number | null;
  day_of_week: number | null;
  sort_order: number;
  video_url: string | null;
  video_thumbnail_url: string | null;
  preview_text: string | null;
  content_html: string | null;
  questions: any[] | null;
  action_items: any[] | null;
  is_discovery_stack: boolean;
  email_subject: string | null;
  email_preview: string | null;
}

// Fetch all challenge products
export function useChallengeProducts() {
  return useQuery({
    queryKey: ["challenge-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenge_products")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as ChallengeProduct[];
    },
  });
}

// Fetch modules for a challenge product
export function useChallengeModules(productId: string | undefined) {
  return useQuery({
    queryKey: ["challenge-modules", productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from("challenge_modules")
        .select("*")
        .eq("challenge_product_id", productId)
        .order("week_number");

      if (error) throw error;
      return data as ChallengeModule[];
    },
    enabled: !!productId,
  });
}

// Fetch lessons for a module
export function useChallengeLessons(moduleId: string | undefined) {
  return useQuery({
    queryKey: ["challenge-lessons", moduleId],
    queryFn: async () => {
      if (!moduleId) return [];
      
      const { data, error } = await supabase
        .from("challenge_lessons")
        .select("*")
        .eq("module_id", moduleId)
        .order("day_number");

      if (error) throw error;
      return data as ChallengeLesson[];
    },
    enabled: !!moduleId,
  });
}

// Fetch all lessons for a product (for overview)
export function useAllChallengeLessons(productId: string | undefined) {
  return useQuery({
    queryKey: ["challenge-lessons-all", productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from("challenge_lessons")
        .select("*, challenge_modules!inner(week_number, name)")
        .eq("challenge_product_id", productId)
        .order("day_number");

      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });
}

// Fetch a single lesson by ID
export function useChallengeLesson(lessonId: string | undefined) {
  return useQuery({
    queryKey: ["challenge-lesson", lessonId],
    queryFn: async () => {
      if (!lessonId) return null;
      
      const { data, error } = await supabase
        .from("challenge_lessons")
        .select("*")
        .eq("id", lessonId)
        .single();

      if (error) throw error;
      return data as ChallengeLesson;
    },
    enabled: !!lessonId,
  });
}

// Update a lesson
export function useUpdateChallengeLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<ChallengeLesson>;
    }) => {
      const { data, error } = await supabase
        .from("challenge_lessons")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["challenge-lessons"] });
      queryClient.invalidateQueries({ queryKey: ["challenge-lessons-all"] });
      queryClient.invalidateQueries({ queryKey: ["challenge-lesson", data.id] });
      toast.success("Lesson updated successfully");
    },
    onError: (error: any) => {
      console.error("Failed to update lesson:", error);
      toast.error("Failed to update lesson");
    },
  });
}

// Update a module
export function useUpdateChallengeModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<ChallengeModule>;
    }) => {
      const { data, error } = await supabase
        .from("challenge_modules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenge-modules"] });
      toast.success("Module updated successfully");
    },
    onError: (error: any) => {
      console.error("Failed to update module:", error);
      toast.error("Failed to update module");
    },
  });
}
