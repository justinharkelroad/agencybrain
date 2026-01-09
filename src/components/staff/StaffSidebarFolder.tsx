import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Lock } from "lucide-react";
import {
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavFolder, NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { MembershipGateModal } from "@/components/MembershipGateModal";
import { hasOneOnOneAccess } from "@/utils/tierAccess";
import { getFeatureGateConfig } from "@/config/featureGates";

interface StaffSidebarFolderProps {
  folder: NavFolder;
  visibleItems: NavItem[];
  storageKey: string;
  onNavClick?: () => void;
  onOpenModal?: (modalKey: string) => void;
  membershipTier?: string | null;
  // Accordion behavior props
  openFolderId?: string | null;
  onFolderToggle?: (folderId: string) => void;
  // Call Scoring tier gating props
  isCallScoringTier?: boolean;
  callScoringAccessibleIds?: string[];
}

export function StaffSidebarFolder({
  folder,
  visibleItems,
  storageKey,
  onNavClick,
  onOpenModal,
  membershipTier,
  openFolderId,
  onFolderToggle,
  isCallScoringTier = false,
  callScoringAccessibleIds = ['call-scoring', 'call-scoring-top'],
}: StaffSidebarFolderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { open: sidebarOpen } = useSidebar();
  const [showGateModal, setShowGateModal] = useState(false);
  const [gatedFeatureName, setGatedFeatureName] = useState("");
  const [showCallScoringGate, setShowCallScoringGate] = useState(false);
  const [gatedItemId, setGatedItemId] = useState<string | null>(null);

  // Check if ANY hash-based item in this folder matches the current route
  const activeHashItem = visibleItems.find((item) => {
    if (!item.url?.includes("#")) return false;
    const [itemPath, itemHash] = item.url.split("#");
    return location.pathname === itemPath && location.hash === `#${itemHash}`;
  });

  // Check if item is active, accounting for hash fragments
  const isItemActive = (item: NavItem): boolean => {
    if (!item.url) return false;

    // If item URL has a hash (e.g., /staff/core4#monthly-missions)
    if (item.url.includes("#")) {
      const [itemPath, itemHash] = item.url.split("#");
      return location.pathname === itemPath && location.hash === `#${itemHash}`;
    }

    // For regular URLs: if a hash item is currently active,
    // don't also highlight the base route
    if (activeHashItem) {
      const [hashItemPath] = activeHashItem.url!.split("#");
      if (item.url === hashItemPath || hashItemPath.startsWith(item.url)) {
        return false;
      }
    }

    return location.pathname.startsWith(item.url);
  };

  const hasActiveChild = visibleItems.some((item) => isItemActive(item));

  // Use controlled state if accordion props provided, otherwise local state
  const isControlled = openFolderId !== undefined && onFolderToggle !== undefined;

  // Local state for uncontrolled mode
  const [localOpen, setLocalOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      return stored === "true";
    }
    return hasActiveChild;
  });

  // For uncontrolled mode - auto-expand on navigation
  useEffect(() => {
    if (!isControlled && hasActiveChild && !localOpen) {
      setLocalOpen(true);
    }
  }, [hasActiveChild, location.pathname, isControlled, localOpen]);

  const effectiveOpen = isControlled ? openFolderId === folder.id : localOpen;

  const handleToggle = () => {
    if (isControlled) {
      onFolderToggle?.(folder.id);
      return;
    }

    setLocalOpen((prev) => {
      const next = !prev;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  };

  const handleItemClick = (item: NavItem) => {
    // Check Call Scoring tier gating FIRST (highest priority)
    if (isCallScoringTier && !callScoringAccessibleIds.includes(item.id)) {
      setGatedItemId(item.id);
      setShowCallScoringGate(true);
      return;
    }

    // Check tier requirement - show gate modal for non-1:1 users
    if (item.requiresTier === "1:1" && !hasOneOnOneAccess(membershipTier)) {
      setGatedFeatureName(item.title);
      setShowGateModal(true);
      return;
    }

    if (item.type === "link" && item.url) {
      navigate(item.url);
      onNavClick?.();
    } else if (item.type === "modal" && item.modalKey && onOpenModal) {
      onOpenModal(item.modalKey);
      onNavClick?.();
    } else if (item.type === "external" && item.externalUrl) {
      window.open(item.externalUrl, "_blank", "noopener,noreferrer");
      onNavClick?.();
    }
  };

  if (visibleItems.length === 0) return null;

  return (
    <>
      <SidebarMenuItem>
        {/* Simple button with direct onClick - NO RADIX COLLAPSIBLE */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // eslint-disable-next-line no-console
            console.log("Folder clicked:", folder.title, "isOpen:", effectiveOpen);
            handleToggle();
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "transition-colors",
            hasActiveChild && "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
        >
          <folder.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          {sidebarOpen && (
            <span className="flex-1 truncate text-left">{folder.title}</span>
          )}
          <ChevronRight
            className={cn(
              "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
              effectiveOpen && "rotate-90"
            )}
          />
        </button>

        {/* Simple conditional render - NO RADIX COLLAPSIBLE CONTENT */}
        {effectiveOpen && (
          <SidebarMenuSub>
            {visibleItems.map((item) => {
              const isActive = isItemActive(item);
              const isGatedForCallScoring = isCallScoringTier && !callScoringAccessibleIds.includes(item.id);

              return (
                <SidebarMenuSubItem key={item.id}>
                  <SidebarMenuSubButton
                    onClick={() => handleItemClick(item)}
                    isActive={isActive}
                    className={cn("cursor-pointer", isGatedForCallScoring && "opacity-70")}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.title}</span>
                    {isGatedForCallScoring && (
                      <Lock className="h-3 w-3 text-amber-500/70" />
                    )}
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>

      <MembershipGateModal
        open={showGateModal}
        onOpenChange={setShowGateModal}
        featureName={gatedFeatureName}
      />

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
    </>
  );
}
