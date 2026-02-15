import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMetricsSnapshot } from '@/hooks/useMetricsSnapshot';

interface MetricsSnapshotPanelProps {
  date: string;
  role?: 'Sales' | 'Service';
  prefer?: 'staff' | 'supabase' | 'auto';
  teamMemberId?: string;
  title?: string;
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCallStatus(status: string | null | undefined): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (status) {
    case 'ok':
      return { label: 'Call Data OK', variant: 'secondary' };
    case 'partial':
      return { label: 'Call Data Partial', variant: 'outline' };
    case 'missing':
      return { label: 'Call Data Missing', variant: 'destructive' };
    case 'disabled':
      return { label: 'Manual Mode', variant: 'default' };
    default:
      return { label: 'Unknown', variant: 'outline' };
  }
}

function formatSourceMode(mode: string | null | undefined): string {
  if (mode === 'on') return 'Auto';
  if (mode === 'shadow') return 'Shadow';
  return 'Manual';
}

export function MetricsSnapshotPanel({
  date,
  role,
  prefer = 'supabase',
  teamMemberId,
  title = 'Locked Metrics Snapshot',
}: MetricsSnapshotPanelProps) {
  const { data, isLoading, isFetching, error, refetch } = useMetricsSnapshot({
    date,
    role,
    teamMemberId,
    prefer,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Canonical daily values from locked snapshot for {date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.snapshot && (
            <Badge variant="outline">v{data.snapshot.version}</Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading snapshot...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Failed to load snapshot'}
          </div>
        ) : !data?.rows?.length ? (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            No snapshot rows found for this date/role.
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3 mb-4">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Rows</div>
                <div className="text-2xl font-semibold">{data.rows.length}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Exceptions</div>
                <div className="text-2xl font-semibold">
                  {data.rows.filter((row) => {
                    const status = String(row.status.call_data_status || '');
                    return status === 'missing' || status === 'partial';
                  }).length}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Scope</div>
                <div className="text-sm font-medium">
                  {data.scope.teamView ? 'Team' : 'Self'}
                </div>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    {data.scope.teamView && <th className="text-left p-3 font-medium">Team Member</th>}
                    <th className="text-left p-3 font-medium">Outbound</th>
                    <th className="text-left p-3 font-medium">Talk Min</th>
                    <th className="text-left p-3 font-medium">Quoted</th>
                    <th className="text-left p-3 font-medium">Sold</th>
                    <th className="text-left p-3 font-medium">Source</th>
                    <th className="text-left p-3 font-medium">Data Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const callStatus = formatCallStatus(String(row.status.call_data_status || ''));
                    const sourceMode = formatSourceMode(String(row.source.call_metrics_mode || 'off'));
                    const hasException = callStatus.label === 'Call Data Missing' || callStatus.label === 'Call Data Partial';

                    return (
                      <tr key={row.teamMemberId} className="border-b border-border/50">
                        {data.scope.teamView && (
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {hasException ? (
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              )}
                              <span className="font-medium">{row.teamMemberName}</span>
                            </div>
                          </td>
                        )}
                        <td className="p-3">{asNumber(row.metrics.outbound_calls)}</td>
                        <td className="p-3">{asNumber(row.metrics.talk_minutes)}</td>
                        <td className="p-3">{asNumber(row.metrics.quoted_households)}</td>
                        <td className="p-3">{asNumber(row.metrics.items_sold)}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="gap-1">
                            <Clock3 className="h-3 w-3" />
                            {sourceMode}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={callStatus.variant}>{callStatus.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
