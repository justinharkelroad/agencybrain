import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Target,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  ArrowRight,
  MessageSquareQuote,
  Dumbbell,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// ─── Types ───

interface AnalyticsCall {
  id: string;
  team_member_id: string;
  team_member_name: string;
  template_id: string;
  template_name: string;
  potential_rank: string | null;
  overall_score: number | null;
  skill_scores: Json | null;
  discovery_wins: Json | null;
  analyzed_at: string | null;
}

interface TeamMember {
  id: string;
  name: string;
}

interface PatternItem {
  pattern: string;
  evidence: string;
  impact: string;
}

interface TrendItem {
  observation: string;
  direction: 'improving' | 'declining' | 'inconsistent';
  detail: string;
}

interface FocusArea {
  area: string;
  priority: 'high' | 'medium' | 'low';
  current_level: string;
  target: string;
  drill: string;
}

interface RolePlayScenario {
  title: string;
  setup: string;
  agent_goal: string;
  customer_persona: string;
  success_criteria: string;
  sample_objection: string;
}

interface WeeklyGoal {
  week: number;
  focus: string;
  measurable_target: string;
  check_in_question: string;
}

interface CallComparison {
  call_id: string;
  team_member: string;
  score: number;
  date: string;
  key_strength: string;
  key_gap: string;
}

interface CoachingReport {
  executive_summary: string;
  pattern_analysis: {
    strengths: PatternItem[];
    weaknesses: PatternItem[];
    trends: TrendItem[];
  };
  coaching_plan: {
    focus_areas: FocusArea[];
    role_play_scenarios: RolePlayScenario[];
    weekly_goals: WeeklyGoal[];
  };
  call_comparisons: CallComparison[];
}

interface ReportMeta {
  id: string;
  title: string;
  comparison_mode: 'trajectory' | 'peer';
  call_count: number;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  gpt_cost: number;
  created_at: string;
}

interface SavedReportSummary {
  id: string;
  title: string;
  comparison_mode: string;
  call_ids: string[];
  created_at: string;
  model_used: string;
}

interface CallCoachingTabProps {
  analyticsCalls: AnalyticsCall[];
  teamMembers: TeamMember[];
  agencyId: string;
  isStaffUser: boolean;
}

const MAX_SELECTED = 5;

// ─── Component ───

