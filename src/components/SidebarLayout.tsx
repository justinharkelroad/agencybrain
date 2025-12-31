import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ROIForecastersModal, type CalcKey } from "@/components/ROIForecastersModal";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";
import { cleanupRadixLocks, isPageLocked } from "@/lib/radixCleanup";

type SidebarLayoutProps = {
  children: React.ReactNode;
};

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [roiOpen, setRoiOpen] = useState(false);
  const [roiInitialTool, setRoiInitialTool] = useState<CalcKey | null>(null);
  const location = useLocation();

  // Cleanup any stuck Radix locks on route change
  useEffect(() => {
    cleanupRadixLocks();
  }, [location.pathname]);

  // Also cleanup when sidebar navigation event fires
  useEffect(() => {
    const handleNavigation = () => cleanupRadixLocks();
    window.addEventListener('sidebar-navigation', handleNavigation);
    return () => window.removeEventListener('sidebar-navigation', handleNavigation);
  }, []);

  // Debug: capture click targets to identify what intercepts sidebar clicks.
  // Enable by running in DevTools: localStorage.setItem('debugSidebarClicks','1')
  useEffect(() => {
    if (localStorage.getItem('debugSidebarClicks') !== '1') return;

    const debugClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const path = (e.composedPath?.() ?? [])
        .slice(0, 8)
        .map((el: any) => (el?.tagName ? el.tagName : String(el)));

      // eslint-disable-next-line no-console
      console.log('Sidebar click capture:', {
        tagName: target.tagName,
        id: target.id,
        className: target.className,
        text: target.textContent?.trim().slice(0, 60),
        inSidebar: target.closest?.('[data-sidebar]') !== null,
        path,
      });
    };

    document.addEventListener('click', debugClickCapture, true);
    return () => document.removeEventListener('click', debugClickCapture, true);
  }, []);

  // Capture-phase failsafe: unlock on any user interaction if page is stuck
  const handleFailsafeUnlock = useCallback(() => {
    if (isPageLocked()) {
      cleanupRadixLocks();
    }
  }, []);

  useEffect(() => {
    // Use capture phase so this runs even if events are blocked
    window.addEventListener('pointerdown', handleFailsafeUnlock, true);
    window.addEventListener('keydown', handleFailsafeUnlock, true);
    return () => {
      window.removeEventListener('pointerdown', handleFailsafeUnlock, true);
      window.removeEventListener('keydown', handleFailsafeUnlock, true);
    };
  }, [handleFailsafeUnlock]);

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
        <AppSidebar onOpenROI={handleOpenROI} />
        
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
      
      <ROIForecastersModal 
        open={roiOpen} 
        onOpenChange={handleCloseROI}
        initialTool={roiInitialTool}
      />
    </SidebarProvider>
  );
}
