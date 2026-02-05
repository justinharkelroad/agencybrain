import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { OnboardingSequence, SequenceTargetType } from "./useOnboardingSequences";

export interface CommunitySequence extends Omit<OnboardingSequence, 'steps'> {
  agency_name: string | null;
  step_count: number;
  clone_count: number; // Always present in community sequences
}

interface RawSequenceData {
  id: string;
  agency_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  target_type: string;
  custom_type_label: string | null;
  is_public: boolean;
  source_sequence_id: string | null;
  clone_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  steps: { id: string }[] | null;
  agency: { name: string } | null;
}

export function useCommunitySequences(filters?: {
  targetType?: SequenceTargetType;
  searchQuery?: string;
}) {
  return useQuery({
    queryKey: ["community-sequences", filters?.targetType, filters?.searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("onboarding_sequences")
        .select(`
          *,
          steps:onboarding_sequence_steps(id),
          agency:agencies(name)
        `)
        .eq("is_public", true)
        .order("clone_count", { ascending: false });

      if (filters?.targetType) {
        query = query.eq("target_type", filters.targetType);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to include agency_name and step_count
      const sequences: CommunitySequence[] = (data as RawSequenceData[] || [])
        .map((seq) => {
          // Destructure to separate the joined data from the sequence data
          const { steps, agency, ...sequenceData } = seq;
          return {
            ...sequenceData,
            agency_name: agency?.name ?? null,
            step_count: steps?.length ?? 0,
            clone_count: seq.clone_count ?? 0, // Ensure clone_count has a default
          };
        })
        .filter((seq) => {
          // Apply search filter client-side for flexibility
          if (!filters?.searchQuery) return true;
          const searchLower = filters.searchQuery.toLowerCase();
          return (
            seq.name.toLowerCase().includes(searchLower) ||
            seq.description?.toLowerCase().includes(searchLower) ||
            seq.agency_name?.toLowerCase().includes(searchLower)
          );
        });

      return sequences;
    },
    staleTime: 60000, // 1 min cache
  });
}
