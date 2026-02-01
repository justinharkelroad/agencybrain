import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavItem } from "@/config/navigation";
import { ExternalLink, Lock, Clock } from "lucide-react";
import { MembershipGateModal } from "@/components/MembershipGateModal";
import { isStrictlyOneOnOne } from "@/utils/tierAccess";
import { getFeatureGateConfig } from "@/config/featureGates";
import { cn } from "@/lib/utils";
import { hasChallengeAccess } from "@/lib/challengeAccess";

interface SidebarNavItemProps {
  item: NavItem;
  isNested?: boolean;
  onOpenModal?: (modalKey: string) => void;
  badge?: React.ReactNode;
  membershipTier?: string | null;
  isCallScoringTier?: boolean;
  callScoringAccessibleIds?: string[];
  agencyId?: string | null;
  isTrialing?: boolean;  // Show trial restriction indicator
}

export function SidebarNavItem({
  item,
  isNested = false,
  onOpenModal,
  badge,
  membershipTier,
  isCallScoringTier = false,
  callScoringAccessibleIds = ['call-scoring', 'call-scoring-top', 'the-exchange'],
  agencyId,
  isTrialing = false
}: SidebarNavItemProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile, setOpen } = useSidebar();
  const [showGateModal, setShowGateModal] = useState(false);
  const [showCallScoringGate, setShowCallScoringGate] = useState(false);
  const [showComingSoonGate, setShowComingSoonGate] = useState(false);

  // Check if this item should be gated for Call Scoring tier users
  const isGatedForCallScoring = isCallScoringTier && !callScoringAccessibleIds.includes(item.id);

  // Check if this challenge item should show "Coming Soon" for non-whitelisted agencies
  const isGatedForChallenge = item.challengeAccess && !hasChallengeAccess(agencyId ?? null);

  // Check if this item has trial restrictions (show subtle indicator)
  const hasTrialRestriction = isTrialing && item.trialRestricted;
  
  // Helper to close mobile sidebar and dispatch navigation event
  const dispatchNavigation = () => {
    // Close sidebar on navigation (mobile and desktop)
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);  // Collapse desktop sidebar to icon-only mode
    }
    window.dispatchEvent(new CustomEvent('sidebar-navigation'));
  };
  
  // Hash-aware isActive logic
  const isActive = (() => {
    if (!item.url) return false;
    const itemHasHash = item.url.includes('#');
    const currentHasHash = !!location.hash;
    
    if (itemHasHash) {
      // Hash link: must match pathname + hash exactly
      const [itemPath, itemHash] = item.url.split('#');
      return location.pathname === itemPath && location.hash === `#${itemHash}`;
    } else {
      // Non-hash link: NOT active if current URL has a hash on the same base path
      if (currentHasHash && location.pathname === item.url) {
        return false;
      }
      return location.pathname.startsWith(item.url);
    }
  })();

  const handleClick = () => {
    // Check Call Scoring tier gating FIRST (highest priority)
    if (isGatedForCallScoring) {
      setShowCallScoringGate(true);
      return;
    }

    // Check challenge access - show "Coming Soon" for non-whitelisted agencies
    if (isGatedForChallenge) {
      setShowComingSoonGate(true);
      return;
    }

    // Check tier requirement - show gate modal for Boardroom users
    if (item.requiresTier === '1:1' && !isStrictlyOneOnOne(membershipTier)) {
      setShowGateModal(true);
      return;
    }
    
    // Close sidebar on navigation (mobile and desktop)
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);  // Collapse desktop sidebar to icon-only mode
    }
    
    // Dispatch navigation event
    window.dispatchEvent(new CustomEvent('sidebar-navigation'));
    
    if (item.type === 'link' && item.url) {
      navigate(item.url);
    } else if (item.type === 'modal' && item.modalKey && onOpenModal) {
      onOpenModal(item.modalKey);
    } else if (item.type === 'external' && item.externalUrl) {
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const content = (
    <>
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 line-clamp-2">{item.title}</span>
      {item.type === 'external' && (
        <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-50" />
      )}
      {isGatedForCallScoring && (
        <Lock className="h-3 w-3 shrink-0 text-red-500" />
      )}
      {isGatedForChallenge && !isGatedForCallScoring && (
        <Clock className="h-3 w-3 shrink-0 text-blue-500" />
      )}
      {hasTrialRestriction && !isGatedForCallScoring && !isGatedForChallenge && (
        <Clock className="h-3 w-3 shrink-0 text-sky-500" title="Some features available after trial" />
      )}
      {!isGatedForCallScoring && !isGatedForChallenge && !hasTrialRestriction && badge}
    </>
  );

  if (isNested) {
    // For link items, use actual Link component for proper routing
    if (item.type === 'link' && item.url) {
      // Check tier requirement before rendering link
      const needsGate = item.requiresTier === '1:1' && !isStrictlyOneOnOne(membershipTier);
      const needsCallScoringGate = isGatedForCallScoring;
      const needsChallengeGate = isGatedForChallenge;

      return (
        <>
          <SidebarMenuSubItem>
            {(needsGate || needsCallScoringGate || needsChallengeGate) ? (
              <SidebarMenuSubButton
                asChild
                isActive={isActive}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (needsCallScoringGate) {
                      setShowCallScoringGate(true);
                    } else if (needsChallengeGate) {
                      setShowComingSoonGate(true);
                    } else {
                      setShowGateModal(true);
                    }
                  }}
                  className={cn(
                    "cursor-pointer w-full flex items-center gap-2 text-left",
                    (isGatedForCallScoring || isGatedForChallenge) && "opacity-70"
                  )}
                >
                  {content}
                </button>
              </SidebarMenuSubButton>
            ) : (
              <SidebarMenuSubButton
                asChild
                isActive={isActive}
              >
                <Link
                  to={item.url}
                  className="w-full"
                  onClick={dispatchNavigation}
                >
                  {content}
                </Link>
              </SidebarMenuSubButton>
            )}
          </SidebarMenuSubItem>
          <MembershipGateModal
            open={showGateModal}
            onOpenChange={setShowGateModal}
            featureName={item.title}
          />
          {/* Call Scoring Tier Gate Modal */}
          <MembershipGateModal
            open={showCallScoringGate}
            onOpenChange={setShowCallScoringGate}
            featureName={getFeatureGateConfig(item.id).featureName}
            featureDescription={getFeatureGateConfig(item.id).featureDescription}
            videoKey={getFeatureGateConfig(item.id).videoKey}
            gateType="call_scoring_upsell"
            returnPath="/call-scoring"
          />
          {/* Challenge Coming Soon Modal */}
          <MembershipGateModal
            open={showComingSoonGate}
            onOpenChange={setShowComingSoonGate}
            featureName={item.title}
            gateType="coming_soon"
          />
        </>
      );
    }

    // For modal/external items, keep using button
    return (
      <>
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            asChild
            isActive={isActive}
          >
            <button
              type="button"
              onClick={handleClick}
              className={cn(
                "cursor-pointer w-full flex items-center gap-2 text-left",
                (isGatedForCallScoring || isGatedForChallenge) && "opacity-70"
              )}
            >
              {content}
            </button>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
        <MembershipGateModal
          open={showGateModal}
          onOpenChange={setShowGateModal}
          featureName={item.title}
        />
        {/* Call Scoring Tier Gate Modal */}
        <MembershipGateModal
          open={showCallScoringGate}
          onOpenChange={setShowCallScoringGate}
          featureName={getFeatureGateConfig(item.id).featureName}
          featureDescription={getFeatureGateConfig(item.id).featureDescription}
          videoKey={getFeatureGateConfig(item.id).videoKey}
          gateType="call_scoring_upsell"
          returnPath="/call-scoring"
        />
        {/* Challenge Coming Soon Modal */}
        <MembershipGateModal
          open={showComingSoonGate}
          onOpenChange={setShowComingSoonGate}
          featureName={item.title}
          gateType="coming_soon"
        />
      </>
    );
  }

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={handleClick}
          isActive={isActive}
          tooltip={item.title}
          className={cn("cursor-pointer", (isGatedForCallScoring || isGatedForChallenge) && "opacity-70")}
        >
          {content}
        </SidebarMenuButton>
      </SidebarMenuItem>
      <MembershipGateModal
        open={showGateModal}
        onOpenChange={setShowGateModal}
        featureName={item.title}
      />
      {/* Call Scoring Tier Gate Modal */}
      <MembershipGateModal
        open={showCallScoringGate}
        onOpenChange={setShowCallScoringGate}
        featureName={getFeatureGateConfig(item.id).featureName}
        featureDescription={getFeatureGateConfig(item.id).featureDescription}
        videoKey={getFeatureGateConfig(item.id).videoKey}
        gateType="call_scoring_upsell"
        returnPath="/call-scoring"
      />
      {/* Challenge Coming Soon Modal */}
      <MembershipGateModal
        open={showComingSoonGate}
        onOpenChange={setShowComingSoonGate}
        featureName={item.title}
        gateType="coming_soon"
      />
    </>
  );
}
