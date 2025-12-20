import { useState, useEffect, useRef, useMemo } from 'react';
import { Filter, RefreshCw, Search, X, ArrowUp, Plus, Loader2 } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useExchangeFeed, useExchangeTags } from '@/hooks/useExchange';
import { useExchangeSearch } from '@/hooks/useExchangeSearch';
import { useMarkPostsViewed } from '@/hooks/useExchangeUnread';
import { ExchangePostCard } from './ExchangePostCard';
import { ExchangePostComposer } from './ExchangePostComposer';
import { ExchangePostSkeleton } from './ExchangePostSkeleton';
import { cn } from '@/lib/utils';

interface ExchangeFeedProps {
  highlightPostId?: string;
  onTagFilterChange?: (tagId: string) => void;
  externalTagFilter?: string;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  onComposerOpen?: () => void;
}

export function ExchangeFeed({ 
  highlightPostId, 
  onTagFilterChange, 
  externalTagFilter,
  searchInputRef: externalSearchRef,
  onComposerOpen,
}: ExchangeFeedProps) {
  const [tagFilter, setTagFilter] = useState<string>(externalTagFilter || '');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedPostId, setExpandedPostId] = useState<string | undefined>(highlightPostId);
  const [showNewPostsBanner, setShowNewPostsBanner] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const internalSearchRef = useRef<HTMLInputElement>(null);
  const searchRef = externalSearchRef || internalSearchRef;
  const lastPostCountRef = useRef<number>(0);
  
  // Infinite scroll trigger
  const { ref: loadMoreRef, inView } = useInView();
  
  // Use external tag filter if provided
  useEffect(() => {
    if (externalTagFilter !== undefined) {
      setTagFilter(externalTagFilter);
    }
  }, [externalTagFilter]);
  
  const { 
    data: feedData, 
    isLoading: feedLoading, 
    refetch, 
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useExchangeFeed(tagFilter || undefined);
  const { data: searchResults, isLoading: searchLoading } = useExchangeSearch(searchTerm, tagFilter || undefined);
  const { data: tags } = useExchangeTags();
  const markPostsViewed = useMarkPostsViewed();
  
  // Flatten paginated posts
  const feedPosts = useMemo(() => {
    if (!feedData?.pages) return [];
    return feedData.pages.flatMap(page => page.posts);
  }, [feedData]);
  
  // Determine which posts to show
  const posts = searchTerm ? searchResults : feedPosts;
  const isLoading = searchTerm ? searchLoading : feedLoading;
  
  // Auto-load more when scrolled to bottom
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !searchTerm) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, searchTerm]);
  
  // Mark posts as viewed when they load
  useEffect(() => {
    if (posts && posts.length > 0) {
      const postIds = posts.map(p => p.id);
      markPostsViewed.mutate(postIds);
    }
  }, [posts]);
  
  // Detect new posts and show banner
  useEffect(() => {
    if (feedPosts && lastPostCountRef.current > 0) {
      const newCount = feedPosts.length - lastPostCountRef.current;
      if (newCount > 0 && window.scrollY > 200) {
        setNewPostsCount(newCount);
        setShowNewPostsBanner(true);
      }
    }
    if (feedPosts) {
      lastPostCountRef.current = feedPosts.length;
    }
  }, [feedPosts]);
  
  // Expand comments for highlighted post
  useEffect(() => {
    if (highlightPostId) {
      setExpandedPostId(highlightPostId);
      // Scroll to post after a short delay
      setTimeout(() => {
        document.getElementById(`post-${highlightPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [highlightPostId]);
  
  const handleTagChange = (value: string) => {
    setTagFilter(value);
    onTagFilterChange?.(value);
  };
  
  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShowNewPostsBanner(false);
    setNewPostsCount(0);
    refetch();
  };
  
  const clearFilters = () => {
    setSearchTerm('');
    setTagFilter('');
    onTagFilterChange?.('');
  };
  
  const hasActiveFilters = searchTerm || tagFilter;
  
  return (
    <div className="space-y-6" ref={feedRef}>
      {/* New Posts Banner */}
      {showNewPostsBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2">
          <Button
            onClick={handleScrollToTop}
            className="gap-2 shadow-lg bg-primary hover:bg-primary/90"
          >
            <ArrowUp className="h-4 w-4" />
            {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'}
          </Button>
        </div>
      )}
      
      {/* Composer */}
      <ExchangePostComposer />
      
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search posts... (/)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={tagFilter} onValueChange={handleTagChange}>
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
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      {/* Posts */}
      {isLoading ? (
        <div className="space-y-4">
          <ExchangePostSkeleton />
          <ExchangePostSkeleton />
          <ExchangePostSkeleton />
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
          
          {/* Load More Trigger */}
          {!searchTerm && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading more...</span>
                </div>
              ) : hasNextPage ? (
                <div className="h-8" /> // Invisible trigger area
              ) : posts.length > 10 ? (
                <p className="text-sm text-muted-foreground">You've reached the end</p>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-card/30 rounded-lg border border-dashed border-border">
          <div className="max-w-sm mx-auto space-y-4">
            {hasActiveFilters ? (
              <>
                <Search className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <div>
                  <p className="text-lg font-medium text-foreground">No results found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your search or filter criteria
                  </p>
                </div>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </>
            ) : (
              <>
                <Plus className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <div>
                  <p className="text-lg font-medium text-foreground">No posts yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Be the first to share something with the community!
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
