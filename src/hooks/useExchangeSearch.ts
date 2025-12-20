import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { useDebounce } from './useDebounce';
import { ExchangePost } from './useExchange';

export function useExchangeSearch(searchTerm: string, tagFilter?: string) {
  const { user } = useAuth();
  const debouncedSearch = useDebounce(searchTerm, 300);
  
  return useQuery({
    queryKey: ['exchange-search', debouncedSearch, tagFilter],
    queryFn: async () => {
      // Build the query with search
      let query = supabase
        .from('exchange_posts')
        .select(`
          *,
          user:profiles!user_id(full_name, email, agency:agencies(name))
        `)
        .order('is_pinned', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      
      // Add search filter
      if (debouncedSearch) {
        query = query.or(`content_text.ilike.%${debouncedSearch}%,file_name.ilike.%${debouncedSearch}%`);
      }
      
      const { data: posts, error } = await query;
      if (error) throw error;
      
      if (!posts || posts.length === 0) return [];
      
      const postIds = posts.map(p => p.id);
      
      // Fetch tags for all posts
      const { data: postTags } = await supabase
        .from('exchange_post_tags')
        .select('post_id, tag:exchange_tags(id, name)')
        .in('post_id', postIds);
      
      // Fetch likes counts
      const { data: likes } = await supabase
        .from('exchange_likes')
        .select('post_id, user_id')
        .in('post_id', postIds);
      
      // Fetch comments counts
      const { data: comments } = await supabase
        .from('exchange_comments')
        .select('post_id')
        .in('post_id', postIds);
      
      // Build lookup maps
      const tagsMap = new Map<string, { id: string; name: string }[]>();
      postTags?.forEach(pt => {
        const existing = tagsMap.get(pt.post_id) || [];
        if (pt.tag) existing.push(pt.tag as { id: string; name: string });
        tagsMap.set(pt.post_id, existing);
      });
      
      const likesCountMap = new Map<string, number>();
      const userLikedMap = new Map<string, boolean>();
      likes?.forEach(l => {
        likesCountMap.set(l.post_id, (likesCountMap.get(l.post_id) || 0) + 1);
        if (l.user_id === user?.id) userLikedMap.set(l.post_id, true);
      });
      
      const commentsCountMap = new Map<string, number>();
      comments?.forEach(c => {
        commentsCountMap.set(c.post_id, (commentsCountMap.get(c.post_id) || 0) + 1);
      });
      
      // Transform posts
      let result = posts.map(post => ({
        ...post,
        tags: tagsMap.get(post.id) || [],
        likes_count: likesCountMap.get(post.id) || 0,
        comments_count: commentsCountMap.get(post.id) || 0,
        user_has_liked: userLikedMap.get(post.id) || false,
      })) as ExchangePost[];
      
      // Filter by tag if specified
      if (tagFilter) {
        result = result.filter(post => 
          post.tags.some(tag => tag.id === tagFilter)
        );
      }
      
      return result;
    },
    enabled: !!user && (!!debouncedSearch || !!tagFilter),
  });
}