export function CallCoachingTab({
  analyticsCalls,
  teamMembers,
  agencyId,
  isStaffUser,
}: CallCoachingTabProps) {
  // Selection state
  const [selectedCallIds, setSelectedCallIds] = useState<Set<string>>(new Set());
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [customPrompt, setCustomPrompt] = useState('');

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<CoachingReport | null>(null);
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null);

  // History state
  const [savedReports, setSavedReports] = useState<SavedReportSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Collapsible report sections
  const [patternOpen, setPatternOpen] = useState(true);
  const [coachingOpen, setCoachingOpen] = useState(true);

  // Filter calls by selected member
  const filteredCalls = useMemo(() => {
    const analyzed = analyticsCalls.filter((c) => c.overall_score !== null);
    if (memberFilter === 'all') return analyzed;
    return analyzed.filter((c) => c.team_member_id === memberFilter);
  }, [analyticsCalls, memberFilter]);

  // Auto-detect comparison mode (use all analyticsCalls, not filtered, so
  // the mode badge stays accurate even when the member filter changes)
  const comparisonMode = useMemo(() => {
    const memberIds = new Set(
      analyticsCalls
        .filter((c) => selectedCallIds.has(c.id))
        .map((c) => c.team_member_id)
    );
    return memberIds.size <= 1 ? 'trajectory' : 'peer';
  }, [analyticsCalls, selectedCallIds]);

  // ─── Helpers ───

  const invokeEdgeFunction = useCallback(
    async (payload: Record<string, unknown>) => {
      const headers: Record<string, string> = {};
      if (isStaffUser) {
        const token = localStorage.getItem('staff_session_token');
        if (token) headers['x-staff-session'] = token;
      }

      const { data, error } = await supabase.functions.invoke('compare-calls', {
        body: payload,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      });

      if (error) {
        // Handle FunctionsHttpError — body is in error.context.json()
        const errCtx = (error as any)?.context;
        if (errCtx?.json) {
          const body = await errCtx.json();
          throw new Error(body?.error || 'Edge function error');
        }
        throw error;
      }
      return data;
    },
    [isStaffUser]
  );

  // ─── Load report history ───

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      if (isStaffUser) {
        const data = await invokeEdgeFunction({ action: 'list' });
        setSavedReports(data?.reports || []);
      } else {
        const { data, error } = await supabase
          .from('call_coaching_reports')
          .select('id, title, comparison_mode, call_ids, created_at, model_used')
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setSavedReports((data as SavedReportSummary[]) || []);
      }
    } catch (err) {
      console.error('Failed to load report history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [agencyId, isStaffUser, invokeEdgeFunction]);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ─── Toggle call selection ───

  const toggleCall = useCallback(
    (callId: string) => {
      setSelectedCallIds((prev) => {
        const next = new Set(prev);
        if (next.has(callId)) {
          next.delete(callId);
        } else if (next.size < MAX_SELECTED) {
          next.add(callId);
        }
        return next;
      });
    },
    []
  );

  // ─── Generate report ───

  const handleGenerate = useCallback(async () => {
    if (selectedCallIds.size < 2) return;
    setGenerating(true);
    setReport(null);
    setReportMeta(null);

    try {
      const data = await invokeEdgeFunction({
        action: 'generate',
        call_ids: [...selectedCallIds],
        custom_prompt: customPrompt || undefined,
      });

      if (data?.report) {
        setReport(data.report as CoachingReport);
        setReportMeta(data.meta as ReportMeta);
        toast.success('Coaching report generated');
        // Refresh history to include new report
        loadHistory();
      } else {
        toast.error(data?.error || 'Failed to generate report');
      }
    } catch (err: any) {
      console.error('Generate error:', err);
      toast.error(err.message || 'Failed to generate coaching report');
    } finally {
      setGenerating(false);
    }
  }, [selectedCallIds, customPrompt, invokeEdgeFunction, loadHistory]);

  // ─── Load a saved report ───

  const handleLoadReport = useCallback(
    async (reportId: string) => {
      try {
        let reportData;
        if (isStaffUser) {
          reportData = await invokeEdgeFunction({ action: 'get', report_id: reportId });
          reportData = reportData?.report;
        } else {
          const { data, error } = await supabase
            .from('call_coaching_reports')
            .select('*')
            .eq('id', reportId)
            .eq('agency_id', agencyId)
            .single();
          if (error) throw error;
          reportData = data;
        }

        if (reportData) {
          setReport(reportData.report_data as unknown as CoachingReport);
          setReportMeta({
            id: reportData.id,
            title: reportData.title,
            comparison_mode: reportData.comparison_mode as 'trajectory' | 'peer',
            call_count: (reportData.call_ids as string[])?.length || 0,
            model_used: reportData.model_used || 'gpt-4o',
            input_tokens: reportData.input_tokens || 0,
            output_tokens: reportData.output_tokens || 0,
            gpt_cost: reportData.gpt_cost || 0,
            created_at: reportData.created_at,
          });
          // Select the call IDs from the loaded report
          setSelectedCallIds(new Set(reportData.call_ids as string[]));
          toast.success('Report loaded');
        }
      } catch (err) {
        console.error('Failed to load report:', err);
        toast.error('Failed to load report');
      }
    },
    [isStaffUser, invokeEdgeFunction, agencyId]
  );

  // ─── Delete a saved report ───

  const handleDeleteReport = useCallback(
    async (reportId: string) => {
      try {
        if (isStaffUser) {
          await invokeEdgeFunction({ action: 'delete', report_id: reportId });
        } else {
          const { error } = await supabase
            .from('call_coaching_reports')
            .delete()
            .eq('id', reportId)
            .eq('agency_id', agencyId);
          if (error) throw error;
        }
        setSavedReports((prev) => prev.filter((r) => r.id !== reportId));
        // Clear current report if it was the deleted one
        if (reportMeta?.id === reportId) {
          setReport(null);
          setReportMeta(null);
        }
        toast.success('Report deleted');
      } catch (err) {
        console.error('Failed to delete report:', err);
        toast.error('Failed to delete report');
      } finally {
        setDeleteTarget(null);
      }
    },
    [isStaffUser, invokeEdgeFunction, reportMeta?.id, agencyId]
  );

  // ─── Render ───

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Left Column: Call Selection ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Calls to Compare
            </CardTitle>
            <CardDescription>
              Choose 2-5 scored calls to generate a coaching report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Member filter */}
            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team Members</SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Selection counter & mode badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedCallIds.size} of {MAX_SELECTED} selected
              </span>
              {selectedCallIds.size >= 2 && (
                <Badge variant="outline" className="text-xs">
                  {comparisonMode === 'trajectory' ? 'Individual Progress' : 'Team Comparison'}
                </Badge>
              )}
            </div>

            {/* Call list */}
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No scored calls available
                </p>
              ) : (
                filteredCalls.map((call) => (
                  <label
                    key={call.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCallIds.has(call.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:bg-muted/50'
                    } ${
                      !selectedCallIds.has(call.id) && selectedCallIds.size >= MAX_SELECTED
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    <Checkbox
                      checked={selectedCallIds.has(call.id)}
                      onCheckedChange={() => toggleCall(call.id)}
                      disabled={
                        !selectedCallIds.has(call.id) &&
                        selectedCallIds.size >= MAX_SELECTED
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {call.team_member_name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {call.analyzed_at
                          ? new Date(call.analyzed_at).toLocaleDateString()
                          : 'Unknown date'}
                      </span>
                    </div>
                    <ScoreBadge score={call.overall_score} />
                  </label>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Right Column: Generate + Results ─── */}
        <div className="space-y-6">
          {/* Generate controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Compare & Coach
              </CardTitle>
              <CardDescription>
                AI analyzes your selected calls and generates a coaching plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Optional: What should we focus on? (e.g., closing techniques, objection handling, discovery questions)"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <Button
                onClick={handleGenerate}
                disabled={selectedCallIds.size < 2 || generating}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing {selectedCallIds.size} calls...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Coaching Report
                    {selectedCallIds.size >= 2 && ` (${selectedCallIds.size} calls)`}
                  </>
                )}
              </Button>
              {selectedCallIds.size > 0 && selectedCallIds.size < 2 && (
                <p className="text-xs text-muted-foreground text-center">
                  Select at least 2 calls to compare
                </p>
              )}
            </CardContent>
          </Card>

          {/* Report display */}
          {report && reportMeta && (
            <ReportDisplay
              report={report}
              meta={reportMeta}
              patternOpen={patternOpen}
              setPatternOpen={setPatternOpen}
              coachingOpen={coachingOpen}
              setCoachingOpen={setCoachingOpen}
            />
          )}
        </div>
      </div>

      {/* ─── Report History ─── */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Past Coaching Reports
              {savedReports.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {savedReports.length}
                </Badge>
              )}
            </span>
            {historyOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : savedReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No saved reports yet. Generate your first coaching report above.
            </p>
          ) : (
            <div className="space-y-2">
              {savedReports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <button
                    onClick={() => handleLoadReport(r.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {r.comparison_mode === 'trajectory'
                          ? 'Progress'
                          : 'Comparison'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()} &middot;{' '}
                      {r.call_ids?.length || 0} calls
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coaching Report?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The report will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDeleteReport(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sub-components ───

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge variant="secondary">N/A</Badge>;
  const color =
    score >= 80
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      : score >= 60
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {score}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[priority] || colors.medium}`}>
      {priority}
    </span>
  );
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === 'improving') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (direction === 'declining') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <ArrowRight className="h-4 w-4 text-amber-500" />;
}

interface ReportDisplayProps {
  report: CoachingReport;
  meta: ReportMeta;
  patternOpen: boolean;
  setPatternOpen: (open: boolean) => void;
  coachingOpen: boolean;
  setCoachingOpen: (open: boolean) => void;
}

function ReportDisplay({
  report,
  meta,
  patternOpen,
  setPatternOpen,
  coachingOpen,
  setCoachingOpen,
}: ReportDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{meta.title}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {meta.comparison_mode === 'trajectory' ? 'Progress' : 'Comparison'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{report.executive_summary}</p>
        </CardContent>
      </Card>

      {/* Pattern Analysis */}
      <Collapsible open={patternOpen} onOpenChange={setPatternOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Pattern Analysis
                </span>
                {patternOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {/* Strengths */}
              {report.pattern_analysis?.strengths?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                    Strengths
                  </h4>
                  <div className="space-y-2">
                    {report.pattern_analysis.strengths.map((s, i) => (
                      <div key={i} className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30">
                        <p className="text-sm font-medium">{s.pattern}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.evidence}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Impact: {s.impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weaknesses */}
              {report.pattern_analysis?.weaknesses?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                    Areas for Improvement
                  </h4>
                  <div className="space-y-2">
                    {report.pattern_analysis.weaknesses.map((w, i) => (
                      <div key={i} className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
                        <p className="text-sm font-medium">{w.pattern}</p>
                        <p className="text-xs text-muted-foreground mt-1">{w.evidence}</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">Impact: {w.impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trends */}
              {report.pattern_analysis?.trends?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Trends</h4>
                  <div className="space-y-2">
                    {report.pattern_analysis.trends.map((t, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <TrendIcon direction={t.direction} />
                        <div>
                          <p className="text-sm font-medium">{t.observation}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Coaching Plan */}
      <Collapsible open={coachingOpen} onOpenChange={setCoachingOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4" />
                  Coaching Plan
                </span>
                {coachingOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
              {/* Focus Areas */}
              {report.coaching_plan?.focus_areas?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Focus Areas</h4>
                  <div className="space-y-2">
                    {report.coaching_plan.focus_areas.map((fa, i) => (
                      <div key={i} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{fa.area}</span>
                          <PriorityBadge priority={fa.priority} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <span className="text-xs text-muted-foreground">Current</span>
                            <p className="text-xs">{fa.current_level}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Target</span>
                            <p className="text-xs">{fa.target}</p>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t">
                          <span className="text-xs text-muted-foreground">Drill</span>
                          <p className="text-xs">{fa.drill}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Role-Play Scenarios */}
              {report.coaching_plan?.role_play_scenarios?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <MessageSquareQuote className="h-4 w-4" />
                    Role-Play Scenarios
                  </h4>
                  <div className="space-y-3">
                    {report.coaching_plan.role_play_scenarios.map((rp, i) => (
                      <div key={i} className="p-4 rounded-lg border bg-muted/30">
                        <h5 className="text-sm font-semibold mb-2">{rp.title}</h5>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="font-medium text-muted-foreground">Setup:</span>{' '}
                            {rp.setup}
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Agent Goal:</span>{' '}
                            {rp.agent_goal}
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Customer:</span>{' '}
                            {rp.customer_persona}
                          </div>
                          <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                            <span className="font-medium text-amber-700 dark:text-amber-400">
                              Sample Objection:
                            </span>{' '}
                            <span className="italic">"{rp.sample_objection}"</span>
                          </div>
                          <div>
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              Success Criteria:
                            </span>{' '}
                            {rp.success_criteria}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly Goals */}
              {report.coaching_plan?.weekly_goals?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    4-Week Goals
                  </h4>
                  <div className="space-y-2">
                    {report.coaching_plan.weekly_goals.map((wg, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                          W{wg.week}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{wg.focus}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Target: {wg.measurable_target}
                          </p>
                          <p className="text-xs text-primary mt-1 italic">
                            Check-in: "{wg.check_in_question}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Call Comparison Table */}
      {report.call_comparisons?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Call Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Agent</th>
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-center py-2 pr-3 font-medium text-muted-foreground">Score</th>
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Strength</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {report.call_comparisons.map((cc, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{cc.team_member}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {cc.date ? new Date(cc.date).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <ScoreBadge score={cc.score} />
                      </td>
                      <td className="py-2 pr-3 text-xs">{cc.key_strength}</td>
                      <td className="py-2 text-xs">{cc.key_gap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
