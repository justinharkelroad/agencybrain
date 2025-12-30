import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

interface AgencyProfile {
  agencySlug: string;
  agencyName: string;
  agencyId: string;
  scorecardRules: any;
}

type MemberRole = "Sales" | "Service" | "Hybrid" | "Manager";

export function useAgencyProfile(userId: string | undefined, role: MemberRole) {
  return useQuery({
    queryKey: ["agency-profile", userId, role],
    enabled: !!userId,
    queryFn: async (): Promise<AgencyProfile> => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', userId!)
        .single();
        
      if (profileError || !profile?.agency_id) {
        throw new Error('Failed to load user profile');
      }

      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('slug, name')
        .eq('id', profile.agency_id)
        .single();
        
      if (agencyError || !agency) {
        throw new Error('Failed to load agency information');
      }

      // Slug should always exist due to database trigger - fail fast if missing
      if (!agency.slug) {
        throw new Error('Agency slug not configured - please contact support');
      }
      const agencySlug = agency.slug;

      const { data: rules, error: rulesError } = await supabase
        .from('scorecard_rules')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .eq('role', role)
        .single();

      if (rulesError) {
        console.warn('Failed to load scorecard rules:', rulesError);
      }

      return {
        agencySlug,
        agencyName: agency.name || "",
        agencyId: profile.agency_id,
        scorecardRules: rules,
      };
    },
  });
}