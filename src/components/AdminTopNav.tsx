import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AgencyBrainBadge } from "@/components/AgencyBrainBadge";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type AdminTopNavProps = {
  title?: string;
  className?: string;
};

export function AdminTopNav({ title, className }: AdminTopNavProps) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const closeAnd = useCallback((fn?: () => void) => {
    setOpen(false);
    if (fn) fn();
  }, []);

  return (
    <header className={cn("frosted-header", className)} role="banner">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center min-w-0">
          <AgencyBrainBadge size="lg" asLink to="/admin" />
          {title ? (
            <span className="text-lg font-medium text-muted-foreground ml-2 truncate" aria-current="page">
              {title}
            </span>
          ) : null}
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <nav className="flex items-center bg-background/40 backdrop-blur-md border border-border/60 rounded-full p-1 font-inter gap-1">
            <Link to="/admin" aria-label="Admin Dashboard">
              <Button variant="glass" size="sm" className="rounded-full" isHeaderButton>Dashboard</Button>
            </Link>
            <Link to="/admin/analysis" aria-label="AI Analysis">
              <Button variant="glass" size="sm" className="rounded-full" isHeaderButton>Analysis</Button>
            </Link>
            <Link to="/admin/prompts" aria-label="Prompt Management">
              <Button variant="glass" size="sm" className="rounded-full" isHeaderButton>Prompts</Button>
            </Link>
            <Link to="/admin/process-vault-types" aria-label="Process Vault Types">
              <Button variant="glass" size="sm" className="rounded-full" isHeaderButton>Process Vault</Button>
            </Link>
            <Link to="/admin/roleplay-reports" aria-label="Roleplay Reports">
              <Button variant="glass" size="sm" className="rounded-full" isHeaderButton>Roleplay Reports</Button>
            </Link>
            <Link to="/agency" aria-label="My Agency">
              <Button variant="glass" size="sm" className="rounded-full" isHeaderButton>My Agency</Button>
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/dashboard">
              <Button variant="glass" className="rounded-full" aria-label="Back to App" isHeaderButton>Back to App</Button>
            </Link>
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
              <SheetHeader className="sr-only">
                <SheetTitle>Admin Navigation Menu</SheetTitle>
                <SheetDescription>Admin navigation menu</SheetDescription>
              </SheetHeader>
              <Link to="/admin" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full justify-start" isHeaderButton>Dashboard</Button>
              </Link>
              <Link to="/admin/analysis" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full justify-start" isHeaderButton>Analysis</Button>
              </Link>
              <Link to="/admin/prompts" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full justify-start" isHeaderButton>Prompts</Button>
              </Link>
              <Link to="/admin/process-vault-types" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full justify-start" isHeaderButton>Process Vault</Button>
              </Link>
              <Link to="/admin/roleplay-reports" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full justify-start" isHeaderButton>Roleplay Reports</Button>
              </Link>
              <Link to="/agency" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full justify-start" isHeaderButton>My Agency</Button>
              </Link>
              <Link to="/dashboard" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full justify-start" isHeaderButton>Back to App</Button>
              </Link>
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

export default AdminTopNav;
