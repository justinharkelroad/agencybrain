import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardEdit,
  BookOpen,
  User,
  LogOut,
  Sparkles,
} from "lucide-react";

import { useStaffAuth } from "@/hooks/useStaffAuth";
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
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/staff/dashboard", icon: LayoutDashboard },
  { title: "Submit Form", url: "/staff/submit", icon: ClipboardEdit },
  { title: "Flows", url: "/flows", icon: Sparkles },
  { title: "Training", url: "/staff/training", icon: BookOpen },
  { title: "Playbook", url: "/staff/playbook", icon: BookOpen },
];

const bottomItems = [
  { title: "My Account", url: "/staff/account", icon: User },
];

export function StaffSidebar() {
  const { logout } = useStaffAuth();
  const location = useLocation();
  const { open: sidebarOpen } = useSidebar();

  const isActive = (path: string) => {
    if (path === "/staff/submit") {
      return location.pathname.startsWith("/staff/submit");
    }
    return location.pathname === path;
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/staff/login";
  };

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
            to="/staff/dashboard"
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
            {sidebarOpen && <SidebarGroupLabel>Navigation</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.url);
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <Icon className="h-4 w-4" strokeWidth={1.5} />
                          {sidebarOpen && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Account Section */}
          <SidebarGroup>
            {sidebarOpen && <SidebarGroupLabel>Account</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {bottomItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.url);
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <Icon className="h-4 w-4" strokeWidth={1.5} />
                          {sidebarOpen && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full text-destructive"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={1.5} />
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
