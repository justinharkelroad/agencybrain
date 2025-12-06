import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Shield,
  LineChart,
  FileText,
  FolderLock,
  MessageSquare,
  Wrench,
  LogOut,
  GraduationCap,
  ClipboardList,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  onOpenROI?: () => void;
};

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Agency", url: "/agency", icon: Building2 },
  { title: "Scorecards", url: "/metrics", icon: ClipboardList },
];

// Admin-only items (system-wide admin access)
const adminOnlyItems = [
  { title: "Admin Portal", url: "/admin", icon: Shield },
  { title: "Analysis", url: "/admin/analysis", icon: LineChart },
  { title: "Prompts", url: "/admin/prompts", icon: FileText },
  { title: "Process Vault", url: "/admin/process-vault-types", icon: FolderLock },
  { title: "Roleplay Reports", url: "/admin/roleplay-reports", icon: MessageSquare },
];

// Items accessible by agency owners AND admins
const agencyOwnerItems = [
  { title: "Training System", url: "/agency/training", icon: GraduationCap },
];

export function AppSidebar({ onOpenROI }: AppSidebarProps) {
  const { signOut, isAdmin, isAgencyOwner } = useAuth();
  const location = useLocation();
  const { open: sidebarOpen } = useSidebar();

  const isActive = (path: string) => location.pathname === path;
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "border-r border-border",
        sidebarOpen ? "w-60" : "w-14"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo Section - Fixed at top */}
        <div className="px-4 py-6 flex items-center justify-center border-b border-border">
          <AgencyBrainBadge 
            asLink 
            to="/dashboard"
            className="w-full px-2"
          />
        </div>

      {/* Trigger Button - Desktop only */}
      <div className="hidden md:block p-2 flex justify-end">
        <SidebarTrigger />
      </div>

        <SidebarContent className="flex-1">
          {/* Main Navigation */}
          <SidebarGroup>
            {sidebarOpen && <SidebarGroupLabel>Main</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.url);
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {sidebarOpen && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Agency Owner Navigation - Training System */}
          {(isAdmin || isAgencyOwner) && (
            <SidebarGroup>
              {sidebarOpen && <SidebarGroupLabel>Management</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {agencyOwnerItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.url);
                    
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link to={item.url} className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {sidebarOpen && <span>{item.title}</span>}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Admin-Only Navigation */}
          {isAdmin && (
            <SidebarGroup>
              {sidebarOpen && <SidebarGroupLabel>Admin</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminOnlyItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.url);
                    
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link to={item.url} className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {sidebarOpen && <span>{item.title}</span>}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Actions */}
          <SidebarGroup>
            {sidebarOpen && <SidebarGroupLabel>Actions</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {onOpenROI && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <button
                        onClick={onOpenROI}
                        className="flex items-center gap-2 w-full"
                      >
                        <Wrench className="h-4 w-4" />
                        {sidebarOpen && <span>Tools</span>}
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-2 w-full text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      {sidebarOpen && <span>Sign Out</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </div>
    </Sidebar>
  );
}
