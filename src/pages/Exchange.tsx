import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExchangeFeed } from '@/components/exchange/ExchangeFeed';
import { SidebarLayout } from '@/components/SidebarLayout';
import { useExchangeRealtime } from '@/hooks/useExchangeRealtime';

export default function Exchange() {
  const [searchParams] = useSearchParams();
  const highlightedPostId = searchParams.get('post');
  const hasScrolled = useRef(false);
  
  useExchangeRealtime(); // Enable real-time updates
  
  // Handle deep link to specific post
  useEffect(() => {
    if (highlightedPostId && !hasScrolled.current) {
      // Give time for the feed to load
      const timer = setTimeout(() => {
        const postElement = document.getElementById(`post-${highlightedPostId}`);
        if (postElement) {
          postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight effect
          postElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            postElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 3000);
          hasScrolled.current = true;
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [highlightedPostId]);
  
  return (
    <SidebarLayout>
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">The Exchange</h1>
          <p className="text-muted-foreground">Share insights and connect with the community</p>
        </div>
        <ExchangeFeed highlightPostId={highlightedPostId || undefined} />
      </div>
    </SidebarLayout>
  );
}
