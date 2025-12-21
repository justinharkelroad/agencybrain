import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, MessageCircle, Search as SearchIcon, LayoutGrid, Bell, MessageSquare } from 'lucide-react';
import { ExchangeFeed } from '@/components/exchange/ExchangeFeed';
import { ExchangeSidebar } from '@/components/exchange/ExchangeSidebar';
import { ExchangePostComposer } from '@/components/exchange/ExchangePostComposer';
import { SidebarLayout } from '@/components/SidebarLayout';
import { useExchangeRealtime } from '@/hooks/useExchangeRealtime';
import { useExchangeNotifications } from '@/hooks/useExchangeNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

export default function Exchange() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const highlightedPostId = searchParams.get('post');
  const hasScrolled = useRef(false);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [showComposer, setShowComposer] = useState(false);
  const { counts, markFeedViewed, markNotificationsViewed } = useExchangeNotifications();
  
  useExchangeRealtime();
  
  useEffect(() => {
    if (highlightedPostId && !hasScrolled.current) {
      const timer = setTimeout(() => {
        const postElement = document.getElementById(`post-${highlightedPostId}`);
        if (postElement) {
          postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          hasScrolled.current = true;
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [highlightedPostId]);
  
  // Mark all notifications as viewed when page loads
  useEffect(() => {
    markFeedViewed();
    markNotificationsViewed();
  }, [markFeedViewed, markNotificationsViewed]);
  
  return (
    <SidebarLayout>
      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">The Exchange</h1>
              <p className="text-muted-foreground">Share insights and connect with the community</p>
            </div>
            
            {/* Notification indicators */}
            {counts.newReplies > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => {
                  markNotificationsViewed();
                }}
              >
                <Bell className="h-4 w-4" />
                <span>{counts.newReplies} new {counts.newReplies === 1 ? 'reply' : 'replies'}</span>
              </Button>
            )}
          </div>
          
          {/* Desktop Layout */}
          <div className="hidden md:grid md:grid-cols-3 gap-6">
            <div className="col-span-2">
              <ExchangeFeed 
                highlightPostId={highlightedPostId || undefined}
                onTagFilterChange={setTagFilter}
                externalTagFilter={tagFilter}
              />
            </div>
            <div className="col-span-1">
              <div className="sticky top-24">
                <ExchangeSidebar 
                  onTagClick={setTagFilter}
                  onNewPost={() => setShowComposer(true)}
                />
              </div>
            </div>
          </div>
          
          {/* Mobile Layout */}
          <div className="md:hidden">
            <ExchangeFeed 
              highlightPostId={highlightedPostId || undefined}
              onTagFilterChange={setTagFilter}
              externalTagFilter={tagFilter}
            />
          </div>
        </div>
      </div>
      
      {/* Mobile FAB */}
      <div className="fixed bottom-20 right-4 md:hidden z-40 flex flex-col gap-2">
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={() => navigate('/exchange/messages')}
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      </div>
    </SidebarLayout>
  );
}
