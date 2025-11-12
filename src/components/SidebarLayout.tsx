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
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border flex items-center px-4">
          <SidebarTrigger className="h-10 w-10" />
          <div className="flex-1 flex justify-center">
            <AgencyBrainBadge asLink to="/dashboard" />
          </div>
        </div>
        
        <main className="flex-1 flex flex-col pt-14 md:pt-0">
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
      
      <ROIForecastersModal open={roiOpen} onOpenChange={setRoiOpen} />
    </SidebarProvider>
  );
}
