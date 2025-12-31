import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavFolder, NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { MembershipGateModal } from "@/components/MembershipGateModal";
import { hasOneOnOneAccess } from "@/utils/tierAccess";

interface StaffSidebarFolderProps {
  folder: NavFolder;
  visibleItems: NavItem[];
  storageKey: string;
  onNavClick?: () => void;
  onOpenModal?: (modalKey: string) => void;
  membershipTier?: string | null;
  // Accordion behavior props
  openFolderId?: string | null;
  onFolderToggle?: (folderId: string) => void;
}

export function StaffSidebarFolder({
  folder, 
  visibleItems, 
  storageKey,
  onNavClick,
  onOpenModal,
  membershipTier,
  openFolderId,
  onFolderToggle
}: StaffSidebarFolderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { open: sidebarOpen } = useSidebar();
  const [showGateModal, setShowGateModal] = useState(false);
  const [gatedFeatureName, setGatedFeatureName] = useState("");

  // Check if ANY hash-based item in this folder matches the current route
  const activeHashItem = visibleItems.find(item => {
    if (!item.url?.includes('#')) return false;
    const [itemPath, itemHash] = item.url.split('#');
    return location.pathname === itemPath && location.hash === `#${itemHash}`;
  });

  // Check if item is active, accounting for hash fragments
  const isItemActive = (item: NavItem): boolean => {
    if (!item.url) return false;
    
    // If item URL has a hash (e.g., /staff/core4#monthly-missions)
    if (item.url.includes('#')) {
      const [itemPath, itemHash] = item.url.split('#');
      return location.pathname === itemPath && location.hash === `#${itemHash}`;
    }
    
    // For regular URLs: if a hash item is currently active, 
    // don't also highlight the base route
    if (activeHashItem) {
      const [hashItemPath] = activeHashItem.url!.split('#');
      if (item.url === hashItemPath || hashItemPath.startsWith(item.url)) {
        return false;
      }
    }
    
    return location.pathname.startsWith(item.url);
  };
  
  const hasActiveChild = visibleItems.some(item => isItemActive(item));
  
  // Use controlled state if accordion props provided, otherwise local state
  const isControlled = openFolderId !== undefined && onFolderToggle !== undefined;
  
  // Local state for uncontrolled mode
  const [localOpen, setLocalOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      return stored === 'true';
    }
    return hasActiveChild;
  });

  // For uncontrolled mode - auto-expand on navigation
  useEffect(() => {
    if (!isControlled && hasActiveChild && !localOpen) {
      setLocalOpen(true);
    }
  }, [hasActiveChild, location.pathname, isControlled, localOpen]);

  const handleOpenChange = (open: boolean) => {
    if (isControlled) {
      // In controlled mode, toggle this folder
      onFolderToggle(folder.id);
    } else {
      setLocalOpen(open);
      localStorage.setItem(storageKey, String(open));
    }
  };

  const handleItemClick = (item: NavItem) => {
    // Check tier requirement - show gate modal for non-1:1 users
    if (item.requiresTier === '1:1' && !hasOneOnOneAccess(membershipTier)) {
      setGatedFeatureName(item.title);
      setShowGateModal(true);
      return;
    }
    
    if (item.type === 'link' && item.url) {
      navigate(item.url);
      onNavClick?.();
    } else if (item.type === 'modal' && item.modalKey && onOpenModal) {
      onOpenModal(item.modalKey);
      onNavClick?.();
    } else if (item.type === 'external' && item.externalUrl) {
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
      onNavClick?.();
    }
  };

  if (visibleItems.length === 0) return null;

  const effectiveOpen = isControlled ? openFolderId === folder.id : localOpen;

  return (
    <>
      <Collapsible open={effectiveOpen} onOpenChange={handleOpenChange}>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            tooltip={folder.title}
            className={cn(
              hasActiveChild && "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
          >
            <CollapsibleTrigger type="button" className="w-full">
              <folder.icon className="h-4 w-4" strokeWidth={1.5} />
              {sidebarOpen && <span>{folder.title}</span>}
              <ChevronRight 
                className={cn(
                  "ml-auto h-4 w-4 transition-transform duration-200",
                  effectiveOpen && "rotate-90"
                )} 
              />
            </CollapsibleTrigger>
          </SidebarMenuButton>
          
          <CollapsibleContent>
            <SidebarMenuSub>
              {visibleItems.map((item) => {
                const isActive = isItemActive(item);
                
                return (
                  <SidebarMenuSubItem key={item.id}>
                    <SidebarMenuSubButton
                      onClick={() => handleItemClick(item)}
                      isActive={isActive}
                      className="cursor-pointer"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
      <MembershipGateModal
        open={showGateModal}
        onOpenChange={setShowGateModal}
        featureName={gatedFeatureName}
      />
    </>
  );
}
