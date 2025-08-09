import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";
import { MyAccountDialogTriggerButton } from "@/components/MyAccountDialog";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type TopNavProps = {
  title?: string;
  onOpenROI?: () => void;
  className?: string;
};

export function TopNav({ title, onOpenROI, className }: TopNavProps) {
  const { signOut, isAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);

  const closeAnd = useCallback((fn?: () => void) => {
    setOpen(false);
    if (fn) fn();
  }, []);

  return (
    <header className={cn("frosted-header", className)} role="banner">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center min-w-0">
          <AgencyBrainBadge size="md" asLink to="/dashboard" />
          {title ? (
            <span className="text-lg font-medium text-muted-foreground ml-2 truncate" aria-current="page">
              {title}
            </span>
          ) : null}
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <nav className="flex items-center bg-background/40 backdrop-blur-md border border-border/60 rounded-full p-1 shadow-elegant font-inter gap-1">
            <Link to="/uploads" aria-label="Go to Files">
              <Button variant="glass" size="sm" className="rounded-full">Files</Button>
            </Link>
            <Link to="/process-vault" aria-label="Go to Process Vault">
              <Button variant="glass" size="sm" className="rounded-full">Process Vault</Button>
            </Link>
            {(isAdmin || user?.email === 'justin@hfiagencies.com') && (
              <Link to="/admin" aria-label="Go to Admin Portal">
                <Button variant="glass" size="sm" className="rounded-full">Admin Portal</Button>
              </Link>
            )}
            <MyAccountDialogTriggerButton />
            <Button
              variant="glass"
              size="sm"
              className="rounded-full"
              onClick={() => onOpenROI?.()}
              aria-label="Open ROI Forecasters"
            >
              ROI Forecasters
            </Button>
          </nav>
          <Button
            variant="glass"
            className="rounded-full"
            onClick={() => signOut()}
            aria-label="Sign out"
          >
            Sign Out
          </Button>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="glass" size="icon" className="rounded-full" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="pt-12 flex flex-col gap-3">
              <Link to="/uploads" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full justify-start">Files</Button>
              </Link>
              <Link to="/process-vault" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full justify-start">Process Vault</Button>
              </Link>
              {(isAdmin || user?.email === 'justin@hfiagencies.com') && (
                <Link to="/admin" onClick={() => setOpen(false)}>
                  <Button variant="secondary" className="w-full justify-start">Admin Portal</Button>
                </Link>
              )}
              <Link to="/account" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full justify-start">My Account</Button>
              </Link>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => closeAnd(onOpenROI)}
              >
                ROI Forecasters
              </Button>
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => closeAnd(() => { void signOut(); })}
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
