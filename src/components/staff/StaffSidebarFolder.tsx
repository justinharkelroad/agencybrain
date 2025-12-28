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

interface StaffSidebarFolderProps {
  folder: NavFolder;
  visibleItems: NavItem[];
  storageKey: string;
  onNavClick?: () => void;
}

export function StaffSidebarFolder({ 
  folder, 
  visibleItems, 
  storageKey,
  onNavClick 
}: StaffSidebarFolderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { open: sidebarOpen } = useSidebar();
  
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

  const handleItemClick = (item: NavItem) => {
    if (item.type === 'link' && item.url) {
      navigate(item.url);
      onNavClick?.();
    }
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
            <folder.icon className="h-4 w-4" strokeWidth={1.5} />
            {sidebarOpen && <span>{folder.title}</span>}
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
            {visibleItems.map((item) => {
              const isActive = item.url ? location.pathname.startsWith(item.url) : false;
              
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
  );
}
