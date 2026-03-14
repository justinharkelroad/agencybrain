import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface DomainReflection {
  wins: string;
  carry_forward: string;
  rating: number;
}

export interface WeeklyReview {
  id: string;
  user_id: string;
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

export function useWeeklyDebrief(weekKey: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ["weekly-debrief", user?.id, weekKey];

  const { data: review, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("weekly_reviews")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_key", weekKey)
        .maybeSingle();
      if (error) throw error;
      return data as WeeklyReview | null;
    },
    enabled: !!user?.id,
  });

  const createOrResume = useMutation({
    mutationFn: async (agencyId: string | null) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Check if already exists
      const { data: existing } = await supabase
        .from("weekly_reviews")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_key", weekKey)
        .maybeSingle();

      if (existing) return existing as WeeklyReview;

      const { data, error } = await supabase
        .from("weekly_reviews")
        .insert({
          user_id: user.id,
          agency_id: agencyId,
          week_key: weekKey,
          status: "in_progress",
          current_step: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data as WeeklyReview;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveStep = useMutation({
    mutationFn: async (step: number) => {
      if (!review?.id) throw new Error("No review");
      const { error } = await supabase
        .from("weekly_reviews")
        .update({ current_step: step, updated_at: new Date().toISOString() })
        .eq("id", review.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveGratitudeNote = useMutation({
    mutationFn: async (note: string) => {
      if (!review?.id) throw new Error("No review");
      const { error } = await supabase
        .from("weekly_reviews")
        .update({ gratitude_note: note, updated_at: new Date().toISOString() })
        .eq("id", review.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveDomainReflection = useMutation({
    mutationFn: async ({
      domain,
      reflection,
    }: {
      domain: string;
      reflection: DomainReflection;
    }) => {
      if (!review?.id) throw new Error("No review");
      // Read latest from DB to avoid stale closure overwriting concurrent saves
      const { data: latest } = await supabase
        .from("weekly_reviews")
        .select("domain_reflections")
        .eq("id", review.id)
        .single();
      const currentReflections = (latest?.domain_reflections as Record<string, DomainReflection>) || {};
      const updated = { ...currentReflections, [domain]: reflection };
      const { error } = await supabase
        .from("weekly_reviews")
        .update({ domain_reflections: updated, updated_at: new Date().toISOString() })
        .eq("id", review.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveNextWeekOBT = useMutation({
    mutationFn: async (obt: string) => {
      if (!review?.id) throw new Error("No review");
      const { error } = await supabase
        .from("weekly_reviews")
        .update({ next_week_one_big_thing: obt, updated_at: new Date().toISOString() })
        .eq("id", review.id);
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
      if (!review?.id) throw new Error("No review");
      const { error } = await supabase
        .from("weekly_reviews")
        .update({
          core4_points: scores.core4Points,
          flow_points: scores.flowPoints,
          playbook_points: scores.playbookPoints,
          total_points: scores.totalPoints,
          status: "completed",
          completed_at: new Date().toISOString(),
          current_step: 4,
          updated_at: new Date().toISOString(),
        })
        .eq("id", review.id);
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
