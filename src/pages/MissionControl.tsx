import { type ComponentType, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Plus,
  Rocket,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth';

type BoardColumn = 'backlog' | 'in_progress' | 'before_next_call' | 'done';

const ADMIN_CLIENTS = [
  { id: 'client-a', label: 'Apex Insurance / Jamie Reed' },
  { id: 'client-b', label: 'North Peak Agency / Alex Warren' },
  { id: 'client-c', label: 'Summit Risk / Morgan Hale' },
];

const SESSION_TIMELINE = [
  {
    id: 's1',
    date: 'March 4, 2026',
    title: 'March strategy call',
    summary: 'Clarified the Q2 sales push, reworked the hiring scorecard, and tightened weekly leadership rhythm.',
  },
  {
    id: 's2',
    date: 'February 6, 2026',
    title: 'February coaching review',
    summary: 'Reviewed producer pipeline gaps, retention handoffs, and owner follow-through on delegation.',
  },
  {
    id: 's3',
    date: 'January 10, 2026',
    title: 'Kickoff operating review',
    summary: 'Set the first scoreboard, defined top three owner commitments, and called out operational friction.',
  },
];

const COMMITMENTS = [
  {
    id: 'c1',
    title: 'Hire and onboard one producer',
    owner: 'Agency owner',
    status: 'In progress',
    due: 'March 18',
    proof: 'Interview scorecard shared',
  },
  {
    id: 'c2',
    title: 'Install Monday leadership scorecard',
    owner: 'Agency owner',
    status: 'Before next call',
    due: 'March 15',
    proof: 'Need screenshot proof',
  },
  {
    id: 'c3',
    title: 'Clean up lead source follow-up rules',
    owner: 'Agency owner',
    status: 'Done',
    due: 'March 8',
    proof: 'CRM workflow updated',
  },
];

const BOARD_ITEMS: Array<{
  id: string;
  title: string;
  column: BoardColumn;
  note: string;
}> = [
  { id: 'b1', title: 'Recruiting scorecard', column: 'backlog', note: 'Define scorecard and pass/fail criteria.' },
  { id: 'b2', title: 'Weekly sales huddle', column: 'in_progress', note: 'Owner is trialing the new cadence now.' },
  { id: 'b3', title: 'Delegation tracker', column: 'before_next_call', note: 'Must be live before the next review.' },
  { id: 'b4', title: 'Retention handoff SOP', column: 'done', note: 'Closed and documented.' },
];

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
  'In progress': 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'Before next call': 'border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  Done: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

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
  const [selectedClient, setSelectedClient] = useState(ADMIN_CLIENTS[0].id);
  const [dialogState, setDialogState] = useState<'session' | 'commitment' | 'board' | null>(null);

  const activeClientLabel = useMemo(() => {
    if (!isAdmin) {
      return user?.email ?? 'Owner workspace';
    }

    return ADMIN_CLIENTS.find((client) => client.id === selectedClient)?.label ?? ADMIN_CLIENTS[0].label;
  }, [isAdmin, selectedClient, user?.email]);

  const boardGroups = useMemo(
    () =>
      BOARD_COLUMNS.map((column) => ({
        ...column,
        items: BOARD_ITEMS.filter((item) => item.column === column.key),
      })),
    []
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(194,162,102,0.14),transparent_32%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.24)_100%)]">
      <main className="container mx-auto max-w-[1540px] space-y-6 px-4 py-6 md:px-6 md:py-8">
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
                      {ADMIN_CLIENTS.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.label}
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
                    <p className="mt-1 text-muted-foreground">Frontend rebuild mode. Live data wiring comes next.</p>
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
                <Button variant="outline" className="border-foreground/15 bg-background/75" onClick={() => setDialogState('commitment')}>
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
          <SummaryCard icon={ClipboardList} label="Open Commitments" value="2" detail="Two items still need proof before the next review." />
          <SummaryCard icon={CalendarDays} label="Last Call" value="Mar 4" detail="Latest coaching session is preserved in the memory timeline." />
          <SummaryCard icon={Rocket} label="Mission Board" value="4" detail="Four active deployments tracked across the board." />
          <SummaryCard icon={Trophy} label="Wins Logged" value="3" detail="Momentum is visible and easy to reference." />
          <SummaryCard icon={CheckCircle2} label="Proof Linked" value="2" detail="Two commitments already have evidence attached." />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_1.2fr_0.9fr]">
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
                <div className="rounded-[24px] border border-border/60 bg-muted/30 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Latest session</p>
                      <h3 className="mt-1 text-xl font-semibold">March strategy call</h3>
                    </div>
                    <Badge variant="outline">March 4, 2026</Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    Clarified the sales hiring push, the new weekly meeting rhythm, and the owner’s next three promises.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Transcript</p>
                      <p className="mt-2 text-sm">Upload pipeline ready next. This rebuild keeps the shell stable first.</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Key points</p>
                      <p className="mt-2 text-sm">Hiring scorecard, delegation discipline, and sales huddle cadence.</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top 3</p>
                      <p className="mt-2 text-sm">Recruit, install scorecard, tighten follow-up rules.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-border/60 bg-background/82">
              <CardHeader>
                <CardTitle>Session Timeline</CardTitle>
                <CardDescription>Past calls stay visible so the relationship memory does not drift month to month.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {SESSION_TIMELINE.map((session, index) => (
                  <div key={session.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{session.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{session.summary}</p>
                      </div>
                      <Badge variant="outline">{session.date}</Badge>
                    </div>
                    {index < SESSION_TIMELINE.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
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
                {COMMITMENTS.map((commitment) => (
                  <div key={commitment.id} className="rounded-[22px] border border-border/60 bg-muted/25 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{commitment.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{commitment.owner}</p>
                      </div>
                      <Badge variant="outline" className={STATUS_TONE[commitment.status] ?? ''}>
                        {commitment.status}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-border/60 bg-background/75 p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Due</p>
                        <p className="mt-2">{commitment.due}</p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/75 p-3 text-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Proof</p>
                        <p className="mt-2">{commitment.proof}</p>
                      </div>
                    </div>
                  </div>
                ))}
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
                        {column.items.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-current/20 bg-background/60 p-3 text-sm text-foreground shadow-sm">
                            <p className="font-medium">{item.title}</p>
                            <p className="mt-2 text-muted-foreground">{item.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
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
                    <li>Producer pipeline recovered after a disciplined follow-up sprint.</li>
                    <li>Owner finally delegated renewals follow-up to the right lead.</li>
                    <li>New sales huddle started showing daily score clarity.</li>
                  </ul>
                </div>
                <Separator />
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Current issues</p>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>Hiring scorecard still needs to be finalized.</li>
                    <li>Leadership cadence depends too much on owner memory.</li>
                    <li>Proof of execution is inconsistent between calls.</li>
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

            <Card className="rounded-[28px] border-border/60 bg-background/82">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BriefcaseBusiness className="h-5 w-5 text-primary" />
                  Proof Locker
                </CardTitle>
                <CardDescription>Uploaded proof, screenshots, and links will live here next.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[24px] border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  No live uploads are wired in this reset build. This panel stays as the dedicated slot for proof and
                  transcript artifacts.
                </div>
                <Button variant="outline" asChild className="w-full">
                  <Link to="/dashboard">Back to dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Dialog open={dialogState !== null} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState === 'session'
                ? 'New session'
                : dialogState === 'commitment'
                  ? 'Add commitment'
                  : 'Add board item'}
            </DialogTitle>
            <DialogDescription>
              This fresh rebuild is intentionally frontend-first. The action opened correctly, and the data-entry flow
              will be connected after the render path is stable in Lovable.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
