import { ExchangeFeed } from '@/components/exchange/ExchangeFeed';
import { SidebarLayout } from '@/components/SidebarLayout';

export default function Exchange() {
  return (
    <SidebarLayout>
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">The Exchange</h1>
          <p className="text-muted-foreground">Share insights and connect with the community</p>
        </div>
        <ExchangeFeed />
      </div>
    </SidebarLayout>
  );
}
