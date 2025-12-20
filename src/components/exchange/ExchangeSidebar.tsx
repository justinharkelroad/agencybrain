import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Heart, FileText, TrendingUp, Plus, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { useExchangeTags } from '@/hooks/useExchange';
import { useUnreadMessageCount } from '@/hooks/useExchangeUnread';
import { useNavigate } from 'react-router-dom';

interface ExchangeSidebarProps {
  onTagClick: (tagId: string) => void;
  onNewPost: () => void;
}

export function ExchangeSidebar({ onTagClick, onNewPost }: ExchangeSidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: tags } = useExchangeTags();
  const { data: unreadMessages } = useUnreadMessageCount();
  
  // User stats query
  const { data: userStats } = useQuery({
    queryKey: ['exchange-user-stats', user?.id],
    queryFn: async () => {
      // Get user's posts count
      const { count: postsCount } = await supabase
        .from('exchange_posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id);
      
      // Get likes received on user's posts
      const { data: userPosts } = await supabase
        .from('exchange_posts')
        .select('id')
        .eq('user_id', user!.id);
      
      let likesReceived = 0;
      let commentsReceived = 0;
      
      if (userPosts && userPosts.length > 0) {
        const postIds = userPosts.map(p => p.id);
        
        const { count: likes } = await supabase
          .from('exchange_likes')
          .select('id', { count: 'exact', head: true })
          .in('post_id', postIds);
        likesReceived = likes || 0;
        
        const { count: comments } = await supabase
          .from('exchange_comments')
          .select('id', { count: 'exact', head: true })
          .in('post_id', postIds);
        commentsReceived = comments || 0;
      }
      
      return { postsCount: postsCount || 0, likesReceived, commentsReceived };
    },
    enabled: !!user,
  });
  
  // Tag usage stats
  const { data: tagStats } = useQuery({
    queryKey: ['exchange-tag-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('exchange_post_tags')
        .select('tag_id, tag:exchange_tags(id, name)');
      
      const counts = new Map<string, { id: string; name: string; count: number }>();
      data?.forEach(pt => {
        if (pt.tag) {
          const tag = pt.tag as { id: string; name: string };
          const existing = counts.get(tag.id);
          if (existing) {
            existing.count++;
          } else {
            counts.set(tag.id, { id: tag.id, name: tag.name, count: 1 });
          }
        }
      });
      
      return Array.from(counts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
  });
  
  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4 space-y-2">
          <Button className="w-full gap-2" onClick={onNewPost}>
            <Plus className="h-4 w-4" />
            New Post
          </Button>
          <Button 
            variant="outline" 
            className="w-full gap-2 relative"
            onClick={() => navigate('/exchange/messages')}
          >
            <Mail className="h-4 w-4" />
            Messages
            {unreadMessages && unreadMessages > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-[#af0000] text-white text-xs">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </Badge>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* User Stats */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Your Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">{userStats?.postsCount || 0}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{userStats?.likesReceived || 0}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Heart className="h-3 w-3" /> Likes
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{userStats?.commentsReceived || 0}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <MessageCircle className="h-3 w-3" /> Comments
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Popular Tags */}
      {tagStats && tagStats.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Popular Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-2">
              {tagStats.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => onTagClick(tag.id)}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-sm">{tag.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {tag.count}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
