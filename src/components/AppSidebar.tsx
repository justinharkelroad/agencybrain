import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Building2,
  Shield,
  LineChart,
  FileText,
  FolderLock,
  MessageSquare,
  LogOut,
  Sparkles,
  BookOpen,
  Sun,
  Video,
  Phone,
  ArrowLeftRight,
  Settings,
  BarChart3,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";

import { useAuth } from "@/lib/auth";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { MyAccountDialogContent } from "@/components/MyAccountDialogContent";
import { useExchangeNotifications } from "@/hooks/useExchangeNotifications";
import { useUnreadMessageCount } from "@/hooks/useExchangeUnread";
import { Badge } from "@/components/ui/badge";

// New imports for navigation system
import { navigationConfig, isNavFolder, NavEntry } from "@/config/navigation";
import { useSidebarAccess } from "@/hooks/useSidebarAccess";
import { SidebarNavItem, SidebarFolder } from "@/components/sidebar";
import type { CalcKey } from "@/components/ROIForecastersModal";

type AppSidebarProps = {
  onOpenROI?: (toolKey?: CalcKey) => void;
};

// Admin-only items (system-wide admin access)
const adminOnlyItems = [
  { title: "Admin Portal", url: "/admin", icon: Shield },
  { title: "Standard Playbook", url: "/admin/standard-playbook", icon: BookOpen },
  { title: "Flow Templates", url: "/admin/flows", icon: Sparkles },
  { title: "Call Scoring", url: "/admin/call-scoring/templates", icon: Phone },
  { title: "Analysis", url: "/admin/analysis", icon: LineChart },
  { title: "Prompts", url: "/admin/prompts", icon: FileText },
  { title: "Process Vault", url: "/admin/process-vault-types", icon: FolderLock },
  { title: "Roleplay Reports", url: "/admin/roleplay-reports", icon: MessageSquare },
  { title: "Help Videos", url: "/admin/help-videos", icon: Video },
  { title: "Exchange Tags", url: "/admin/exchange-tags", icon: ArrowLeftRight },
  { title: "Exchange Reports", url: "/admin/exchange-reports", icon: MessageSquare },
  { title: "Exchange Analytics", url: "/admin/exchange-analytics", icon: BarChart3 },
];

