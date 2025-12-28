import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  LogOut,
  Sun,
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
import { staffNavigationConfig, isNavFolder, NavEntry, NavItem } from "@/config/navigation";
import { StaffSidebarFolder } from "./StaffSidebarFolder";
import { CalcKey } from "@/components/ROIForecastersModal";

interface StaffSidebarProps {
  onOpenROI?: (toolKey: CalcKey) => void;
}

export function StaffSidebar({ onOpenROI }: StaffSidebarProps) {
  const { logout, user, loading } = useStaffAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
    if (loading) {
      setCallScoringEnabled(null);
      return;
    }

    if (!user?.agency_id) {
      setCallScoringEnabled(false);
      return;
    }

    let cancelled = false;

    const checkCallScoringAccess = async () => {
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

  // Determine user access level based on role
  const userAccess = useMemo(() => {
    const role = user?.role?.toLowerCase() || '';
    const isManager = role === 'manager';
    const isOwner = role === 'owner';
    
    return {
      isStaff: !isManager && !isOwner,
      isManager: isManager || isOwner, // Managers and owners
      isOwner: isOwner,
    };
  }, [user?.role]);

  // Check if user can access an item based on their role
  const canAccessItem = useMemo(() => {
    return (access: { staff: boolean; manager: boolean; owner: boolean }): boolean => {
      if (userAccess.isOwner) return access.owner;
      if (userAccess.isManager) return access.manager;
      return access.staff;
    };
  }, [userAccess]);

  // Filter navigation items based on role and callScoringEnabled setting
  const filteredNavigation = useMemo(() => {
    const filterItems = (items: NavItem[]): NavItem[] => {
      return items.filter(item => {
        // Check role-based access first
        if (!canAccessItem(item.access)) return false;
        
        // Check settingCheck for callScoringEnabled
        if (item.settingCheck === 'callScoringEnabled') {
          return callScoringEnabled === true;
        }
        return true;
      });
    };

    return staffNavigationConfig
      .filter((entry) => {
        // Check folder/item level access
        if (isNavFolder(entry)) {
          return canAccessItem(entry.access);
        }
        return canAccessItem(entry.access);
      })
      .map((entry): NavEntry | null => {
        if (isNavFolder(entry)) {
          const filteredItems = filterItems(entry.items);
          // Hide folder if no items remain
          if (filteredItems.length === 0) return null;
          return { ...entry, items: filteredItems };
        }
        return entry;
      })
      .filter((entry): entry is NavEntry => entry !== null);
  }, [callScoringEnabled, canAccessItem]);

  const isActive = (path: string) => {
    if (path === "/staff/submit") {
      return location.pathname.startsWith("/staff/submit");
    }
    if (path === "/staff/training") {
      return location.pathname === path || location.pathname.startsWith("/staff/training/");
    }
    if (path === "/staff/call-scoring") {
      return location.pathname.startsWith("/staff/call-scoring");
    }
    if (path === "/staff/cancel-audit") {
      return location.pathname.startsWith("/staff/cancel-audit");
    }
    if (path === "/staff/flows") {
      return location.pathname.startsWith("/staff/flows");
    }
    if (path === "/staff/core4") {
      return location.pathname.startsWith("/staff/core4");
    }
    return location.pathname === path;
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const handleOpenModal = (modalKey: string) => {
    if (onOpenROI) {
      onOpenROI(modalKey as CalcKey);
    }
    handleNavClick();
  };

  const handleItemClick = (item: NavItem) => {
    if (item.type === 'link' && item.url) {
      navigate(item.url);
      handleNavClick();
    } else if (item.type === 'modal' && item.modalKey) {
      handleOpenModal(item.modalKey);
    } else if (item.type === 'external' && item.externalUrl) {
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
      handleNavClick();
    }
  };

  // Show loading skeleton while call scoring status is being fetched
  const isLoadingSettings = callScoringEnabled === null && !loading;

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
                {isLoadingSettings ? (
                  // Loading skeleton
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <SidebarMenuItem key={i}>
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          <div className="h-4 w-4 rounded bg-muted/50 animate-pulse" />
                          {sidebarOpen && <div className="h-4 w-20 rounded bg-muted/50 animate-pulse" />}
                        </div>
                      </SidebarMenuItem>
                    ))}
                  </>
                ) : (
                  filteredNavigation.map((entry) => {
                    if (isNavFolder(entry)) {
                      return (
                        <StaffSidebarFolder
                          key={entry.id}
                          folder={entry}
                          visibleItems={entry.items}
                          storageKey={`staff-sidebar-folder-${entry.id}`}
                          onNavClick={handleNavClick}
                          onOpenModal={handleOpenModal}
                        />
                      );
                    }

                    // Direct nav item (Dashboard, Submit Form)
                    const active = entry.url ? isActive(entry.url) : false;
                    return (
                      <SidebarMenuItem key={entry.id}>
                        <SidebarMenuButton 
                          isActive={active}
                          onClick={() => handleItemClick(entry)}
                          tooltip={entry.title}
                          className="cursor-pointer"
                        >
                          <entry.icon className="h-4 w-4" strokeWidth={1.5} />
                          {sidebarOpen && <span>{entry.title}</span>}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })
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
