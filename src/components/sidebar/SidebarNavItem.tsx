import { useLocation, useNavigate } from "react-router-dom";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { NavItem } from "@/config/navigation";
import { ExternalLink } from "lucide-react";

interface SidebarNavItemProps {
  item: NavItem;
  isNested?: boolean;
  onOpenModal?: (modalKey: string) => void;
  badge?: React.ReactNode;
}

export function SidebarNavItem({ 
  item, 
  isNested = false, 
  onOpenModal,
  badge 
}: SidebarNavItemProps) {
  const location = useLocation();
  const navigate = useNavigate();
  
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
    if (item.type === 'link' && item.url) {
      navigate(item.url);
    } else if (item.type === 'modal' && item.modalKey && onOpenModal) {
      onOpenModal(item.modalKey);
    } else if (item.type === 'external' && item.externalUrl) {
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (isNested) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          onClick={handleClick}
          isActive={isActive}
          className="cursor-pointer"
        >
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
          {item.type === 'external' && (
            <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
          )}
          {badge}
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={handleClick}
        isActive={isActive}
        tooltip={item.title}
        className="cursor-pointer"
      >
        <item.icon className="h-4 w-4" />
        <span>{item.title}</span>
        {item.type === 'external' && (
          <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
        )}
        {badge}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
