import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StaffSidebar } from "./StaffSidebar";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";
import { ROIForecastersModal, CalcKey } from "@/components/ROIForecastersModal";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { getStaffHomePath } from "@/utils/tierAccess";

export function StaffLayout() {
  const { user } = useStaffAuth();
  const [roiOpen, setRoiOpen] = useState(false);
  const [roiInitialTool, setRoiInitialTool] = useState<CalcKey | null>(null);

  // Get the tier-aware home path for this user
  const staffHomePath = getStaffHomePath(user?.agency_membership_tier);

  const handleOpenROI = (toolKey?: CalcKey) => {
    setRoiInitialTool(toolKey || null);
    setRoiOpen(true);
  };

  const handleCloseROI = (open: boolean) => {
    setRoiOpen(open);
    if (!open) {
      setRoiInitialTool(null);
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <StaffSidebar onOpenROI={handleOpenROI} />
        
        {/* Mobile Header with Hamburger Menu - Only visible on mobile */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border flex items-center px-4 gap-3 pt-[env(safe-area-inset-top)] min-h-14">
          <SidebarTrigger className="shrink-0" />
          <div className="flex-1 flex justify-center min-w-0">
            <AgencyBrainBadge asLink to={staffHomePath} />
          </div>
        </div>
        
        <main className="flex-1 flex flex-col pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0 overflow-x-hidden min-w-0">
          <div className="flex-1 min-w-0 w-full">
            <Outlet />
          </div>
        </main>
      </div>
      
      <ROIForecastersModal 
        open={roiOpen} 
        onOpenChange={handleCloseROI}
        initialTool={roiInitialTool}
      />
    </SidebarProvider>
  );
}
