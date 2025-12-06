import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StaffSidebar } from "./StaffSidebar";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";

export function StaffLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <StaffSidebar />
        
        {/* Mobile Header with Hamburger Menu - Only visible on mobile */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-background border-b border-border flex items-center px-4 gap-3">
          <SidebarTrigger className="shrink-0" />
          <div className="flex-1 flex justify-center min-w-0">
            <AgencyBrainBadge asLink to="/staff/dashboard" />
          </div>
        </div>
        
        <main className="flex-1 flex flex-col pt-14 md:pt-0 overflow-x-hidden min-w-0">
          <div className="flex-1 min-w-0 w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
