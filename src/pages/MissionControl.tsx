import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link, Navigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FilePlus2,
  FileText,
  Link2,
  Loader2,
  MessageSquare,
  NotebookPen,
  NotebookText,
  Plus,
  Sparkles,
  Target,
  Upload,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { cn, formatDateLocal } from '@/lib/utils';
import { useMissionControlAccess } from '@/hooks/useMissionControlAccess';
import { useMissionControlClients } from '@/hooks/useMissionControlClients';
import {
  type MissionBoardColumn,
  type MissionCommitmentStatus,
  type MissionSession,
  type MissionUpload,
  useMissionControlWorkspace,
} from '@/hooks/useMissionControlWorkspace';

const BOARD_COLUMNS: Array<{
  key: MissionBoardColumn;
  label: string;
  tone: string;
  description: string;
}> = [
  {
    key: 'backlog',
    label: 'Backlog',
    tone: 'border-stone-300/70 bg-stone-100/70 text-stone-800 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-200',
    description: 'Ideas and deployments not committed yet.',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    tone: 'border-amber-300/70 bg-amber-100/80 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100',
    description: 'Active builds moving inside the month.',
  },
  {
    key: 'before_next_call',
    label: 'Before Next Call',
    tone: 'border-emerald-300/70 bg-emerald-100/80 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-100',
    description: 'Must land before the next coaching review.',
  },
  {
    key: 'done',
    label: 'Done',
    tone: 'border-sky-300/70 bg-sky-100/80 text-sky-900 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-100',
    description: 'Closed loops and shipped wins.',
  },
];

const COMMITMENT_STATUSES: Array<{ value: MissionCommitmentStatus; label: string }> = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'carried_forward', label: 'Carry forward' },
];

const PRIORITY_OPTIONS = ['low', 'medium', 'high'] as const;
const SEVERITY_OPTIONS = ['low', 'normal', 'high', 'critical'] as const;

function jsonArrayToLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        const candidate = (entry as Record<string, unknown>).title ?? (entry as Record<string, unknown>).text;
        return typeof candidate === 'string' ? candidate.trim() : '';
      }
      return '';
    })
    .filter(Boolean);
}

function linesToJson(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'done'
      ? 'border-emerald-300/70 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100'
      : status === 'in_progress'
        ? 'border-amber-300/70 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
        : status === 'blocked'
          ? 'border-rose-300/70 bg-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100'
          : 'border-stone-300/70 bg-stone-100 text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200';

  return (
    <Badge variant="outline" className={cn('capitalize', tone)}>
      {status.replaceAll('_', ' ')}
    </Badge>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  disabled = false,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-border/60 bg-muted/25 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-background/80">
        <CircleAlert className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-serif text-2xl">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
      <Button className="mt-5" onClick={onAction} disabled={disabled}>
        {actionLabel}
      </Button>
    </div>
  );
}

