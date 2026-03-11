import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  type MissionControlBrainProfile,
  type MissionControlBrainProfileKey,
  useMissionControlBrainProfiles,
} from '@/hooks/useMissionControlBrainProfiles';
import { useMissionControlClients } from '@/hooks/useMissionControlClients';
import {
  type MissionAttachment,
  type MissionBrainMessage,
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
    title: 'Parking Lot',
    description: 'Ideas worth tracking, but not moving yet.',
    tone: 'border-stone-300/70 bg-stone-100/70 text-stone-900 dark:border-stone-700 dark:bg-stone-950/50 dark:text-stone-100',
  },
  {
    key: 'in_progress',
    title: 'In Motion',
    description: 'Priorities actively moving right now.',
    tone: 'border-amber-300/70 bg-amber-100/75 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100',
  },
  {
    key: 'before_next_call',
    title: 'Before Next Call',
    description: 'Needs to happen before the next review.',
    tone: 'border-emerald-300/70 bg-emerald-100/75 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-100',
  },
  {
    key: 'done',
    title: 'Completed',
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
  { value: 'not_started', label: 'Has not started yet' },
  { value: 'in_progress', label: 'Still moving' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'carried_forward', label: 'Move to next call' },
  { value: 'done', label: 'Completed' },
] as const;

const BOARD_STATUS_OPTIONS = [
  { value: 'backlog', label: 'Parking Lot' },
  { value: 'in_progress', label: 'In Motion' },
  { value: 'before_next_call', label: 'Before Next Call' },
  { value: 'done', label: 'Completed' },
] as const;

type AttachmentTargetKind = 'session' | 'commitment' | 'board';
type AttachmentDialogDefaults = {
  targetKind: AttachmentTargetKind;
  targetId: string;
  attachmentType: 'transcript' | 'proof' | 'reference' | 'artifact';
} | null;

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

interface CoachBrainMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  nextSteps?: string[];
  references?: string[];
  followUpQuestion?: string | null;
}

interface CoachBrainResponse {
  answer: string;
  next_steps: string[];
  references: string[];
  follow_up_question: string | null;
}

type WorkflowMode = 'prepare' | 'review' | 'execute';

function mapBrainMessage(message: MissionBrainMessage): CoachBrainMessage {
  return {
    id: message.id,
    role: message.role as 'user' | 'assistant',
    content: message.content,
    nextSteps: jsonArrayToLines(message.next_steps_json),
    references: jsonArrayToLines(message.references_json),
    followUpQuestion: message.follow_up_question,
  };
}

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

