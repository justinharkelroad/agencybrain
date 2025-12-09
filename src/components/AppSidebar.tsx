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
  Sparkles,
  BookOpen,
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
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  onOpenROI?: () => void;
};

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Training", url: "/training", icon: BookOpen },
  { title: "Flows", url: "/flows", icon: Sparkles },
  { title: "Scorecards", url: "/metrics", icon: ClipboardList },
];

// Admin-only items (system-wide admin access)
const adminOnlyItems = [
  { title: "Admin Portal", url: "/admin", icon: Shield },
  { title: "Standard Playbook", url: "/admin/standard-playbook", icon: BookOpen },
  { title: "Flow Templates", url: "/admin/flows", icon: Sparkles },
  { title: "Analysis", url: "/admin/analysis", icon: LineChart },
  { title: "Prompts", url: "/admin/prompts", icon: FileText },
  { title: "Process Vault", url: "/admin/process-vault-types", icon: FolderLock },
  { title: "Roleplay Reports", url: "/admin/roleplay-reports", icon: MessageSquare },
];

export function AppSidebar({ onOpenROI }: AppSidebarProps) {
  const { signOut, isAdmin, isAgencyOwner } = useAuth();
  const location = useLocation();
  const { open: sidebarOpen } = useSidebar();

  const isActive = (path: string) => {
    // Training should be active for any training sub-route
    if (path === '/training') {
      return location.pathname === path || location.pathname.startsWith('/training/');
    }
    return location.pathname === path;
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
        {/* Logo Section - More breathing room, softer border */}
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
          {/* Main Navigation */}
          <SidebarGroup>
            {sidebarOpen && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium px-3">
                Main
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => {
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
                        <Link to={item.url} className="flex items-center gap-2">
                          <Icon className="h-4 w-4" strokeWidth={1.5} />
                          {sidebarOpen && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {/* Tools button - under Scorecards */}
                {onOpenROI && (
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <button
                        onClick={onOpenROI}
                        className="flex items-center gap-2 w-full"
                      >
                        <Wrench className="h-4 w-4" strokeWidth={1.5} />
                        {sidebarOpen && <span>Tools</span>}
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
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
                    <Link to="/agency" className="flex items-center gap-2">
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
                    <button
                      onClick={() => signOut()}
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
