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
import { ExternalLink } from "lucide-react";
import { MembershipGateModal } from "@/components/MembershipGateModal";
import { isStrictlyOneOnOne } from "@/utils/tierAccess";

interface SidebarNavItemProps {
  item: NavItem;
  isNested?: boolean;
  onOpenModal?: (modalKey: string) => void;
  badge?: React.ReactNode;
  membershipTier?: string | null;
}

export function SidebarNavItem({ 
  item, 
  isNested = false, 
  onOpenModal,
  badge,
  membershipTier
}: SidebarNavItemProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const [showGateModal, setShowGateModal] = useState(false);
  
  // Helper to close mobile sidebar and dispatch navigation event
  const dispatchNavigation = () => {
    // Close mobile sidebar FIRST before dispatching event
    if (isMobile) {
      setOpenMobile(false);
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
    // Check tier requirement - show gate modal for Boardroom users
    if (item.requiresTier === '1:1' && !isStrictlyOneOnOne(membershipTier)) {
      setShowGateModal(true);
      return;
    }
    
    // Close mobile sidebar FIRST before any navigation
    if (isMobile) {
      setOpenMobile(false);
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
      <item.icon className="h-4 w-4" />
      <span>{item.title}</span>
      {item.type === 'external' && (
        <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
      )}
      {badge}
    </>
  );

  if (isNested) {
    // For link items, use actual Link component for proper routing
    if (item.type === 'link' && item.url) {
      // Check tier requirement before rendering link
      const needsGate = item.requiresTier === '1:1' && !isStrictlyOneOnOne(membershipTier);
      
      return (
        <>
          <SidebarMenuSubItem>
            {needsGate ? (
              <SidebarMenuSubButton
                asChild
                isActive={isActive}
              >
                <button
                  type="button"
                  onClick={() => setShowGateModal(true)}
                  className="cursor-pointer w-full flex items-center gap-2 text-left"
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
              className="cursor-pointer w-full flex items-center gap-2 text-left"
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
