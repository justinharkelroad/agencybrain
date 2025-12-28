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
}

export function SidebarFolder({ 
  folder, 
  visibleItems, 
  onOpenModal,
  storageKey 
}: SidebarFolderProps) {
  const location = useLocation();
  
  const hasActiveChild = visibleItems.some(item => 
    item.url && location.pathname.startsWith(item.url)
  );
  
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      return stored === 'true';
    }
    return hasActiveChild;
  });

  useEffect(() => {
    if (hasActiveChild && !isOpen) {
      setIsOpen(true);
    }
  }, [hasActiveChild, location.pathname]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    localStorage.setItem(storageKey, String(open));
  };

  if (visibleItems.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
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
                isOpen && "rotate-90"
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
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
