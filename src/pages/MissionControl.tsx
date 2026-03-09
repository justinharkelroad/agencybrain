import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import {
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Rocket,
  Sparkles,
  Target,
  TextSearch,
  TrendingUp,
  Trophy,
  Upload,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useMissionControlAccess } from '@/hooks/useMissionControlAccess';
import { useMissionControlClients } from '@/hooks/useMissionControlClients';
import {
  type MissionAttachment,
  type MissionBoardItem,
  type MissionCoachNote,
  type MissionCommitment,
  type MissionSession,
  type MissionUpload,
  useMissionControlWorkspace,
} from '@/hooks/useMissionControlWorkspace';
import { toast } from 'sonner';

type BoardColumn = 'backlog' | 'in_progress' | 'before_next_call' | 'done';

const BOARD_COLUMNS: Array<{
  key: BoardColumn;
  title: string;
  description: string;
  tone: string;
}> = [
  {
    key: 'backlog',
    title: 'Backlog',
    description: 'Ideas and deployments not committed yet.',
    tone: 'border-stone-300/70 bg-stone-100/70 text-stone-900 dark:border-stone-700 dark:bg-stone-950/50 dark:text-stone-100',
  },
  {
    key: 'in_progress',
    title: 'In Progress',
    description: 'Active builds moving now.',
    tone: 'border-amber-300/70 bg-amber-100/75 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100',
  },
  {
    key: 'before_next_call',
    title: 'Before Next Call',
    description: 'Must land before review.',
    tone: 'border-emerald-300/70 bg-emerald-100/75 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-100',
  },
  {
    key: 'done',
    title: 'Done',
    description: 'Closed loops and shipped wins.',
    tone: 'border-sky-300/70 bg-sky-100/75 text-sky-950 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-100',
  },
];

const STATUS_TONE: Record<string, string> = {
  in_progress: 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  blocked: 'border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  carried_forward: 'border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  done: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  not_started: 'border-stone-300/70 bg-stone-500/10 text-stone-700 dark:text-stone-300',
};

const COMMITMENT_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'carried_forward', label: 'Carry forward' },
  { value: 'done', label: 'Done' },
] as const;

const BOARD_STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'before_next_call', label: 'Before Next Call' },
  { value: 'done', label: 'Done' },
] as const;

type AttachmentTargetKind = 'session' | 'commitment' | 'board';

interface LinkedMissionAttachment extends MissionAttachment {
  upload: MissionUpload | null;
}

type SessionReviewStatus = 'done' | 'blocked' | 'carried_forward' | 'in_progress';

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

