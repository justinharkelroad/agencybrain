import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { NavItem } from "@/config/navigation";
import { ExternalLink } from "lucide-react";
import { MembershipGateModal } from "@/components/MembershipGateModal";

interface SidebarNavItemProps {
  item: NavItem;
  isNested?: boolean;
  onOpenModal?: (modalKey: string) => void;
  badge?: React.ReactNode;
  membershipTier?: string | null;
}

// Helper to check if user has 1:1 Coaching access
const has1to1Access = (tier: string | null | undefined): boolean => {
  if (!tier) return false;
  const lowerTier = tier.toLowerCase();
  return lowerTier.includes('1:1') || 
         lowerTier.includes('coaching') ||
         lowerTier.includes('1-on-1');
};

export function SidebarNavItem({ 
  item, 
  isNested = false, 
  onOpenModal,
  badge,
  membershipTier
}: SidebarNavItemProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showGateModal, setShowGateModal] = useState(false);
  
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
    // Check tier requirement - show gate modal for Boardroom users
    if (item.requiresTier === '1:1' && !has1to1Access(membershipTier)) {
      setShowGateModal(true);
      return;
    }
    
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
      <item.icon className="h-4 w-4" />
      <span>{item.title}</span>
      {item.type === 'external' && (
        <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
      )}
      {badge}
    </>
  );

  if (isNested) {
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
              className="cursor-pointer w-full"
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
          className="cursor-pointer"
        >
          {content}
        </SidebarMenuButton>
      </SidebarMenuItem>
      <MembershipGateModal
        open={showGateModal}
        onOpenChange={setShowGateModal}
        featureName={item.title}
      />
    </>
  );
}
