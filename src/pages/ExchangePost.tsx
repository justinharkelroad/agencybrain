import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { ExchangePostCard } from '@/components/exchange/ExchangePostCard';
import { ExchangePost } from '@/hooks/useExchange';

export default function ExchangePostPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { data: post, isLoading, error } = useQuery({
    queryKey: ['exchange-post', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_posts')
        .select(`
          *,
          user:profiles!user_id(full_name, email, agency:agencies(name))
        `)
        .eq('id', postId)
        .single();
      
      if (error) throw error;
      
      // Fetch tags
      const { data: postTags } = await supabase
        .from('exchange_post_tags')
        .select('tag:exchange_tags(id, name)')
        .eq('post_id', postId);
      
      // Fetch likes
      const { data: likes } = await supabase
        .from('exchange_likes')
        .select('user_id')
        .eq('post_id', postId);
      
      // Fetch comments count
      const { data: comments } = await supabase
        .from('exchange_comments')
        .select('id')
        .eq('post_id', postId);
      
      return {
        ...data,
        tags: postTags?.map((t: any) => t.tag).filter(Boolean) || [],
        likes_count: likes?.length || 0,
        comments_count: comments?.length || 0,
        user_has_liked: likes?.some(l => l.user_id === user?.id) || false,
      } as ExchangePost;
    },
    enabled: !!postId && !!user,
  });
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (error || !post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Post not found</h2>
        <p className="text-muted-foreground mb-6">
          This post may have been deleted or you don't have access to view it.
        </p>
        <Button onClick={() => navigate('/exchange')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to The Exchange
        </Button>
      </div>
    );
  }
  
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 gap-2"
        onClick={() => navigate('/exchange')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to The Exchange
      </Button>
      
      <ExchangePostCard post={post} defaultShowComments />
    </div>
  );
}