function parseFormattedNumber(value: string) {
  const normalized = value.replace(/[^0-9.-]/g, '');
  if (!normalized) return 0;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEditableNumber(value: number | undefined | null, maximumFractionDigits = 0) {
  if (value === null || value === undefined || value === 0) return '';
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(value);
}

function formatEditableCurrency(value: number | undefined | null) {
  if (value === null || value === undefined || value === 0) return '';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
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

function summarizePreviewText(value: string, limit = 420) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}...`;
}

async function readMissionControlTextFile(file: File) {
  const supportedExtensions = ['.md', '.txt'];
  const lowerName = file.name.toLowerCase();
  const isSupported = supportedExtensions.some((extension) => lowerName.endsWith(extension));

  if (!isSupported) {
    throw new Error('Use a .md or .txt file.');
  }

  if (file.size > 2_000_000) {
    throw new Error('Keep imported files under 2 MB.');
  }

  const content = await file.text();
  if (!content.trim()) {
    throw new Error('The selected file is empty.');
  }

  return content;
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
  toneClass,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  toneClass?: string;
}) {
  return (
    <Card className={`rounded-[24px] border-border/60 bg-background/80 shadow-sm ${toneClass ?? ''}`}>
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
  const [attachmentDefaults, setAttachmentDefaults] = useState<AttachmentDialogDefaults>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [pulseEditorOpen, setPulseEditorOpen] = useState(false);
  const [pulseAdvancedOpen, setPulseAdvancedOpen] = useState(false);
  const [clientBrainOpen, setClientBrainOpen] = useState(false);
  const [historicalImportOpen, setHistoricalImportOpen] = useState(false);
  const [brainProfileEditor, setBrainProfileEditor] = useState<MissionControlBrainProfileKey | null>(null);
  const [coachBrainQuestion, setCoachBrainQuestion] = useState('');
  const [coachBrainPendingMessages, setCoachBrainPendingMessages] = useState<CoachBrainMessage[]>([]);
  const [activeMode, setActiveMode] = useState<WorkflowMode>('prepare');
  const [coachConsoleOpen, setCoachConsoleOpen] = useState(false);
  const pulseSectionRef = useRef<HTMLElement | null>(null);

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
  const brainProfiles = useMissionControlBrainProfiles(user?.id ?? null, isAdmin);
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

  useEffect(() => {
    setActiveMode(isAdmin ? 'review' : 'prepare');
  }, [isAdmin, selectedClient]);

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

  const scrollToPulseSection = () => {
    pulseSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openPulseEditor = () => {
    setPulseEditorOpen(true);
    window.setTimeout(() => {
      scrollToPulseSection();
    }, 80);
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
  const commitmentAttachmentMap = useMemo(() => {
    const next = new Map<string, LinkedMissionAttachment[]>();

    linkedAttachments.forEach((attachment) => {
      if (!attachment.commitment_id) return;
      next.set(attachment.commitment_id, [...(next.get(attachment.commitment_id) ?? []), attachment]);
    });

    return next;
  }, [linkedAttachments]);
  const verifiedEvidenceCount = useMemo(
    () =>
      workspace.commitments.filter((commitment) => {
        const linkedProofs = commitmentAttachmentMap.get(commitment.id) ?? [];
        return commitment.status === 'done' && linkedProofs.length > 0;
      }).length,
    [commitmentAttachmentMap, workspace.commitments]
  );
  const needsEvidenceCount = useMemo(
    () =>
      workspace.commitments.filter((commitment) => {
        const linkedProofs = commitmentAttachmentMap.get(commitment.id) ?? [];
        return commitment.status === 'done' && linkedProofs.length === 0;
      }).length,
    [commitmentAttachmentMap, workspace.commitments]
  );
  const clientBrainNote = useMemo(
    () =>
      workspace.coachNotes.find(
        (note) => note.session_id === null && note.title.trim().toLowerCase() === 'client brain'
      ) ?? null,
    [workspace.coachNotes]
  );
  const privateCoachNotes = useMemo(
    () =>
      workspace.coachNotes.filter((note) =>
        clientBrainNote ? note.id !== clientBrainNote.id : true
      ),
    [clientBrainNote, workspace.coachNotes]
  );
  const persistedCoachBrainMessages = useMemo(
    () => workspace.brainMessages.map((message) => mapBrainMessage(message)),
    [workspace.brainMessages]
  );
  const displayedCoachBrainMessages = useMemo(
    () => [...persistedCoachBrainMessages, ...coachBrainPendingMessages],
    [coachBrainPendingMessages, persistedCoachBrainMessages]
  );
  const coachBrainMutation = useMutation({
    mutationFn: async (payload: {
      question: string;
      conversation: Array<{ role: 'user' | 'assistant'; content: string }>;
    }) => {
      if (!ownerUserId) throw new Error('No workspace selected');

      const { data, error } = await supabase.functions.invoke('mission-control-coach-brain', {
        body: {
          owner_user_id: ownerUserId,
          question: payload.question,
          conversation: payload.conversation,
        },
      });

      if (error) {
        throw new Error(error.message || 'Coach Brain failed');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as CoachBrainResponse;
    },
    onError: (error) => {
      toast.error('Coach Brain could not answer', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
  const coachBrainStarters = useMemo(() => {
    const sessionPrompt = latestSession?.title
      ? `Based on ${latestSession.title}, what should this owner focus on before the next call?`
      : 'What should this owner focus on first right now?';

    const stressPrompt = latestQualitative.biggestStress
      ? `Coach me through the current blocker: ${latestQualitative.biggestStress}`
      : 'Where is execution slipping right now based on the current workspace?';

    return [
      sessionPrompt,
      stressPrompt,
      'What would Justin say is the next most important decision for this owner?',
    ];
  }, [latestQualitative.biggestStress, latestSession?.title]);

  const askCoachBrain = async (questionOverride?: string) => {
    const question = (questionOverride ?? coachBrainQuestion).trim();
    if (!question || coachBrainMutation.isPending) return;

    const userMessage: CoachBrainMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
    };

    const priorConversation = persistedCoachBrainMessages
      .slice(-6)
      .map((message) => ({ role: message.role, content: message.content }));

    setCoachBrainPendingMessages([userMessage]);
    setCoachBrainQuestion('');

    try {
      const response = await coachBrainMutation.mutateAsync({
        question,
        conversation: [...priorConversation, { role: 'user', content: question }],
      });

      const assistantMessage: CoachBrainMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        nextSteps: response.next_steps,
        references: response.references,
        followUpQuestion: response.follow_up_question,
      };

      setCoachBrainPendingMessages([userMessage, assistantMessage]);

      await workspace.createBrainMessages.mutateAsync([
        {
          role: 'user',
          content: question,
          next_steps_json: [],
          references_json: [],
          follow_up_question: null,
        },
        {
          role: 'assistant',
          content: response.answer,
          next_steps_json: response.next_steps,
          references_json: response.references,
          follow_up_question: response.follow_up_question,
        },
      ]);

      setCoachBrainPendingMessages([]);
    } catch {
      setCoachBrainPendingMessages([]);
    }
  };

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
      return `Priority · ${
        workspace.boardItems.find((item) => item.id === attachment.board_item_id)?.title ?? 'Priority'
      }`;
    }

    return 'Mission record';
  };

  const openAttachmentDialogForPromise = (commitmentId: string) => {
    setAttachmentDefaults({
      targetKind: 'commitment',
      targetId: commitmentId,
      attachmentType: 'proof',
    });
    setAttachmentOpen(true);
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
    ? 'Review the pulse. Capture the call. Keep promises and priorities moving.'
    : 'Update your pulse before the call, then use this workspace to stay on track between sessions.';
  const workflowModes: Array<{
    key: WorkflowMode;
    title: string;
    description: string;
    panelClass: string;
    activeClass: string;
    summaryTitle: string;
    summaryBody: string;
  }> = [
    {
      key: 'prepare',
      title: 'Prepare',
      description: 'Pulse, trends, and pre-call focus.',
      panelClass: 'border-emerald-400/25 bg-emerald-500/10',
      activeClass: 'border-emerald-400/30 bg-emerald-500 text-emerald-950',
      summaryTitle: 'Prep window is live',
      summaryBody: 'Scoreboard, focus answers, and trend context stay up front so the owner knows exactly how to prepare for the next call.',
    },
    {
      key: 'review',
      title: 'Review',
      description: 'Session memory and promise review.',
      panelClass: 'border-amber-400/25 bg-amber-500/10',
      activeClass: 'border-amber-400/30 bg-amber-400 text-amber-950',
      summaryTitle: 'Call memory comes first',
      summaryBody: 'This phase is for looking back at what happened, what was promised, and what the next session needs to verify.',
    },
    {
      key: 'execute',
      title: 'Execute',
      description: 'Promises, priorities, evidence, and Coach Brain.',
      panelClass: 'border-sky-400/25 bg-sky-500/10',
      activeClass: 'border-sky-400/30 bg-sky-400 text-sky-950',
      summaryTitle: 'Between-call execution',
      summaryBody: 'This phase keeps the work moving: open promises, bigger priorities, linked evidence, and the coaching brain between meetings.',
    },
  ];
  const activeWorkflowMode = workflowModes.find((mode) => mode.key === activeMode) ?? workflowModes[0];
  const phasePillClass =
    activeMode === 'prepare'
      ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200'
      : activeMode === 'review'
        ? 'border-amber-400/30 bg-amber-500/12 text-amber-700 dark:text-amber-200'
        : 'border-sky-400/30 bg-sky-500/12 text-sky-700 dark:text-sky-200';
  const modeSectionClass =
    activeMode === 'review'
      ? 'rounded-[32px] border border-amber-400/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(0,0,0,0))] p-4 md:p-5'
      : activeMode === 'execute'
        ? 'rounded-[32px] border border-sky-400/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.08),rgba(0,0,0,0))] p-4 md:p-5'
        : '';
  const workflowGridClass =
    activeMode === 'review'
      ? isAdmin
        ? 'grid gap-6 xl:grid-cols-2 2xl:grid-cols-[minmax(320px,0.92fr)_minmax(380px,1.08fr)_minmax(360px,0.96fr)]'
        : 'grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]'
      : isAdmin
        ? 'grid gap-6 xl:grid-cols-2 2xl:grid-cols-[minmax(320px,0.92fr)_minmax(380px,1.08fr)_minmax(360px,0.96fr)]'
        : 'grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]';
  const executeSummaryTone = 'border-sky-400/20 bg-sky-500/10';

  const businessPulseSection = (
    <section ref={pulseSectionRef} className="rounded-[32px] border border-border/60 bg-background/82 p-6 shadow-sm">
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
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Prepare for the next coaching call</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              The owner ritual lives here now: update the scoreboard, surface what feels heavy, and walk into the call with a clean monthly frame.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/8 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Target window</p>
              <p className="mt-2 text-lg font-semibold">{pulse.targetPeriod.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">This is the prep period that feeds the next call.</p>
            </div>
            <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/8 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Prep status</p>
              <p className="mt-2 text-lg font-semibold">{pulseCompletionLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{pulseCompletion}/14 core fields currently filled in the live draft.</p>
            </div>
            <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/8 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Trend source</p>
              <p className="mt-2 text-lg font-semibold">{latestPulse ? labelForPeriod(latestPulse) : 'No saved pulse yet'}</p>
              <p className="mt-1 text-sm text-muted-foreground">Month-over-month compares against the last saved pulse, not the unsaved draft.</p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[420px] rounded-[28px] border border-emerald-400/20 bg-[linear-gradient(160deg,rgba(236,253,245,0.88),rgba(209,250,229,0.35))] p-5 dark:bg-[linear-gradient(160deg,rgba(14,36,29,0.96),rgba(8,18,15,0.96))]">
          <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">Owner prep</p>
          <h3 className="mt-3 text-xl font-semibold">Update the numbers. Clarify the call.</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This replaces the old submit detour. Owners update the pulse here, coaches read it before the call, and the month-over-month board stays intact.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {!isAdmin ? (
              <>
                <Button
                  className="bg-foreground text-background hover:bg-foreground/90"
                  onClick={() => {
                    if (pulseEditorOpen) {
                      setPulseEditorOpen(false);
                      return;
                    }
                    openPulseEditor();
                  }}
                >
                  {pulseEditorOpen ? 'Close 1:1 meeting pulse' : 'Open 1:1 meeting pulse'}
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
              <div className="rounded-2xl border border-emerald-400/20 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
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
                <div className="rounded-2xl border border-emerald-400/20 bg-background/80 px-4 py-3 text-sm">
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
                  value={formatEditableCurrency(pulseDraft.sales.premium)}
                  kind="currency"
                  onChange={(value) =>
                    updatePulseSection('sales', (current) => ({
                      ...current,
                      premium: parseFormattedNumber(value),
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Items Sold"
                  icon={Package}
                  value={formatEditableNumber(pulseDraft.sales.items)}
                  onChange={(value) =>
                    updatePulseSection('sales', (current) => ({
                      ...current,
                      items: Math.trunc(parseFormattedNumber(value)),
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Policies Sold"
                  icon={ClipboardList}
                  value={formatEditableNumber(pulseDraft.sales.policies)}
                  onChange={(value) =>
                    updatePulseSection('sales', (current) => ({
                      ...current,
                      policies: Math.trunc(parseFormattedNumber(value)),
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Policies Quoted"
                  icon={Users}
                  value={formatEditableNumber(pulseDraft.marketing.policiesQuoted)}
                  onChange={(value) =>
                    updatePulseSection('marketing', (current) => ({
                      ...current,
                      policiesQuoted: Math.trunc(parseFormattedNumber(value)),
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Marketing Spend"
                  icon={Target}
                  value={formatEditableCurrency(pulseDraft.marketing.totalSpend)}
                  kind="currency"
                  onChange={(value) =>
                    updatePulseSection('marketing', (current) => ({
                      ...current,
                      totalSpend: parseFormattedNumber(value),
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Compensation"
                  icon={Trophy}
                  value={formatEditableCurrency(pulseDraft.cashFlow.compensation)}
                  kind="currency"
                  onChange={(value) =>
                    updatePulseSection('cashFlow', (current) => ({
                      ...current,
                      compensation: parseFormattedNumber(value),
                      netProfit: parseFormattedNumber(value) - current.expenses,
                    }))
                  }
                />
                <PulseMetricInputCard
                  label="Expenses"
                  icon={BriefcaseBusiness}
                  value={formatEditableCurrency(pulseDraft.cashFlow.expenses)}
                  kind="currency"
                  onChange={(value) =>
                    updatePulseSection('cashFlow', (current) => ({
                      ...current,
                      expenses: parseFormattedNumber(value),
                      netProfit: current.compensation - parseFormattedNumber(value),
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
                <div className="rounded-[24px] border border-emerald-400/20 bg-background/82 p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
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

                <div className="rounded-[24px] border border-emerald-400/20 bg-background/82 p-5">
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

              <div className="mt-5 rounded-[24px] border border-emerald-400/16 bg-background/80 p-5">
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
                        value={formatEditableNumber(pulseDraft.retention.currentRetentionPercent, 1)}
                        onChange={(value) =>
                          updatePulseSection('retention', (current) => ({
                            ...current,
                            currentRetentionPercent: parseFormattedNumber(value),
                          }))
                        }
                      />
                      <PulseMetricInputCard
                        label="Policies Terminated"
                        icon={AlertTriangle}
                        value={formatEditableNumber(pulseDraft.retention.numberTerminated)}
                        onChange={(value) =>
                          updatePulseSection('retention', (current) => ({
                            ...current,
                            numberTerminated: Math.trunc(parseFormattedNumber(value)),
                          }))
                        }
                      />
                      <PulseMetricInputCard
                        label="ALR Total YTD"
                        icon={DollarSign}
                        value={formatEditableCurrency(pulseDraft.operations.currentAlrTotal)}
                        kind="currency"
                        onChange={(value) =>
                          updatePulseSection('operations', (current) => ({
                            ...current,
                            currentAlrTotal: parseFormattedNumber(value),
                          }))
                        }
                      />
                      <PulseMetricInputCard
                        label="Bonus Trend"
                        icon={TrendingUp}
                        value={formatEditableNumber(pulseDraft.operations.currentBonusTrend)}
                        onChange={(value) =>
                          updatePulseSection('operations', (current) => ({
                            ...current,
                            currentBonusTrend: parseFormattedNumber(value),
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
                                  value={formatEditableCurrency(source.spend)}
                                  onChange={(event) =>
                                    updatePulseSection('marketing', (current) => ({
                                      ...current,
                                      leadSources: current.leadSources.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, spend: parseFormattedNumber(event.target.value) } : entry
                                      ),
                                    }))
                                  }
                                  placeholder="Spend"
                                />
                                <Input
                                  value={formatEditableCurrency(source.soldPremium)}
                                  onChange={(event) =>
                                    updatePulseSection('marketing', (current) => ({
                                      ...current,
                                      leadSources: current.leadSources.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, soldPremium: parseFormattedNumber(event.target.value) } : entry
                                      ),
                                    }))
                                  }
                                  placeholder="Sold premium"
                                />
                                <div className="flex gap-2">
                                  <Input
                                    value={formatEditableNumber(source.commissionRate, 1)}
                                    onChange={(event) =>
                                      updatePulseSection('marketing', (current) => ({
                                        ...current,
                                        leadSources: current.leadSources.map((entry, entryIndex) =>
                                          entryIndex === index ? { ...entry, commissionRate: parseFormattedNumber(event.target.value) } : entry
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
          <div className="relative space-y-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-foreground/15 bg-background/70 px-3 py-1 text-[11px] uppercase tracking-[0.24em]">
                Agency Mission Control
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

            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[clamp(1.1rem,2.3vw,1.7rem)] font-semibold uppercase leading-none tracking-[0.28em] text-foreground/70">
                  Agency
                </p>
                <h1 className="w-full text-[clamp(4.1rem,12vw,9rem)] font-black uppercase leading-[0.88] tracking-[0.13em] text-foreground">
                  Mission
                  <span className="block">Control</span>
                </h1>
              </div>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-[1.1rem]">
                  {heroSupportText}
                </p>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                {!isAdmin ? (
                  <Button
                    variant="outline"
                    className="min-w-[240px] border-foreground/15 bg-background/75"
                    onClick={() => {
                      setActiveMode('prepare');
                      openPulseEditor();
                    }}
                  >
                    Open 1:1 Meeting Pulse
                  </Button>
                ) : (
                  <Button variant="outline" className="min-w-[240px] border-foreground/15 bg-background/75" disabled>
                    Owner Updates Pulse
                  </Button>
                )}
                {isAdmin ? (
                  <Button
                    className="min-w-[220px] bg-foreground text-background hover:bg-foreground/90"
                    onClick={() => {
                      setActiveMode('review');
                      setDialogState('session');
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Capture Session
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="min-w-[220px] border-foreground/15 bg-background/75"
                  onClick={() => {
                    setActiveMode('execute');
                    setDialogState('commitment');
                  }}
                  disabled={!latestSession}
                >
                  <Target className="mr-2 h-4 w-4" />
                  Add Commitment
                </Button>
                <Button
                  variant="outline"
                  className="min-w-[220px] border-foreground/15 bg-background/75"
                  onClick={() => {
                    setActiveMode('execute');
                    setDialogState('board');
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Priority
                </Button>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/60 bg-background/55 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Active phase</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isAdmin
                      ? 'Operator view for the current stage of the coaching cycle.'
                      : 'Only the information that matters for this stage of the relationship.'}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {workflowModes.map((mode) => (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => setActiveMode(mode.key)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          activeMode === mode.key
                            ? mode.activeClass
                            : 'border-border/60 bg-background/70 text-foreground hover:bg-background'
                        }`}
                      >
                        <p className={`text-sm font-semibold ${activeMode === mode.key ? 'text-current' : 'text-foreground'}`}>
                          {mode.title}
                        </p>
                        <p className={`mt-1 text-xs leading-5 ${activeMode === mode.key ? 'text-current/80' : 'text-muted-foreground'}`}>
                          {mode.description}
                        </p>
                      </button>
                    ))}
                  </div>
                  {isAdmin ? (
                    <Button
                      variant="outline"
                      className="border-foreground/15 bg-background/75"
                      onClick={() => setCoachConsoleOpen(true)}
                    >
                      <Bot className="mr-2 h-4 w-4" />
                      Coach Console
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className={`mt-4 rounded-[22px] border px-4 py-4 ${activeWorkflowMode.panelClass}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={phasePillClass}>
                    {activeWorkflowMode.title}
                  </Badge>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Phase focus</p>
                </div>
                <p className="mt-2 text-lg font-semibold">{activeWorkflowMode.summaryTitle}</p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{activeWorkflowMode.summaryBody}</p>
              </div>
            </div>
          </div>
        </section>

        {activeMode === 'prepare' ? businessPulseSection : null}

        {activeMode === 'execute' ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard icon={ClipboardList} label="Promises Still Open" value={String(openCommitments.length)} detail="Items still waiting on action, proof, or review." toneClass={executeSummaryTone} />
            <SummaryCard icon={CalendarDays} label="Last Session" value={latestSession ? latestSession.session_date : 'None'} detail="Most recent coaching session preserved in the timeline." toneClass={executeSummaryTone} />
            <SummaryCard icon={Rocket} label="Active Priorities" value={String(workspace.boardItems.length)} detail="Bigger initiatives tracked between calls." toneClass={executeSummaryTone} />
            {isAdmin ? (
              <SummaryCard icon={CheckCircle2} label="Verified With Evidence" value={String(verifiedEvidenceCount)} detail="Completed promises that have supporting evidence linked." toneClass={executeSummaryTone} />
            ) : null}
            {isAdmin ? (
              <SummaryCard icon={Paperclip} label="Needs Evidence" value={String(needsEvidenceCount)} detail="Completed promises that still need screenshots, proof, or artifacts." toneClass={executeSummaryTone} />
            ) : null}
          </section>
        ) : null}

        {activeMode !== 'prepare' ? (
        <section className={modeSectionClass}>
        <div className={workflowGridClass}>
          <div className={`space-y-6 ${activeMode === 'execute' ? 'hidden 2xl:hidden' : ''}`}>
            {activeMode === 'review' ? (
            <Card className="rounded-[28px] border-amber-400/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.06),rgba(0,0,0,0))]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Last Session Memory
                </CardTitle>
                <CardDescription>What happened on the most recent call, what mattered, and what now feeds accountability.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestSession ? (
                <div className="rounded-[24px] border border-border/60 bg-muted/30 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Most recent coaching session</p>
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
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top 3 promises from the call</p>
                      <ul className="mt-2 space-y-1 text-sm">
                        {(topCommitments.length > 0 ? topCommitments : ['No top promises logged yet.']).map((point) => (
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
            ) : null}

            {activeMode === 'review' && isAdmin ? (
            <Card className="rounded-[28px] border-amber-400/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.06),rgba(0,0,0,0))]">
              <CardHeader>
                <CardTitle>Session Timeline</CardTitle>
                <CardDescription>Past calls stay visible so you can compare what was said then to what was reviewed later.</CardDescription>
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
            ) : null}
          </div>

          <div className="space-y-6">
            <Card className={`rounded-[28px] ${activeMode === 'review' ? 'border-amber-400/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.06),rgba(0,0,0,0))]' : 'border-sky-400/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.06),rgba(0,0,0,0))]'}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>Commitment Tracker</span>
                  <Button size="sm" variant="outline" onClick={() => setDialogState('commitment')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Promise
                  </Button>
                </CardTitle>
                <CardDescription>What the owner said would get done, and what the next call verified actually happened.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAdmin ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step A</p>
                      <p className="mt-2 font-medium">Promise gets captured</p>
                      <p className="mt-1 text-sm text-muted-foreground">This is created from a session or added manually if it needs to be tracked.</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step B</p>
                      <p className="mt-2 font-medium">Next call verifies it</p>
                      <p className="mt-1 text-sm text-muted-foreground">At the next session, you mark it completed, blocked, moved to next call, or still moving.</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    Open promises stay here until a later session marks them completed, blocked, or moved to the next call.
                  </div>
                )}
                {workspace.commitments.length > 0 ? workspace.commitments.map((commitment) => {
                  const linkedProofs = commitmentAttachmentMap.get(commitment.id) ?? [];
                  const sourceSession = workspace.sessions.find((session) => session.id === commitment.session_id);
                  const reviewedSession = commitment.reviewed_in_session_id
                    ? workspace.sessions.find((session) => session.id === commitment.reviewed_in_session_id)
                    : null;
                  const evidenceLabel =
                    linkedProofs.length > 0
                      ? commitment.status === 'done'
                        ? 'Verified with evidence'
                        : 'Evidence linked'
                      : commitment.status === 'done'
                        ? 'Completed, needs evidence'
                        : 'No evidence linked yet';
                  const evidenceTone =
                    linkedProofs.length > 0
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : commitment.status === 'done'
                        ? 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'border-stone-300/70 bg-stone-500/10 text-stone-700 dark:text-stone-300';

                  return (
                    <div key={commitment.id} className="rounded-[22px] border border-border/60 bg-muted/25 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{commitment.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{commitment.description || 'No supporting note added.'}</p>
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
                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                      <div className="rounded-2xl border border-border/60 bg-background/75 p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last call said</p>
                        <p className="mt-2">{sourceSession ? `${sourceSession.title}${commitment.due_date ? ` • due ${formatDateLabel(commitment.due_date)}` : ''}` : 'No source session linked'}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/75 p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">This call verified</p>
                        <p className="mt-2">{reviewedSession ? `${reviewedSession.title} • ${COMMITMENT_STATUS_OPTIONS.find((option) => option.value === commitment.status)?.label ?? commitment.status}` : 'Not reviewed on a later session yet'}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-border/60 bg-background/75 p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current outcome</p>
                        <p className="mt-2">{COMMITMENT_STATUS_OPTIONS.find((option) => option.value === commitment.status)?.label ?? commitment.status}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/75 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Evidence or notes</p>
                          <Badge variant="outline" className={evidenceTone}>
                            {evidenceLabel}
                          </Badge>
                        </div>
                        <p className="mt-2">{commitment.proof_notes || 'Add a note or link evidence when this promise is completed.'}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {linkedProofs.length > 0 ? (
                            linkedProofs.map((attachment) => (
                              <Badge key={attachment.id} variant="outline" className="max-w-full truncate">
                                {attachment.upload?.original_name ?? 'Linked file'}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No uploaded evidence linked yet.</span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openAttachmentDialogForPromise(commitment.id)}
                            disabled={workspace.uploads.length === 0}
                          >
                            <Paperclip className="mr-2 h-4 w-4" />
                            {linkedProofs.length > 0 ? 'Link more evidence' : 'Link evidence'}
                          </Button>
                          {workspace.uploads.length === 0 ? (
                            <Button type="button" size="sm" variant="outline" asChild>
                              <Link to="/uploads">
                                <Upload className="mr-2 h-4 w-4" />
                                Open files
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    </div>
                  );
                }) : (
                  <EmptyState
                    icon={Target}
                    title="No promises in motion"
                    body="Capture what the owner said would get done so the next call can verify what actually happened."
                    actionLabel="Add promise"
                    onAction={() => setDialogState('commitment')}
                  />
                )}
              </CardContent>
            </Card>

            {activeMode === 'execute' ? (
            <Card className="rounded-[28px] border-sky-400/20 bg-background/88">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>Priority Board</span>
                  <Button size="sm" variant="outline" onClick={() => setDialogState('board')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Priority
                  </Button>
                </CardTitle>
                <CardDescription>Bigger initiatives that stay visible between calls, separate from the one-call promises above.</CardDescription>
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
            ) : null}
          </div>

          {isAdmin || activeMode === 'execute' ? (
          <div className={`space-y-6 xl:col-span-2 xl:grid xl:grid-cols-2 xl:gap-6 xl:space-y-0 2xl:col-span-1 2xl:block 2xl:space-y-6 ${activeMode === 'review' ? 'xl:grid-cols-1' : ''}`}>
            {isAdmin ? (
            <Card className={`rounded-[28px] ${activeMode === 'review' ? 'border-amber-400/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.06),rgba(0,0,0,0))]' : 'border-sky-400/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.06),rgba(0,0,0,0))]'}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Wins + Blockers
                </CardTitle>
                <CardDescription>The latest wins and the main things still causing drag in the business.</CardDescription>
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
            ) : null}

            {activeMode === 'execute' ? (
            <Card className="rounded-[28px] border-sky-400/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.06),rgba(0,0,0,0))]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Coach Brain
                </CardTitle>
                <CardDescription>{isAdmin ? 'Ask questions between calls and get answers grounded in your voice, doctrine, client memory, sessions, promises, priorities, and linked evidence.' : 'Ask for help with the next decision, blocker, promise, or priority using the context already inside this workspace.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAdmin ? (
                  <div className="flex flex-wrap gap-2">
                    {['Justin Voice', 'Standard Doctrine', 'Client Brain', 'Session memory', 'Promise history', 'Priority context', 'Linked evidence'].map((chip) => (
                      <Badge key={chip} variant="outline">
                        {chip}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {isAdmin && (!brainProfiles.voiceProfile || !brainProfiles.doctrineProfile) ? (
                  <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                    Coach Brain will work without the global voice/doctrine docs, but it will feel much more like you once both are filled in.
                  </div>
                ) : null}
                <div className="space-y-3">
                  {displayedCoachBrainMessages.length > 0 ? (
                    displayedCoachBrainMessages.map((message) => (
                      <CoachBrainMessageCard key={message.id} message={message} />
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-border/60 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                      Ask a direct coaching question. Coach Brain answers from this client’s memory instead of giving generic advice.
                    </div>
                  )}
                  {coachBrainMutation.isPending ? (
                    <div className="rounded-[20px] border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Coach Brain is thinking through the workspace context...
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3 rounded-[24px] border border-border/60 bg-muted/20 p-4">
                  <div className="flex flex-wrap gap-2">
                    {coachBrainStarters.map((starter) => (
                      <Button
                        key={starter}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-auto whitespace-normal text-left"
                        onClick={() => askCoachBrain(starter)}
                        disabled={coachBrainMutation.isPending || !ownerUserId}
                      >
                        {starter}
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coach-brain-question">Ask Coach Brain</Label>
                    <Textarea
                      id="coach-brain-question"
                      rows={4}
                      value={coachBrainQuestion}
                      onChange={(event) => setCoachBrainQuestion(event.target.value)}
                      placeholder={
                        isAdmin
                          ? 'Ask how Justin would coach this client next, where execution is slipping, or what should be prioritized before the next call.'
                          : 'Ask for help with your current blocker, what to focus on next, or how to move a promise or priority forward.'
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="sm:flex-1"
                      onClick={() => askCoachBrain()}
                      disabled={coachBrainMutation.isPending || !coachBrainQuestion.trim() || !ownerUserId}
                    >
                      {coachBrainMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="mr-2 h-4 w-4" />
                      )}
                      Ask Coach Brain
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:flex-1"
                      onClick={() => setCoachBrainPendingMessages([])}
                      disabled={coachBrainMutation.isPending || displayedCoachBrainMessages.length === 0}
                    >
                      Start fresh question
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            ) : null}

            {activeMode === 'execute' && isAdmin ? (
            <Card className="rounded-[28px] border-sky-400/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.06),rgba(0,0,0,0))] xl:col-span-2 2xl:col-span-1">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-5 w-5 text-primary" />
                    Linked Evidence
                  </CardTitle>
                <CardDescription>Link transcripts, screenshots, and supporting files back to the exact session, promise, or priority they support.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Files already linked</p>
                    <p className="mt-2 text-3xl font-semibold">{linkedAttachments.length}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Files already tied to sessions, promises, or priorities.</p>
                  </div>
                  <div className="rounded-[22px] border border-border/60 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Files ready to link</p>
                    <p className="mt-2 text-3xl font-semibold">{workspace.uploads.length}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Owner and coach uploads ready to be connected to this workspace.</p>
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
                    No evidence linked yet. Upload files in the Files area, then connect them here to the session,
                    promise, or priority they support.
                  </div>
                )}

                {workspace.uploads.length > 0 && (
                  <div className="rounded-[22px] border border-border/60 bg-background/75 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Recent files ready to link</p>
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
            ) : null}
          </div>
          ) : null}
        </div>
        </section>
        ) : null}

      </main>

      <Dialog open={coachConsoleOpen} onOpenChange={setCoachConsoleOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Coach Console</DialogTitle>
            <DialogDescription>
              Private operator tools for shaping the brain, seeding historical memory, and keeping coaching context off the owner-facing surface.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-border/60 bg-background/82 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Brain Setup</p>
                  <h3 className="mt-2 text-xl font-semibold">Global coaching layers</h3>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    These two documents shape how Coach Brain sounds and what it teaches before client-specific memory gets layered on top.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  Voice + doctrine are shared across every client workspace.
                </div>
              </div>
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <BrainProfileCard
                  title="Justin Voice"
                  body={brainProfiles.voiceProfile?.body ?? ''}
                  helper="Tone, pressure, empathy, directness, and coaching boundaries."
                  buttonLabel={brainProfiles.voiceProfile ? 'Edit' : 'Start'}
                  onEdit={() => setBrainProfileEditor('justin_voice')}
                />
                <BrainProfileCard
                  title="Standard Doctrine"
                  body={brainProfiles.doctrineProfile?.body ?? ''}
                  helper="Frameworks, principles, sequencing, and Standard operating doctrine."
                  buttonLabel={brainProfiles.doctrineProfile ? 'Edit' : 'Start'}
                  onEdit={() => setBrainProfileEditor('standard_doctrine')}
                />
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <Card className="rounded-[28px] border-border/60 bg-background/82">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span>Client Brain</span>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setHistoricalImportOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Import historical memory
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setClientBrainOpen(true)}>
                        <FileText className="mr-2 h-4 w-4" />
                        {clientBrainNote ? 'Edit Client Brain' : 'Start Client Brain'}
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Durable client-specific memory: business model, recurring blockers, team context, red flags, language, and what has already been tried.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-[24px] border border-border/60 bg-muted/20 p-4">
                    {clientBrainNote ? (
                      <>
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant="outline">Preview only</Badge>
                          <Badge variant="outline">Coach only</Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {summarizePreviewText(clientBrainNote.note_body, 520)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">
                        No client brain saved yet. Start with the business model, team context, recurring issues, and the strategies already recommended so Coach Brain is not starting cold.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-border/60 bg-background/82">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span>Private Coach Notes</span>
                    <Button size="sm" variant="outline" onClick={() => setCoachNoteOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add note
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Private prep, observations, and follow-up notes that should never appear in the owner’s workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {privateCoachNotes.length > 0 ? privateCoachNotes.slice(0, 6).map((note) => (
                    <div key={note.id} className="rounded-[22px] border border-border/60 bg-muted/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{note.title || 'Coach note'}</p>
                        <Badge variant="outline">
                          {note.session_id
                            ? workspace.sessions.find((session) => session.id === note.session_id)?.title ?? 'Linked session'
                            : 'Standalone note'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {summarizePreviewText(note.note_body, 220)}
                      </p>
                    </div>
                  )) : (
                    <div className="rounded-[24px] border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                      No private coach notes yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </DialogContent>
      </Dialog>

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
                ? 'Capture coach session'
                : dialogState === 'commitment'
                  ? 'Add promise'
                : 'Add priority'}
            </DialogTitle>
            <DialogDescription>
              {dialogState === 'session'
                ? 'Paste the transcript, draft the session memory, review prior promises, and save the new accountability record.'
                : dialogState === 'commitment'
                  ? 'Capture one clear promise that should be reviewed on the next call.'
                  : 'Track a bigger initiative that stays in motion between calls.'}
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

      <Dialog open={clientBrainOpen} onOpenChange={setClientBrainOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{clientBrainNote ? 'Edit client brain' : 'Start client brain'}</DialogTitle>
            <DialogDescription>
              Keep one durable markdown-style context note for this client so strategies, recurring patterns, and historical context do not get lost.
            </DialogDescription>
          </DialogHeader>
          <ClientBrainDialog
            existingNote={clientBrainNote}
            isSaving={workspace.createCoachNote.isPending || workspace.updateCoachNote.isPending}
            onSubmit={async (payload) => {
              if (clientBrainNote) {
                await workspace.updateCoachNote.mutateAsync({
                  id: clientBrainNote.id,
                  updates: {
                    note_body: payload.note_body,
                    title: payload.title,
                  },
                });
              } else {
                await workspace.createCoachNote.mutateAsync(payload);
              }
              setClientBrainOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={historicalImportOpen} onOpenChange={setHistoricalImportOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import historical memory</DialogTitle>
            <DialogDescription>
              Paste old transcripts, strategy notes, or context and decide whether they should become a dated session in memory or be added to the coach-only client brain.
            </DialogDescription>
          </DialogHeader>
          <HistoricalMemoryImportDialog
            existingBrain={clientBrainNote}
            isSaving={
              workspace.createSession.isPending ||
              workspace.createCoachNote.isPending ||
              workspace.updateCoachNote.isPending
            }
            onImportAsSession={async (payload) => {
              await workspace.createSession.mutateAsync(payload);
            }}
            onImportToBrain={async (payload) => {
              if (clientBrainNote) {
                await workspace.updateCoachNote.mutateAsync({
                  id: clientBrainNote.id,
                  updates: {
                    note_body: payload.note_body,
                    title: 'Client Brain',
                  },
                });
              } else {
                await workspace.createCoachNote.mutateAsync({
                  title: 'Client Brain',
                  note_body: payload.note_body,
                  session_id: null,
                });
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!brainProfileEditor} onOpenChange={(open) => !open && setBrainProfileEditor(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{brainProfileEditor === 'justin_voice' ? 'Edit Justin Voice' : 'Edit Standard Doctrine'}</DialogTitle>
            <DialogDescription>
              {brainProfileEditor === 'justin_voice'
                ? 'Define how the coach brain should sound when it represents you: tone, directness, pressure, empathy, and coaching boundaries.'
                : 'Define the frameworks, principles, and decision logic that should make the brain feel like Standard.'}
            </DialogDescription>
          </DialogHeader>
          {brainProfileEditor ? (
            <BrainProfileDialog
              profileKey={brainProfileEditor}
              existingProfile={
                brainProfileEditor === 'justin_voice'
                  ? brainProfiles.voiceProfile
                  : brainProfiles.doctrineProfile
              }
              isSaving={brainProfiles.saveProfile.isPending}
              onSubmit={async (payload) => {
                await brainProfiles.saveProfile.mutateAsync(payload);
                setBrainProfileEditor(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={attachmentOpen}
        onOpenChange={(open) => {
          setAttachmentOpen(open);
          if (!open) setAttachmentDefaults(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Link upload</DialogTitle>
            <DialogDescription>Attach an existing uploaded file to the specific session, promise, or priority it supports.</DialogDescription>
          </DialogHeader>
          <AttachmentDialog
            uploads={workspace.uploads}
            sessions={workspace.sessions}
            commitments={workspace.commitments}
            boardItems={workspace.boardItems}
            defaults={attachmentDefaults}
            isSaving={workspace.createAttachment.isPending}
            onSubmit={async (payload) => {
              await workspace.createAttachment.mutateAsync(payload);
              setAttachmentDefaults(null);
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
  kind,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: ComponentType<{ className?: string }>;
  kind?: 'currency' | 'number';
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
        placeholder={placeholder ?? (kind === 'currency' ? '$0' : '0')}
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

function CoachBrainMessageCard({
  message,
}: {
  message: CoachBrainMessage;
}) {
  if (message.role === 'user') {
    return (
      <div className="rounded-[22px] border border-border/60 bg-muted/20 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">You asked</p>
        <p className="mt-2 text-sm leading-6">{message.content}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-border/60 bg-background/80 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Coach Brain</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{message.content}</p>

      {message.nextSteps && message.nextSteps.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next steps</p>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {message.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {message.references && message.references.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Grounded in</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {message.references.map((reference) => (
              <Badge key={reference} variant="outline">
                {reference}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {message.followUpQuestion ? (
        <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Follow-up:</span> {message.followUpQuestion}
        </div>
      ) : null}
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
  const [importedTranscriptFileName, setImportedTranscriptFileName] = useState('');
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

  const importTranscriptFile = async (file: File | null) => {
    if (!file) return;

    try {
      const content = await readMissionControlTextFile(file);
      setTranscript(content);
      setImportedTranscriptFileName(file.name);
      toast.success('Transcript imported', {
        description: `${file.name} was loaded into the session transcript field.`,
      });
    } catch (error) {
      toast.error('Could not import transcript file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Step 1</p>
          <p className="mt-2 font-medium">Load transcript</p>
          <p className="mt-1 text-sm text-muted-foreground">Paste the transcript or import a `.txt` / `.md` file from the session.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Step 2</p>
          <p className="mt-2 font-medium">Draft the session</p>
          <p className="mt-1 text-sm text-muted-foreground">Use AI to draft the summary, wins, issues, and top 3 promises.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Step 3</p>
          <p className="mt-2 font-medium">Review last call</p>
          <p className="mt-1 text-sm text-muted-foreground">Mark prior promises completed, blocked, moved to next call, or still moving.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Step 4</p>
          <p className="mt-2 font-medium">Save session</p>
          <p className="mt-1 text-sm text-muted-foreground">This stores the call memory and updates accountability for the next call.</p>
        </div>
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
              Paste the raw transcript or import a transcript file here. This becomes the source memory for the session.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild type="button" variant="outline">
              <label htmlFor="mission-session-transcript-file" className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Import transcript file
              </label>
            </Button>
            <Input
              id="mission-session-transcript-file"
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0] ?? null;
                await importTranscriptFile(file);
                event.currentTarget.value = '';
              }}
            />
            <Button type="button" variant="outline" onClick={handleGenerateFromTranscript} disabled={!canGenerateFromTranscript}>
              {draftMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {draftMutation.isPending ? 'Generating draft...' : 'Generate AI draft'}
            </Button>
          </div>
        </div>
        {importedTranscriptFileName ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Loaded transcript file: <span className="font-medium text-foreground">{importedTranscriptFileName}</span>
          </div>
        ) : null}
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
            <p className="text-sm font-medium">What this session will create</p>
            <p className="text-xs text-muted-foreground">This is the memory and promise handoff that will land in Mission Control after save.</p>
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
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top 3 promises</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {linesToJson(topThree).slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
              {!linesToJson(topThree).length && (
                <li>No promises drafted yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium">Turn the top 3 into tracked promises</p>
            <p className="text-xs text-muted-foreground">
              Save this session and turn the drafted top 3 into tracked promises automatically.
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
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Will create on save</p>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {draftedCommitments.length > 0 ? draftedCommitments.slice(0, 3).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            )) : (
              <li>No draft promises yet.</li>
            )}
          </ul>
          {autoCreateCommitments && nextCallDate ? (
            <p className="mt-3 text-xs text-muted-foreground">New promises will be due by {formatDateLabel(nextCallDate)}.</p>
          ) : null}
        </div>
      </div>
      {openCommitments.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Review what last call promised</p>
              <p className="text-xs text-muted-foreground">
                Close the loop on the prior promises before saving this new session.
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
                        <SelectItem value="done">Completed</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                        <SelectItem value="carried_forward">Move to next call</SelectItem>
                        <SelectItem value="in_progress">Still moving</SelectItem>
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
          <Label htmlFor="mission-session-top-three">Top 3 promises</Label>
          <Textarea id="mission-session-top-three" rows={4} value={topThree} onChange={(event) => setTopThree(event.target.value)} placeholder="One promise per line" />
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
        Save session and update accountability
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
        <Label>Promised on which session?</Label>
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
        <Label htmlFor="mission-commitment-title">Promise title</Label>
        <Input id="mission-commitment-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Install Monday leadership scorecard" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-commitment-description">What exactly needs to happen?</Label>
        <Textarea id="mission-commitment-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what getting this done actually looks like before the next call." />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>What is the current outcome?</Label>
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
          <Label htmlFor="mission-commitment-due-date">When should this be done?</Label>
          <Input id="mission-commitment-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-commitment-proof">Proof or review notes</Label>
        <Textarea id="mission-commitment-proof" rows={3} value={proofNotes} onChange={(event) => setProofNotes(event.target.value)} placeholder="Paste proof, a link, or what should be verified on the next call..." />
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
        Save promise
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
        <Label htmlFor="mission-board-title">Priority title</Label>
        <Input id="mission-board-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Delegation system" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-board-description">Description</Label>
        <Textarea
          id="mission-board-description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What larger initiative are we tracking between calls?"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Priority lane</Label>
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
          <Label>Linked session</Label>
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
        Save priority
      </Button>
    </div>
  );
}

function ClientBrainDialog({
  existingNote,
  onSubmit,
  isSaving,
}: {
  existingNote: MissionCoachNote | null;
  onSubmit: (payload: { title: string; note_body: string; session_id?: string | null }) => Promise<void>;
  isSaving: boolean;
}) {
  const [noteBody, setNoteBody] = useState(existingNote?.note_body ?? '');
  const [importedFileName, setImportedFileName] = useState('');

  useEffect(() => {
    setNoteBody(existingNote?.note_body ?? '');
    setImportedFileName('');
  }, [existingNote]);

  const importFile = async (file: File | null) => {
    if (!file) return;

    try {
      const content = await readMissionControlTextFile(file);
      setNoteBody(content);
      setImportedFileName(file.name);
      toast.success('Client Brain imported', {
        description: `${file.name} is now loaded into the editor.`,
      });
    } catch (error) {
      toast.error('Could not import file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Best format</p>
          <p className="mt-2 text-sm text-muted-foreground">Use markdown-style notes for strategy, recurring blockers, team context, and what has already been tried.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Keep here</p>
          <p className="mt-2 text-sm text-muted-foreground">Business model, key people, recurring patterns, red flags, and client-specific language the coach brain should remember.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Coach only</p>
          <p className="mt-2 text-sm text-muted-foreground">This note never appears in the owner view. It is private operating context for coaching.</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Label htmlFor="mission-client-brain">Client brain</Label>
            <p className="text-xs text-muted-foreground">
              Paste notes directly or import a `.md` / `.txt` file and edit from there.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild type="button" variant="outline" size="sm">
              <label htmlFor="mission-client-brain-file" className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Import markdown
              </label>
            </Button>
            <Input
              id="mission-client-brain-file"
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0] ?? null;
                await importFile(file);
                event.currentTarget.value = '';
              }}
            />
          </div>
        </div>
        {importedFileName ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Loaded from file: <span className="font-medium text-foreground">{importedFileName}</span>
          </div>
        ) : null}
        <Textarea
          id="mission-client-brain"
          rows={16}
          value={noteBody}
          onChange={(event) => setNoteBody(event.target.value)}
          placeholder={'## Business model\n## Team context\n## Recurring blockers\n## Strategy already recommended\n## What to avoid repeating\n## What success looks like'}
        />
      </div>

      <Button
        className="w-full"
        disabled={isSaving || !noteBody.trim()}
        onClick={() =>
          onSubmit({
            title: 'Client Brain',
            note_body: noteBody.trim(),
            session_id: null,
          })
        }
      >
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        Save client brain
      </Button>
    </div>
  );
}

function BrainProfileCard({
  title,
  body,
  helper,
  buttonLabel,
  onEdit,
}: {
  title: string;
  body: string;
  helper: string;
  buttonLabel: string;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-border/60 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          {buttonLabel}
        </Button>
      </div>
      <div className="mt-4 rounded-2xl border border-border/60 bg-background/80 p-4">
        {body ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="outline">Preview only</Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {summarizePreviewText(body, 360)}
            </p>
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">No profile saved yet.</p>
        )}
      </div>
    </div>
  );
}

function BrainProfileDialog({
  profileKey,
  existingProfile,
  onSubmit,
  isSaving,
}: {
  profileKey: MissionControlBrainProfileKey;
  existingProfile: MissionControlBrainProfile | null;
  onSubmit: (payload: {
    profile_key: MissionControlBrainProfileKey;
    title: string;
    body: string;
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const defaultTitle = profileKey === 'justin_voice' ? 'Justin Voice' : 'Standard Doctrine';
  const [body, setBody] = useState(existingProfile?.body ?? '');
  const [importedFileName, setImportedFileName] = useState('');

  useEffect(() => {
    setBody(existingProfile?.body ?? '');
    setImportedFileName('');
  }, [existingProfile]);

  const placeholder =
    profileKey === 'justin_voice'
      ? '- Be direct and practical.\n- Push for clarity, ownership, and deadlines.\n- Do not give soft generic encouragement without accountability.\n- Prefer decisions and execution over theory.\n- Challenge excuses, but stay useful.'
      : '## Core principles\n## Sales philosophy\n## Leadership standards\n## Accountability rules\n## How Standard diagnoses problems\n## Preferred sequence of recommendations';

  const importFile = async (file: File | null) => {
    if (!file) return;

    try {
      const content = await readMissionControlTextFile(file);
      setBody(content);
      setImportedFileName(file.name);
      toast.success(`${defaultTitle} imported`, {
        description: `${file.name} is now loaded into the editor.`,
      });
    } catch (error) {
      toast.error('Could not import file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Purpose</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {profileKey === 'justin_voice'
              ? 'This controls how the coach brain sounds when it represents you.'
              : 'This controls what the coach brain teaches and how it reasons from Standard.'}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Use</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {profileKey === 'justin_voice'
              ? 'Tone, pressure, empathy, directness, coaching boundaries, and speaking style.'
              : 'Frameworks, principles, sequencing, diagnostics, and Standard language.'}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Format</p>
          <p className="mt-2 text-sm text-muted-foreground">Markdown-style notes work best so the future brain layer can pull clean instructions from them.</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Label htmlFor={`brain-profile-${profileKey}`}>{defaultTitle}</Label>
            <p className="text-xs text-muted-foreground">
              Paste notes directly or import a `.md` / `.txt` file into this editor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild type="button" variant="outline" size="sm">
              <label htmlFor={`brain-profile-file-${profileKey}`} className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Import markdown
              </label>
            </Button>
            <Input
              id={`brain-profile-file-${profileKey}`}
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0] ?? null;
                await importFile(file);
                event.currentTarget.value = '';
              }}
            />
          </div>
        </div>
        {importedFileName ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Loaded from file: <span className="font-medium text-foreground">{importedFileName}</span>
          </div>
        ) : null}
        <Textarea
          id={`brain-profile-${profileKey}`}
          rows={16}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={placeholder}
        />
      </div>
      <Button
        className="w-full"
        disabled={isSaving || !body.trim()}
        onClick={() =>
          onSubmit({
            profile_key: profileKey,
            title: defaultTitle,
            body: body.trim(),
          })
        }
      >
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
        Save {defaultTitle}
      </Button>
    </div>
  );
}

function HistoricalMemoryImportDialog({
  existingBrain,
  onImportAsSession,
  onImportToBrain,
  isSaving,
}: {
  existingBrain: MissionCoachNote | null;
  onImportAsSession: (payload: {
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
  }) => Promise<void>;
  onImportToBrain: (payload: { note_body: string }) => Promise<void>;
  isSaving: boolean;
}) {
  type SourceType = 'transcript' | 'strategy_note' | 'client_history' | 'email_thread';
  type HistoricalImportDraft = {
    id: string;
    sourceType: SourceType;
    title: string;
    entryDate: string;
    rawText: string;
    importedFileName: string;
    summary: string;
    keyPoints: string;
    wins: string;
    issues: string;
    topThree: string;
    autoCreatePromises: boolean;
  };

  const createDraft = (overrides?: Partial<HistoricalImportDraft>): HistoricalImportDraft => ({
    id: crypto.randomUUID(),
    sourceType: 'transcript',
    title: '',
    entryDate: new Date().toISOString().slice(0, 10),
    rawText: '',
    importedFileName: '',
    summary: '',
    keyPoints: '',
    wins: '',
    issues: '',
    topThree: '',
    autoCreatePromises: false,
    ...overrides,
  });

  const isBlankDraft = (draft: HistoricalImportDraft) =>
    !draft.title.trim() &&
    !draft.rawText.trim() &&
    !draft.summary.trim() &&
    !draft.keyPoints.trim() &&
    !draft.wins.trim() &&
    !draft.issues.trim() &&
    !draft.topThree.trim() &&
    !draft.importedFileName;

  const [drafts, setDrafts] = useState<HistoricalImportDraft[]>(() => [createDraft()]);
  const [selectedDraftId, setSelectedDraftId] = useState<string>('');
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) ?? drafts[0] ?? null,
    [drafts, selectedDraftId]
  );

  useEffect(() => {
    if (!selectedDraftId && drafts[0]?.id) {
      setSelectedDraftId(drafts[0].id);
    }
  }, [drafts, selectedDraftId]);

  const effectiveSaving = isSaving || isBulkRunning || !!draftingId;

  const updateDraft = (draftId: string, patch: Partial<HistoricalImportDraft>) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              ...patch,
            }
          : draft
      )
    );
  };

  const addBlankDraft = () => {
    const next = createDraft({
      sourceType: selectedDraft?.sourceType ?? 'transcript',
      entryDate: selectedDraft?.entryDate ?? new Date().toISOString().slice(0, 10),
    });
    setDrafts((current) => [...current, next]);
    setSelectedDraftId(next.id);
  };

  const removeDraft = (draftId: string) => {
    setDrafts((current) => {
      const next = current.filter((draft) => draft.id !== draftId);
      if (next.length === 0) {
        const fallback = createDraft();
        setSelectedDraftId(fallback.id);
        return [fallback];
      }

      if (draftId === selectedDraftId) {
        setSelectedDraftId(next[0].id);
      }

      return next;
    });
  };

  const buildBrainSection = (draft: HistoricalImportDraft) => {
    const sourceLabel = draft.sourceType.replace('_', ' ');
    const header = `## ${draft.title.trim() || 'Imported historical memory'}\n- Date: ${formatDateLabel(draft.entryDate)}\n- Source: ${sourceLabel}\n`;
    const blocks = [
      draft.summary.trim() ? `### Summary\n${draft.summary.trim()}` : '',
      draft.keyPoints.trim()
        ? `### Key points\n${draft.keyPoints
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((line) => `- ${line.trim()}`)
            .join('\n')}`
        : '',
      draft.rawText.trim() ? `### Raw source\n${draft.rawText.trim()}` : '',
    ].filter(Boolean);
    return `${header}\n${blocks.join('\n\n')}`;
  };

  const generateDraftForEntry = async (draft: HistoricalImportDraft) => {
    const { data, error } = await supabase.functions.invoke('generate-mission-control-draft', {
      body: {
        transcript: draft.rawText.trim(),
        session_date: draft.entryDate,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to generate import draft');
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
  };

  const ensureStructuredDraft = async (draft: HistoricalImportDraft) => {
    if (draft.summary.trim() || draft.rawText.trim().length <= 80) {
      return draft;
    }

    const generated = await generateDraftForEntry(draft);
    const nextDraft: HistoricalImportDraft = {
      ...draft,
      title: draft.title.trim() || `${formatDateLabel(draft.entryDate)} ${generated.suggested_title}`,
      summary: generated.summary || '',
      keyPoints: generated.key_points.join('\n'),
      wins: generated.wins.join('\n'),
      issues: generated.issues.join('\n'),
      topThree: generated.top_commitments.join('\n'),
    };
    updateDraft(draft.id, nextDraft);
    return nextDraft;
  };

  const handleGenerateDraft = async () => {
    if (!selectedDraft || selectedDraft.rawText.trim().length <= 80) return;
    try {
      setDraftingId(selectedDraft.id);
      const generated = await generateDraftForEntry(selectedDraft);
      updateDraft(selectedDraft.id, {
        title: selectedDraft.title.trim() || `${formatDateLabel(selectedDraft.entryDate)} ${generated.suggested_title}`,
        summary: generated.summary || '',
        keyPoints: generated.key_points.join('\n'),
        wins: generated.wins.join('\n'),
        issues: generated.issues.join('\n'),
        topThree: generated.top_commitments.join('\n'),
      });
      toast.success('Historical draft ready', {
        description: 'The imported memory was summarized and structured.',
      });
    } catch (error) {
      toast.error('Could not draft historical memory', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setDraftingId(null);
    }
  };

  const importHistoricalFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;

    try {
      const loadedDrafts = await Promise.all(
        Array.from(fileList).map(async (file) => {
          const content = await readMissionControlTextFile(file);
          return createDraft({
            title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim(),
            rawText: content,
            importedFileName: file.name,
            sourceType: selectedDraft?.sourceType ?? 'transcript',
            entryDate: selectedDraft?.entryDate ?? new Date().toISOString().slice(0, 10),
          });
        })
      );

      setDrafts((current) => {
        if (current.length === 1 && isBlankDraft(current[0])) {
          return loadedDrafts;
        }
        return [...current, ...loadedDrafts];
      });
      setSelectedDraftId(loadedDrafts[0].id);
      toast.success('Historical memory imported', {
        description:
          loadedDrafts.length === 1
            ? `${loadedDrafts[0].importedFileName} was loaded into the import queue.`
            : `${loadedDrafts.length} files were added to the import queue.`,
      });
    } catch (error) {
      toast.error('Could not import file', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const importSingleAsSession = async () => {
    if (!selectedDraft || !selectedDraft.rawText.trim()) return;
    const prepared = await ensureStructuredDraft(selectedDraft);
    await onImportAsSession({
      title: prepared.title.trim() || `${formatDateLabel(prepared.entryDate)} Historical Session`,
      session_date: prepared.entryDate,
      summary_ai: prepared.summary.trim() || null,
      transcript_text: prepared.rawText.trim() || null,
      key_points_json: uniqueLines(prepared.keyPoints),
      wins_json: uniqueLines(prepared.wins),
      issues_json: uniqueLines(prepared.issues),
      top_commitments_json: uniqueLines(prepared.topThree),
      auto_create_commitments: prepared.autoCreatePromises,
    });
    toast.success('Historical session imported', {
      description: `${prepared.title.trim() || 'Historical session'} now lives in the timeline.`,
    });
    removeDraft(prepared.id);
  };

  const importAllAsSessions = async () => {
    const importable = drafts.filter((draft) => draft.rawText.trim());
    if (importable.length === 0) return;

    try {
      setIsBulkRunning(true);
      for (const draft of importable) {
        const prepared = await ensureStructuredDraft(draft);
        await onImportAsSession({
          title: prepared.title.trim() || `${formatDateLabel(prepared.entryDate)} Historical Session`,
          session_date: prepared.entryDate,
          summary_ai: prepared.summary.trim() || null,
          transcript_text: prepared.rawText.trim() || null,
          key_points_json: uniqueLines(prepared.keyPoints),
          wins_json: uniqueLines(prepared.wins),
          issues_json: uniqueLines(prepared.issues),
          top_commitments_json: uniqueLines(prepared.topThree),
          auto_create_commitments: prepared.autoCreatePromises,
        });
      }
      toast.success('Historical sessions imported', {
        description: `${importable.length} memory ${importable.length === 1 ? 'entry was' : 'entries were'} added to the timeline.`,
      });
      const fallback = createDraft({
        sourceType: selectedDraft?.sourceType ?? 'transcript',
        entryDate: selectedDraft?.entryDate ?? new Date().toISOString().slice(0, 10),
      });
      setDrafts([fallback]);
      setSelectedDraftId(fallback.id);
    } finally {
      setIsBulkRunning(false);
    }
  };

  const appendSingleToBrain = async () => {
    if (!selectedDraft || !selectedDraft.rawText.trim()) return;
    const mergedBody = [existingBrain?.note_body?.trim() ?? '', buildBrainSection(selectedDraft)]
      .filter(Boolean)
      .join('\n\n---\n\n');
    await onImportToBrain({ note_body: mergedBody });
    toast.success('Added to client brain', {
      description: `${selectedDraft.title.trim() || 'Historical memory'} was added to the coach-only brain.`,
    });
    removeDraft(selectedDraft.id);
  };

  const appendAllToBrain = async () => {
    const importable = drafts.filter((draft) => draft.rawText.trim());
    if (importable.length === 0) return;

    try {
      setIsBulkRunning(true);
      const mergedBody = [
        existingBrain?.note_body?.trim() ?? '',
        ...importable.map((draft) => buildBrainSection(draft)),
      ]
        .filter(Boolean)
        .join('\n\n---\n\n');
      await onImportToBrain({ note_body: mergedBody });
      toast.success('Client brain updated', {
        description: `${importable.length} historical ${importable.length === 1 ? 'entry was' : 'entries were'} merged into the client brain.`,
      });
      const fallback = createDraft({
        sourceType: selectedDraft?.sourceType ?? 'transcript',
        entryDate: selectedDraft?.entryDate ?? new Date().toISOString().slice(0, 10),
      });
      setDrafts([fallback]);
      setSelectedDraftId(fallback.id);
    } finally {
      setIsBulkRunning(false);
    }
  };

  const importableCount = drafts.filter((draft) => draft.rawText.trim()).length;
  const canGenerateDraft = (selectedDraft?.rawText.trim().length ?? 0) > 80;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Backfill use</p>
          <p className="mt-2 text-sm text-muted-foreground">Load old transcripts, strategy notes, and email threads without rebuilding every past call one by one.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Queue first</p>
          <p className="mt-2 text-sm text-muted-foreground">Import multiple files, review each memory block, then send them into the timeline or client brain in one pass.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Historical sessions</p>
          <p className="mt-2 text-sm text-muted-foreground">Use for past calls that should appear in the session timeline and memory layer.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Client brain</p>
          <p className="mt-2 text-sm text-muted-foreground">Use for durable context, strategy notes, and patterns that should live in coach-only memory.</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="border-border/60 bg-muted/10">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Import queue</CardTitle>
                <CardDescription>{importableCount} file-backed {importableCount === 1 ? 'entry' : 'entries'} ready to backfill.</CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.24em]">
                {drafts.length} total
              </Badge>
            </div>
            <div className="grid gap-2">
              <Button asChild type="button" variant="outline" className="w-full">
                <label htmlFor="historical-memory-file" className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Import files
                </label>
              </Button>
              <Input
                id="historical-memory-file"
                type="file"
                accept=".md,.txt,text/markdown,text/plain"
                className="hidden"
                multiple
                onChange={async (event) => {
                  await importHistoricalFiles(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
              <Button type="button" variant="ghost" className="w-full justify-start" onClick={addBlankDraft}>
                <Plus className="mr-2 h-4 w-4" />
                Add blank memory
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {drafts.map((draft, index) => {
                const isSelected = draft.id === selectedDraft?.id;
                const preview = summarizePreviewText(draft.summary || draft.rawText, 88);
                return (
                  <button
                    key={draft.id}
                    type="button"
                    onClick={() => setSelectedDraftId(draft.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      isSelected
                        ? 'border-foreground/20 bg-background shadow-sm'
                        : 'border-border/50 bg-background/40 hover:border-border hover:bg-background/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Entry {index + 1}</p>
                        <p className="mt-1 truncate font-medium text-foreground">
                          {draft.title.trim() || draft.importedFileName || 'Untitled historical memory'}
                        </p>
                      </div>
                      {drafts.length > 1 ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeDraft(draft.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {draft.sourceType.replace('_', ' ')} • {formatDateLabel(draft.entryDate)}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {preview || 'No text loaded yet.'}
                    </p>
                  </button>
                );
              })}
            </div>

            <Separator />

            <div className="space-y-2">
              <Button className="w-full" disabled={effectiveSaving || importableCount === 0} onClick={importAllAsSessions}>
                {effectiveSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
                Import all as sessions
              </Button>
              <Button variant="outline" className="w-full" disabled={effectiveSaving || importableCount === 0} onClick={appendAllToBrain}>
                {effectiveSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Add all to client brain
              </Button>
            </div>
          </CardContent>
        </Card>

        {selectedDraft ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Source type</Label>
                <Select
                  value={selectedDraft.sourceType}
                  onValueChange={(value) => updateDraft(selectedDraft.id, { sourceType: value as SourceType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transcript">Transcript</SelectItem>
                    <SelectItem value="strategy_note">Strategy note</SelectItem>
                    <SelectItem value="client_history">Client history</SelectItem>
                    <SelectItem value="email_thread">Email thread</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="historical-memory-title">Memory title</Label>
                <Input
                  id="historical-memory-title"
                  value={selectedDraft.title}
                  onChange={(event) => updateDraft(selectedDraft.id, { title: event.target.value })}
                  placeholder="Q4 sales turnaround call"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label htmlFor="historical-memory-date">Original date</Label>
                <Input
                  id="historical-memory-date"
                  type="date"
                  value={selectedDraft.entryDate}
                  onChange={(event) => updateDraft(selectedDraft.id, { entryDate: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="historical-memory-raw">Transcript, markdown, or notes</Label>
                    <p className="text-xs text-muted-foreground">Review and shape this entry before pushing it into session memory or the client brain.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateDraft}
                    disabled={!canGenerateDraft || effectiveSaving}
                  >
                    {draftingId === selectedDraft.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {draftingId === selectedDraft.id ? 'Drafting...' : 'Generate draft'}
                  </Button>
                </div>
                {selectedDraft.importedFileName ? (
                  <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Loaded file: <span className="font-medium text-foreground">{selectedDraft.importedFileName}</span>
                  </div>
                ) : null}
                <Textarea
                  id="historical-memory-raw"
                  rows={10}
                  value={selectedDraft.rawText}
                  onChange={(event) => updateDraft(selectedDraft.id, { rawText: event.target.value })}
                  placeholder="Paste an old transcript, cleaned notes, or markdown context here..."
                />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="historical-memory-summary">Summary</Label>
                <Textarea
                  id="historical-memory-summary"
                  rows={4}
                  value={selectedDraft.summary}
                  onChange={(event) => updateDraft(selectedDraft.id, { summary: event.target.value })}
                  placeholder="Short summary of what this historical memory contains..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="historical-memory-top-three">Promise candidates</Label>
                <Textarea
                  id="historical-memory-top-three"
                  rows={4}
                  value={selectedDraft.topThree}
                  onChange={(event) => updateDraft(selectedDraft.id, { topThree: event.target.value })}
                  placeholder="One promise per line if this import should also seed old promises..."
                />
                <Button
                  type="button"
                  variant={selectedDraft.autoCreatePromises ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    updateDraft(selectedDraft.id, {
                      autoCreatePromises: !selectedDraft.autoCreatePromises,
                    })
                  }
                >
                  {selectedDraft.autoCreatePromises ? 'Will create active promises' : 'Keep as memory only'}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="historical-memory-key-points">Key points</Label>
                <Textarea
                  id="historical-memory-key-points"
                  rows={4}
                  value={selectedDraft.keyPoints}
                  onChange={(event) => updateDraft(selectedDraft.id, { keyPoints: event.target.value })}
                  placeholder="One key point per line"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="historical-memory-wins">Wins</Label>
                <Textarea
                  id="historical-memory-wins"
                  rows={4}
                  value={selectedDraft.wins}
                  onChange={(event) => updateDraft(selectedDraft.id, { wins: event.target.value })}
                  placeholder="One win per line"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="historical-memory-issues">Issues</Label>
                <Textarea
                  id="historical-memory-issues"
                  rows={4}
                  value={selectedDraft.issues}
                  onChange={(event) => updateDraft(selectedDraft.id, { issues: event.target.value })}
                  placeholder="One issue per line"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="sm:flex-1" disabled={effectiveSaving || !selectedDraft.rawText.trim()} onClick={importSingleAsSession}>
                {effectiveSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
                Import selected as session
              </Button>
              <Button variant="outline" className="sm:flex-1" disabled={effectiveSaving || !selectedDraft.rawText.trim()} onClick={appendSingleToBrain}>
                {effectiveSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Add selected to client brain
              </Button>
            </div>
          </div>
        ) : null}
      </div>
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
  defaults,
  onSubmit,
  isSaving,
}: {
  uploads: MissionUpload[];
  sessions: MissionSession[];
  commitments: MissionCommitment[];
  boardItems: MissionBoardItem[];
  defaults?: AttachmentDialogDefaults;
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
    defaults?.attachmentType ?? (initialTargetKind === 'session' ? 'transcript' : 'proof')
  );
  const [targetKind, setTargetKind] = useState<AttachmentTargetKind>(defaults?.targetKind ?? initialTargetKind);
  const [targetId, setTargetId] = useState(defaults?.targetId ?? '');

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
    if (!defaults) return;
    setTargetKind(defaults.targetKind);
    setAttachmentType(defaults.attachmentType);
    setTargetId(defaults.targetId);
  }, [defaults]);

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
            : 'Create a session, promise, or priority first so the file has somewhere to attach.'}
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
              {commitments.length > 0 && <SelectItem value="commitment">Promise</SelectItem>}
              {boardItems.length > 0 && <SelectItem value="board">Priority</SelectItem>}
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
              <SelectItem value="proof">Evidence</SelectItem>
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
