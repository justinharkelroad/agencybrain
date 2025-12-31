import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";

interface FolderItem {
  title: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface Folder {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: FolderItem[];
}

interface SidebarFolderProps {
  folder: Folder;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function SidebarFolder({ folder, isOpen, onToggle, children }: SidebarFolderProps) {
  const Icon = folder.icon;

  return (
    <SidebarMenuItem>
      {/* Simple button with direct onClick - NO RADIX COLLAPSIBLE */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // eslint-disable-next-line no-console
          console.log("Folder clicked:", folder.title, "isOpen:", isOpen);
          onToggle();
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "transition-colors"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{folder.title}</span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            isOpen && "rotate-90"
          )}
        />
      </button>

      {/* Simple conditional render - NO RADIX COLLAPSIBLE CONTENT */}
      {isOpen && <SidebarMenuSub>{children}</SidebarMenuSub>}
    </SidebarMenuItem>
  );
}
