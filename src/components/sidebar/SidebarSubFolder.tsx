import * as React from "react";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavSubFolder, NavItem } from "@/config/navigation";
import { SidebarNavItem } from "./SidebarNavItem";

interface SidebarSubFolderProps {
  subFolder: NavSubFolder;
  onOpenModal?: (modalKey: string) => void;
  membershipTier?: string | null;
  isCallScoringTier?: boolean;
  callScoringAccessibleIds?: string[];
  // For accordion behavior within sub-folders
  isOpen?: boolean;
  onToggle?: () => void;
}

export function SidebarSubFolder({ 
  subFolder, 
  onOpenModal,
  membershipTier,
  isCallScoringTier = false,
  callScoringAccessibleIds = ['call-scoring', 'call-scoring-top', 'the-exchange'],
  isOpen: controlledOpen,
  onToggle,
}: SidebarSubFolderProps) {
  const { open: sidebarOpen } = useSidebar();
  
  // Local state for uncontrolled mode
  const [localOpen, setLocalOpen] = useState(false);
  
  const isControlled = controlledOpen !== undefined && onToggle !== undefined;
  const isOpen = isControlled ? controlledOpen : localOpen;

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.();
    } else {
      setLocalOpen(prev => !prev);
    }
  };

  const Icon = subFolder.icon;

  return (
    <>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          asChild
          className="cursor-pointer"
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggle();
            }}
            className="w-full flex items-center gap-2 text-left"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 line-clamp-2">{subFolder.title}</span>
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 transition-transform duration-200",
                isOpen && "rotate-90"
              )}
            />
          </button>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      
      {/* Nested items with additional indentation */}
      {isOpen && subFolder.items.map((item) => (
        <div key={item.id} className="pl-4">
          <SidebarNavItem
            item={item}
            isNested
            onOpenModal={onOpenModal}
            membershipTier={membershipTier}
            isCallScoringTier={isCallScoringTier}
            callScoringAccessibleIds={callScoringAccessibleIds}
          />
        </div>
      ))}
    </>
  );
}
