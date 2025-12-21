import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export type ExchangeContentType = 'process_vault' | 'flow_result' | 'saved_report' | 'training_module' | 'text_post' | 'external_link' | 'image';
export type ExchangeVisibility = 'call_scoring' | 'boardroom' | 'one_on_one';

const POSTS_PER_PAGE = 20;

export interface ExchangePost {
  id: string;
  user_id: string;
  agency_id: string | null;
  content_type: ExchangeContentType;
  content_text: string | null;
  file_path: string | null;
  file_name: string | null;
  external_url: string | null;
  source_reference: { type: string; id: string; title: string } | null;
  visibility: ExchangeVisibility;
  is_admin_post: boolean;
  is_pinned?: boolean;
  created_at: string;
  updated_at: string;
  user: {
    full_name: string | null;
    email: string;
    profile_photo_url?: string | null;
    agency?: { name: string } | null;
  } | null;
  tags: { id: string; name: string }[];
  likes_count: number;
  comments_count: number;
  user_has_liked: boolean;
}

export interface ExchangeTag {
  id: string;
  name: string;
  is_active: boolean;
}

export interface CreatePostInput {
  content_type: ExchangeContentType;
  content_text?: string;
  file_path?: string;
  file_name?: string;
  external_url?: string;
  source_reference?: { type: string; id: string; title: string };
  visibility: ExchangeVisibility;
  tag_ids?: string[];
  private_recipient_id?: string;
}

export function useExchangeFeed(tagFilter?: string) {
  const { user } = useAuth();
  
  return useInfiniteQuery({
    queryKey: ['exchange-feed', tagFilter || 'all'],
    queryFn: async ({ pageParam }) => {
      // Build base query
      let query = supabase
        .from('exchange_posts')
        .select(`
          *,
          user:profiles!user_id(full_name, email, profile_photo_url, agency:agencies(name))
        `)
        .order('is_pinned', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(POSTS_PER_PAGE);
      
      // Cursor-based pagination - only add cursor if valid string
      if (pageParam && typeof pageParam === 'string') {
        query = query.lt('created_at', pageParam);
      }
      
      const { data: posts, error } = await query;
      if (error) {
        console.error('Exchange feed error:', error);
        throw error;
      }
      
      if (!posts || posts.length === 0) {
        return { posts: [], nextCursor: null };
      }
      
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
      
      // Determine next cursor
      const nextCursor = posts.length === POSTS_PER_PAGE 
        ? posts[posts.length - 1].created_at 
        : null;
      
      return { posts: result, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    enabled: !!user?.id,
  });
}

export function useExchangeTags() {
  return useQuery({
    queryKey: ['exchange-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_tags')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as ExchangeTag[];
    },
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      // Get user's agency_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user!.id)
        .single();
      
      const { data: post, error: postError } = await supabase
        .from('exchange_posts')
        .insert({
          user_id: user!.id,
          agency_id: profile?.agency_id,
          content_type: input.content_type,
          content_text: input.content_text,
          file_path: input.file_path,
          file_name: input.file_name,
          external_url: input.external_url,
          source_reference: input.source_reference,
          visibility: input.visibility,
          is_admin_post: false,
          private_recipient_id: input.private_recipient_id,
        })
        .select()
        .single();
      
      if (postError) throw postError;
      
      // Add tags if provided
      if (input.tag_ids && input.tag_ids.length > 0) {
        const { error: tagError } = await supabase
          .from('exchange_post_tags')
          .insert(input.tag_ids.map(tagId => ({
            post_id: post.id,
            tag_id: tagId,
          })));
        
        if (tagError) throw tagError;
      }
      
      return post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-feed'] });
      toast.success('Post shared to The Exchange');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to share post');
    },
  });
}

export function useToggleLike() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ postId, hasLiked }: { postId: string; hasLiked: boolean }) => {
      if (hasLiked) {
        const { error } = await supabase
          .from('exchange_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('exchange_likes')
          .insert({ post_id: postId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-feed'] });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('exchange_posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-feed'] });
      toast.success('Post deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete post');
    },
  });
}

export function useReportPost() {
  return useMutation({
    mutationFn: async ({ postId, reason }: { postId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('exchange_reports')
        .insert({
          post_id: postId,
          reporter_user_id: user.id,
          reason,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Post reported. Thank you for helping keep the community safe.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to report post');
    },
  });
}
