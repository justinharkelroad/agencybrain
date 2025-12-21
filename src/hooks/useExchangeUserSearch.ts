import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { useDebounce } from '@/hooks/useDebounce';

export interface ExchangeUser {
  id: string;
  full_name: string | null;
  email: string;
  agency_name: string | null;
}

export function useExchangeUserSearch(searchTerm: string) {
  const { user } = useAuth();
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  return useQuery({
    queryKey: ['exchange-user-search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      
      // Use SECURITY DEFINER function to search all Exchange community members
      const { data, error } = await supabase.rpc('search_exchange_users', {
        search_term: debouncedSearch,
        current_user_id: user!.id,
      });
      
      if (error) throw error;
      
      return (data || []) as ExchangeUser[];
    },
    enabled: !!user && debouncedSearch.length >= 2,
  });
}
