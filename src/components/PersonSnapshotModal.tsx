import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import type { SnapshotResponse, SnapshotDay } from "@/types/snapshot";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; memberId: string | null };

function formatMonthLabel(d: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(d);
}
function firstOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function yyyymm(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function yyyymmdd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function PersonSnapshotModal({ open, onOpenChange, memberId }: Props) {
  const [month, setMonth] = React.useState<Date>(firstOfMonth(new Date()));
  React.useEffect(() => { if (!open) setMonth(firstOfMonth(new Date())); }, [open]);

  const enabled = open && !!memberId;
  const { data, isLoading, isError, refetch } = useQuery<SnapshotResponse>({
    queryKey: ["member-month-snapshot", memberId, yyyymm(month)],
    enabled,
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) {
        throw new Error("No authentication token");
      }
      
      const response = await fetch(
        `https://wjqyccbytctqwceuhzhk.supabase.co/functions/v1/get_member_month_snapshot?member_id=${memberId}&month=${yyyymm(month)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-client-info": "supabase-js-web",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqcXljY2J5dGN0cXdjZXVoemhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjQwODEsImV4cCI6MjA2OTg0MDA4MX0.GN9SjnDf3jwFTzsO_83ZYe4iqbkRQJutGZJtapq6-Tw",
            "Content-Type": "application/json",
          },
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }
      
      return response.json();
    },
  });

  const daysMap = React.useMemo(() => {
    const m = new Map<string, SnapshotDay>();
    data?.days.forEach(d => m.set(d.date, d));
    return m;
  }, [data]);

  const start = firstOfMonth(month);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const startWeekday = start.getDay(); // 0=Sun

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) cells.push(new Date(d));
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = yyyymmdd(new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                {data?.member?.name?.split(" ").map(s => s[0]).join("").slice(0,2) ?? "?"}
              </div>
              <div className="text-base">
                <div className="font-medium">{data?.member?.name ?? "Member"}</div>
                <div className="text-xs text-muted-foreground">{data?.member?.role ?? ""}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Previous month"
                className="px-2 py-1 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >‹</button>
              <span className="min-w-[160px] text-center font-medium">{formatMonthLabel(month)}</span>
              <button
                aria-label="Next month"
                className="px-2 py-1 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >›</button>
            </div>
          </DialogTitle>
          <DialogDescription>
            View daily performance metrics showing pass/fail status for each day of the month.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3 text-sm flex gap-4">
          <span className="inline-flex items-center">
            <span className="h-3 w-3 bg-green-500 inline-block mr-2 rounded-sm" /> Pass
          </span>
          <span className="inline-flex items-center">
            <span className="h-3 w-3 bg-red-500 inline-block mr-2 rounded-sm" /> Fail
          </span>
          <span className="inline-flex items-center">
            <span className="h-3 w-3 bg-muted inline-block mr-2 rounded-sm" /> No data
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse bg-muted rounded" />
            ))}
          </div>
        ) : isError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">Error loading snapshot.</p>
            <button 
              onClick={() => refetch()} 
              className="px-3 py-2 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 text-xs text-muted-foreground mb-1">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => 
                <div key={d} className="p-1 text-center font-medium">{d}</div>
              )}
            </div>
            <TooltipProvider delayDuration={150}>
              <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Monthly pass fail calendar">
                {cells.map((d, idx) => {
                  if (!d) return <div key={idx} className="h-10" />;
                  const key = yyyymmdd(d);
                  const day = daysMap.get(key);
                  const pass = day?.pass;
                  const bg = pass === true ? "bg-green-500" : pass === false ? "bg-red-500" : "bg-muted";
                  const textColor = pass === true ? "text-white" : pass === false ? "text-white" : "text-foreground";
                  const isToday = key === todayStr;
                  const cell = (
                    <div
                      className={`h-10 rounded flex items-center justify-center text-xs font-medium ${bg} ${textColor} ${isToday ? "outline outline-1 outline-foreground/50" : ""} transition-colors`}
                    >
                      {d.getDate()}
                    </div>
                  );
                  return (
                    <Tooltip key={idx}>
                      <TooltipTrigger asChild>{cell}</TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          {day ? <>Met {day.met_count} / {day.required_count}</> : <>No data</>}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
            {data && data.days.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">No submissions this month.</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}