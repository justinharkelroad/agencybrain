import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ROIForecastersModal } from "@/components/ROIForecastersModal";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";

type SidebarLayoutProps = {
  children: React.ReactNode;
};

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [roiOpen, setRoiOpen] = useState(false);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar onOpenROI={() => setRoiOpen(true)} />
        
        {/* Mobile Header with Hamburger Menu - Only visible on mobile */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border flex items-center px-4 gap-3 pt-[env(safe-area-inset-top)] min-h-14">
          <SidebarTrigger className="shrink-0" />
          <div className="flex-1 flex justify-center min-w-0">
            <AgencyBrainBadge asLink to="/dashboard" />
          </div>
        </div>
        
        <main className="flex-1 flex flex-col pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0 overflow-x-hidden min-w-0">
          <div className="flex-1 min-w-0 w-full">
            {children}
          </div>
        </main>
      </div>
      
      <ROIForecastersModal open={roiOpen} onOpenChange={setRoiOpen} />
    </SidebarProvider>
  );
}
