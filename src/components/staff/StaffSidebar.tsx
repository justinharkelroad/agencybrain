import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ClipboardEdit,
  BookOpen,
  LogOut,
  Sparkles,
  Sun,
  Phone,
  Settings,
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/staff/dashboard", icon: LayoutDashboard },
  { title: "Submit Form", url: "/staff/submit", icon: ClipboardEdit },
  { title: "Flows", url: "/staff/flows", icon: Sparkles },
  { title: "Training", url: "/staff/training", icon: BookOpen },
];

export function StaffSidebar() {
  const { logout, user, loading } = useStaffAuth();
  const location = useLocation();
  const { open: sidebarOpen, setOpenMobile, isMobile } = useSidebar();
  const [callScoringEnabled, setCallScoringEnabled] = useState<boolean | null>(null);

  // Get staff name and photo from user object
  const staffName = user?.team_member_name || user?.display_name || user?.email || '';
  const profilePhotoUrl = user?.profile_photo_url || null;

  // Close sidebar on mobile when navigating
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Check if call scoring is enabled for staff user's agency
  useEffect(() => {
    // While staff session is still loading, keep placeholder in place.
    if (loading) {
      setCallScoringEnabled(null);
      return;
    }

    // If not authenticated (or no agency), remove the item entirely.
    if (!user?.agency_id) {
      setCallScoringEnabled(false);
      return;
    }

    let cancelled = false;

    const checkCallScoringAccess = async () => {
      // Ensure we show the skeleton while fetching.
      setCallScoringEnabled(null);

      const { data: isEnabled, error } = await supabase.rpc('is_call_scoring_enabled', {
        p_agency_id: user.agency_id,
      });

      if (cancelled) return;

      if (error) {
        setCallScoringEnabled(false);
        return;
      }

      setCallScoringEnabled(isEnabled ?? false);
    };

    checkCallScoringAccess();

    return () => {
      cancelled = true;
    };
  }, [loading, user?.agency_id]);

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
    window.location.href = "/";
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
                        <Link to={item.url} onClick={handleNavClick} className="flex items-center gap-2">
                          <Icon className="h-4 w-4" strokeWidth={1.5} />
                          {sidebarOpen && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {/* Call Scoring - show skeleton while loading, then link when enabled */}
                {callScoringEnabled === null ? (
                  <SidebarMenuItem>
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <div className="h-4 w-4 rounded bg-muted/50 animate-pulse" />
                      {sidebarOpen && <div className="h-4 w-20 rounded bg-muted/50 animate-pulse" />}
                    </div>
                  </SidebarMenuItem>
                ) : callScoringEnabled && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/staff/call-scoring")}>
                      <Link to="/staff/call-scoring" onClick={handleNavClick} className="flex items-center gap-2">
                        <Phone className="h-4 w-4" strokeWidth={1.5} />
                        {sidebarOpen && <span>Call Scoring</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>


          {/* Settings Section */}
          <SidebarGroup>
            {sidebarOpen && <SidebarGroupLabel>Settings</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
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

        {/* User Avatar Footer */}
        <div className="mt-auto p-3 border-t border-border/20">
          <Link 
            to="/staff/account" 
            onClick={handleNavClick}
            className="flex items-center gap-3 w-full hover:bg-muted/40 rounded-lg p-2 transition-colors"
          >
            <Avatar className="h-8 w-8 shrink-0">
              {profilePhotoUrl && <AvatarImage src={profilePhotoUrl} alt={staffName} />}
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {staffName
                  ? staffName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  : user?.email?.[0].toUpperCase() || '??'}
              </AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{staffName || 'My Account'}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Settings className="h-3 w-3" />
                  Account Settings
                </p>
              </div>
            )}
          </Link>
        </div>
      </div>
    </Sidebar>
  );
}