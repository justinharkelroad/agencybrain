import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  Minus,
  Loader2,
  MessageSquare,
  Package,
  Paperclip,
  Plus,
  Rocket,
  Shield,
  Sparkles,
  Target,
  TextSearch,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import {
  type MissionPulseFormData,
  buildMissionPulseDraft,
  useMissionControlBusinessPulse,
} from '@/hooks/useMissionControlBusinessPulse';
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
type PulseFormData = {
  sales?: { premium?: number; items?: number; policies?: number; achievedVC?: boolean };
  marketing?: { totalSpend?: number; policiesQuoted?: number };
  cashFlow?: { compensation?: number; expenses?: number; netProfit?: number };
  qualitative?: {
    biggestStress?: string;
    gutAction?: string;
    biggestPersonalWin?: string;
    biggestBusinessWin?: string;
    attackItems?: { item1?: string; item2?: string; item3?: string };
  };
};

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

function numberOrUndefined(value: unknown) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
}

function formatNumber(n: number | undefined | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(n));
}

function formatCurrency(n: number | undefined | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function inputNumberValue(value: number | undefined | null) {
  if (!value) return '';
  return String(value);
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

function labelForPeriod(period: { title: string; start_date: string; end_date: string }) {
  const titleHasDate =
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(period.title) || /\b\d{4}-\d{2}-\d{2}\b/.test(period.title);

  return titleHasDate
    ? period.title
    : `${period.title} • ${formatDateLabel(period.start_date)} – ${formatDateLabel(period.end_date)}`;
}

function getPulseData(period?: { form_data: unknown } | null): PulseFormData {
  if (!period?.form_data || typeof period.form_data !== 'object') return {};
  return period.form_data as PulseFormData;
}

function getAttackItems(period?: { form_data: unknown } | null) {
  const qualitative = getPulseData(period).qualitative;
  const attackItems = qualitative?.attackItems;
  return [attackItems?.item1, attackItems?.item2, attackItems?.item3].filter(Boolean) as string[];
}

function getNetProfit(cashFlow?: PulseFormData['cashFlow']) {
  if (!cashFlow) return undefined;
  if (typeof cashFlow.netProfit === 'number') return cashFlow.netProfit;
  if (typeof cashFlow.compensation === 'number' && typeof cashFlow.expenses === 'number') {
    return cashFlow.compensation - cashFlow.expenses;
  }
  return undefined;
}

function getDelta(curr?: number, prev?: number) {
  if (typeof curr !== 'number' || typeof prev !== 'number') {
    return { abs: undefined as number | undefined, pct: undefined as number | undefined };
  }
  const abs = curr - prev;
  const pct = prev === 0 ? undefined : (abs / prev) * 100;
  return { abs, pct };
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
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [pulseEditorOpen, setPulseEditorOpen] = useState(false);
  const [pulseAdvancedOpen, setPulseAdvancedOpen] = useState(false);

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
  const pulseUserId = isAdmin ? ownerUserId : user?.id ?? ownerUserId;
  const pulse = useMissionControlBusinessPulse(pulseUserId, Boolean(isAdmin ? ownerUserId : user?.id));
  const latestPulse = pulse.latestPeriod;
  const previousPulse = pulse.previousPeriod;
  const pulseSeed = useMemo(() => buildMissionPulseDraft(pulse.editablePeriod, latestPulse), [latestPulse, pulse.editablePeriod]);
  const [pulseDraft, setPulseDraft] = useState<MissionPulseFormData>(pulseSeed);

  useEffect(() => {
    if (!pulseEditorOpen) {
      setPulseDraft(pulseSeed);
    }
  }, [pulseEditorOpen, pulseSeed]);

  useEffect(() => {
    if (!isAdmin && !pulse.isLoading && !latestPulse) {
      setPulseEditorOpen(true);
    }
  }, [isAdmin, latestPulse, pulse.isLoading]);

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
  const latestPulseData = getPulseData(latestPulse);
  const previousPulseData = getPulseData(previousPulse);
  const pulseDisplayData = pulseEditorOpen ? pulseDraft : latestPulseData;
  const latestSales = latestPulseData.sales ?? {};
  const latestMarketing = latestPulseData.marketing ?? {};
  const latestCashFlow = latestPulseData.cashFlow ?? {};
  const latestQualitative = latestPulseData.qualitative ?? {};
  const previousSales = previousPulseData.sales ?? {};
  const previousMarketing = previousPulseData.marketing ?? {};
  const previousCashFlow = previousPulseData.cashFlow ?? {};
  const displaySales = pulseDisplayData.sales ?? {};
  const displayMarketing = pulseDisplayData.marketing ?? {};
  const displayCashFlow = pulseDisplayData.cashFlow ?? {};
  const displayQualitative = pulseDisplayData.qualitative ?? {};
  const pulseMetrics = [
    { label: 'Premium Sold', value: formatCurrency(numberOrUndefined(displaySales.premium)), icon: DollarSign },
    { label: 'Items Sold', value: formatNumber(numberOrUndefined(displaySales.items)), icon: Package },
    { label: 'Policies Sold', value: formatNumber(numberOrUndefined(displaySales.policies)), icon: ClipboardList },
    { label: 'Policies Quoted', value: formatNumber(numberOrUndefined(displayMarketing.policiesQuoted)), icon: Users },
    { label: 'Marketing Spend', value: formatCurrency(numberOrUndefined(displayMarketing.totalSpend)), icon: Target },
    { label: 'Agency Compensation', value: formatCurrency(numberOrUndefined(displayCashFlow.compensation)), icon: Trophy },
    { label: 'Expenses', value: formatCurrency(numberOrUndefined(displayCashFlow.expenses)), icon: BriefcaseBusiness },
    { label: 'Net Profit', value: formatCurrency(getNetProfit(displayCashFlow)), icon: TrendingUp },
  ];
  const pulseTrends = [
    {
      label: 'Premium Sold',
      current: numberOrUndefined(latestSales.premium),
      delta: getDelta(numberOrUndefined(latestSales.premium), numberOrUndefined(previousSales.premium)),
      currency: true,
    },
    {
      label: 'Items Sold',
      current: numberOrUndefined(latestSales.items),
      delta: getDelta(numberOrUndefined(latestSales.items), numberOrUndefined(previousSales.items)),
      currency: false,
    },
    {
      label: 'Policies Sold',
      current: numberOrUndefined(latestSales.policies),
      delta: getDelta(numberOrUndefined(latestSales.policies), numberOrUndefined(previousSales.policies)),
      currency: false,
    },
    {
      label: 'Policies Quoted',
      current: numberOrUndefined(latestMarketing.policiesQuoted),
      delta: getDelta(numberOrUndefined(latestMarketing.policiesQuoted), numberOrUndefined(previousMarketing.policiesQuoted)),
      currency: false,
    },
    {
      label: 'Marketing Spend',
      current: numberOrUndefined(latestMarketing.totalSpend),
      delta: getDelta(numberOrUndefined(latestMarketing.totalSpend), numberOrUndefined(previousMarketing.totalSpend)),
      currency: true,
    },
    {
      label: 'Net Profit',
      current: getNetProfit(latestCashFlow),
      delta: getDelta(getNetProfit(latestCashFlow), getNetProfit(previousCashFlow)),
      currency: true,
    },
  ];
  const attackItems = getAttackItems(latestPulse);
  const draftAttackItems = [
    pulseDraft.qualitative.attackItems.item1,
    pulseDraft.qualitative.attackItems.item2,
    pulseDraft.qualitative.attackItems.item3,
  ].filter(Boolean);
  const pulseCompletion = [
    pulseDraft.sales.premium,
    pulseDraft.sales.items,
    pulseDraft.sales.policies,
    pulseDraft.marketing.policiesQuoted,
    pulseDraft.marketing.totalSpend,
    pulseDraft.cashFlow.compensation,
    pulseDraft.cashFlow.expenses,
    pulseDraft.qualitative.biggestStress,
    pulseDraft.qualitative.gutAction,
    pulseDraft.qualitative.biggestBusinessWin,
    pulseDraft.qualitative.biggestPersonalWin,
    pulseDraft.qualitative.attackItems.item1,
    pulseDraft.qualitative.attackItems.item2,
    pulseDraft.qualitative.attackItems.item3,
  ].filter((value) => {
    if (typeof value === 'number') return value > 0;
    return Boolean(value);
  }).length;
  const pulseCompletionLabel =
    pulseCompletion >= 12 ? 'Ready for the call' : pulseCompletion >= 7 ? 'Solid draft' : pulseCompletion > 0 ? 'In progress' : 'Not started';

  const updatePulseSection = <K extends keyof MissionPulseFormData,>(
    section: K,
    updater: (current: MissionPulseFormData[K]) => MissionPulseFormData[K]
  ) => {
    setPulseDraft((current) => ({
      ...current,
      [section]: updater(current[section]),
    }));
  };

  const savePulseDraft = async () => {
    try {
      await pulse.savePulse.mutateAsync(pulseDraft);
      toast.success('Business pulse saved', {
        description: `${pulse.targetPeriod.label} prep is now live in Mission Control.`,
      });
      setPulseEditorOpen(false);
    } catch (error) {
      toast.error('Could not save business pulse', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
  const deleteTargetSession = deleteSessionId
    ? workspace.sessions.find((session) => session.id === deleteSessionId) ?? null
    : null;
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

  const heroSupportText = isAdmin
    ? 'Before the call: review the business pulse. After the call: capture the session and review commitments.'
    : 'Before the call: update your business pulse. After the call: review what was captured and work the commitments between calls.';
  const stepTwoTitle = isAdmin ? 'Capture Session' : 'Coach Updates Session';
  const stepTwoBody = isAdmin
    ? 'Paste the transcript after the call and save the session memory.'
    : 'After the call, your coach updates the transcript, session memory, and next steps here.';
  const stepThreeTitle = isAdmin ? 'Review Commitments' : 'Work the Commitments';
  const stepThreeBody = isAdmin
    ? 'Use the next session to verify what was done, blocked, or carried forward.'
    : 'Use this workspace between calls to see what is done, blocked, or still in progress.';

  const businessPulseSection = (
    <section className="rounded-[32px] border border-border/60 bg-background/82 p-6 shadow-sm">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-foreground/15 bg-background/70 px-3 py-1 text-[11px] uppercase tracking-[0.24em]">
              Business Pulse
            </Badge>
            <Badge variant="outline">{pulse.targetPeriod.label}</Badge>
            {pulse.editablePeriod ? <Badge variant="outline">Editing current prep window</Badge> : null}
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Prep for the coaching call</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              The owner ritual lives here now: update the scoreboard, surface what feels heavy, and walk into the call with a clean monthly frame.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-border/60 bg-muted/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Target window</p>
              <p className="mt-2 text-lg font-semibold">{pulse.targetPeriod.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">This is the prep period that feeds the next call.</p>
            </div>
            <div className="rounded-[24px] border border-border/60 bg-muted/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Prep status</p>
              <p className="mt-2 text-lg font-semibold">{pulseCompletionLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{pulseCompletion}/14 core fields currently filled in the live draft.</p>
            </div>
            <div className="rounded-[24px] border border-border/60 bg-muted/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Trend source</p>
              <p className="mt-2 text-lg font-semibold">{latestPulse ? labelForPeriod(latestPulse) : 'No saved pulse yet'}</p>
              <p className="mt-1 text-sm text-muted-foreground">Month-over-month compares against the last saved pulse, not the unsaved draft.</p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[420px] rounded-[28px] border border-border/60 bg-[linear-gradient(160deg,rgba(250,247,240,0.8),rgba(233,227,217,0.35))] p-5 dark:bg-[linear-gradient(160deg,rgba(36,32,26,0.92),rgba(17,17,15,0.92))]">
          <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Owner ritual</p>
          <h3 className="mt-3 text-xl font-semibold">Scoreboard first. Then call focus.</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This replaces the old submit detour. Owners update the pulse here, coaches read it before the call, and the month-over-month board stays intact.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {!isAdmin ? (
              <>
                <Button
                  className="bg-foreground text-background hover:bg-foreground/90"
                  onClick={() => setPulseEditorOpen((current) => !current)}
                >
                  {pulseEditorOpen ? 'Close pulse editor' : latestPulse ? 'Edit pre-call pulse' : "Start this month's pulse"}
                </Button>
                <Button
                  variant="outline"
                  className="border-foreground/15 bg-background/75"
                  onClick={savePulseDraft}
                  disabled={!pulseEditorOpen || pulse.savePulse.isPending}
                >
                  {pulse.savePulse.isPending ? 'Saving pulse...' : 'Save business pulse'}
                </Button>
              </>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                Owner updates this block before the call. You review the saved pulse and then capture the session after the call.
              </div>
            )}
          </div>
        </div>
      </div>

      {pulse.isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {!isAdmin && pulseEditorOpen ? (
            <div className="rounded-[28px] border border-border/60 bg-muted/15 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">This month's prep frame</p>
                  <h3 className="mt-2 text-xl font-semibold">Update the numbers. Clarify the call.</h3>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Keep the top of the form fast: scoreboard first, then what feels heavy, then the top three things to solve on the call.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm">
                  <p className="font-medium">{pulse.targetPeriod.title}</p>
                  <p className="mt-1 text-muted-foreground">
                    {pulse.editablePeriod ? 'Editing the current pulse record.' : 'This will create the current pulse record.'}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <PulseMetricInputCard
                  label="Premium Sold"
                  icon={DollarSign}
                  value={inputNumberValue(pulseDraft.sales.premium)}
                  placeholder="$"
                  onChange={(value) =>
                    updatePulseSection('sales', (current) => ({
                      ...current,
                      premium: Number.parseFloat(value) || 0,
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Items Sold"
                  icon={Package}
                  value={inputNumberValue(pulseDraft.sales.items)}
                  onChange={(value) =>
                    updatePulseSection('sales', (current) => ({
                      ...current,
                      items: Number.parseInt(value, 10) || 0,
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Policies Sold"
                  icon={ClipboardList}
                  value={inputNumberValue(pulseDraft.sales.policies)}
                  onChange={(value) =>
                    updatePulseSection('sales', (current) => ({
                      ...current,
                      policies: Number.parseInt(value, 10) || 0,
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Policies Quoted"
                  icon={Users}
                  value={inputNumberValue(pulseDraft.marketing.policiesQuoted)}
                  onChange={(value) =>
                    updatePulseSection('marketing', (current) => ({
                      ...current,
                      policiesQuoted: Number.parseInt(value, 10) || 0,
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Marketing Spend"
                  icon={Target}
                  value={inputNumberValue(pulseDraft.marketing.totalSpend)}
                  placeholder="$"
                  onChange={(value) =>
                    updatePulseSection('marketing', (current) => ({
                      ...current,
                      totalSpend: Number.parseFloat(value) || 0,
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Compensation"
                  icon={Trophy}
                  value={inputNumberValue(pulseDraft.cashFlow.compensation)}
                  placeholder="$"
                  onChange={(value) =>
                    updatePulseSection('cashFlow', (current) => ({
                      ...current,
                      compensation: Number.parseFloat(value) || 0,
                      netProfit: (Number.parseFloat(value) || 0) - current.expenses,
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Expenses"
                  icon={BriefcaseBusiness}
                  value={inputNumberValue(pulseDraft.cashFlow.expenses)}
                  placeholder="$"
                  onChange={(value) =>
                    updatePulseSection('cashFlow', (current) => ({
                      ...current,
                      expenses: Number.parseFloat(value) || 0,
                      netProfit: current.compensation - (Number.parseFloat(value) || 0),
                    }))
                  }
                />
                <div className="rounded-[24px] border border-emerald-500/25 bg-emerald-500/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Net Profit</p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight">{formatCurrency(pulseDraft.cashFlow.compensation - pulseDraft.cashFlow.expenses)}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/25 bg-background/80 p-3">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[24px] border border-border/60 bg-background/80 p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">Focus for this call</h4>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    These are the coaching prompts that should matter most when the call starts.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <PulseReflectionField
                      label="What feels heaviest right now?"
                      value={pulseDraft.qualitative.biggestStress}
                      onChange={(value) =>
                        updatePulseSection('qualitative', (current) => ({
                          ...current,
                          biggestStress: value,
                        }))
                      }
                    />
                    <PulseReflectionField
                      label="What do you already know you need to do?"
                      value={pulseDraft.qualitative.gutAction}
                      onChange={(value) =>
                        updatePulseSection('qualitative', (current) => ({
                          ...current,
                          gutAction: value,
                        }))
                      }
                    />
                    <PulseReflectionField
                      label="Best business win this month"
                      value={pulseDraft.qualitative.biggestBusinessWin}
                      onChange={(value) =>
                        updatePulseSection('qualitative', (current) => ({
                          ...current,
                          biggestBusinessWin: value,
                        }))
                      }
                    />
                    <PulseReflectionField
                      label="Best personal win this month"
                      value={pulseDraft.qualitative.biggestPersonalWin}
                      onChange={(value) =>
                        updatePulseSection('qualitative', (current) => ({
                          ...current,
                          biggestPersonalWin: value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/60 bg-background/80 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">Top 3 for this call</h4>
                      <p className="mt-2 text-sm text-muted-foreground">What are the three things we need to solve or attack together?</p>
                    </div>
                    <Badge variant="outline">{draftAttackItems.length}/3</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(['item1', 'item2', 'item3'] as const).map((key, index) => (
                      <div key={key} className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                        <Label htmlFor={`pulse-attack-${key}`} className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Item {index + 1}
                        </Label>
                        <Textarea
                          id={`pulse-attack-${key}`}
                          rows={3}
                          className="mt-2 bg-background/80"
                          value={pulseDraft.qualitative.attackItems[key]}
                          onChange={(event) =>
                            updatePulseSection('qualitative', (current) => ({
                              ...current,
                              attackItems: {
                                ...current.attackItems,
                                [key]: event.target.value,
                              },
                            }))
                          }
                          placeholder="What needs to get solved on the call?"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-border/60 bg-background/80 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="font-semibold">Supporting detail</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Keep the heavy detail out of the main ritual, but keep it available for trend tracking and deeper review.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-foreground/15 bg-background/75"
                    onClick={() => setPulseAdvancedOpen((current) => !current)}
                  >
                    {pulseAdvancedOpen ? 'Hide advanced detail' : 'Show advanced detail'}
                  </Button>
                </div>

                {pulseAdvancedOpen ? (
                  <div className="mt-5 space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <PulseMetricInputCard
                        label="Retention %"
                        icon={Shield}
                        value={inputNumberValue(pulseDraft.retention.currentRetentionPercent)}
                        onChange={(value) =>
                          updatePulseSection('retention', (current) => ({
                            ...current,
                            currentRetentionPercent: Number.parseFloat(value) || 0,
                          }))
                        }
                      />
                      <PulseMetricInputCard
                        label="Policies Terminated"
                        icon={AlertTriangle}
                        value={inputNumberValue(pulseDraft.retention.numberTerminated)}
                        onChange={(value) =>
                          updatePulseSection('retention', (current) => ({
                            ...current,
                            numberTerminated: Number.parseInt(value, 10) || 0,
                          }))
                        }
                      />
                      <PulseMetricInputCard
                        label="ALR Total YTD"
                        icon={DollarSign}
                        value={inputNumberValue(pulseDraft.operations.currentAlrTotal)}
                        placeholder="$"
                        onChange={(value) =>
                          updatePulseSection('operations', (current) => ({
                            ...current,
                            currentAlrTotal: Number.parseFloat(value) || 0,
                          }))
                        }
                      />
                      <PulseMetricInputCard
                        label="Bonus Trend"
                        icon={TrendingUp}
                        value={inputNumberValue(pulseDraft.operations.currentBonusTrend)}
                        onChange={(value) =>
                          updatePulseSection('operations', (current) => ({
                            ...current,
                            currentBonusTrend: Number.parseFloat(value) || 0,
                          }))
                        }
                      />
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <div className="rounded-[24px] border border-border/60 bg-muted/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">Lead source breakdown</p>
                            <p className="mt-1 text-sm text-muted-foreground">Optional detail for source-level spend and production.</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updatePulseSection('marketing', (current) => ({
                                ...current,
                                leadSources: [
                                  ...current.leadSources,
                                  { name: '', spend: 0, soldPremium: 0, commissionRate: 0 },
                                ],
                              }))
                            }
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add source
                          </Button>
                        </div>
                        <div className="mt-4 space-y-3">
                          {pulseDraft.marketing.leadSources.length > 0 ? pulseDraft.marketing.leadSources.map((source, index) => (
                            <div key={`${source.name}-${index}`} className="rounded-2xl border border-border/60 bg-background/80 p-3">
                              <div className="grid gap-3 md:grid-cols-2">
                                <Input
                                  value={source.name}
                                  onChange={(event) =>
                                    updatePulseSection('marketing', (current) => ({
                                      ...current,
                                      leadSources: current.leadSources.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, name: event.target.value } : entry
                                      ),
                                    }))
                                  }
                                  placeholder="Lead source"
                                />
                                <Input
                                  value={inputNumberValue(source.spend)}
                                  onChange={(event) =>
                                    updatePulseSection('marketing', (current) => ({
                                      ...current,
                                      leadSources: current.leadSources.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, spend: Number.parseFloat(event.target.value) || 0 } : entry
                                      ),
                                    }))
                                  }
                                  placeholder="Spend"
                                />
                                <Input
                                  value={inputNumberValue(source.soldPremium)}
                                  onChange={(event) =>
                                    updatePulseSection('marketing', (current) => ({
                                      ...current,
                                      leadSources: current.leadSources.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, soldPremium: Number.parseFloat(event.target.value) || 0 } : entry
                                      ),
                                    }))
                                  }
                                  placeholder="Sold premium"
                                />
                                <div className="flex gap-2">
                                  <Input
                                    value={inputNumberValue(source.commissionRate)}
                                    onChange={(event) =>
                                      updatePulseSection('marketing', (current) => ({
                                        ...current,
                                        leadSources: current.leadSources.map((entry, entryIndex) =>
                                          entryIndex === index ? { ...entry, commissionRate: Number.parseFloat(event.target.value) || 0 } : entry
                                        ),
                                      }))
                                    }
                                    placeholder="Commission %"
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    onClick={() =>
                                      updatePulseSection('marketing', (current) => ({
                                        ...current,
                                        leadSources: current.leadSources.filter((_, entryIndex) => entryIndex !== index),
                                      }))
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-dashed border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                              No lead source breakdown added yet.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-border/60 bg-muted/20 p-4">
                        <div className="grid gap-4">
                          <div>
                            <Label htmlFor="pulse-aap-projection">AAP Projection</Label>
                            <Select
                              value={pulseDraft.operations.currentAapProjection}
                              onValueChange={(value) =>
                                updatePulseSection('operations', (current) => ({
                                  ...current,
                                  currentAapProjection: value,
                                }))
                              }
                            >
                              <SelectTrigger id="pulse-aap-projection" className="mt-2 bg-background/80">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {['Emerging', 'On Track', 'Stretch', 'Behind'].map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">Team roster</p>
                                <p className="mt-1 text-sm text-muted-foreground">Persistent team context you want visible month to month.</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updatePulseSection('operations', (current) => ({
                                    ...current,
                                    teamRoster: [...current.teamRoster, { name: '', role: 'Sales' }],
                                  }))
                                }
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add member
                              </Button>
                            </div>
                            <div className="mt-3 space-y-3">
                              {pulseDraft.operations.teamRoster.length > 0 ? pulseDraft.operations.teamRoster.map((member, index) => (
                                <div key={`${member.name}-${index}`} className="flex gap-2 rounded-2xl border border-border/60 bg-background/80 p-3">
                                  <Input
                                    value={member.name}
                                    onChange={(event) =>
                                      updatePulseSection('operations', (current) => ({
                                        ...current,
                                        teamRoster: current.teamRoster.map((entry, entryIndex) =>
                                          entryIndex === index ? { ...entry, name: event.target.value } : entry
                                        ),
                                      }))
                                    }
                                    placeholder="Team member"
                                  />
                                  <Input
                                    value={member.role}
                                    onChange={(event) =>
                                      updatePulseSection('operations', (current) => ({
                                        ...current,
                                        teamRoster: current.teamRoster.map((entry, entryIndex) =>
                                          entryIndex === index ? { ...entry, role: event.target.value } : entry
                                        ),
                                      }))
                                    }
                                    placeholder="Role"
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    onClick={() =>
                                      updatePulseSection('operations', (current) => ({
                                        ...current,
                                        teamRoster: current.teamRoster.filter((_, entryIndex) => entryIndex !== index),
                                      }))
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )) : (
                                <div className="rounded-2xl border border-dashed border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                                  No team roster added yet.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row">
                  <Button className="sm:flex-1" onClick={savePulseDraft} disabled={pulse.savePulse.isPending}>
                    {pulse.savePulse.isPending ? 'Saving business pulse...' : 'Save business pulse'}
                  </Button>
                  <Button
                    variant="outline"
                    className="sm:flex-1"
                    onClick={() => {
                      setPulseDraft(pulseSeed);
                      setPulseAdvancedOpen(false);
                    }}
                    disabled={pulse.savePulse.isPending}
                  >
                    Reset draft
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pulseMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-[24px] border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{metric.label}</p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight">{metric.value}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
            <div className="rounded-[28px] border border-border/60 bg-muted/15 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold">Focus for the call</h3>
                  <p className="text-sm text-muted-foreground">
                    The owner's prep answers stay visible here so the conversation starts in the right place.
                  </p>
                </div>
                {!isAdmin ? (
                  <Button variant="outline" className="border-foreground/15 bg-background/75" onClick={() => setPulseEditorOpen(true)}>
                    {latestPulse ? 'Tighten prep answers' : 'Start prep answers'}
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <PulseDisplayCard
                  eyebrow="What feels heaviest right now?"
                  body={latestQualitative.biggestStress || 'No stress note submitted yet.'}
                />
                <PulseDisplayCard
                  eyebrow="What do you already know you need to do?"
                  body={latestQualitative.gutAction || 'No gut-action note submitted yet.'}
                />
                <PulseDisplayCard
                  eyebrow="Best business win this month"
                  body={latestQualitative.biggestBusinessWin || 'No business win submitted yet.'}
                />
                <PulseDisplayCard
                  eyebrow="Best personal win this month"
                  body={latestQualitative.biggestPersonalWin || 'No personal win submitted yet.'}
                />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {(attackItems.length > 0 ? attackItems : ['No attack items submitted yet.']).map((item, index) => (
                  <div key={`${item}-${index}`} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top {index + 1}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-border/60 bg-muted/15 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-semibold">Month-over-month trend board</h3>
                  <p className="text-sm text-muted-foreground">
                    {previousPulse ? `${labelForPeriod(latestPulse!)} vs ${labelForPeriod(previousPulse)}` : 'Submit another pulse to unlock comparison trends.'}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {pulseTrends.map((trend) => {
                  const up = typeof trend.delta.abs === 'number' ? trend.delta.abs > 0 : false;
                  const down = typeof trend.delta.abs === 'number' ? trend.delta.abs < 0 : false;
                  const TrendIcon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
                  const colorClass = up ? 'text-emerald-600 dark:text-emerald-300' : down ? 'text-rose-600 dark:text-rose-300' : 'text-muted-foreground';
                  const currentValue = trend.currency ? formatCurrency(trend.current) : formatNumber(trend.current);
                  const deltaValue =
                    typeof trend.delta.abs === 'number'
                      ? trend.currency
                        ? formatCurrency(trend.delta.abs)
                        : formatNumber(trend.delta.abs)
                      : 'No previous period';

                  return (
                    <div key={trend.label} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                      <p className="text-sm text-muted-foreground">{trend.label}</p>
                      <p className="mt-2 text-2xl font-semibold">{currentValue}</p>
                      <div className={`mt-3 flex items-center gap-2 text-sm ${colorClass}`}>
                        <TrendIcon className="h-4 w-4" />
                        <span>{deltaValue}</span>
                        {typeof trend.delta.pct === 'number' ? (
                          <span className="text-muted-foreground">
                            ({new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(trend.delta.pct)}%)
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );

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
                <h1 className="text-4xl font-black uppercase tracking-[0.2em] md:text-6xl">
                  Mission Control
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                  {heroSupportText}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {!isAdmin ? (
                  <Button
                    variant="outline"
                    className="border-foreground/15 bg-background/75"
                    onClick={() => setPulseEditorOpen(true)}
                  >
                    {latestPulse ? 'Update Pulse' : 'Start Pulse'}
                  </Button>
                ) : (
                  <Button variant="outline" className="border-foreground/15 bg-background/75" disabled>
                    Owner Updates Pulse
                  </Button>
                )}
                {isAdmin ? (
                  <Button className="bg-foreground text-background hover:bg-foreground/90" onClick={() => setDialogState('session')}>
                    <FileText className="mr-2 h-4 w-4" />
                    Capture Session
                  </Button>
                ) : null}
                <Button variant="outline" className="border-foreground/15 bg-background/75" onClick={() => setDialogState('commitment')} disabled={!latestSession}>
                  <Target className="mr-2 h-4 w-4" />
                  Add Commitment
                </Button>
                <Button variant="outline" className="border-foreground/15 bg-background/75" onClick={() => setDialogState('board')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Board Item
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-border/60 bg-background/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Step 1</p>
                <p className="mt-2 font-medium">Update Business Pulse</p>
                <p className="mt-1 text-sm text-muted-foreground">Owner fills out the pre-call boxes and numbers before the session.</p>
              </div>
              <div className="rounded-[22px] border border-border/60 bg-background/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Step 2</p>
                <p className="mt-2 font-medium">{stepTwoTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stepTwoBody}</p>
              </div>
              <div className="rounded-[22px] border border-border/60 bg-background/70 p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Step 3</p>
                <p className="mt-2 font-medium">{stepThreeTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stepThreeBody}</p>
              </div>
            </div>
          </div>
        </section>

        {businessPulseSection}

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
                <CardDescription>The latest conversation, the transcript memory, and the owner's real commitments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestSession ? (
                <div className="rounded-[24px] border border-border/60 bg-muted/30 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Latest session</p>
                      <h3 className="mt-1 line-clamp-2 text-xl font-semibold">{latestSession.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{latestSession.session_date}</Badge>
                      {isAdmin ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setDeleteSessionId(latestSession.id)}
                          aria-label="Delete latest session"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
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
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{session.session_date}</Badge>
                        {isAdmin ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setDeleteSessionId(session.id)}
                            aria-label={`Delete ${session.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
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

      <AlertDialog open={!!deleteSessionId} onOpenChange={(open) => !open && setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetSession
                ? `Delete "${deleteTargetSession.title}"? This also removes commitments, linked session attachments, and coach notes tied directly to this session.`
                : 'Delete this session? This also removes commitments, linked session attachments, and coach notes tied directly to it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteSessionId) return;
                await workspace.deleteSession.mutateAsync(deleteSessionId);
                setDeleteSessionId(null);
              }}
            >
              Delete session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function PulseMetricInputCard({
  label,
  value,
  onChange,
  icon: Icon,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: ComponentType<{ className?: string }>;
  placeholder?: string;
}) {
  return (
    <div className="rounded-[24px] border border-border/60 bg-background/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-3">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <Input
        className="mt-4 h-12 border-border/50 bg-background/90 text-lg font-semibold"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder={placeholder ?? '0'}
      />
    </div>
  );
}

function PulseReflectionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</Label>
      <Textarea
        rows={4}
        className="mt-2 bg-background/85"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type your answer here..."
      />
    </div>
  );
}

function PulseDisplayCard({
  eyebrow,
  body,
}: {
  eyebrow: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
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
