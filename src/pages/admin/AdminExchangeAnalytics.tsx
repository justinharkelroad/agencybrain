import { useQuery } from '@tanstack/react-query';
import { BarChart3, Heart, MessageCircle, FileText, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SidebarLayout } from '@/components/SidebarLayout';
import { supabase } from '@/lib/supabaseClient';
import { format, subDays, subMonths } from 'date-fns';

export default function AdminExchangeAnalytics() {
  const { data: stats } = useQuery({
    queryKey: ['exchange-analytics'],
    queryFn: async () => {
      const now = new Date();
      const weekAgo = subDays(now, 7);
      const monthAgo = subMonths(now, 1);
      
      // Total posts
      const { count: totalPosts } = await supabase
        .from('exchange_posts')
        .select('id', { count: 'exact', head: true });
      
      const { count: postsThisWeek } = await supabase
        .from('exchange_posts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString());
      
      // Active users (posted in last month)
      const { data: activeUsers } = await supabase
        .from('exchange_posts')
        .select('user_id')
        .gte('created_at', monthAgo.toISOString());
      const uniqueActiveUsers = new Set(activeUsers?.map(u => u.user_id)).size;
      
      // Likes this week
      const { count: likesThisWeek } = await supabase
        .from('exchange_likes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString());
      
      // Comments this week
      const { count: commentsThisWeek } = await supabase
        .from('exchange_comments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString());
      
      return {
        totalPosts: totalPosts || 0,
        postsThisWeek: postsThisWeek || 0,
        activeUsers: uniqueActiveUsers,
        likesThisWeek: likesThisWeek || 0,
        commentsThisWeek: commentsThisWeek || 0,
      };
    },
  });
  
  const { data: topPosts } = useQuery({
    queryKey: ['exchange-top-posts'],
    queryFn: async () => {
      const { data: posts } = await supabase
        .from('exchange_posts')
        .select('id, content_text, created_at, user:profiles!user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (!posts) return [];
      
      // Get like counts for these posts
      const postIds = posts.map(p => p.id);
      const { data: likes } = await supabase
        .from('exchange_likes')
        .select('post_id')
        .in('post_id', postIds);
      
      const { data: comments } = await supabase
        .from('exchange_comments')
        .select('post_id')
        .in('post_id', postIds);
      
      const likeCounts = new Map<string, number>();
      likes?.forEach(l => likeCounts.set(l.post_id, (likeCounts.get(l.post_id) || 0) + 1));
      
      const commentCounts = new Map<string, number>();
      comments?.forEach(c => commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1));
      
      return posts.map(p => ({
        ...p,
        likes: likeCounts.get(p.id) || 0,
        comments: commentCounts.get(p.id) || 0,
      })).sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments)).slice(0, 10);
    },
  });
  
  return (
    <SidebarLayout>
      <div className="flex-1 p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Exchange Analytics
          </h1>
          <p className="text-muted-foreground">Overview of The Exchange activity</p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats?.totalPosts || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Posts</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats?.postsThisWeek || 0}</p>
                  <p className="text-xs text-muted-foreground">Posts This Week</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats?.activeUsers || 0}</p>
                  <p className="text-xs text-muted-foreground">Active Users</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats?.likesThisWeek || 0}</p>
                  <p className="text-xs text-muted-foreground">Likes This Week</p>
                </div>
                <Heart className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats?.commentsThisWeek || 0}</p>
                  <p className="text-xs text-muted-foreground">Comments This Week</p>
                </div>
                <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Top Posts */}
        <Card>
          <CardHeader>
            <CardTitle>Top Posts</CardTitle>
            <CardDescription>Most engaged posts</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPosts?.map(post => (
                  <TableRow key={post.id}>
                    <TableCell className="max-w-xs truncate">
                      {post.content_text?.slice(0, 50) || 'No text'}
                    </TableCell>
                    <TableCell>{(post.user as any)?.full_name || 'Unknown'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Badge variant="secondary" className="gap-1">
                          <Heart className="h-3 w-3" /> {post.likes}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <MessageCircle className="h-3 w-3" /> {post.comments}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(post.created_at), 'MMM d')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