export function AppSidebar({ onOpenROI }: AppSidebarProps) {
  const { signOut, isAdmin, user, membershipTier } = useAuth();
  const { open: sidebarOpen, setOpenMobile, isMobile } = useSidebar();
  const { filterNavigation, loading: accessLoading } = useSidebarAccess();
  
  // Check if user is on a Call Scoring tier
  const isCallScoringTier = membershipTier?.startsWith('Call Scoring');
  
  // Close sidebar on mobile when navigating
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  
  const [callScoringEnabled, setCallScoringEnabled] = useState(false);
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const { counts: exchangeNotifications } = useExchangeNotifications();
  const { data: unreadMessageCount = 0 } = useUnreadMessageCount();
  
  // Combine post/comment notifications with unread messages
  const totalExchangeNotifications = exchangeNotifications.total + unreadMessageCount;

  // Fetch user profile data for avatar
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      setUserName(user.user_metadata?.full_name || user.email || '');
      
      const { data } = await supabase
        .from('profiles')
        .select('profile_photo_url')
        .eq('id', user.id)
        .single();
      
      if (data?.profile_photo_url) {
        setUserPhotoUrl(data.profile_photo_url);
      }
    };
    fetchUserProfile();
  }, [user?.id]);

  // Check if call scoring is enabled for user's agency
  useEffect(() => {
    let hasChecked = false;
    
    const checkCallScoringAccess = async (userId: string, userEmail?: string) => {
      // Only log once per mount to reduce console noise
      if (!hasChecked) {
        console.log('Sidebar - Checking access for user:', userEmail);
      }
      hasChecked = true;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id, role')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Sidebar - Profile fetch error:', {
          userId,
          userEmail,
          error: profileError,
        });
      }

      // Admins always see it
      if (profile?.role === 'admin') {
        setCallScoringEnabled(true);
        return;
      }

      // For non-admins, check if their agency has it enabled
      if (profile?.agency_id) {
        const { data: settings, error: settingsError } = await supabase
          .from('agency_call_scoring_settings')
          .select('enabled')
          .eq('agency_id', profile.agency_id)
          .maybeSingle();

        if (settingsError) {
          console.error('Sidebar - Call scoring settings fetch error:', {
            agencyId: profile.agency_id,
            error: settingsError,
          });
        }

        setCallScoringEnabled(settings?.enabled ?? false);
      } else {
        setCallScoringEnabled(false);
      }
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only re-check on actual auth events, not token refresh
        if (event === 'TOKEN_REFRESHED') return;
        
        if (!session?.user) {
          setCallScoringEnabled(false);
          return;
        }

        // Defer the async call to avoid deadlock
        setTimeout(() => {
          checkCallScoringAccess(session.user.id, session.user.email);
        }, 0);
      }
    );

    // Also check current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        checkCallScoringAccess(session.user.id, session.user.email);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle modal opening - passes the modalKey to the ROI modal
  const handleOpenModal = (modalKey: string) => {
    if (onOpenROI) {
      onOpenROI(modalKey as CalcKey);
    }
    handleNavClick();
  };

  // Filter navigation based on user access
  const filteredNavigation = filterNavigation(navigationConfig, callScoringEnabled);

  // For Call Scoring tier, we need special handling - they only see Call Scoring + Exchange
  const getVisibleNavigation = (): NavEntry[] => {
    if (isCallScoringTier) {
      return filteredNavigation
        .map(entry => {
          if (isNavFolder(entry)) {
            // Filter items within the folder to only allowed ones
            const filteredItems = entry.items.filter(item => 
              item.id === 'call-scoring' || item.id === 'the-exchange'
            );
            return { ...entry, items: filteredItems };
          }
          return entry;
        })
        .filter(entry => {
          if (isNavFolder(entry)) {
            // Remove folders with no remaining items
            return entry.items.length > 0;
          }
          // Keep non-folder items only if they're allowed
          return entry.id === 'call-scoring' || entry.id === 'the-exchange';
        });
    }
    return filteredNavigation;
  };

  const visibleNavigation = getVisibleNavigation();

  const isActive = (path: string) => {
    // Import location here to check active state
    const pathname = window.location.pathname;
    if (path === '/training') {
      return pathname === path || pathname.startsWith('/training/');
    }
    return pathname === path;
  };

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "border-r border-border/30",
        sidebarOpen ? "w-60" : "w-14"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="p-5 flex items-center justify-center border-b border-border/20">
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
          {/* Main Navigation - using new config-driven system */}
          <SidebarGroup>
            {sidebarOpen && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium px-3">
                Main
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {!accessLoading && visibleNavigation.map((entry) => {
                  if (isNavFolder(entry)) {
                    // Get visible items for this folder
                    const visibleItems = entry.items;
                    
                    return (
                      <SidebarFolder
                        key={entry.id}
                        folder={entry}
                        visibleItems={visibleItems}
                        onOpenModal={handleOpenModal}
                        storageKey={`sidebar-folder-${entry.id}`}
                        membershipTier={membershipTier}
                      />
                    );
                  }
                  
                  // Single nav item (not in folder)
                  // Add badge for Exchange notifications
                  const badge = entry.id === 'the-exchange' && totalExchangeNotifications > 0 ? (
                    <Badge 
                      variant="destructive" 
                      className="ml-auto h-5 min-w-5 flex items-center justify-center text-xs px-1"
                    >
                      {totalExchangeNotifications > 99 ? '99+' : totalExchangeNotifications}
                    </Badge>
                  ) : undefined;
                  
                  return (
                    <SidebarNavItem
                      key={entry.id}
                      item={entry}
                      onOpenModal={handleOpenModal}
                      badge={badge}
                      membershipTier={membershipTier}
                    />
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Soft divider */}
          <div className="my-2" />

          {/* Admin-Only Navigation */}
          {isAdmin && (
            <SidebarGroup>
              {sidebarOpen && (
                <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium px-3">
                  Admin
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminOnlyItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.url);
                    
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={active}
                          className={cn(
                            "hover:bg-muted/40 transition-colors",
                            active && "bg-muted/50 text-foreground"
                          )}
                        >
                          <Link to={item.url} onClick={handleNavClick} className="flex items-center gap-2">
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

          {/* Soft divider */}
          <div className="my-2" />

          {/* Account section - My Agency + Sign Out */}
          <SidebarGroup>
            {sidebarOpen && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium px-3">
                Account
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive("/agency")}
                    className={cn(
                      "hover:bg-muted/40 transition-colors",
                      isActive("/agency") && "bg-muted/50 text-foreground"
                    )}
                  >
                    <Link to="/agency" onClick={handleNavClick} className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" strokeWidth={1.5} />
                      {sidebarOpen && <span>My Agency</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild
                    className="hover:bg-muted/40 transition-colors"
                  >
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
                  <SidebarMenuButton 
                    asChild
                    className="hover:bg-muted/40 transition-colors"
                  >
                    <button
                      onClick={async () => {
                        await signOut();
                        window.location.href = '/';
                      }}
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
          <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-3 w-full hover:bg-muted/40 rounded-lg p-2 transition-colors">
                <Avatar className="h-8 w-8 shrink-0">
                  {userPhotoUrl && <AvatarImage src={userPhotoUrl} alt={userName} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {userName
                      ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      : user?.email?.[0].toUpperCase() || '??'}
                  </AvatarFallback>
                </Avatar>
                {sidebarOpen && (
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{userName || 'My Account'}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Settings className="h-3 w-3" />
                      Account Settings
                    </p>
                  </div>
                )}
              </button>
            </DialogTrigger>
            <DialogContent className="glass-surface">
              <MyAccountDialogContent 
                onClose={() => setAccountDialogOpen(false)}
                onPhotoUpdate={(url) => setUserPhotoUrl(url)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Sidebar>
  );
}
