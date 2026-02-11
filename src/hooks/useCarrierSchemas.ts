import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CarrierSchema } from '@/lib/growth-center/types';

async function fetchCarrierSchemas(): Promise<CarrierSchema[]> {
  const { data, error } = await supabase
    .from('carrier_schemas' as never)
    .select('*')
    .eq('is_active', true)
    .order('display_name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as CarrierSchema[];
}

export function useCarrierSchemas() {
  return useQuery({
    queryKey: ['growth-center', 'carrier-schemas'],
    queryFn: fetchCarrierSchemas,
  });
}
