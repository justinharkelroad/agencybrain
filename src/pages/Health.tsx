import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { versionLabel } from "@/version";
import EnvironmentStatusBadge from "@/components/EnvironmentStatusBadge";
import { getEnvironmentOverride, setEnvironmentOverride, clearEnvironmentOverride, getEffectiveEnvironmentStatus, type EnvOverride } from "@/lib/environment";

const Health: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [authOk, setAuthOk] = useState<boolean | null>(null);
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [override, setOverride] = useState<EnvOverride | null>(getEnvironmentOverride());

  const runChecks = async () => {
    setRunning(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      setSessionOk(!sessionError);
      setAuthOk(!!sessionData.session);

      const { error: dbErr } = await supabase
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .limit(1);

      if (dbErr) {
        setDbOk(false);
        setDbError(dbErr.message);
      } else {
        setDbOk(true);
        setDbError(null);
      }
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    document.title = "App Health Check | AgencyBrain";
    const ensureMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    };
    ensureMeta("description", "Health status: Supabase connectivity, auth, and build information.");
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = window.location.href;

    runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkSafe = () => {
    const ov = setEnvironmentOverride("safe", "Manually marked safe", user?.id);
    setOverride(ov);
  };
  const handleMarkUnstable = () => {
    const ov = setEnvironmentOverride("unstable", "Manually marked unstable", user?.id);
    setOverride(ov);
  };
  const handleClearOverride = () => {
    clearEnvironmentOverride();
    setOverride(null);
  };

  const Status = ({ label, status, note }: { label: string; status: boolean | null; note?: string | null }) => (
    <div className="flex items-start justify-between py-2">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm">
        {status === null && <span className="text-muted-foreground">Running…</span>}
        {status === true && <span className="text-primary">OK</span>}
        {status === false && (
          <span className="text-destructive">Failed{note ? ` – ${note}` : ""}</span>
        )}
      </div>
    </div>
  );

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">App Health Check</h1>
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Runtime Diagnostics</CardTitle>
            <CardDescription>Quick connectivity and auth checks</CardDescription>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-muted-foreground">Environment Status</div>
                <div className="mt-1">
                  <EnvironmentStatusBadge
                    status={getEffectiveEnvironmentStatus({ sessionOk, authOk, dbOk }).status}
                    note={getEffectiveEnvironmentStatus({ sessionOk, authOk, dbOk }).note}
                    updatedAt={getEffectiveEnvironmentStatus({ sessionOk, authOk, dbOk }).updatedAt}
                    source={getEffectiveEnvironmentStatus({ sessionOk, authOk, dbOk }).source}
                  />
                </div>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={handleMarkSafe} disabled={running}>Mark Safe</Button>
                  <Button size="sm" variant="outline" onClick={handleMarkUnstable} disabled={running}>Mark Unstable</Button>
                  {override && (
                    <Button size="sm" variant="outline" onClick={handleClearOverride}>Clear Override</Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Status label="Supabase SDK reachable" status={sessionOk} />
            <Status label="Authenticated session present" status={authOk} />
            <Status label="Database read (profiles)" status={dbOk} note={dbError} />

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button onClick={runChecks} disabled={running} className="sm:w-auto w-full">
                {running ? "Re-running…" : "Re-run checks"}
              </Button>
              <Button variant="secondary" asChild className="sm:w-auto w-full">
                <a href="/auth">Go to Sign In</a>
              </Button>
              <Button variant="outline" asChild className="sm:w-auto w-full">
                <a href="/dashboard">Back to Dashboard</a>
              </Button>
            </div>

            <div className="mt-6 text-xs text-muted-foreground">
              <div>Current user: {user ? user.id : "Not logged in"}</div>
              <div>Admin: {user ? (isAdmin ? "Yes" : "No") : "-"}</div>
              <div>Build: {versionLabel}</div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default Health;
