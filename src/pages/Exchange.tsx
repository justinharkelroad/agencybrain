import { ExchangeFeed } from '@/components/exchange/ExchangeFeed';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

export default function Exchange() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">The Exchange</h1>
            <p className="text-muted-foreground">Share insights and connect with the community</p>
          </div>
          <ExchangeFeed />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
