import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ClipboardEdit,
  BookOpen,
  User,
  LogOut,
  Sparkles,
  Sun,
  Phone,
  Users,
  BarChart3,
  FileText,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";

import { useStaffAuth } from "@/hooks/useStaffAuth";
import { supabase } from "@/integrations/supabase/client";
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
  { title: "Flows", url: "/staff/flows", icon: Sparkles },
  { title: "Training", url: "/staff/training", icon: BookOpen },
];

// Manager-only navigation items
const managerNavItems = [
  { title: "Team Performance", url: "/staff/team-performance", icon: BarChart3 },
  { title: "Team Members", url: "/staff/team-members", icon: Users },
  { title: "Roleplay Reports", url: "/staff/roleplay-reports", icon: FileText },
];

const bottomItems = [
  { title: "My Account", url: "/staff/account", icon: User },
];

export function StaffSidebar() {
  const { logout, user } = useStaffAuth();
  const location = useLocation();
  const { open: sidebarOpen } = useSidebar();
  const [callScoringEnabled, setCallScoringEnabled] = useState(false);

  // Check if call scoring is enabled for staff user's agency
  useEffect(() => {
    const checkCallScoringAccess = async () => {
      if (!user?.agency_id) {
        console.log('StaffSidebar - No agency_id in user session');
        setCallScoringEnabled(false);
        return;
      }

      console.log('StaffSidebar - Checking call scoring for agency:', user.agency_id);

      // Use RPC function to bypass RLS (staff users don't use Supabase Auth)
      const { data: isEnabled, error } = await supabase
        .rpc('is_call_scoring_enabled', { p_agency_id: user.agency_id });

      console.log('StaffSidebar - Call scoring enabled:', isEnabled, 'Error:', error);
      setCallScoringEnabled(isEnabled ?? false);
    };

    checkCallScoringAccess();
  }, [user?.agency_id]);

  const isManager = user?.role === 'Manager';

  const isActive = (path: string) => {
    if (path === "/staff/submit") {
      return location.pathname.startsWith("/staff/submit");
    }
    // Training should be active for any training sub-route
    if (path === "/staff/training") {
      return location.pathname === path || location.pathname.startsWith("/staff/training/");
    }
    if (path === "/staff/call-scoring") {
      return location.pathname.startsWith("/staff/call-scoring");
    }
    return location.pathname === path;
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/staff/login";
  };

  console.log('StaffSidebar render - callScoringEnabled:', callScoringEnabled);

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
                {/* Call Scoring - show when enabled for agency */}
                {callScoringEnabled && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/staff/call-scoring")}>
                      <Link to="/staff/call-scoring" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" strokeWidth={1.5} />
                        {sidebarOpen && <span>Call Scoring</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Manager-Only Navigation */}
          {isManager && (
            <SidebarGroup>
              {sidebarOpen && <SidebarGroupLabel>Management</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {managerNavItems.map((item) => {
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
          )}

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
                    <div className="flex items-center justify-between w-full cursor-default">
                      <span className="flex items-center gap-2">
                        <Sun className="h-4 w-4" strokeWidth={1.5} />
                        {sidebarOpen && <span>Theme</span>}
                      </span>
                      {sidebarOpen && <ThemeToggle />}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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