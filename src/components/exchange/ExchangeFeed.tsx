import { useState, useEffect } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useExchangeFeed, useExchangeTags } from '@/hooks/useExchange';
import { ExchangePostCard } from './ExchangePostCard';
import { ExchangePostComposer } from './ExchangePostComposer';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ExchangeFeedProps {
  highlightPostId?: string;
}

export function ExchangeFeed({ highlightPostId }: ExchangeFeedProps) {
  const [tagFilter, setTagFilter] = useState<string>('');
  const [expandedPostId, setExpandedPostId] = useState<string | undefined>(highlightPostId);
  
  const { data: posts, isLoading, refetch, isRefetching } = useExchangeFeed(tagFilter || undefined);
  const { data: tags } = useExchangeTags();
  
  // Expand comments for highlighted post
  useEffect(() => {
    if (highlightPostId) {
      setExpandedPostId(highlightPostId);
    }
  }, [highlightPostId]);
  
  return (
    <div className="space-y-6">
      {/* Composer */}
      <ExchangePostComposer />
      
      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="All Topics" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Topics</SelectItem>
              {tags?.map(tag => (
                <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {/* Posts */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border rounded-lg p-4 space-y-3 bg-card/50">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-4">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : posts && posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map(post => (
            <div
              key={post.id}
              id={`post-${post.id}`}
              className={cn(
                "transition-all duration-300",
                highlightPostId === post.id && "ring-2 ring-primary ring-offset-2 rounded-lg"
              )}
            >
              <ExchangePostCard 
                post={post} 
                defaultShowComments={expandedPostId === post.id}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-card/30 rounded-lg border border-dashed border-border">
          <p className="text-muted-foreground">No posts yet. Be the first to share something!</p>
        </div>
      )}
    </div>
  );
}
