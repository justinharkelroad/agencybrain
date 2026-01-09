import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

interface AgencyProfile {
  agencySlug: string;
  agencyName: string;
  agencyId: string;
  scorecardRules: any;
}

type MemberRole = "Sales" | "Service" | "Hybrid" | "Manager";

export function useAgencyProfile(userId: string | undefined, role: MemberRole, staffAgencyId?: string) {
  return useQuery({
    queryKey: ["agency-profile", userId || staffAgencyId, role],
    enabled: !!(userId || staffAgencyId),
    queryFn: async (): Promise<AgencyProfile> => {
      let agencyId = staffAgencyId;
      
      // Only query profiles if we don't have staffAgencyId
      if (!agencyId && userId) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', userId)
          .single();
          
        if (profileError || !profile?.agency_id) {
          throw new Error('Failed to load user profile');
        }
        agencyId = profile.agency_id;
      }
      
      if (!agencyId) {
        throw new Error('No agency ID available');
      }

      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('slug, name')
        .eq('id', agencyId)
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
        .eq('agency_id', agencyId)
        .eq('role', role)
        .single();

      if (rulesError) {
        console.warn('Failed to load scorecard rules:', rulesError);
      }

      return {
        agencySlug,
        agencyName: agency.name || "",
        agencyId: agencyId,
        scorecardRules: rules,
      };
    },
  });
}