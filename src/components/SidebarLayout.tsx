import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ROIForecastersModal, type CalcKey } from "@/components/ROIForecastersModal";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";
import { cleanupRadixLocks, isPageLocked } from "@/lib/radixCleanup";
import { StanChatBot } from "@/components/chatbot/StanChatBot";
import { ReportIssueButton } from "@/components/feedback";
import { isCallScoringTier, isChallengeTier } from "@/utils/tierAccess";
import { useAuth } from "@/lib/auth";
import { TrialBanner, PaymentFailedLockout } from "@/components/subscription";
import { useSubscription } from "@/hooks/useSubscription";

type SidebarLayoutProps = {
  children: React.ReactNode;
};

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [roiOpen, setRoiOpen] = useState(false);
  const [roiInitialTool, setRoiInitialTool] = useState<CalcKey | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { membershipTier, roleLoading } = useAuth();
  const { data: subscription } = useSubscription();

  // Lock out users with failed payments (but not legacy users without subscriptions)
  const isPastDue = subscription?.status === 'past_due';

  if (isPastDue) {
    return <PaymentFailedLockout />;
  }

  // Routes that Call Scoring tier users ARE allowed to access in Brain Portal
  const callScoringAllowedPaths = [
    '/call-scoring',
    '/agency',
    '/exchange',
  ];

  // Routes that Challenge tier users ARE allowed to access in Brain Portal
  const challengeAllowedPaths = [
    '/training/challenge',
    '/agency',
    '/exchange',
    '/account',
  ];

  // Check if current path starts with any allowed path
  const isCallScoringAllowed = callScoringAllowedPaths.some(
    allowedPath => location.pathname.startsWith(allowedPath)
  );
  const isChallengeAllowed = challengeAllowedPaths.some(
    allowedPath => location.pathname.startsWith(allowedPath)
  );

  // Redirect restricted tier users away from pages they can't access
  useEffect(() => {
    // Don't redirect until tier data is loaded
    if (roleLoading) return;

    if (isCallScoringTier(membershipTier) && !isCallScoringAllowed) {
      navigate('/call-scoring', { replace: true });
    } else if (isChallengeTier(membershipTier) && !isChallengeAllowed) {
      navigate('/training/challenge', { replace: true });
    }
  }, [location.pathname, membershipTier, isCallScoringAllowed, isChallengeAllowed, navigate, roleLoading]);

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
    <SidebarProvider defaultOpen={false}>
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
          {/* Trial Banner - shown for users on trial */}
          <div className="px-4 pt-4 md:px-6 md:pt-6">
            <TrialBanner dismissible className="max-w-6xl mx-auto" />
          </div>
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
      <StanChatBot portal="brain" />
      <ReportIssueButton />
    </SidebarProvider>
  );
}
