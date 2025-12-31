import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import { NavFolder, NavItem } from "@/config/navigation";
import { SidebarNavItem } from "./SidebarNavItem";
import { cn } from "@/lib/utils";

interface SidebarFolderProps {
  folder: NavFolder;
  visibleItems: NavItem[];
  onOpenModal?: (modalKey: string) => void;
  storageKey: string;
  membershipTier?: string | null;
  // Accordion behavior props
  openFolderId?: string | null;
  onFolderToggle?: (folderId: string) => void;
}

export function SidebarFolder({ 
  folder, 
  visibleItems, 
  onOpenModal,
  storageKey,
  membershipTier,
  openFolderId,
  onFolderToggle
}: SidebarFolderProps) {
  const location = useLocation();
  
  // Hash-aware active check for child items
  const isItemActive = (item: NavItem): boolean => {
    if (!item.url) return false;
    const itemHasHash = item.url.includes('#');
    const currentHasHash = !!location.hash;
    
    if (itemHasHash) {
      const [itemPath, itemHash] = item.url.split('#');
      return location.pathname === itemPath && location.hash === `#${itemHash}`;
    } else {
      if (currentHasHash && location.pathname === item.url) {
        return false;
      }
      return location.pathname.startsWith(item.url);
    }
  };
  
  const hasActiveChild = visibleItems.some(item => isItemActive(item));
  
  // Use controlled state if accordion props provided, otherwise local state
  const isControlled = openFolderId !== undefined && onFolderToggle !== undefined;
  const isOpen = isControlled ? openFolderId === folder.id : (() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      return stored === 'true';
    }
    return hasActiveChild;
  })();
  
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

  if (visibleItems.length === 0) return null;

  const effectiveOpen = isControlled ? isOpen : localOpen;

  return (
    <Collapsible open={effectiveOpen} onOpenChange={handleOpenChange}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={folder.title}
            className={cn(
              hasActiveChild && "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
          >
            <folder.icon className="h-4 w-4" />
            <span>{folder.title}</span>
            <ChevronRight 
              className={cn(
                "ml-auto h-4 w-4 transition-transform duration-200",
                effectiveOpen && "rotate-90"
              )} 
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <SidebarMenuSub>
            {visibleItems.map((item) => (
              <SidebarNavItem
                key={item.id}
                item={item}
                isNested
                onOpenModal={onOpenModal}
                membershipTier={membershipTier}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
