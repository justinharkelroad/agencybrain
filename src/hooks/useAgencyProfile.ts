import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

interface AgencyProfile {
  agencySlug: string;
  agencyName: string;
  agencyId: string;
  scorecardRules: any;
}

type MemberRole = "Sales" | "Service" | "Hybrid" | "Manager";

interface StaffAgencyProfile {
  agencyId: string;
  agencySlug: string;
  agencyName: string;
}

export function useAgencyProfile(userId: string | undefined, role: MemberRole, staffAgencyProfile?: StaffAgencyProfile) {
  return useQuery({
    queryKey: ["agency-profile", userId || staffAgencyProfile?.agencyId, role],
    enabled: !!(userId || staffAgencyProfile),
    queryFn: async (): Promise<AgencyProfile> => {
      // If we have a pre-fetched staff agency profile, use it directly
      // This avoids RLS issues since staff users don't have Supabase auth sessions
      if (staffAgencyProfile) {
        // Just fetch the scorecard rules using agency ID
        const { data: rules, error: rulesError } = await supabase
          .from('scorecard_rules')
          .select('*')
          .eq('agency_id', staffAgencyProfile.agencyId)
          .eq('role', role)
          .single();

        if (rulesError && rulesError.code !== 'PGRST116') {
          console.warn('Failed to load scorecard rules:', rulesError);
        }

        return {
          agencySlug: staffAgencyProfile.agencySlug,
          agencyName: staffAgencyProfile.agencyName,
          agencyId: staffAgencyProfile.agencyId,
          scorecardRules: rules,
        };
      }
      
      // Standard path for Supabase-authenticated users
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', userId!)
        .single();
        
      if (profileError || !profile?.agency_id) {
        throw new Error('Failed to load user profile');
      }
      
      const agencyId = profile.agency_id;

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