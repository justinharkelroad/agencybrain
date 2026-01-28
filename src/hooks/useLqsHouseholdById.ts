import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HouseholdWithRelations } from './useLqsData';

/**
 * Fetch a single LQS household by ID with all relations.
 * Used for opening household detail modals from various contexts.
 */
export function useLqsHouseholdById(householdId: string | null) {
  return useQuery({
    queryKey: ['lqs-household-by-id', householdId],
    enabled: !!householdId,
    staleTime: 30000, // Cache for 30 seconds
    queryFn: async (): Promise<HouseholdWithRelations | null> => {
      if (!householdId) return null;

      const { data, error } = await supabase
        .from('lqs_households')
        .select(`
          *,
          quotes:lqs_quotes(*),
          sales:lqs_sales(
            id,
            sale_date,
            product_type,
            items_sold,
            policies_sold,
            premium_cents,
            policy_number,
            source,
            source_reference_id,
            linked_quote_id
          ),
          lead_source:lead_sources!lqs_households_lead_source_id_fkey(
            id,
            name,
            is_self_generated,
            bucket:marketing_buckets(id, name)
          ),
          team_member:team_members(id, name)
        `)
        .eq('id', householdId)
        .single();

      if (error) {
        console.error('Failed to fetch household:', error);
        throw error;
      }

      return data as HouseholdWithRelations;
    },
  });
}
