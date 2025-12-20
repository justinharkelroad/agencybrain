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
      
      // Fetch profiles with agencies, then filter client-side
      // This allows searching by full_name, email, OR agency name
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
        .limit(100); // Fetch more, filter client-side
      
      if (error) throw error;
      
      // Filter client-side to match full_name, email, OR agency name
      const searchLower = debouncedSearch.toLowerCase();
      const filtered = (data || []).filter(p => {
        const agencyName = (p.agency as any)?.name || '';
        return (
          (p.full_name?.toLowerCase().includes(searchLower)) ||
          (p.email?.toLowerCase().includes(searchLower)) ||
          (agencyName.toLowerCase().includes(searchLower))
        );
      }).slice(0, 10);
      
      return filtered.map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        agency_name: (p.agency as any)?.name || null,
      })) as ExchangeUser[];
    },
    enabled: !!user && debouncedSearch.length >= 2,
  });
}
