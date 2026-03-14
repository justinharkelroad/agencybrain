import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import type { DomainReflection } from "./useWeeklyDebrief";

export interface StaffWeeklyReview {
  id: string;
  staff_user_id: string;
  team_member_id: string | null;
  agency_id: string | null;
  week_key: string;
  core4_points: number;
  flow_points: number;
  playbook_points: number;
  total_points: number;
  domain_reflections: Record<string, DomainReflection>;
  gratitude_note: string | null;
  next_week_one_big_thing: string | null;
  status: "in_progress" | "completed";
  completed_at: string | null;
  current_step: number;
  created_at: string;
  updated_at: string;
}

export function useStaffWeeklyDebrief(weekKey: string) {
  const { user, sessionToken } = useStaffAuth();
  const queryClient = useQueryClient();

  const queryKey = ["staff-weekly-debrief", user?.id, weekKey];

  const { data: review, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!sessionToken || !user?.id) return null;
      const { data, error } = await supabase.functions.invoke("get_staff_team_data", {
        headers: { "x-staff-session": sessionToken },
        body: { type: "weekly_review", week_key: weekKey },
      });
      if (error) throw error;
      return (data?.review as StaffWeeklyReview) || null;
    },
    enabled: !!sessionToken && !!user?.id,
  });

  const createOrResume = useMutation({
    mutationFn: async () => {
      if (!sessionToken || !user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke("get_staff_team_data", {
        headers: { "x-staff-session": sessionToken },
        body: { type: "weekly_review_create", week_key: weekKey },
      });
      if (error) throw error;
      return data?.review as StaffWeeklyReview;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveStep = useMutation({
    mutationFn: async (step: number) => {
      if (!sessionToken || !review?.id) throw new Error("No review");
      const { error } = await supabase.functions.invoke("get_staff_team_data", {
        headers: { "x-staff-session": sessionToken },
        body: { type: "weekly_review_update", review_id: review.id, updates: { current_step: step } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveGratitudeNote = useMutation({
    mutationFn: async (note: string) => {
      if (!sessionToken || !review?.id) throw new Error("No review");
      const { error } = await supabase.functions.invoke("get_staff_team_data", {
        headers: { "x-staff-session": sessionToken },
        body: { type: "weekly_review_update", review_id: review.id, updates: { gratitude_note: note } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveDomainReflection = useMutation({
    mutationFn: async ({ domain, reflection }: { domain: string; reflection: DomainReflection }) => {
      if (!sessionToken || !review?.id) throw new Error("No review");
      // Fetch latest reflections to avoid stale closure overwriting concurrent saves
      const { data: latestData } = await supabase.functions.invoke("get_staff_team_data", {
        headers: { "x-staff-session": sessionToken },
        body: { type: "weekly_review", week_key: review.week_key },
      });
      const currentReflections = (latestData?.review?.domain_reflections as Record<string, DomainReflection>) || {};
      const updated = { ...currentReflections, [domain]: reflection };
      const { error } = await supabase.functions.invoke("get_staff_team_data", {
        headers: { "x-staff-session": sessionToken },
        body: { type: "weekly_review_update", review_id: review.id, updates: { domain_reflections: updated } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveNextWeekOBT = useMutation({
    mutationFn: async (obt: string) => {
      if (!sessionToken || !review?.id) throw new Error("No review");
      const { error } = await supabase.functions.invoke("get_staff_team_data", {
        headers: { "x-staff-session": sessionToken },
        body: { type: "weekly_review_update", review_id: review.id, updates: { next_week_one_big_thing: obt } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const completeDebrief = useMutation({
    mutationFn: async (scores: {
      core4Points: number;
      flowPoints: number;
      playbookPoints: number;
      totalPoints: number;
    }) => {
      if (!sessionToken || !review?.id) throw new Error("No review");
      const { error } = await supabase.functions.invoke("get_staff_team_data", {
        headers: { "x-staff-session": sessionToken },
        body: {
          type: "weekly_review_complete",
          review_id: review.id,
          scores,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    review,
    isLoading,
    createOrResume,
    saveStep,
    saveGratitudeNote,
    saveDomainReflection,
    saveNextWeekOBT,
    completeDebrief,
  };
}
