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
      
      // Search profiles that have exchange access (agency owners with membership tier)
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          agency:agencies(name)
        `)
        .neq('id', user!.id) // Exclude self
        .neq('role', 'admin')
        .not('agency_id', 'is', null)
        .or(`full_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`)
        .limit(10);
      
      if (error) throw error;
      
      return (data || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        agency_name: (p.agency as any)?.name || null,
      })) as ExchangeUser[];
    },
    enabled: !!user && debouncedSearch.length >= 2,
  });
}
