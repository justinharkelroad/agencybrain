import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { isCallScoringTier as checkIsCallScoringTier, getStaffHomePath, hasOneOnOneAccess } from "@/utils/tierAccess";
import { hasSalesBetaAccess } from "@/lib/salesBetaAccess";
import {
  LogOut,
  Sun,
  Settings,
  Lock,
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
import { staffNavigationConfig, isNavFolder, isNavSubFolder, NavEntry, NavItem, NavSubFolder } from "@/config/navigation";
import { StaffSidebarFolder } from "./StaffSidebarFolder";
import { CalcKey } from "@/components/ROIForecastersModal";
import { MembershipGateModal } from "@/components/MembershipGateModal";
import { getFeatureGateConfig } from "@/config/featureGates";

const STAFF_SIDEBAR_OPEN_FOLDER_KEY = 'staff-sidebar-open-folder';

interface StaffSidebarProps {
  onOpenROI?: (toolKey: CalcKey) => void;
}

export function StaffSidebar({ onOpenROI }: StaffSidebarProps) {
  const { logout, user, loading } = useStaffAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { open: sidebarOpen, setOpenMobile, isMobile } = useSidebar();
  const [callScoringEnabled, setCallScoringEnabled] = useState<boolean | null>(null);
  const [showCallScoringGate, setShowCallScoringGate] = useState(false);
  const [gatedItemId, setGatedItemId] = useState<string | null>(null);
  
  // Accordion state - only one folder open at a time
  const [openFolderId, setOpenFolderId] = useState<string | null>(() => {
    return localStorage.getItem(STAFF_SIDEBAR_OPEN_FOLDER_KEY);
  });
  
  const handleFolderToggle = useCallback((folderId: string) => {
    setOpenFolderId(prev => {
      const newOpenId = prev === folderId ? null : folderId;
      if (newOpenId) {
        localStorage.setItem(STAFF_SIDEBAR_OPEN_FOLDER_KEY, newOpenId);
      } else {
        localStorage.removeItem(STAFF_SIDEBAR_OPEN_FOLDER_KEY);
      }
      return newOpenId;
    });
  }, []);

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

      // 5 second timeout safety net
      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          console.warn('[StaffSidebar] Call scoring check timeout');
          setCallScoringEnabled(false);
        }
      }, 5000);

      try {
        const { data: isEnabled, error } = await supabase.rpc('is_call_scoring_enabled', {
          p_agency_id: user.agency_id,
        });

        clearTimeout(timeoutId);
        if (cancelled) return;

        if (error) {
          console.error('[StaffSidebar] Call scoring check error:', error);
          setCallScoringEnabled(false);
          return;
        }

        setCallScoringEnabled(isEnabled ?? false);
      } catch (err) {
        clearTimeout(timeoutId);
        if (!cancelled) {
          console.error('[StaffSidebar] Call scoring check failed:', err);
          setCallScoringEnabled(false);
        }
      }
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

  // Helper to check if agency is on Call Scoring tier
  const isCallScoringTier = checkIsCallScoringTier(user?.agency_membership_tier);

  // Items that Call Scoring tier users can actually access (not just see)
  const callScoringAccessibleIds = ['call-scoring', 'call-scoring-top'];

  // Check if agency has sales beta access
  const salesEnabled = hasSalesBetaAccess(user?.agency_id ?? null);

  // Filter navigation items based on role, callScoringEnabled setting
  // For Call Scoring tier: we show all items but gate them at click time
  const filteredNavigation = useMemo(() => {
    // IDs that require sales beta access
    const salesBetaRequiredIds = ['sales', 'sales-dashboard'];
    
    const filterItems = (items: (NavItem | NavSubFolder)[], folderId?: string) => {
      return items
        .filter(item => {
          // Check if this is a sub-folder
          if (isNavSubFolder(item)) {
            return canAccessItem(item.access);
          }
          
          // For Call Scoring tier: remove call-scoring from inside Accountability folder
          // (we show it as top-level call-scoring-top instead)
          if (isCallScoringTier && folderId === 'accountability' && item.id === 'call-scoring') {
            return false;
          }
          
          // Check email restriction first - most restrictive
          if (item.emailRestriction) {
            const staffEmail = user?.email?.toLowerCase();
            if (!staffEmail || staffEmail !== item.emailRestriction.toLowerCase()) {
              return false;
            }
          }

          // NOTE: challengeAccess items are NOT filtered - shown to everyone, gated at click-time

          // Check sales beta access
          if (salesBetaRequiredIds.includes(item.id) && !salesEnabled) {
            return false;
          }
          
          // Check role-based access
          const canAccess = canAccessItem(item.access);
          if (!canAccess) {
            return false;
          }
          
          // Check settingCheck for callScoringEnabled
          if (item.settingCheck === 'callScoringEnabled') {
            return callScoringEnabled === true;
          }
          
          return true;
        })
        .map(item => {
          // Filter items within sub-folders
          if (isNavSubFolder(item)) {
            const filteredSubItems = item.items.filter(subItem => {
              if (subItem.emailRestriction) {
                const staffEmail = user?.email?.toLowerCase();
                if (!staffEmail || staffEmail !== subItem.emailRestriction.toLowerCase()) {
                  return false;
                }
              }
              // NOTE: challengeAccess items are NOT filtered - shown to everyone, gated at click-time
              if (salesBetaRequiredIds.includes(subItem.id) && !salesEnabled) {
                return false;
              }
              if (!canAccessItem(subItem.access)) {
                return false;
              }
              if (subItem.settingCheck === 'callScoringEnabled') {
                return callScoringEnabled === true;
              }
              return true;
            });
            return { ...item, items: filteredSubItems };
          }
          return item;
        })
        .filter(item => {
          // Remove empty sub-folders
          if (isNavSubFolder(item)) {
            return item.items.length > 0;
          }
          return true;
        });
    };

    let filtered = staffNavigationConfig
      .filter((entry) => {
        // Check folder/item level access based on role
        if (isNavFolder(entry)) {
          return canAccessItem(entry.access);
        }
        
        // For individual items at root level
        if (entry.emailRestriction) {
          const staffEmail = user?.email?.toLowerCase();
          if (!staffEmail || staffEmail !== entry.emailRestriction.toLowerCase()) {
            return false;
          }
        }

        // NOTE: challengeAccess items are NOT filtered - shown to everyone, gated at click-time

        // Check settingCheck for root-level items
        if (entry.settingCheck === 'callScoringEnabled' && !callScoringEnabled) {
          return false;
        }
        
        return canAccessItem(entry.access);
      })
      .map((entry): NavEntry | null => {
        if (isNavFolder(entry)) {
          const filteredItems = filterItems(entry.items, entry.id);
          // Hide folder if no items remain
          if (filteredItems.length === 0) return null;
          return { ...entry, items: filteredItems };
        }
        return entry;
      })
      .filter((entry): entry is NavEntry => entry !== null);

    if (isCallScoringTier) {
      // For Call Scoring tier: reorder so call-scoring-top is FIRST
      const callScoringTopIndex = filtered.findIndex(
        entry => !isNavFolder(entry) && entry.id === 'call-scoring-top'
      );
      
      if (callScoringTopIndex > 0) {
        const [callScoringTop] = filtered.splice(callScoringTopIndex, 1);
        filtered.unshift(callScoringTop);
      }
    } else {
      // For NON-Call-Scoring tier users:
      // Remove call-scoring-top from navigation (they should only see it in Accountability folder)
      filtered = filtered.filter(entry => {
        if (!isNavFolder(entry) && entry.id === 'call-scoring-top') {
          return false;
        }
        return true;
      });
    }

    return filtered;
  }, [callScoringEnabled, canAccessItem, isCallScoringTier, salesEnabled, user?.email]);

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
  
  // Auto-expand folder containing active route
  useEffect(() => {
    const findFolderWithActiveChild = (): string | null => {
      for (const entry of filteredNavigation) {
        if (isNavFolder(entry)) {
          for (const item of entry.items) {
            // Skip sub-folders
            if (isNavSubFolder(item)) {
              for (const subItem of item.items) {
                if (!subItem.url) continue;
                if (location.pathname.startsWith(subItem.url)) {
                  return entry.id;
                }
              }
              continue;
            }
            if (!item.url) continue;
            const itemHasHash = item.url.includes('#');
            if (itemHasHash) {
              const [itemPath, itemHash] = item.url.split('#');
              if (location.pathname === itemPath && location.hash === `#${itemHash}`) {
                return entry.id;
              }
            } else {
              if (location.hash && location.pathname === item.url) continue;
              if (location.pathname.startsWith(item.url)) {
                return entry.id;
              }
            }
          }
        }
      }
      return null;
    };
    
    const activeFolderId = findFolderWithActiveChild();
    if (activeFolderId && activeFolderId !== openFolderId) {
      setOpenFolderId(activeFolderId);
      localStorage.setItem(STAFF_SIDEBAR_OPEN_FOLDER_KEY, activeFolderId);
    }
  }, [location.pathname, location.hash, filteredNavigation]);

  // Show loading skeleton while call scoring status is being fetched
  const isLoadingSettings = callScoringEnabled === null && !loading;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border"
    >
      <div className="flex flex-col h-full">
        {/* Logo Section - Fixed at top */}
        <div className="px-4 py-6 flex items-center justify-center border-b border-border">
          <AgencyBrainBadge 
            asLink 
            to={getStaffHomePath(user?.agency_membership_tier)}
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
                          membershipTier={user?.agency_membership_tier}
                          openFolderId={openFolderId}
                          onFolderToggle={handleFolderToggle}
                          isCallScoringTier={isCallScoringTier}
                          callScoringAccessibleIds={callScoringAccessibleIds}
                          agencyId={user?.agency_id}
                        />
                      );
                    }

                    // Direct nav item (Dashboard, Submit Form, Call Scoring)
                    const active = entry.url ? isActive(entry.url) : false;
                    const isGatedForCallScoring = isCallScoringTier && !callScoringAccessibleIds.includes(entry.id);

                    return (
                      <SidebarMenuItem key={entry.id}>
                        <SidebarMenuButton 
                          isActive={active}
                          onClick={() => {
                            if (isGatedForCallScoring) {
                              setGatedItemId(entry.id);
                              setShowCallScoringGate(true);
                            } else {
                              handleItemClick(entry);
                            }
                          }}
                          tooltip={entry.title}
                          className={cn("cursor-pointer", isGatedForCallScoring && "opacity-70")}
                        >
                          <entry.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                          {sidebarOpen && (
                            <>
                              <span className="flex-1 line-clamp-2">{entry.title}</span>
                              {isGatedForCallScoring && (
                                <Lock className="h-3 w-3 shrink-0 text-red-500" />
                              )}
                            </>
                          )}
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

      {/* Call Scoring Tier Gate Modal */}
      {gatedItemId && (
        <MembershipGateModal
          open={showCallScoringGate}
          onOpenChange={(open) => {
            setShowCallScoringGate(open);
            if (!open) setGatedItemId(null);
          }}
          featureName={getFeatureGateConfig(gatedItemId).featureName}
          featureDescription={getFeatureGateConfig(gatedItemId).featureDescription}
          videoKey={getFeatureGateConfig(gatedItemId).videoKey}
          gateType="call_scoring_upsell"
          returnPath="/staff/call-scoring"
        />
      )}
    </Sidebar>
  );
}