function uniqueLines(value: string) {
  return Array.from(new Set(linesToJson(value)));
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateLabel(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return 'Unknown date';

  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-[24px] border-border/60 bg-background/80 shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function MissionControl() {
  const { isAdmin, user } = useAuth();
  const { data: access, isLoading: accessLoading } = useMissionControlAccess();
  const { data: clients = [], isLoading: clientsLoading } = useMissionControlClients();
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [dialogState, setDialogState] = useState<'session' | 'commitment' | 'board' | null>(null);
  const [coachNoteOpen, setCoachNoteOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);

  useEffect(() => {
    if (isAdmin && !selectedClient && clients.length > 0) {
      setSelectedClient(clients[0].ownerUserId);
    }
  }, [clients, isAdmin, selectedClient]);

  const ownerUserId = isAdmin ? (selectedClient || null) : access?.ownerUserId ?? user?.id ?? null;
  const selectedClientRecord = useMemo(
    () => clients.find((client) => client.ownerUserId === selectedClient) ?? null,
    [clients, selectedClient]
  );
  const workspace = useMissionControlWorkspace({
    ownerUserId,
    enabled: Boolean(isAdmin ? selectedClient : access?.hasAccess && ownerUserId),
    currentUserId: user?.id ?? null,
    includeCoachNotes: isAdmin,
    clientContext: isAdmin
      ? selectedClientRecord
        ? {
            agencyId: selectedClientRecord.agencyId,
            agencyName: selectedClientRecord.agencyName,
            ownerUserId: selectedClientRecord.ownerUserId,
            ownerName: selectedClientRecord.ownerName,
            ownerEmail: selectedClientRecord.ownerEmail,
          }
        : null
      : access?.agencyId
        ? {
            agencyId: access.agencyId,
            agencyName: access.agencyName ?? 'Agency workspace',
            ownerUserId: access.ownerUserId ?? ownerUserId ?? '',
            ownerName: access.targetOwnerName ?? user?.email ?? 'Owner workspace',
            ownerEmail: user?.email ?? null,
          }
        : null,
  });

  const activeClientLabel = useMemo(() => {
    if (workspace.client?.ownerName) {
      return `${workspace.client.agencyName} / ${workspace.client.ownerName}`;
    }

    if (!isAdmin) {
      return user?.email ?? 'Owner workspace';
    }

    return 'Select a 1:1 client';
  }, [isAdmin, user?.email, workspace.client]);

  const boardGroups = useMemo(
    () =>
      BOARD_COLUMNS.map((column) => ({
        ...column,
        items: workspace.boardItems.filter((item) => item.column_status === column.key),
      })),
    [workspace.boardItems]
  );

  const latestSession = workspace.latestSession;
  const wins = jsonArrayToLines(latestSession?.wins_json);
  const issues = jsonArrayToLines(latestSession?.issues_json);
  const keyPoints = jsonArrayToLines(latestSession?.key_points_json);
  const topCommitments = jsonArrayToLines(latestSession?.top_commitments_json);
  const openCommitments = workspace.commitments.filter((item) => item.status !== 'done');
  const uploadMap = useMemo(
    () => new Map(workspace.uploads.map((upload) => [upload.id, upload])),
    [workspace.uploads]
  );
  const linkedAttachments = useMemo<LinkedMissionAttachment[]>(
    () =>
      workspace.attachments.map((attachment) => ({
        ...attachment,
        upload: uploadMap.get(attachment.upload_id) ?? null,
      })),
    [uploadMap, workspace.attachments]
  );
  const latestSessionAttachments = linkedAttachments.filter((attachment) => attachment.session_id === latestSession?.id);
  const proofLinkedCount = linkedAttachments.filter((attachment) => attachment.attachment_type === 'proof').length;
  const commitmentAttachmentMap = useMemo(() => {
    const next = new Map<string, LinkedMissionAttachment[]>();

    linkedAttachments.forEach((attachment) => {
      if (!attachment.commitment_id) return;
      next.set(attachment.commitment_id, [...(next.get(attachment.commitment_id) ?? []), attachment]);
    });

    return next;
  }, [linkedAttachments]);

  const attachmentTargetLabel = (attachment: LinkedMissionAttachment) => {
    if (attachment.session_id) {
      return `Session · ${
        workspace.sessions.find((session) => session.id === attachment.session_id)?.title ?? 'Session record'
      }`;
    }

    if (attachment.commitment_id) {
      return `Commitment · ${
        workspace.commitments.find((commitment) => commitment.id === attachment.commitment_id)?.title ?? 'Commitment'
      }`;
    }

    if (attachment.board_item_id) {
      return `Board item · ${
        workspace.boardItems.find((item) => item.id === attachment.board_item_id)?.title ?? 'Board item'
      }`;
    }

    return 'Mission record';
  };

  if (!accessLoading && !access?.hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  if (accessLoading || (isAdmin && clientsLoading && !selectedClient)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(194,162,102,0.14),transparent_32%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.24)_100%)]">
      <main className="container mx-auto max-w-[1540px] space-y-6 px-4 py-6 md:px-6 md:py-8">
        {workspace.error ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            Mission Control could not load this workspace cleanly. {workspace.error.message || 'A database permission or data-linking issue occurred.'}
          </div>
        ) : null}
        <section className="relative overflow-hidden rounded-[32px] border border-border/60 bg-[linear-gradient(145deg,rgba(250,247,240,0.96),rgba(242,236,224,0.72))] p-6 shadow-[0_24px_80px_rgba(28,24,17,0.08)] dark:bg-[linear-gradient(145deg,rgba(34,30,24,0.96),rgba(18,18,16,0.94))]">
          <div className="absolute inset-y-0 right-[-12%] w-[35%] rounded-full bg-primary/10 blur-3xl" />
          <div className="relative space-y-6">
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
                  <p className="text-sm font-medium">Open a client workspace</p>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger className="bg-background/80">
                      <SelectValue placeholder="Choose a 1:1 client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.ownerUserId} value={client.ownerUserId}>
                          {client.agencyName} / {client.ownerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <Users className="h-4 w-4" />
                      {activeClientLabel}
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {workspace.client ? 'Live workspace data connected.' : 'Pick a client to open their workspace.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl space-y-3">
                <h1 className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">
                  Mission Control for one owner, one relationship, one operating room.
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                  Capture what was said, keep commitments visible, and walk into the next call with a clean memory of
                  what mattered, what shipped, and what is still stuck.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" className="border-foreground/15 bg-background/75" onClick={() => setDialogState('session')}>
                  <FileText className="mr-2 h-4 w-4" />
                  New Session
                </Button>
                <Button variant="outline" className="border-foreground/15 bg-background/75" onClick={() => setDialogState('commitment')} disabled={!latestSession}>
                  <Target className="mr-2 h-4 w-4" />
                  Add Commitment
                </Button>
                <Button onClick={() => setDialogState('board')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Board Item
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard icon={ClipboardList} label="Open Commitments" value={String(openCommitments.length)} detail="Commitments still waiting on action or proof." />
          <SummaryCard icon={CalendarDays} label="Last Call" value={latestSession ? latestSession.session_date : 'None'} detail="Latest coaching session preserved in the timeline." />
          <SummaryCard icon={Rocket} label="Mission Board" value={String(workspace.boardItems.length)} detail="Deployments tracked across the board." />
          <SummaryCard icon={Trophy} label="Wins Logged" value={String(wins.length)} detail="Highlights preserved from the latest session." />
          <SummaryCard icon={CheckCircle2} label="Proof Linked" value={String(proofLinkedCount)} detail="Uploaded evidence files linked back to commitments." />
        </section>

        <section className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-[minmax(320px,0.92fr)_minmax(380px,1.08fr)_minmax(360px,0.96fr)]">
          <div className="space-y-6">
            <Card className="rounded-[28px] border-border/60 bg-background/82">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Session Memory
                </CardTitle>
                <CardDescription>The latest conversation, the transcript memory, and the owner’s real commitments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestSession ? (
                <div className="rounded-[24px] border border-border/60 bg-muted/30 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Latest session</p>
                      <h3 className="mt-1 line-clamp-2 text-xl font-semibold">{latestSession.title}</h3>
                    </div>
                    <Badge variant="outline">{latestSession.session_date}</Badge>
                  </div>
                  <p className="mt-4 line-clamp-6 text-sm leading-6 text-muted-foreground">
                    {latestSession.summary_ai || 'No summary saved yet for this session.'}
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Transcript</p>
                      <p className="mt-2 text-sm line-clamp-5">{latestSession.transcript_text || 'No transcript added yet.'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {latestSessionAttachments.filter((attachment) => attachment.attachment_type === 'transcript').length > 0 ? (
                          latestSessionAttachments
                            .filter((attachment) => attachment.attachment_type === 'transcript')
                            .map((attachment) => (
                              <Badge key={attachment.id} variant="outline" className="max-w-full truncate">
                                {attachment.upload?.original_name ?? 'Linked transcript file'}
                              </Badge>
                            ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No transcript files linked yet.</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Key points</p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {(keyPoints.length > 0 ? keyPoints : ['No key points logged yet.']).map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top 3</p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {(topCommitments.length > 0 ? topCommitments : ['No top commitments logged yet.']).map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                ) : (
                  <EmptyState
                    icon={TextSearch}
                    title="No sessions logged yet"
                    body="Capture the first coaching session and this column becomes the memory bank for the relationship."
                    actionLabel="Capture first session"
                    onAction={() => setDialogState('session')}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/60 bg-background/82">
              <CardHeader>
                <CardTitle>Session Timeline</CardTitle>
                <CardDescription>Past calls stay visible so the relationship memory does not drift month to month.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {workspace.sessions.length > 0 ? workspace.sessions.map((session, index) => (
                  <div key={session.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium">{session.title}</p>
                        <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">{session.summary_ai || 'No summary saved yet.'}</p>
                      </div>
                      <Badge variant="outline">{session.session_date}</Badge>
                    </div>
                    {index < workspace.sessions.length - 1 && <Separator className="mt-4" />}
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">The timeline will populate as sessions are captured.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[28px] border-border/60 bg-background/82">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>Commitment Tracker</span>
                  <Button size="sm" variant="outline" onClick={() => setDialogState('commitment')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </CardTitle>
                <CardDescription>The scoreboard for what the owner said would be done before the next call.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {workspace.commitments.length > 0 ? workspace.commitments.map((commitment) => {
                  const linkedProofs = commitmentAttachmentMap.get(commitment.id) ?? [];
                  const sourceSession = workspace.sessions.find((session) => session.id === commitment.session_id);
                  const reviewedSession = commitment.reviewed_in_session_id
                    ? workspace.sessions.find((session) => session.id === commitment.reviewed_in_session_id)
                    : null;

                  return (
                    <div key={commitment.id} className="rounded-[22px] border border-border/60 bg-muted/25 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{commitment.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{commitment.description || 'No supporting note added.'}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {sourceSession ? <Badge variant="outline">From {sourceSession.title}</Badge> : null}
                          {reviewedSession ? <Badge variant="outline">Reviewed in {reviewedSession.title}</Badge> : null}
                        </div>
                      </div>
                      <Select
                        value={commitment.status}
                        onValueChange={(value) => workspace.updateCommitment.mutate({ id: commitment.id, updates: { status: value } })}
                      >
                        <SelectTrigger className={`w-[170px] ${STATUS_TONE[commitment.status] ?? ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMITMENT_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-border/60 bg-background/75 p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Due</p>
                        <p className="mt-2">{commitment.due_date || 'No due date set'}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/75 p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Proof</p>
                        <p className="mt-2">{commitment.proof_notes || 'No proof linked yet'}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {linkedProofs.length > 0 ? (
                            linkedProofs.map((attachment) => (
                              <Badge key={attachment.id} variant="outline" className="max-w-full truncate">
                                {attachment.upload?.original_name ?? 'Linked file'}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No uploaded proof linked yet.</span>
                          )}
                        </div>
                      </div>
                    </div>
                    </div>
                  );
                }) : (
                  <EmptyState
                    icon={Target}
                    title="No commitments in motion"
                    body="Add the top promises from the call so accountability starts here, not in memory."
                    actionLabel="Add commitment"
                    onAction={() => setDialogState('commitment')}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/60 bg-background/82">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>Mission Board</span>
                  <Button size="sm" variant="outline" onClick={() => setDialogState('board')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </CardTitle>
                <CardDescription>Broader deployments that need to stay visible between calls.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                  {boardGroups.map((column) => (
                    <div key={column.key} className={`rounded-[24px] border p-4 ${column.tone}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{column.title}</h3>
                          <p className="mt-1 text-sm opacity-80">{column.description}</p>
                        </div>
                        <Badge variant="outline">{column.items.length}</Badge>
                      </div>
                      <div className="mt-4 space-y-3">
                        {column.items.length > 0 ? column.items.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-current/20 bg-background/60 p-3 text-sm text-foreground shadow-sm">
                            <p className="font-medium">{item.title}</p>
                            <p className="mt-2 text-muted-foreground">{item.description || 'No supporting note added.'}</p>
                          </div>
                        )) : (
                          <div className="rounded-2xl border border-dashed border-current/25 bg-background/45 p-3 text-sm opacity-80">
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

          <div className="space-y-6 xl:col-span-2 xl:grid xl:grid-cols-2 xl:gap-6 xl:space-y-0 2xl:col-span-1 2xl:block 2xl:space-y-6">
            <Card className="rounded-[28px] border-border/60 bg-background/82">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Wins + Friction
                </CardTitle>
                <CardDescription>The emotional temperature of the account, preserved from the latest call.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Recent wins</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {(wins.length > 0 ? wins : ['Wins from the latest session will stack here.']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <Separator />
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Current issues</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {(issues.length > 0 ? issues : ['Current blockers will surface here after sessions are captured.']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/60 bg-background/82">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  AI Mastermind
                </CardTitle>
                <CardDescription>The coaching brain placeholder sits here after the memory layer is stable.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[24px] border border-dashed border-border/60 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                  This rebuild keeps the page reliable first. The chat brain will plug into transcripts, commitments,
                  wins, and proof artifacts after the shell is locked.
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Session transcript', 'Commitment history', 'Mission board context', 'Proof artifacts'].map((chip) => (
                    <Badge key={chip} variant="outline">
                      {chip}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {isAdmin && (
              <Card className="rounded-[28px] border-border/60 bg-background/82">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Coach Notes
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setCoachNoteOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </CardTitle>
                  <CardDescription>Private coach-only observations for the next call.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {workspace.coachNotes.length > 0 ? workspace.coachNotes.map((note) => (
                    <div key={note.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="font-medium">{note.title}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{note.note_body}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No coach-only notes yet.</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-[28px] border-border/60 bg-background/82 xl:col-span-2 2xl:col-span-1">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-5 w-5 text-primary" />
                    Proof Locker
                  </CardTitle>
                <CardDescription>Link transcripts, screenshots, and artifacts back to the exact session or commitment they prove.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Linked artifacts</p>
                    <p className="mt-2 text-3xl font-semibold">{linkedAttachments.length}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Attachments already tied to sessions, commitments, or board items.</p>
                  </div>
                  <div className="rounded-[22px] border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Uploads available</p>
                    <p className="mt-2 text-3xl font-semibold">{workspace.uploads.length}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Owner and coach/admin uploads ready to be linked into the workspace.</p>
                  </div>
                </div>

                {linkedAttachments.length > 0 ? (
                  <div className="space-y-3">
                    {linkedAttachments.slice(0, 6).map((attachment) => (
                      <div key={attachment.id} className="rounded-[22px] border border-border/60 bg-muted/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{attachment.upload?.original_name ?? 'Linked upload'}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{attachmentTargetLabel(attachment)}</p>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {attachment.attachment_type}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{formatFileSize(attachment.upload?.file_size ?? null)}</span>
                          <span>•</span>
                          <span>{attachment.upload?.category ?? 'Uncategorized'}</span>
                          <span>•</span>
                          <span>{formatDateLabel(attachment.created_at, { hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    No artifacts linked yet. Upload files in the Files area, then connect them here to the session,
                    commitment, or board item they support.
                  </div>
                )}

                {workspace.uploads.length > 0 && (
                  <div className="rounded-[22px] border border-border/60 bg-background/75 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Recent uploads ready to link</p>
                    <div className="mt-3 space-y-2">
                      {workspace.uploads.slice(0, 3).map((upload) => (
                        <div key={upload.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{upload.original_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {upload.category} · {formatFileSize(upload.file_size)} · {formatDateLabel(upload.created_at)}
                            </p>
                          </div>
                          <Badge variant="outline">{upload.user_id === user?.id ? 'You' : 'Owner'}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button className="flex-1" onClick={() => setAttachmentOpen(true)} disabled={workspace.uploads.length === 0}>
                    <Paperclip className="mr-2 h-4 w-4" />
                    Link existing upload
                  </Button>
                  <Button variant="outline" asChild className="flex-1">
                    <Link to="/uploads">
                      <Upload className="mr-2 h-4 w-4" />
                      Open files
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {workspace.error && (
        <div className="fixed bottom-6 right-6 max-w-md rounded-2xl border border-amber-300/60 bg-amber-50/95 p-4 text-sm text-amber-900 shadow-xl dark:border-amber-700 dark:bg-amber-950/95 dark:text-amber-100">
          Mission Control data could not load in this environment. The shell is live, but the backend returned an
          error while reading or writing workspace records.
        </div>
      )}

      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent
          className={
            dialogState === 'session'
              ? 'max-h-[90vh] max-w-4xl overflow-y-auto'
              : 'max-h-[85vh] max-w-2xl overflow-y-auto'
          }
        >
          <DialogHeader>
            <DialogTitle>
              {dialogState === 'session'
                ? 'New session'
                : dialogState === 'commitment'
                  ? 'Add commitment'
                : 'Add board item'}
            </DialogTitle>
            <DialogDescription>
              {dialogState === 'session'
                ? 'Paste the transcript, save the session memory, and then link proof or transcript files back to it.'
                : 'Capture the next piece of relationship memory and keep the workspace moving.'}
            </DialogDescription>
          </DialogHeader>
          {dialogState === 'session' && (
            <SessionDialog
              openCommitments={openCommitments}
              sessions={workspace.sessions}
              isSaving={workspace.createSession.isPending}
              onSubmit={async (payload) => {
                await workspace.createSession.mutateAsync(payload);
                setDialogState(null);
              }}
            />
          )}
          {dialogState === 'commitment' && (
            <CommitmentDialog
              sessions={workspace.sessions}
              isSaving={workspace.createCommitment.isPending}
              onSubmit={async (payload) => {
                await workspace.createCommitment.mutateAsync(payload);
                setDialogState(null);
              }}
            />
          )}
          {dialogState === 'board' && (
            <BoardItemDialog
              sessions={workspace.sessions}
              isSaving={workspace.createBoardItem.isPending}
              onSubmit={async (payload) => {
                await workspace.createBoardItem.mutateAsync(payload);
                setDialogState(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={coachNoteOpen} onOpenChange={setCoachNoteOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add coach note</DialogTitle>
            <DialogDescription>Private prep, feedback, or pattern tracking for your own use.</DialogDescription>
          </DialogHeader>
          <CoachNoteDialog
            sessions={workspace.sessions}
            isSaving={workspace.createCoachNote.isPending}
            onSubmit={async (payload) => {
              await workspace.createCoachNote.mutateAsync(payload);
              setCoachNoteOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={attachmentOpen} onOpenChange={setAttachmentOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Link upload</DialogTitle>
            <DialogDescription>Attach an existing uploaded file to the specific session, commitment, or board item it supports.</DialogDescription>
          </DialogHeader>
          <AttachmentDialog
            uploads={workspace.uploads}
            sessions={workspace.sessions}
            commitments={workspace.commitments}
            boardItems={workspace.boardItems}
            isSaving={workspace.createAttachment.isPending}
            onSubmit={async (payload) => {
              await workspace.createAttachment.mutateAsync(payload);
              setAttachmentOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-border/60 bg-muted/25 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-background/80">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-serif text-2xl">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
      <Button className="mt-5" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

function SessionDialog({
  openCommitments,
  sessions,
  onSubmit,
  isSaving,
}: {
  openCommitments: MissionCommitment[];
  sessions: MissionSession[];
  onSubmit: (payload: {
    title: string;
    session_date: string;
    next_call_date?: string | null;
    summary_ai?: string | null;
    transcript_text?: string | null;
    key_points_json?: string[];
    wins_json?: string[];
    issues_json?: string[];
    top_commitments_json?: string[];
    auto_create_commitments?: boolean;
    reviewed_commitments?: Array<{
      commitment_id: string;
      status: SessionReviewStatus;
    }>;
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextCallDate, setNextCallDate] = useState('');
  const [summary, setSummary] = useState('');
  const [transcript, setTranscript] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [wins, setWins] = useState('');
  const [issues, setIssues] = useState('');
  const [topThree, setTopThree] = useState('');
  const [autoCreateCommitments, setAutoCreateCommitments] = useState(true);
  const [reviewMap, setReviewMap] = useState<Record<string, SessionReviewStatus>>({});
  const canGenerateFromTranscript = transcript.trim().length > 80;
  const draftMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-mission-control-draft', {
        body: {
          transcript: transcript.trim(),
          session_date: sessionDate,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate mission control draft');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as {
        suggested_title: string;
        summary: string;
        key_points: string[];
        wins: string[];
        issues: string[];
        top_commitments: string[];
      };
    },
    onSuccess: (draft) => {
      setTitle((current) => current || `${formatDateLabel(sessionDate)} ${draft.suggested_title}`);
      setSummary(draft.summary || '');
      setKeyPoints(draft.key_points.join('\n'));
      setWins(draft.wins.join('\n'));
      setIssues(draft.issues.join('\n'));
      setTopThree(draft.top_commitments.join('\n'));
      toast.success('Transcript draft ready', {
        description: 'The session draft was generated from the transcript.',
      });
    },
    onError: (error) => {
      toast.error('Could not generate transcript draft', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  const handleGenerateFromTranscript = () => {
    if (!canGenerateFromTranscript) return;
    draftMutation.mutate();
  };

  const draftedCommitments = uniqueLines(topThree);
  const reviewedCommitments = openCommitments
    .map((commitment) => {
      const status = reviewMap[commitment.id];
      return status ? { commitment_id: commitment.id, status } : null;
    })
    .filter(Boolean) as Array<{ commitment_id: string; status: SessionReviewStatus }>;

  const updateReviewStatus = (commitmentId: string, status: SessionReviewStatus | 'skip') => {
    setReviewMap((current) => {
      if (status === 'skip') {
        const next = { ...current };
        delete next[commitmentId];
        return next;
      }

      return {
        ...current,
        [commitmentId]: status,
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        Paste the transcript first, then generate an AI draft for the summary, key points, wins, issues, and top 3.
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-session-title">Session title</Label>
        <Input id="mission-session-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="March strategy call" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mission-session-date">Session date</Label>
          <Input id="mission-session-date" type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mission-next-call-date">Next call date</Label>
          <Input id="mission-next-call-date" type="date" value={nextCallDate} onChange={(event) => setNextCallDate(event.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-session-summary">Summary (manual for now)</Label>
        <p className="text-xs text-muted-foreground">
          Optional. The AI draft will fill this in, and you can still edit it before save.
        </p>
        <Textarea
          id="mission-session-summary"
          rows={4}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Summarize what actually mattered on the call..."
        />
      </div>
      <div className="space-y-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <Label htmlFor="mission-session-transcript">Transcript</Label>
            <p className="text-xs text-muted-foreground">
              Paste the raw transcript or cleaned call notes here. This is the source memory for the session.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={handleGenerateFromTranscript} disabled={!canGenerateFromTranscript}>
            {draftMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {draftMutation.isPending ? 'Generating draft...' : 'Generate AI draft'}
          </Button>
        </div>
        <Textarea
          id="mission-session-transcript"
          rows={8}
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder="Paste the transcript or cleaned notes here..."
        />
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Session draft preview</p>
            <p className="text-xs text-muted-foreground">This is what will feed the Mission Control workspace after save.</p>
          </div>
          <Badge variant="outline">
            {draftMutation.isPending ? 'Generating draft' : canGenerateFromTranscript ? 'Transcript ready' : 'Paste transcript first'}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Summary</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {summary.trim() || 'No summary draft yet.'}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top 3 preview</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {linesToJson(topThree).slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
              {!linesToJson(topThree).length && (
                <li>No commitments drafted yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium">Top 3 commitment handoff</p>
            <p className="text-xs text-muted-foreground">
              Save this session and turn the drafted top 3 into tracked accountability items automatically.
            </p>
          </div>
          <Button
            type="button"
            variant={autoCreateCommitments ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoCreateCommitments((current) => !current)}
          >
            {autoCreateCommitments ? 'Auto-create on' : 'Auto-create off'}
          </Button>
        </div>
        <div className="mt-4 rounded-2xl border border-border/60 bg-background/80 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Will create</p>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {draftedCommitments.length > 0 ? draftedCommitments.slice(0, 3).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            )) : (
              <li>No draft commitments yet.</li>
            )}
          </ul>
          {autoCreateCommitments && nextCallDate ? (
            <p className="mt-3 text-xs text-muted-foreground">New commitments will be due by {formatDateLabel(nextCallDate)}.</p>
          ) : null}
        </div>
      </div>
      {openCommitments.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Review last call commitments</p>
              <p className="text-xs text-muted-foreground">
                Close the loop on what was promised before this session so the new memory starts clean.
              </p>
            </div>
            <Badge variant="outline">{openCommitments.length} open</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {openCommitments.map((commitment) => {
              const sourceSession = sessions.find((session) => session.id === commitment.session_id);

              return (
                <div key={commitment.id} className="rounded-2xl border border-border/60 bg-background/80 p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{commitment.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {sourceSession?.title ?? 'Previous session'} {commitment.due_date ? `• due ${formatDateLabel(commitment.due_date)}` : ''}
                      </p>
                    </div>
                    <Select
                      value={reviewMap[commitment.id] ?? 'skip'}
                      onValueChange={(value) => updateReviewStatus(commitment.id, value as SessionReviewStatus | 'skip')}
                    >
                      <SelectTrigger className="w-full lg:w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Leave unchanged</SelectItem>
                        <SelectItem value="done">Done on this call</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                        <SelectItem value="carried_forward">Carry forward</SelectItem>
                        <SelectItem value="in_progress">Still in progress</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mission-session-key-points">Key points</Label>
          <Textarea id="mission-session-key-points" rows={4} value={keyPoints} onChange={(event) => setKeyPoints(event.target.value)} placeholder="One point per line" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mission-session-top-three">Top 3 commitments</Label>
          <Textarea id="mission-session-top-three" rows={4} value={topThree} onChange={(event) => setTopThree(event.target.value)} placeholder="One commitment per line" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mission-session-wins">Wins</Label>
          <Textarea id="mission-session-wins" rows={4} value={wins} onChange={(event) => setWins(event.target.value)} placeholder="One win per line" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mission-session-issues">Issues</Label>
          <Textarea id="mission-session-issues" rows={4} value={issues} onChange={(event) => setIssues(event.target.value)} placeholder="One issue per line" />
        </div>
      </div>
      <Button
        className="w-full"
        onClick={() =>
          onSubmit({
            title: title.trim() || `${formatDateLabel(sessionDate)} Coaching session`,
            session_date: sessionDate,
            next_call_date: nextCallDate || null,
            summary_ai: summary.trim() || null,
            transcript_text: transcript.trim() || null,
            key_points_json: uniqueLines(keyPoints),
            wins_json: uniqueLines(wins),
            issues_json: uniqueLines(issues),
            top_commitments_json: draftedCommitments,
            auto_create_commitments: autoCreateCommitments,
            reviewed_commitments: reviewedCommitments,
          })
        }
        disabled={isSaving || !sessionDate || (!title.trim() && !transcript.trim())}
      >
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        Save session
      </Button>
    </div>
  );
}

function CommitmentDialog({
  sessions,
  onSubmit,
  isSaving,
}: {
  sessions: MissionSession[];
  onSubmit: (payload: {
    session_id: string;
    title: string;
    description?: string | null;
    status: string;
    due_date?: string | null;
    proof_notes?: string | null;
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('not_started');
  const [dueDate, setDueDate] = useState('');
  const [proofNotes, setProofNotes] = useState('');

  useEffect(() => {
    if (!sessionId && sessions[0]?.id) {
      setSessionId(sessions[0].id);
    }
  }, [sessionId, sessions]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Source session</Label>
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose session" />
          </SelectTrigger>
          <SelectContent>
            {sessions.map((session) => (
              <SelectItem key={session.id} value={session.id}>
                {session.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-commitment-title">Commitment title</Label>
        <Input id="mission-commitment-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Install Monday leadership scorecard" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-commitment-description">Description</Label>
        <Textarea id="mission-commitment-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What exactly has to happen before the next call?" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMITMENT_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mission-commitment-due-date">Due date</Label>
          <Input id="mission-commitment-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-commitment-proof">Proof notes</Label>
        <Textarea id="mission-commitment-proof" rows={3} value={proofNotes} onChange={(event) => setProofNotes(event.target.value)} placeholder="Paste proof, link, or what you expect to verify next call..." />
      </div>
      <Button
        className="w-full"
        onClick={() =>
          onSubmit({
            session_id: sessionId,
            title: title.trim(),
            description: description.trim() || null,
            status,
            due_date: dueDate || null,
            proof_notes: proofNotes.trim() || null,
          })
        }
        disabled={isSaving || !sessionId || !title.trim()}
      >
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Target className="mr-2 h-4 w-4" />}
        Save commitment
      </Button>
    </div>
  );
}

function BoardItemDialog({
  sessions,
  onSubmit,
  isSaving,
}: {
  sessions: MissionSession[];
  onSubmit: (payload: {
    title: string;
    description?: string | null;
    column_status: string;
    source_session_id?: string | null;
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnStatus, setColumnStatus] = useState<BoardColumn>('backlog');
  const [sourceSessionId, setSourceSessionId] = useState('none');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="mission-board-title">Board item title</Label>
        <Input id="mission-board-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Delegation tracker" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-board-description">Description</Label>
        <Textarea id="mission-board-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is being built or deployed?" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Board column</Label>
          <Select value={columnStatus} onValueChange={(value) => setColumnStatus(value as BoardColumn)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOARD_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
      <Button
        className="w-full"
        onClick={() =>
          onSubmit({
            title: title.trim(),
            description: description.trim() || null,
            column_status: columnStatus,
            source_session_id: sourceSessionId === 'none' ? null : sourceSessionId,
          })
        }
        disabled={isSaving || !title.trim()}
      >
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
        Save board item
      </Button>
    </div>
  );
}

function CoachNoteDialog({
  sessions,
  onSubmit,
  isSaving,
}: {
  sessions: MissionSession[];
  onSubmit: (payload: { title: string; note_body: string; session_id?: string | null }) => Promise<void>;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [sessionId, setSessionId] = useState('none');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="mission-coach-note-title">Note title</Label>
        <Input id="mission-coach-note-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Owner still avoids firm hiring deadline" />
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
        <Label htmlFor="mission-coach-note-body">Note</Label>
        <Textarea id="mission-coach-note-body" rows={5} value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Private prep and observations for the next call..." />
      </div>
      <Button
        className="w-full"
        onClick={() =>
          onSubmit({
            title: title.trim(),
            note_body: noteBody.trim(),
            session_id: sessionId === 'none' ? null : sessionId,
          })
        }
        disabled={isSaving || !title.trim() || !noteBody.trim()}
      >
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
        Save coach note
      </Button>
    </div>
  );
}

function AttachmentDialog({
  uploads,
  sessions,
  commitments,
  boardItems,
  onSubmit,
  isSaving,
}: {
  uploads: MissionUpload[];
  sessions: MissionSession[];
  commitments: MissionCommitment[];
  boardItems: MissionBoardItem[];
  onSubmit: (payload: {
    upload_id: string;
    attachment_type: string;
    session_id?: string | null;
    commitment_id?: string | null;
    board_item_id?: string | null;
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const initialTargetKind: AttachmentTargetKind = sessions.length > 0 ? 'session' : commitments.length > 0 ? 'commitment' : 'board';
  const hasTargets = sessions.length > 0 || commitments.length > 0 || boardItems.length > 0;
  const [uploadId, setUploadId] = useState(uploads[0]?.id ?? '');
  const [attachmentType, setAttachmentType] = useState<'transcript' | 'proof' | 'reference' | 'artifact'>(
    initialTargetKind === 'session' ? 'transcript' : 'proof'
  );
  const [targetKind, setTargetKind] = useState<AttachmentTargetKind>(initialTargetKind);
  const [targetId, setTargetId] = useState('');

  const targetOptions = useMemo(() => {
    if (targetKind === 'session') {
      return sessions.map((session) => ({ value: session.id, label: `${session.title} · ${formatDateLabel(session.session_date)}` }));
    }

    if (targetKind === 'commitment') {
      return commitments.map((commitment) => ({ value: commitment.id, label: commitment.title }));
    }

    return boardItems.map((item) => ({ value: item.id, label: item.title }));
  }, [boardItems, commitments, sessions, targetKind]);

  useEffect(() => {
    if (!uploadId && uploads[0]?.id) {
      setUploadId(uploads[0].id);
    }
  }, [uploadId, uploads]);

  useEffect(() => {
    if (targetKind === 'session' && attachmentType === 'proof') {
      setAttachmentType('transcript');
    }

    if (targetKind !== 'session' && attachmentType === 'transcript') {
      setAttachmentType('proof');
    }
  }, [attachmentType, targetKind]);

  useEffect(() => {
    const nextTargetId = targetOptions[0]?.value ?? '';
    if (!targetOptions.find((option) => option.value === targetId)) {
      setTargetId(nextTargetId);
    }
  }, [targetId, targetOptions]);

  if (uploads.length === 0 || !hasTargets) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
          {uploads.length === 0
            ? 'There are no uploaded files available to link yet.'
            : 'Create a session, commitment, or board item first so the file has somewhere to attach.'}
        </div>
        {uploads.length === 0 && (
          <Button asChild className="w-full">
            <Link to="/uploads">
              <Upload className="mr-2 h-4 w-4" />
              Open files
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Upload</Label>
        <Select value={uploadId} onValueChange={setUploadId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose uploaded file" />
          </SelectTrigger>
          <SelectContent>
            {uploads.map((upload) => (
              <SelectItem key={upload.id} value={upload.id}>
                {upload.original_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Link to</Label>
          <Select value={targetKind} onValueChange={(value) => setTargetKind(value as AttachmentTargetKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sessions.length > 0 && <SelectItem value="session">Session</SelectItem>}
              {commitments.length > 0 && <SelectItem value="commitment">Commitment</SelectItem>}
              {boardItems.length > 0 && <SelectItem value="board">Board item</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Attachment type</Label>
          <Select value={attachmentType} onValueChange={(value) => setAttachmentType(value as typeof attachmentType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targetKind === 'session' && <SelectItem value="transcript">Transcript</SelectItem>}
              <SelectItem value="proof">Proof</SelectItem>
              <SelectItem value="reference">Reference</SelectItem>
              <SelectItem value="artifact">Artifact</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Target record</Label>
        <Select value={targetId} onValueChange={setTargetId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose record" />
          </SelectTrigger>
          <SelectContent>
            {targetOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        className="w-full"
        onClick={() =>
          onSubmit({
            upload_id: uploadId,
            attachment_type: attachmentType,
            session_id: targetKind === 'session' ? targetId : null,
            commitment_id: targetKind === 'commitment' ? targetId : null,
            board_item_id: targetKind === 'board' ? targetId : null,
          })
        }
        disabled={isSaving || !uploadId || !targetId}
      >
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
        Link upload
      </Button>
    </div>
  );
}