export default function MissionControl() {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClientId = searchParams.get('client');
  const selectedAgencyId = searchParams.get('agency');

  const { data: clientOptions = [], isLoading: clientsLoading } = useMissionControlClients();
  const { data: access, isLoading: accessLoading } = useMissionControlAccess(isAdmin ? selectedClientId : null);
  const workspace = useMissionControlWorkspace({
    agencyId: access?.agencyId,
    ownerUserId: access?.ownerUserId,
    enabled: access?.hasAccess,
    includeCoachNotes: isAdmin && access?.reason === 'admin_target',
    currentUserId: user?.id ?? null,
  });

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [commitmentDialogOpen, setCommitmentDialogOpen] = useState(false);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [coachNoteDialogOpen, setCoachNoteDialogOpen] = useState(false);
  const [attachmentDialog, setAttachmentDialog] = useState<{ open: boolean; commitmentId: string | null }>({
    open: false,
    commitmentId: null,
  });

  const sessionMap = useMemo(
    () => new Map(workspace.sessions.map((session) => [session.id, session])),
    [workspace.sessions]
  );

  const uploadMap = useMemo(
    () => new Map(workspace.uploads.map((upload) => [upload.id, upload])),
    [workspace.uploads]
  );

  const selectedClient = clientOptions.find((client) => client.ownerUserId === selectedClientId) ?? null;

  useEffect(() => {
    if (!isAdmin || selectedClientId || !selectedAgencyId || clientOptions.length === 0) {
      return;
    }

    const matchingClient = clientOptions.find((client) => client.agencyId === selectedAgencyId);
    if (!matchingClient) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set('client', matchingClient.ownerUserId);
    next.delete('agency');
    setSearchParams(next, { replace: true });
  }, [clientOptions, isAdmin, searchParams, selectedAgencyId, selectedClientId, setSearchParams]);

  if (!accessLoading && !access?.hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  const latestSession = workspace.latestSession;
  const latestWins = jsonArrayToLines(latestSession?.wins_json);
  const latestIssues = jsonArrayToLines(latestSession?.issues_json);
  const latestKeyPoints = jsonArrayToLines(latestSession?.key_points_json);
  const latestDeclaredCommitments = jsonArrayToLines(latestSession?.top_commitments_json);
  const openCommitments = workspace.commitments.filter((item) => item.status !== 'done');
  const doneCommitments = workspace.commitments.filter((item) => item.status === 'done');
  const boardByColumn = BOARD_COLUMNS.map((column) => ({
    ...column,
    items: workspace.boardItems.filter((item) => item.column_status === column.key),
  }));
  const proofCount = workspace.attachments.filter((item) => item.attachment_type === 'proof').length;

  const isPreviewOnly = isAdmin && access?.reason === 'admin_preview';
  const canOperateWorkspace = Boolean(access?.agencyId && access?.ownerUserId && !isPreviewOnly);
  const isLoading = accessLoading || clientsLoading || workspace.isLoading;

  const setClientParam = (nextClientId: string) => {
    const next = new URLSearchParams(searchParams);
    if (!nextClientId || nextClientId === 'preview') {
      next.delete('client');
    } else {
      next.set('client', nextClientId);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(194,162,102,0.14),transparent_32%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.3)_100%)]">
      <main className="container mx-auto max-w-[1540px] space-y-6 px-4 py-6 md:px-6 md:py-8">
        <section className="relative overflow-hidden rounded-[32px] border border-border/60 bg-[linear-gradient(140deg,rgba(250,247,240,0.92),rgba(240,234,221,0.7))] p-6 shadow-[0_24px_80px_rgba(28,24,17,0.08)] dark:bg-[linear-gradient(140deg,rgba(34,30,24,0.96),rgba(18,18,16,0.92))]">
          <div className="absolute inset-y-0 right-[-8%] w-[32%] rounded-full bg-primary/10 blur-3xl" />
          <div className="relative space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-foreground/15 bg-background/70 px-3 py-1 text-[11px] uppercase tracking-[0.24em]">
                Owner Dossier
              </Badge>
              <Badge variant="outline" className="border-foreground/15 bg-background/70 px-3 py-1 text-xs">
                1:1 Mission Control
              </Badge>
              {isAdmin && (
                <Badge variant="outline" className="border-primary/20 bg-primary/10 px-3 py-1 text-xs">
                  Coach / Admin Operator Mode
                </Badge>
              )}
            </div>

            {isAdmin && (
              <div className="grid gap-4 rounded-[24px] border border-border/50 bg-background/45 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <Label>Open a client workspace</Label>
                  <Select value={selectedClientId ?? 'preview'} onValueChange={setClientParam}>
                    <SelectTrigger className="bg-background/80">
                      <SelectValue placeholder="Choose a 1:1 client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preview">Preview shell only</SelectItem>
                      {clientOptions.map((client) => (
                        <SelectItem key={client.ownerUserId} value={client.ownerUserId}>
                          {client.agencyName} - {client.ownerName}
                          {client.featureEnabled ? '' : ' (feature off)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm">
                    {selectedClient ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-medium">
                          <Users className="h-4 w-4" />
                          {selectedClient.ownerName}
                        </div>
                        <p className="text-muted-foreground">{selectedClient.agencyName}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No owner selected</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl space-y-3">
                <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">
                  The monthly operating room for one client, one relationship, one score to settle.
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                  Capture the conversation, lock the commitments, keep the active deployments visible, and walk into the
                  next call with the full memory of what was promised and what actually shipped.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="border-foreground/15 bg-background/75" onClick={() => setSessionDialogOpen(true)} disabled={!canOperateWorkspace}>
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  New Session
                </Button>
                <Button variant="outline" className="border-foreground/15 bg-background/75" onClick={() => setCommitmentDialogOpen(true)} disabled={!canOperateWorkspace || workspace.sessions.length === 0}>
                  <Target className="mr-2 h-4 w-4" />
                  Add Commitment
                </Button>
                <Button onClick={() => setBoardDialogOpen(true)} disabled={!canOperateWorkspace}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Board Item
                </Button>
              </div>
            </div>
          </div>
        </section>

        {isPreviewOnly && (
          <Card className="border-dashed border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle>Admin Preview Mode</CardTitle>
              <CardDescription>
                You are seeing the shell only. Select a one-on-one client above to operate inside their actual Mission
                Control workspace as coach/admin.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {!isPreviewOnly && isAdmin && selectedClient && !access?.featureEnabled && (
          <Card className="border-amber-300/60 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/40">
            <CardHeader>
              <CardTitle>Feature flag is off for this client</CardTitle>
              <CardDescription>
                You can still prep the workspace as admin, but the owner will not see Mission Control until
                `mission_control` access is granted for this agency.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {workspace.error && canOperateWorkspace && (
          <Card className="border-amber-300/60 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/40">
            <CardHeader>
              <CardTitle>Mission Control backend not ready in this environment</CardTitle>
              <CardDescription>
                The UI is live, but the Mission Control tables could not be queried. Apply the Mission Control
                migrations before testing workspace data here.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <Card key={index} className="rounded-[22px]">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-28" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-9 w-16" />
                  <Skeleton className="h-4 w-36" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card className="rounded-[22px]">
                <CardHeader className="pb-2">
                  <CardDescription>Open Commitments</CardDescription>
                  <CardTitle className="font-serif text-4xl">{openCommitments.length}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {doneCommitments.length} commitments have already been closed.
                </CardContent>
              </Card>

              <Card className="rounded-[22px]">
                <CardHeader className="pb-2">
                  <CardDescription>Last Call</CardDescription>
                  <CardTitle className="font-serif text-3xl">
                    {latestSession ? formatDateLocal(latestSession.session_date, 'MMM d') : 'None yet'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {latestSession
                    ? `${latestSession.title} • ${formatDistanceToNow(new Date(latestSession.updated_at), { addSuffix: true })}`
                    : 'Create the first coaching session to start the memory timeline.'}
                </CardContent>
              </Card>

              <Card className="rounded-[22px]">
                <CardHeader className="pb-2">
                  <CardDescription>Mission Board</CardDescription>
                  <CardTitle className="font-serif text-4xl">{workspace.boardItems.length}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {boardByColumn.find((column) => column.key === 'done')?.items.length ?? 0} deployment items shipped.
                </CardContent>
              </Card>

              <Card className="rounded-[22px]">
                <CardHeader className="pb-2">
                  <CardDescription>Wins Logged</CardDescription>
                  <CardTitle className="font-serif text-4xl">{latestWins.length}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Highlights preserved from the latest session dossier.
                </CardContent>
              </Card>

              <Card className="rounded-[22px]">
                <CardHeader className="pb-2">
                  <CardDescription>Coach Notes</CardDescription>
                  <CardTitle className="font-serif text-4xl">{workspace.coachNotes.length}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Private notes visible only to coach/admin.
                </CardContent>
              </Card>
            </>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_1.45fr_0.95fr]">
          <div className="space-y-6">
            <Card className="rounded-[26px] border-border/60 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                  <NotebookText className="h-5 w-5" />
                  Session Memory
                </CardTitle>
                <CardDescription>
                  The dossier of what was said, what mattered, and what is still unresolved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {isLoading ? (
                  <>
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </>
                ) : latestSession ? (
                  <>
                    <div className="rounded-[24px] border border-border/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.76),rgba(243,239,231,0.96))] p-5 dark:bg-[linear-gradient(135deg,rgba(28,28,24,0.82),rgba(20,20,18,0.95))]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Latest Session</p>
                          <h2 className="mt-2 font-serif text-2xl">{latestSession.title}</h2>
                        </div>
                        <Badge variant="outline" className="border-foreground/15 bg-background/70">
                          {formatDateLocal(latestSession.session_date)}
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <MetaCard label="Next Call" value={latestSession.next_call_date ? formatDateLocal(latestSession.next_call_date) : 'Not scheduled'} />
                        <MetaCard label="Status" value={latestSession.status} />
                      </div>

                      {latestSession.summary_ai && (
                        <div className="mt-4 rounded-2xl border border-border/60 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Coach Summary</p>
                          <p className="mt-2 text-sm leading-6 text-foreground/90">{latestSession.summary_ai}</p>
                        </div>
                      )}
                    </div>

                    {latestKeyPoints.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Key Points</p>
                        {latestKeyPoints.map((point, index) => (
                          <div key={`${point}-${index}`} className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
                            {point}
                          </div>
                        ))}
                      </div>
                    )}

                    {latestSession.transcript_text && (
                      <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Transcript Snapshot</p>
                          <Badge variant="outline" className="border-foreground/15 bg-background/70">
                            {latestSession.transcript_text.length.toLocaleString()} chars
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {latestSession.transcript_text.slice(0, 420)}
                          {latestSession.transcript_text.length > 420 ? '...' : ''}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState
                    title="No sessions logged yet"
                    body="Start with a coaching session and this column becomes the client’s memory bank."
                    actionLabel="Capture first session"
                    onAction={() => setSessionDialogOpen(true)}
                    disabled={!canOperateWorkspace}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[26px] border-border/60 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                  <FileText className="h-5 w-5" />
                  Session Timeline
                </CardTitle>
                <CardDescription>Past calls stay visible so nothing gets “remembered” differently next month.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <>
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </>
                ) : workspace.sessions.length > 0 ? (
                  workspace.sessions.slice(0, 6).map((session) => (
                    <div key={session.id} className="rounded-2xl border border-border/60 bg-background/75 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{session.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateLocal(session.session_date)} • {jsonArrayToLines(session.top_commitments_json).length} declared commitments
                          </p>
                        </div>
                        <StatusBadge status={session.status} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">The timeline will populate as sessions are added.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[26px] border-border/60 bg-card/90 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="font-serif text-2xl">Commitment Tracker</CardTitle>
                  <CardDescription>The scoreboard for what the owner said would be done before the next call.</CardDescription>
                </div>
                <Button variant="outline" className="border-foreground/15 bg-background/75" onClick={() => setCommitmentDialogOpen(true)} disabled={!canOperateWorkspace || workspace.sessions.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <>
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </>
                ) : openCommitments.length > 0 ? (
                  openCommitments.map((commitment) => {
                    const session = sessionMap.get(commitment.session_id);
                    const proofAttachments = workspace.attachmentsByCommitment.get(commitment.id) ?? [];

                    return (
                      <div key={commitment.id} className="rounded-[24px] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(246,244,239,0.9))] p-5 dark:bg-[linear-gradient(180deg,rgba(28,28,24,0.86),rgba(20,20,18,0.92))]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={commitment.status} />
                              <Badge variant="outline" className="capitalize border-foreground/15 bg-background/70">
                                {commitment.priority} priority
                              </Badge>
                              {commitment.proof_required && (
                                <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                                  Proof required
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-serif text-2xl">{commitment.title}</h3>
                            {commitment.description && (
                              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{commitment.description}</p>
                            )}
                          </div>

                          <div className="w-full sm:w-[200px]">
                            <Select
                              value={commitment.status}
                              onValueChange={(value) =>
                                workspace.updateCommitment.mutate({
                                  id: commitment.id,
                                  updates: { status: value as MissionCommitmentStatus },
                                })
                              }
                            >
                              <SelectTrigger className="bg-background/80">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                {COMMITMENT_STATUSES.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <MetaCard label="Declared On" value={session ? session.title : 'Unknown session'} />
                          <MetaCard label="Due Date" value={commitment.due_date ? formatDateLocal(commitment.due_date) : 'No due date'} />
                          <MetaCard label="Proof" value={`${proofAttachments.length} linked file${proofAttachments.length === 1 ? '' : 's'}`} />
                        </div>

                        {proofAttachments.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {proofAttachments.map((attachment) => {
                              const upload = uploadMap.get(attachment.upload_id);
                              return (
                                <Badge key={attachment.id} variant="outline" className="border-foreground/15 bg-background/70">
                                  <Link2 className="mr-1 h-3 w-3" />
                                  {upload?.original_name ?? 'Linked upload'}
                                </Badge>
                              );
                            })}
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {commitment.proof_required && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-foreground/15 bg-background/75"
                              onClick={() => setAttachmentDialog({ open: true, commitmentId: commitment.id })}
                              disabled={!canOperateWorkspace}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Link proof
                            </Button>
                          )}
                          {commitment.status !== 'done' && (
                            <Button
                              size="sm"
                              onClick={() =>
                                workspace.updateCommitment.mutate({
                                  id: commitment.id,
                                  updates: { status: 'done' },
                                })
                              }
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Mark done
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : latestDeclaredCommitments.length > 0 ? (
                  <div className="rounded-[24px] border border-dashed border-border/60 bg-muted/25 p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Declared on the last call</p>
                    <div className="mt-4 space-y-3">
                      {latestDeclaredCommitments.map((item, index) => (
                        <div key={`${item}-${index}`} className="rounded-2xl border border-border/60 bg-background/75 p-4 text-sm">
                          {item}
                        </div>
                      ))}
                    </div>
                    <Button className="mt-4" onClick={() => setCommitmentDialogOpen(true)} disabled={!canOperateWorkspace || workspace.sessions.length === 0}>
                      Convert into tracked commitments
                    </Button>
                  </div>
                ) : (
                  <EmptyState
                    title="No commitments in motion"
                    body="Add the top three promises from the call so accountability starts here, not in memory."
                    actionLabel="Add commitment"
                    onAction={() => setCommitmentDialogOpen(true)}
                    disabled={!canOperateWorkspace || workspace.sessions.length === 0}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[26px] border-border/60 bg-card/90 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="font-serif text-2xl">Mission Board</CardTitle>
                  <CardDescription>Broader deployments that need to stay visible between calls.</CardDescription>
                </div>
                <Button variant="outline" className="border-foreground/15 bg-background/75" onClick={() => setBoardDialogOpen(true)} disabled={!canOperateWorkspace}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 xl:grid-cols-4">
                  {boardByColumn.map((column) => (
                    <div key={column.key} className={cn('rounded-[24px] border p-4', column.tone)}>
                      <div className="mb-4">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-serif text-xl">{column.label}</h3>
                          <Badge variant="outline" className="border-current/20 bg-background/40">
                            {column.items.length}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 opacity-80">{column.description}</p>
                      </div>

                      <div className="space-y-3">
                        {column.items.length > 0 ? (
                          column.items.map((item) => (
                            <div key={item.id} className="rounded-[18px] border border-black/10 bg-background/80 p-4 shadow-sm dark:border-white/10">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{item.title}</p>
                                  {item.description && (
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
                                  )}
                                </div>
                                <Badge variant="outline" className="capitalize border-foreground/15 bg-background/70">
                                  {item.priority}
                                </Badge>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span className="rounded-full bg-muted px-2 py-1 capitalize">{item.severity} severity</span>
                                {item.proof_required && <span className="rounded-full bg-muted px-2 py-1">Proof required</span>}
                              </div>

                              <div className="mt-4">
                                <Select
                                  value={item.column_status}
                                  onValueChange={(value) =>
                                    workspace.updateBoardItem.mutate({
                                      id: item.id,
                                      updates: { column_status: value as MissionBoardColumn },
                                    })
                                  }
                                >
                                  <SelectTrigger className="bg-background/80">
                                    <SelectValue placeholder="Move item" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {BOARD_COLUMNS.map((option) => (
                                      <SelectItem key={option.key} value={option.key}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-dashed border-black/10 bg-background/60 p-4 text-sm opacity-80 dark:border-white/10">
                            Nothing here yet.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {isAdmin && canOperateWorkspace && (
              <Card className="rounded-[26px] border-border/60 bg-card/90 shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                      <NotebookPen className="h-5 w-5" />
                      Coach Notes
                    </CardTitle>
                    <CardDescription>Private notes, feedback, and observations that the owner does not see.</CardDescription>
                  </div>
                  <Button variant="outline" className="border-foreground/15 bg-background/75" onClick={() => setCoachNoteDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {workspace.coachNotes.length > 0 ? (
                    workspace.coachNotes.map((note) => (
                      <div key={note.id} className="rounded-2xl border border-border/60 bg-background/75 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{note.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {note.session_id ? sessionMap.get(note.session_id)?.title ?? 'Linked session' : 'General note'} •{' '}
                              {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                            </p>
                          </div>
                          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                            Private
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{note.note_body}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
                      No coach notes yet. Use this lane for prep, observations, and candid feedback.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-[26px] border-border/60 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                  <Sparkles className="h-5 w-5" />
                  Wins + Friction
                </CardTitle>
                <CardDescription>The emotional temperature of the account, preserved from the latest call.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Recent wins</p>
                  <div className="mt-3 space-y-3">
                    {latestWins.length > 0 ? (
                      latestWins.map((win, index) => (
                        <div key={`${win}-${index}`} className="rounded-2xl border border-emerald-300/50 bg-emerald-50/70 p-4 text-sm text-emerald-950 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-100">
                          {win}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Wins from the latest session will stack here.</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Current issues</p>
                  <div className="mt-3 space-y-3">
                    {latestIssues.length > 0 ? (
                      latestIssues.map((issue, index) => (
                        <div key={`${issue}-${index}`} className="rounded-2xl border border-rose-300/50 bg-rose-50/70 p-4 text-sm text-rose-950 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-100">
                          {issue}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Current blockers will surface here after sessions are captured.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[26px] border-border/60 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                  <Bot className="h-5 w-5" />
                  AI Mastermind
                </CardTitle>
                <CardDescription>The owner-specific coaching brain plugs in here after the memory layer is stable.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[24px] border border-dashed border-primary/30 bg-primary/5 p-5">
                  <p className="text-sm leading-6 text-muted-foreground">
                    This panel is intentionally staged next. It will answer against the client’s transcripts, commitment
                    history, wins, issues, and proof artifacts instead of behaving like a general-purpose bot.
                  </p>
                </div>
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Will answer from</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-foreground/15 bg-background/70">Session transcript</Badge>
                    <Badge variant="outline" className="border-foreground/15 bg-background/70">Commitment history</Badge>
                    <Badge variant="outline" className="border-foreground/15 bg-background/70">Mission board context</Badge>
                    <Badge variant="outline" className="border-foreground/15 bg-background/70">Proof artifacts</Badge>
                    {isAdmin && <Badge variant="outline" className="border-foreground/15 bg-background/70">Coach notes</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[26px] border-border/60 bg-card/90 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                  <Upload className="h-5 w-5" />
                  Proof Locker
                </CardTitle>
                <CardDescription>Existing uploads that can be linked back to commitments as evidence.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {workspace.uploads.length > 0 ? (
                  workspace.uploads.slice(0, 8).map((upload) => (
                    <div key={upload.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/75 p-4">
                      <div>
                        <p className="font-medium">{upload.original_name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {upload.category} • {formatDistanceToNow(new Date(upload.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Link2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
                    No uploads yet. When transcripts or proof files are uploaded, they become linkable from this panel.
                  </div>
                )}

                <Button asChild variant="outline" className="w-full border-foreground/15 bg-background/75">
                  <Link to="/uploads">
                    <Upload className="mr-2 h-4 w-4" />
                    Open uploads
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <SessionComposerDialog
        open={sessionDialogOpen}
        onOpenChange={setSessionDialogOpen}
        isSaving={workspace.createSession.isPending}
        onSubmit={async (payload) => {
          await workspace.createSession.mutateAsync(payload);
          setSessionDialogOpen(false);
        }}
      />

      <CommitmentComposerDialog
        open={commitmentDialogOpen}
        onOpenChange={setCommitmentDialogOpen}
        sessions={workspace.sessions}
        isSaving={workspace.createCommitment.isPending}
        onSubmit={async (payload) => {
          await workspace.createCommitment.mutateAsync(payload);
          setCommitmentDialogOpen(false);
        }}
      />

      <BoardItemComposerDialog
        open={boardDialogOpen}
        onOpenChange={setBoardDialogOpen}
        sessions={workspace.sessions}
        commitments={workspace.commitments}
        getNextOrder={(column) => workspace.boardItems.filter((item) => item.column_status === column).length}
        isSaving={workspace.createBoardItem.isPending}
        onSubmit={async (payload) => {
          await workspace.createBoardItem.mutateAsync(payload);
          setBoardDialogOpen(false);
        }}
      />

      <CoachNoteComposerDialog
        open={coachNoteDialogOpen}
        onOpenChange={setCoachNoteDialogOpen}
        sessions={workspace.sessions}
        isSaving={workspace.createCoachNote.isPending}
        onSubmit={async (payload) => {
          await workspace.createCoachNote.mutateAsync(payload);
          setCoachNoteDialogOpen(false);
        }}
      />

      <AttachEvidenceDialog
        open={attachmentDialog.open}
        onOpenChange={(open) => setAttachmentDialog({ open, commitmentId: open ? attachmentDialog.commitmentId : null })}
        uploads={workspace.uploads}
        isSaving={workspace.createAttachment.isPending}
        onSubmit={async (uploadId) => {
          if (!attachmentDialog.commitmentId) return;
          await workspace.createAttachment.mutateAsync({
            upload_id: uploadId,
            commitment_id: attachmentDialog.commitmentId,
            attachment_type: 'proof',
          });
          setAttachmentDialog({ open: false, commitmentId: null });
        }}
      />
    </div>
  );
}

function SessionComposerDialog({
  open,
  onOpenChange,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    title: string;
    session_date: string;
    next_call_date: string | null;
    summary_ai: string | null;
    transcript_text: string | null;
    key_points_json: string[];
    wins_json: string[];
    issues_json: string[];
    top_commitments_json: string[];
    status: string;
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(today);
  const [nextCallDate, setNextCallDate] = useState('');
  const [summary, setSummary] = useState('');
  const [transcript, setTranscript] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [wins, setWins] = useState('');
  const [issues, setIssues] = useState('');
  const [topCommitments, setTopCommitments] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl">Capture a session</DialogTitle>
          <DialogDescription>
            Save the memory, the tensions, and the promises from the call in one pass.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="session-title">Session title</Label>
            <Input id="session-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="March strategy call" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-date">Session date</Label>
            <Input id="session-date" type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="next-call-date">Next call date</Label>
            <Input id="next-call-date" type="date" value={nextCallDate} onChange={(event) => setNextCallDate(event.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="summary">Coach summary</Label>
            <Textarea id="summary" rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="High-level takeaways from the call..." />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="transcript">Transcript</Label>
            <Textarea id="transcript" rows={7} value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Paste the transcript or a cleaned excerpt..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="key-points">Key points</Label>
            <Textarea id="key-points" rows={5} value={keyPoints} onChange={(event) => setKeyPoints(event.target.value)} placeholder="One line per key point" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="declared-commitments">Top commitments from the call</Label>
            <Textarea id="declared-commitments" rows={5} value={topCommitments} onChange={(event) => setTopCommitments(event.target.value)} placeholder="One line per promised action" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wins">Wins</Label>
            <Textarea id="wins" rows={4} value={wins} onChange={(event) => setWins(event.target.value)} placeholder="One line per win" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issues">Issues / blockers</Label>
            <Textarea id="issues" rows={4} value={issues} onChange={(event) => setIssues(event.target.value)} placeholder="One line per issue" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() =>
              onSubmit({
                title: title.trim() || `Coaching session ${sessionDate}`,
                session_date: sessionDate,
                next_call_date: nextCallDate || null,
                summary_ai: summary.trim() || null,
                transcript_text: transcript.trim() || null,
                key_points_json: linesToJson(keyPoints),
                wins_json: linesToJson(wins),
                issues_json: linesToJson(issues),
                top_commitments_json: linesToJson(topCommitments),
                status: 'published',
              })
            }
            disabled={isSaving || !sessionDate}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
            Save session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommitmentComposerDialog({
  open,
  onOpenChange,
  sessions,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: MissionSession[];
  onSubmit: (payload: {
    title: string;
    description: string | null;
    session_id: string;
    priority: string;
    due_date: string | null;
    proof_required: boolean;
    proof_status: string;
    status: MissionCommitmentStatus;
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [priority, setPriority] = useState('high');
  const [dueDate, setDueDate] = useState('');
  const [proofRequired, setProofRequired] = useState(true);

  const selectableSessionId = sessionId || sessions[0]?.id || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl">Add a commitment</DialogTitle>
          <DialogDescription>Turn a promise from the call into something that can be reviewed next month.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="commitment-title">Commitment title</Label>
            <Input id="commitment-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Launch producer scorecard review" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commitment-description">Description</Label>
            <Textarea id="commitment-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What exactly needs to be deployed or demonstrated?" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Source session</Label>
              <Select value={selectableSessionId} onValueChange={setSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.title} • {formatDateLocal(session.session_date, 'MMM d')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/25 p-4">
            <div>
              <p className="font-medium">Require proof</p>
              <p className="text-sm text-muted-foreground">Ask for evidence before this can truly be called complete.</p>
            </div>
            <Checkbox checked={proofRequired} onCheckedChange={(checked) => setProofRequired(Boolean(checked))} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Due date</Label>
            <Input id="due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() =>
              onSubmit({
                title: title.trim(),
                description: description.trim() || null,
                session_id: selectableSessionId,
                priority,
                due_date: dueDate || null,
                proof_required: proofRequired,
                proof_status: proofRequired ? 'pending' : 'not_required',
                status: 'not_started',
              })
            }
            disabled={isSaving || !title.trim() || !selectableSessionId}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
            Save commitment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BoardItemComposerDialog({
  open,
  onOpenChange,
  sessions,
  commitments,
  getNextOrder,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: MissionSession[];
  commitments: Array<{ id: string; title: string }>;
  getNextOrder: (column: MissionBoardColumn) => number;
  onSubmit: (payload: {
    title: string;
    description: string | null;
    column_status: MissionBoardColumn;
    column_order: number;
    priority: string;
    severity: string;
    proof_required: boolean;
    proof_status: string;
    source_session_id: string | null;
    source_commitment_id: string | null;
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnStatus, setColumnStatus] = useState<MissionBoardColumn>('backlog');
  const [priority, setPriority] = useState('medium');
  const [severity, setSeverity] = useState('normal');
  const [proofRequired, setProofRequired] = useState(false);
  const [sourceSessionId, setSourceSessionId] = useState<string>('none');
  const [sourceCommitmentId, setSourceCommitmentId] = useState<string>('none');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl">Add a board item</DialogTitle>
          <DialogDescription>Keep larger deployments visible even when they are broader than a single commitment.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="board-title">Title</Label>
            <Input id="board-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Install weekly score review cadence" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="board-description">Description</Label>
            <Textarea id="board-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional context, owner, or deployment notes..." />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Column</Label>
              <Select value={columnStatus} onValueChange={(value) => setColumnStatus(value as MissionBoardColumn)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOARD_COLUMNS.map((column) => (
                    <SelectItem key={column.key} value={column.key}>
                      {column.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Source session</Label>
              <Select value={sourceSessionId} onValueChange={setSourceSessionId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Source commitment</Label>
            <Select value={sourceCommitmentId} onValueChange={setSourceCommitmentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {commitments.map((commitment) => (
                  <SelectItem key={commitment.id} value={commitment.id}>
                    {commitment.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/25 p-4">
            <div>
              <p className="font-medium">Require proof</p>
              <p className="text-sm text-muted-foreground">Use this when the next call should verify the actual artifact.</p>
            </div>
            <Checkbox checked={proofRequired} onCheckedChange={(checked) => setProofRequired(Boolean(checked))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() =>
              onSubmit({
                title: title.trim(),
                description: description.trim() || null,
                column_status: columnStatus,
                column_order: getNextOrder(columnStatus),
                priority,
                severity,
                proof_required: proofRequired,
                proof_status: proofRequired ? 'pending' : 'not_required',
                source_session_id: sourceSessionId === 'none' ? null : sourceSessionId,
                source_commitment_id: sourceCommitmentId === 'none' ? null : sourceCommitmentId,
              })
            }
            disabled={isSaving || !title.trim()}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Save board item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CoachNoteComposerDialog({
  open,
  onOpenChange,
  sessions,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: MissionSession[];
  onSubmit: (payload: { title: string; note_body: string; session_id: string | null }) => Promise<void>;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sessionId, setSessionId] = useState('none');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl">Add coach note</DialogTitle>
          <DialogDescription>Private prep, candid feedback, or transcript observations for your own use.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="coach-note-title">Title</Label>
            <Input id="coach-note-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Owner avoided hard deadline" />
          </div>

          <div className="space-y-2">
            <Label>Linked session</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General workspace note</SelectItem>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coach-note-body">Note</Label>
            <Textarea id="coach-note-body" rows={6} value={body} onChange={(event) => setBody(event.target.value)} placeholder="What you want to remember before the next call..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() =>
              onSubmit({
                title: title.trim(),
                note_body: body.trim(),
                session_id: sessionId === 'none' ? null : sessionId,
              })
            }
            disabled={isSaving || !title.trim() || !body.trim()}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachEvidenceDialog({
  open,
  onOpenChange,
  uploads,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploads: MissionUpload[];
  onSubmit: (uploadId: string) => Promise<void>;
  isSaving: boolean;
}) {
  const [uploadId, setUploadId] = useState<string>('none');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl">Link proof</DialogTitle>
          <DialogDescription>Choose an existing upload and attach it as evidence for the commitment.</DialogDescription>
        </DialogHeader>

        {uploads.length > 0 ? (
          <div className="space-y-2">
            <Label>Upload</Label>
            <Select value={uploadId} onValueChange={setUploadId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an upload" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select an upload</SelectItem>
                {uploads.map((upload) => (
                  <SelectItem key={upload.id} value={upload.id}>
                    {upload.original_name} • {formatDateLocal(upload.created_at, 'MMM d')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
            No uploads are available yet. Add transcripts or proof files in Uploads first.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSubmit(uploadId)} disabled={isSaving || uploadId === 'none'}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            Link file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
