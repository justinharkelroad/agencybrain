import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StaffSidebar } from "./StaffSidebar";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";
import { ROIForecastersModal, CalcKey } from "@/components/ROIForecastersModal";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { getStaffHomePath, isCallScoringTier } from "@/utils/tierAccess";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";
import { StanChatBot } from "@/components/chatbot/StanChatBot";

export function StaffLayout() {
  const { user, isImpersonation, logout } = useStaffAuth();
  const [roiOpen, setRoiOpen] = useState(false);
  const [roiInitialTool, setRoiInitialTool] = useState<CalcKey | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Get the tier-aware home path for this user
  const staffHomePath = getStaffHomePath(user?.agency_membership_tier);

  // Routes that Call Scoring tier users ARE allowed to access
  const callScoringAllowedPaths = [
    '/staff/call-scoring',
    '/staff/account',
  ];

  // Check if current path starts with any allowed path
  const isAllowedPath = callScoringAllowedPaths.some(
    allowedPath => location.pathname.startsWith(allowedPath)
  );

  // Redirect Call Scoring tier users away from restricted pages
  useEffect(() => {
    const userTier = user?.agency_membership_tier;
    
    if (isCallScoringTier(userTier) && !isAllowedPath) {
      // User is Call Scoring tier and trying to access a restricted page
      navigate('/staff/call-scoring', { replace: true });
    }
  }, [location.pathname, user?.agency_membership_tier, isAllowedPath, navigate]);

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

  const handleExitImpersonation = () => {
    logout();
    // Close the tab since this was opened from admin
    window.close();
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <StaffSidebar onOpenROI={handleOpenROI} />
        
        {/* Impersonation Banner */}
        {isImpersonation && (
          <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 py-2 px-4 flex items-center justify-center gap-3">
            <Eye className="h-4 w-4" />
            <span className="font-medium text-sm">
              IMPERSONATION MODE - Viewing as {user?.display_name || user?.username}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitImpersonation}
              className="ml-4 bg-amber-600 border-amber-700 text-amber-950 hover:bg-amber-700 hover:text-white h-7 px-3"
            >
              <X className="h-3 w-3 mr-1" />
              Exit
            </Button>
          </div>
        )}
        
        {/* Mobile Header with Hamburger Menu - Only visible on mobile */}
        <div className={`md:hidden fixed left-0 right-0 z-50 bg-background border-b border-border flex items-center px-4 gap-3 pt-[env(safe-area-inset-top)] min-h-14 ${isImpersonation ? 'top-10' : 'top-0'}`}>
          <SidebarTrigger className="shrink-0" />
          <div className="flex-1 flex justify-center min-w-0">
            <AgencyBrainBadge asLink to={staffHomePath} />
          </div>
        </div>
        
        <main className={`flex-1 flex flex-col overflow-x-hidden min-w-0 ${isImpersonation ? 'pt-[calc(3.5rem+2.5rem+env(safe-area-inset-top))] md:pt-10' : 'pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0'}`}>
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
      <StanChatBot portal="staff" />
    </SidebarProvider>
  );
}
