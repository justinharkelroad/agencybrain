import React, { useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { enableMetrics } from "@/lib/featureFlags";

export type TopNavProps = {
  title?: string;
  onOpenROI?: () => void;
  className?: string;
};

export function TopNav({ title, onOpenROI, className }: TopNavProps) {
  const { signOut, isAdmin, user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  
  const isOnDashboard = location.pathname === '/dashboard';
  const isOnAgency = location.pathname === '/agency';

  const closeAnd = useCallback((fn?: () => void) => {
    setOpen(false);
    if (fn) fn();
  }, []);

  return (
    <header className={cn("frosted-header", className)} role="banner">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center min-w-0">
          <AgencyBrainBadge size="lg" asLink to="/dashboard" />
          {title ? (
            <span className="text-lg font-medium text-muted-foreground ml-2 truncate" aria-current="page">
              {title}
            </span>
          ) : null}
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <nav className="flex items-center bg-background/40 backdrop-blur-md border border-border/60 rounded-full p-1 shadow-elegant font-inter gap-1">
            {!isOnDashboard && (
              <Link to="/dashboard" aria-label="Go to Dashboard">
                <Button variant="glass" size="sm" className="rounded-full" isHeaderButton>Dashboard</Button>
              </Link>
            )}
            {(isAdmin || user?.email === 'justin@hfiagencies.com') && (
              <Link to="/admin" aria-label="Go to Admin Portal">
                <Button variant="glass" size="sm" className="rounded-full" isHeaderButton>Admin Portal</Button>
              </Link>
            )}
            {!isOnAgency && (
              <Link to="/agency" aria-label="Go to My Agency">
                <Button variant="glass" size="sm" className="rounded-full" isHeaderButton>My Agency</Button>
              </Link>
            )}
            {onOpenROI && (
              <Button
                variant="glass"
                size="sm"
                className="rounded-full"
                onClick={() => onOpenROI()}
                aria-label="Open Tools"
                isHeaderButton
              >
                Tools
              </Button>
            )}
          </nav>
          <Button
            variant="glass"
            className="rounded-full"
            onClick={() => signOut()}
            aria-label="Sign out"
            isHeaderButton
          >
            Sign Out
          </Button>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="glass" size="icon" className="rounded-full" aria-label="Open navigation menu" isHeaderButton>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="pt-12 flex flex-col gap-3">
              {!isOnDashboard && (
                <Link to="/dashboard" onClick={() => setOpen(false)}>
                  <Button variant="secondary" className="w-full justify-start" isHeaderButton>Dashboard</Button>
                </Link>
              )}
              {(isAdmin || user?.email === 'justin@hfiagencies.com') && (
                <Link to="/admin" onClick={() => setOpen(false)}>
                  <Button variant="secondary" className="w-full justify-start" isHeaderButton>Admin Portal</Button>
                </Link>
              )}
              {!isOnAgency && (
                <Link to="/agency" onClick={() => setOpen(false)}>
                  <Button variant="secondary" className="w-full justify-start" isHeaderButton>My Agency</Button>
                </Link>
              )}
              {onOpenROI && (
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => closeAnd(onOpenROI)}
                  isHeaderButton
                >
                  Tools
                </Button>
              )}
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => closeAnd(() => { void signOut(); })}
                isHeaderButton
              >
                Sign Out
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export default TopNav;
