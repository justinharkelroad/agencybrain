import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { MarketingBucket, MarketingBucketInsert, MarketingBucketUpdate } from '@/types/lqs';

export const useMarketingBuckets = () => {
  const [buckets, setBuckets] = useState<MarketingBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchBuckets = async () => {
    if (!user?.id) {
      setBuckets([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get user's agency_id from profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.agency_id) {
        setError('User profile not found or not associated with an agency');
        setBuckets([]);
        return;
      }

      // Fetch marketing buckets for the agency
      const { data, error: bucketError } = await supabase
        .from('marketing_buckets')
        .select('*')
        .eq('agency_id', profile.agency_id)
        .order('order_index', { ascending: true });

      if (bucketError) throw bucketError;

      setBuckets(data || []);
    } catch (err) {
      console.error('Error fetching marketing buckets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load marketing buckets');
    } finally {
      setLoading(false);
    }
  };

  const createBucket = async (bucket: { name: string; commission_rate_percent: number }): Promise<MarketingBucket | null> => {
    if (!user?.id) return null;

    try {
      // Get user's agency_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.agency_id) throw new Error('No agency found');

      // Get max order_index
      const maxOrder = buckets.length > 0 
        ? Math.max(...buckets.map(b => b.order_index || 0)) 
        : 0;

      const { data, error } = await supabase
        .from('marketing_buckets')
        .insert({
          name: bucket.name,
          commission_rate_percent: bucket.commission_rate_percent,
          agency_id: profile.agency_id,
          order_index: maxOrder + 1,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      setBuckets(prev => [...prev, data]);
      return data;
    } catch (err) {
      console.error('Error creating marketing bucket:', err);
      setError(err instanceof Error ? err.message : 'Failed to create bucket');
      return null;
    }
  };

  const updateBucket = async (id: string, updates: MarketingBucketUpdate): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('marketing_buckets')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setBuckets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      return true;
    } catch (err) {
      console.error('Error updating marketing bucket:', err);
      setError(err instanceof Error ? err.message : 'Failed to update bucket');
      return false;
    }
  };

  const deleteBucket = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('marketing_buckets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setBuckets(prev => prev.filter(b => b.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting marketing bucket:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete bucket');
      return false;
    }
  };

  const reorderBuckets = async (bucketId: string, direction: 'up' | 'down'): Promise<boolean> => {
    const currentIndex = buckets.findIndex(b => b.id === bucketId);
    if (currentIndex === -1) return false;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= buckets.length) return false;

    const reordered = [...buckets];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Update order_index for affected buckets
    const updates = reordered.map((bucket, index) => ({
      id: bucket.id,
      order_index: index + 1
    }));

    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('marketing_buckets')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
        
        if (error) throw error;
      }

      setBuckets(reordered.map((b, i) => ({ ...b, order_index: i + 1 })));
      return true;
    } catch (err) {
      console.error('Error reordering buckets:', err);
      setError(err instanceof Error ? err.message : 'Failed to reorder buckets');
      return false;
    }
  };

  const getLeadSourceCountForBucket = async (bucketId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('lead_sources')
        .select('*', { count: 'exact', head: true })
        .eq('bucket_id', bucketId);

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('Error getting lead source count:', err);
      return 0;
    }
  };

  useEffect(() => {
    fetchBuckets();
  }, [user?.id]);

  return {
    buckets,
    loading,
    error,
    createBucket,
    updateBucket,
    deleteBucket,
    reorderBuckets,
    getLeadSourceCountForBucket,
    refetch: fetchBuckets
  };
};
