import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  User, Users, Target, AlertTriangle, CheckCircle2, XCircle,
  FileAudio, Clock, ChevronDown, ChevronUp, Download, Search,
  Image, FileText, Share2, Loader2, CheckCircle, Mic, VolumeX,
  MessageSquareQuote, Sparkles, Mail, MessageSquare
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { exportScorecardAsPNG, exportScorecardAsPDF } from '@/lib/exportScorecard';
import { parseFeedback } from '@/lib/utils/feedback-parser';
import { FollowUpTemplateDisplay } from '@/components/call-scoring/FollowUpTemplateDisplay';
import { supabase } from '@/integrations/supabase/client';
import { resolveFunctionErrorMessage } from '@/lib/utils/resolve-function-error';
import type { Json } from '@/integrations/supabase/types';

interface CallScorecardCall {
  id: string;
  team_member_name?: string | null;
  section_scores: Json | null;
  transcript_segments: Json | null;
  discovery_wins: Json | null;
  closing_attempts: Json | null;
  client_profile: Json | null;
  skill_scores: Json | null;
  agent_talk_percent: number | null;
  customer_talk_percent: number | null;
  dead_air_percent: number | null;
  agent_talk_seconds: number | null;
  customer_talk_seconds: number | null;
  dead_air_seconds: number | null;
  overall_score: number | null;
  potential_rank: string | null;
  critical_gaps: Json | null;
  summary: string | null;
  notable_quotes: Json | null;
  original_filename: string | null;
  created_at: string | null;
  analyzed_at: string | null;
  generated_email_template: string | null;
  generated_text_template: string | null;
  [key: string]: unknown;
}

interface SectionScoreEntry {
  score?: number;
  wins?: string[];
  failures?: string[];
  coaching?: string | null;
  tip?: string | null;
  feedback?: string | null;
}

type SectionScoreMap = Record<string, SectionScoreEntry | undefined>;

interface RawSkillScoreRow {
  skill_name?: string | null;
  score?: number | null;
  max_score?: number | null;
  feedback?: string | null;
  tip?: string | null;
}

interface NormalizedSkillScore {
  skill_name: string;
  score: number;
  max_score: number;
  feedback?: string | null;
  tip?: string | null;
}

interface CallScorecardProps {
  call: CallScorecardCall | null;
  open: boolean;
  onClose: () => void;
  isStaffUser?: boolean;
  staffTeamMemberId?: string;
  acknowledgedAt?: string | null;
  staffFeedbackPositive?: string | null;
  staffFeedbackImprovement?: string | null;
  onAcknowledge?: (positive: string, improvement: string) => Promise<void>;
  loading?: boolean;
  qaEnabled?: boolean;
}

export function CallScorecard({ 
  call, 
  open, 
  onClose,
  isStaffUser = false,
  staffTeamMemberId,
  acknowledgedAt,
  staffFeedbackPositive,
  staffFeedbackImprovement,
  onAcknowledge,
  loading = false,
  qaEnabled = false
}: CallScorecardProps) {
  const [showCrmNotes, setShowCrmNotes] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showAcknowledgeForm, setShowAcknowledgeForm] = useState(false);
  const [feedbackPositive, setFeedbackPositive] = useState('');
  const [feedbackImprovement, setFeedbackImprovement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const QA_QUESTION_LIMIT = 10;
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaQuestionsUsed, setQaQuestionsUsed] = useState(0);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [qaResult, setQaResult] = useState<{
    question: string;
    verdict: 'found' | 'partial' | 'not_found';
    confidence: number;
    summary: string;
    matches: Array<{
      timestamp_seconds?: number | null;
      speaker?: string | null;
      quote: string;
      context?: string | null;
    }>;
  } | null>(null);
  const scorecardRef = useRef<HTMLDivElement>(null);

  // Reset QA state when switching calls
  useEffect(() => {
    setQaQuestion('');
    setQaQuestionsUsed(0);
    setQaLoading(false);
    setQaError(null);
    setQaResult(null);
  }, [call?.id]);

  const handleQaQuery = async () => {
    if (!qaEnabled || qaLoading) return;

    if (qaQuestionsUsed >= QA_QUESTION_LIMIT) {
      toast.error(`You've reached the ${QA_QUESTION_LIMIT}-question limit for this call.`);
      return;
    }

    const question = qaQuestion.trim();
    if (!question) {
      toast.error('Please enter a question first.');
      return;
    }

    setQaLoading(true);
    setQaError(null);
    setQaResult(null);

    try {
      const headers: Record<string, string> = {};
      const staffSession = localStorage.getItem('staff_session_token');
      if (staffSession) {
        headers['x-staff-session'] = staffSession;
      }

      const { data, error } = await supabase.functions.invoke('call-scoring-qa', {
        body: {
          call_id: call.id,
          question,
        },
        headers,
      });

      if (error) {
        const message = await resolveFunctionErrorMessage(error);
        throw new Error(message);
      }

      if (!data?.question) {
        throw new Error('QA service returned an unexpected response.');
      }

      setQaResult(data);
      setQaQuestionsUsed(prev => prev + 1);
      toast.success('Q&A complete.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run QA query';
      setQaError(message);
      toast.error(message);
    } finally {
      setQaLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!feedbackPositive.trim() || !feedbackImprovement.trim()) {
      toast.error('Please fill in both fields');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onAcknowledge?.(feedbackPositive, feedbackImprovement);
      toast.success('Review acknowledged!');
      setShowAcknowledgeForm(false);
    } catch (error) {
      toast.error('Failed to submit acknowledgment');
    } finally {
      setIsSubmitting(false);
    }
  };


  // IMPORTANT: keep the dialog open and show a loading/empty state even when call is null
  if (!call) {
    return (
      <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Call Scorecard</DialogTitle>
          <div className="flex items-center justify-center gap-3 py-10 text-muted-foreground">
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading call details…</span>
              </>
            ) : (
              <span>Call details not available.</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Score ranges for the new scoring system
  const SCORE_RANGES = [
    { label: 'Excellent', min: 80, max: 100, color: '#22c55e', textClass: 'text-green-400', bgClass: 'bg-green-500/20' },
    { label: 'Good', min: 60, max: 79, color: '#facc15', textClass: 'text-yellow-400', bgClass: 'bg-yellow-500/20' },
    { label: 'Needs Work', min: 40, max: 59, color: '#f97316', textClass: 'text-orange-400', bgClass: 'bg-orange-500/20' },
    { label: 'Poor', min: 0, max: 39, color: '#ef4444', textClass: 'text-red-400', bgClass: 'bg-red-500/20' },
  ];

  const getScoreRange = (score: number) => {
    return SCORE_RANGES.find(r => score >= r.min && score <= r.max) || SCORE_RANGES[SCORE_RANGES.length - 1];
  };

  // Legacy function for historical calls with rank but no score
  const getRankColor = (rank: string) => {
    switch (rank?.toUpperCase()) {
      case 'VERY HIGH': return 'text-green-400 bg-green-500/20';
      case 'HIGH': return 'text-green-400 bg-green-500/20';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/20';
      case 'LOW': return 'text-orange-400 bg-orange-500/20';
      case 'VERY LOW': return 'text-red-400 bg-red-500/20';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  // Format seconds to MM:SS for timestamp display
  const formatTimestamp = (seconds: number | undefined | null): string => {
    if (seconds === undefined || seconds === null) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Copy timestamp to clipboard
  const handleTimestampClick = (seconds: number) => {
    const formatted = formatTimestamp(seconds);
    navigator.clipboard.writeText(formatted);
    toast.success(`Timestamp ${formatted} copied`);
  };

  const toMmSs = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '--:--';
    return formatTimestamp(seconds);
  };

  const sectionScoresRaw = call.section_scores || {};
  const executionChecklist = call.discovery_wins || {};

  // Normalize key: "Process Discipline" -> "process_discipline"
  const normalizeKey = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/&/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  // Build a normalized lookup map from section_scores (handles both object and array formats)
  const isObject = (value: Json | null | undefined): value is Record<string, Json> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const toNumber = (value: Json | null | undefined): number | null =>
    typeof value === 'number' ? value : null;

  const toStringArray = (value: Json | null | undefined): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === 'string');
  };

  const toClaimArray = (value: Json | null | undefined): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry.trim();
        if (isObject(entry)) {
          if (typeof entry.claim === 'string') return entry.claim.trim();
          if (typeof entry.text === 'string') return entry.text.trim();
        }
        return '';
      })
      .filter((entry): entry is string => entry.length > 0);
  };

  const buildFeedbackFromSection = (value: Record<string, Json>): string | null => {
    const directFeedback = typeof value.feedback === 'string' ? value.feedback.trim() : '';
    if (directFeedback) return directFeedback;

    const strengths = typeof value.strengths === 'string' ? value.strengths.trim() : '';
    const gaps = typeof value.gaps === 'string' ? value.gaps.trim() : '';
    const action = typeof value.action === 'string' ? value.action.trim() : '';

    const wins = toClaimArray(value.wins).join(' ');
    const failures = toClaimArray(value.failures).join(' ');
    const coaching = typeof value.coaching === 'string' ? value.coaching.trim() : '';
    const tip = typeof value.tip === 'string' ? value.tip.trim() : '';

    const resolvedStrengths = strengths || wins;
    const resolvedGaps = gaps || failures;
    const resolvedAction = action || coaching || tip;

    if (!resolvedStrengths && !resolvedGaps && !resolvedAction) return null;

    return `STRENGTHS: ${resolvedStrengths || 'Not clearly demonstrated in this call.'} GAPS: ${resolvedGaps || 'No clear gaps were captured in the section output.'} ACTION: ${resolvedAction || 'Practice one specific behavior tied to this section on the next call.'}`;
  };

  const asSectionScoreEntry = (value: Json | null | undefined): SectionScoreEntry | null => {
    if (!isObject(value)) return null;
    return {
      score: toNumber(value.score) ?? undefined,
      wins: toClaimArray(value.wins),
      failures: toClaimArray(value.failures),
      coaching: typeof value.coaching === 'string' ? value.coaching : null,
      tip: typeof value.tip === 'string' ? value.tip : null,
      feedback: buildFeedbackFromSection(value),
    };
  };

  const sectionScoresMap: SectionScoreMap = (() => {
    // If it's already an object with normalized keys
    if (isObject(sectionScoresRaw)) {
      const map: SectionScoreMap = {};
      for (const [key, rawValue] of Object.entries(sectionScoresRaw)) {
        const normalizedKey = normalizeKey(key);
        const value = asSectionScoreEntry(rawValue);
        if (!value) continue;
        map[normalizedKey] = value;
        // Also store with original key for backward compatibility
        if (key !== normalizedKey) {
          map[key] = value;
        }
      }
      return map;
    }
    // If it's an array (service calls), convert to object using section_name
    if (Array.isArray(sectionScoresRaw)) {
      const map: SectionScoreMap = {};
      for (const section of sectionScoresRaw) {
        if (isObject(section) && typeof section.section_name === 'string') {
          const normalizedKey = normalizeKey(section.section_name);
          const value = asSectionScoreEntry(section);
          if (!value) continue;
          map[normalizedKey] = value;
        }
      }
      return map;
    }
    return {};
  })();

  // Backward compatible alias
  const sectionScores = sectionScoresMap;
  const crmNotes = isObject(call.closing_attempts) ? call.closing_attempts : {};
  const extractedData = isObject(call.client_profile) ? call.client_profile : {};

  const getClientProfileText = (value: Json | undefined) => {
    return typeof value === 'string' ? value : '';
  };

  const getClientProfileList = (value: Json | undefined): string[] => {
    return toStringArray(value);
  };

  const yourQuote = getClientProfileText(extractedData.your_quote);
  const budgetIndicators = getClientProfileText(extractedData.budget_indicators);
  const competitorQuote = getClientProfileText(extractedData.competitor_quote);
  const currentCoverage = getClientProfileText(extractedData.current_coverage);
  const householdSize = getClientProfileText(extractedData.household_size);
  const timeline = getClientProfileText(extractedData.timeline);
  const clientFirstName = getClientProfileText(extractedData.client_first_name);
  const salespersonNameFromProfile = getClientProfileText(extractedData.salesperson_name);
  const assets = getClientProfileList(extractedData.assets);
  const painPoints = getClientProfileList(extractedData.pain_points);

  // Get salesperson name from various possible locations
  const salespersonName = call.team_member_name ||
    salespersonNameFromProfile ||
    'Agent';

  const toNormalizedSkillScores = (scores: Json | null | undefined): NormalizedSkillScore[] => {
    if (Array.isArray(scores)) {
      return scores
        .filter((row): row is RawSkillScoreRow => isObject(row))
        .map((row) => ({
          skill_name: row.skill_name?.trim() || 'Skill',
          score: typeof row.score === 'number' ? row.score : 0,
          max_score: typeof row.max_score === 'number' && row.max_score > 0 ? row.max_score : 10,
          feedback: row.feedback ?? null,
          tip: row.tip ?? null
        }));
    }

    if (!isObject(scores)) return [];

    return Object.entries(scores).flatMap(([key, value]) => {
      const numericValue = toNumber(value);
      if (numericValue === null) {
        return [];
      }
      const normalizedScore = numericValue <= 10 ? numericValue : Math.round(numericValue / 10);
      return [{
        skill_name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        score: normalizedScore,
        max_score: 10,
        feedback: null,
        tip: null
      }];
    });
  };

  // Prepare radar chart data - handles both array and object formats
  const getRadarData = () => {
    const scores = call.skill_scores;
    const normalizedScores = toNormalizedSkillScores(scores as Json | null | undefined);
    
    // Handle array format (new): [{skill_name, score (0-10), max_score}]
    if (Array.isArray(scores) && scores.length > 0) {
      const findScore = (keywords: string[]) => {
        const match = normalizedScores.find((s) =>
          keywords.some((k) => s.skill_name?.toLowerCase().includes(k.toLowerCase()))
        );
        return match ? (match.score / (match.max_score || 10)) * 100 : 50;
      };
      
      return [
        { skill: 'Rapport', score: findScore(['rapport', 'thanking', 'greeting']), fullMark: 100 },
        { skill: 'Discovery', score: findScore(['discovery', 'question', 'value-based']), fullMark: 100 },
        { skill: 'Coverage', score: findScore(['coverage', 'liability', 'protection']), fullMark: 100 },
        { skill: 'Objection', score: findScore(['objection', 'handling']), fullMark: 100 },
        { skill: 'Closing', score: findScore(['closing', 'assumptive', 'sale']), fullMark: 100 },
      ];
    }
    
    // Handle object format (legacy): {rapport: 75, discovery: 60, ...}
    const scoresObj = isObject(scores) ? scores : {};
    return [
      { skill: 'Rapport', score: sectionScores.rapport?.score ?? toNumber(scoresObj.rapport) ?? 50, fullMark: 100 },
      { skill: 'Discovery', score: toNumber(scoresObj.discovery) ?? 50, fullMark: 100 },
      { skill: 'Coverage', score: sectionScores.coverage?.score ?? toNumber(scoresObj.coverage) ?? 50, fullMark: 100 },
      { skill: 'Objection', score: toNumber(scoresObj.objection_handling) ?? 50, fullMark: 100 },
      { skill: 'Closing', score: sectionScores.closing?.score ?? toNumber(scoresObj.closing) ?? 50, fullMark: 100 },
    ];
  };

  // Parse price for comparison bars
  const parsePrice = (priceValue: unknown) => {
    const priceStr =
      typeof priceValue === 'string'
        ? priceValue
        : typeof priceValue === 'number'
          ? priceValue.toString()
          : '';
    if (!priceStr) return 0;
    return parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
  };

  // Format seconds to mm:ss
  const formatSecondsToMinutes = (seconds: number | null | undefined) => {
    if (!seconds && seconds !== 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Talk ratio data from call
  const agentTalkSeconds = call.agent_talk_seconds;
  const customerTalkSeconds = call.customer_talk_seconds;
  const deadAirSeconds = call.dead_air_seconds;
  const totalTalkSeconds =
    (agentTalkSeconds ?? 0) + (customerTalkSeconds ?? 0) + (deadAirSeconds ?? 0);
  const hasUsableSeconds = totalTalkSeconds > 0;
  const agentTalkPercent = hasUsableSeconds
    ? ((agentTalkSeconds ?? 0) / totalTalkSeconds) * 100
    : call.agent_talk_percent;
  const customerTalkPercent = hasUsableSeconds
    ? ((customerTalkSeconds ?? 0) / totalTalkSeconds) * 100
    : call.customer_talk_percent;
  const deadAirPercent = hasUsableSeconds
    ? ((deadAirSeconds ?? 0) / totalTalkSeconds) * 100
    : call.dead_air_percent;

  const yourQuoteValue = parsePrice(yourQuote || budgetIndicators);
  const competitorQuoteValue = parsePrice(competitorQuote || currentCoverage);
  const maxQuote = Math.max(yourQuoteValue, competitorQuoteValue, 1);

  const handleExportPNG = async () => {
    if (!scorecardRef.current) return;
    setExporting(true);
    const filename = `scorecard-${salespersonName}-${new Date().toISOString().split('T')[0]}`;
    const success = await exportScorecardAsPNG(scorecardRef.current, filename);
    if (success) toast.success('Downloaded as PNG');
    else toast.error('Export failed');
    setExporting(false);
  };

  const handleExportPDF = async () => {
    if (!scorecardRef.current) return;
    setExporting(true);
    const filename = `scorecard-${salespersonName}-${new Date().toISOString().split('T')[0]}`;
    const success = await exportScorecardAsPDF(scorecardRef.current, filename);
    if (success) toast.success('Downloaded as PDF');
    else toast.error('Export failed');
    setExporting(false);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/call-scoring?call=${call.id}`);
    toast.success('Link copied to clipboard');
  };

  // Show loading state
  if (loading) {
    return (
      <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogTitle className="sr-only">Loading call details</DialogTitle>
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">Call scorecard details</DialogTitle>
        {/* Export buttons - OUTSIDE the ref so they don't appear in export */}
        <div className="absolute top-4 right-12 z-10 flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Follow-Up</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowFollowUpDialog(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Generate Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowFollowUpDialog(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Generate Text/SMS
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowFollowUpDialog(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Both
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPNG}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">PNG</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={exporting}
          >
            <Download className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">PDF</span>
          </Button>
        </div>

        {/* Everything that should be exported goes inside this ref */}
        <div ref={scorecardRef} className="bg-background">
          {/* Header */}
          <div className="border-b p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-red-500 font-medium tracking-wider mb-1">CALL PERFORMANCE AUDIT</p>
                <h1 className="text-2xl font-bold tracking-tight">
                  SALESPERSON: {salespersonName.toUpperCase()}
                </h1>
                <div className="h-1 w-16 bg-blue-500 mt-2" />
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">PERFORMANCE SCORE</p>
                {/* Show score-based display for new calls, fall back to rank for historical */}
                {call.overall_score !== null && call.overall_score !== undefined ? (
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={`text-lg px-3 py-1 ${getScoreRange(call.overall_score).textClass} ${getScoreRange(call.overall_score).bgClass}`}>
                      {call.overall_score}%
                    </Badge>
                    <span className={`text-xs ${getScoreRange(call.overall_score).textClass}`}>
                      {getScoreRange(call.overall_score).label}
                    </span>
                  </div>
                ) : call.potential_rank ? (
                  <Badge className={`text-lg px-3 py-1 ${getRankColor(call.potential_rank)}`}>
                    {call.potential_rank}
                  </Badge>
                ) : (
                  <Badge className="text-lg px-3 py-1 text-muted-foreground bg-muted">
                    PENDING
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="p-6 space-y-6">
          {/* Key Metrics Row - Stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Your Quote / Budget */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {yourQuote ? 'YOUR QUOTE' : budgetIndicators ? 'BUDGET' : 'YOUR QUOTE'}
                </p>
                <p className="text-xl sm:text-2xl font-bold break-words">
                  {yourQuote || budgetIndicators || '--'}
                </p>
              </CardContent>
            </Card>
            
            {/* Competitor / Current Coverage */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {competitorQuote ? 'COMPETITOR AVG' : currentCoverage ? 'CURRENT COVERAGE' : 'COMPETITOR AVG'}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-green-400 break-words">
                  {competitorQuote ? `~${competitorQuote}` : currentCoverage || '--'}
                </p>
              </CardContent>
            </Card>
            
            {/* Asset Profile / Household */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1 text-center sm:text-left">
                  {assets.length ? 'ASSET PROFILE' : householdSize ? 'HOUSEHOLD' : 'ASSET PROFILE'}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs sm:text-sm">
                  {assets.length > 0 ? (
                    assets.slice(0, 2).map((asset: string, i: number) => (
                      <span key={i} className="truncate max-w-full sm:max-w-[120px]">{asset}</span>
                    ))
                  ) : (
                    <span className="truncate max-w-full">{householdSize || '--'}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Talk-to-Listen Ratio Section */}
          {(agentTalkPercent !== null && agentTalkPercent !== undefined) && (
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  TALK-TO-LISTEN RATIO
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Agent Talk */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <User className="h-3 w-3" />
                      Agent
                    </span>
                    <span className="font-medium">
                      {agentTalkPercent?.toFixed(0)}%
                      <span className="text-muted-foreground text-xs ml-1">
                        ({formatSecondsToMinutes(agentTalkSeconds)})
                      </span>
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        agentTalkPercent > 60 ? 'bg-red-500' : 
                        agentTalkPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(agentTalkPercent, 100)}%` }}
                    />
                  </div>
                </div>
                
                {/* Customer Talk */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      Customer
                    </span>
                    <span className="font-medium">
                      {customerTalkPercent?.toFixed(0)}%
                      <span className="text-muted-foreground text-xs ml-1">
                        ({formatSecondsToMinutes(customerTalkSeconds)})
                      </span>
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        customerTalkPercent >= 50 ? 'bg-green-500' : 
                        customerTalkPercent >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(customerTalkPercent, 100)}%` }}
                    />
                  </div>
                </div>
                
                {/* Dead Air */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <VolumeX className="h-3 w-3" />
                      Dead Air
                    </span>
                    <span className="font-medium">
                      {deadAirPercent?.toFixed(0)}%
                      <span className="text-muted-foreground text-xs ml-1">
                        ({formatSecondsToMinutes(deadAirSeconds)})
                      </span>
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        deadAirPercent > 15 ? 'bg-red-500' : 
                        deadAirPercent > 10 ? 'bg-yellow-500' : 'bg-blue-500/50'
                      }`}
                      style={{ width: `${Math.min(deadAirPercent, 100)}%` }}
                    />
                  </div>
                </div>
                
                {/* Coaching Insight */}
                <div className={`mt-4 p-3 rounded-lg text-sm ${
                  agentTalkPercent <= 45 && customerTalkPercent >= 45 
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : agentTalkPercent > 60
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                    : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                }`}>
                  {agentTalkPercent <= 45 && customerTalkPercent >= 45 ? (
                    <p>✓ Great balance! You let the customer do most of the talking.</p>
                  ) : agentTalkPercent > 60 ? (
                    <p>⚠ You talked {agentTalkPercent?.toFixed(0)}% of the call. Try asking more open-ended questions to get the customer talking.</p>
                  ) : (
                    <p>→ Aim for 40% or less talk time. Top performers listen more than they speak.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Critical Assessment + Extracted Data Row */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Critical Assessment - Takes 2 columns */}
            <Card className="md:col-span-2 border-l-4 border-l-red-500">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  CRITICAL ASSESSMENT
                </p>
                <p className="text-sm leading-relaxed">
                  {call.critical_gaps?.assessment || call.summary || 'Analysis pending...'}
                </p>
              </CardContent>
            </Card>

              {/* Extracted CRM Data */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileAudio className="h-3 w-3" />
                    EXTRACTED CRM DATA
                  </p>
                  
                  {/* Legacy: Quote Comparison OR New: Budget Info */}
                  {yourQuote ? (
                    <div>
                      <p className="text-xs text-muted-foreground">QUOTE COMPARISON</p>
                      <p className="text-lg font-bold">
                        {yourQuote}
                        {competitorQuote && (
                          <span className="text-sm text-muted-foreground ml-2">
                            vs <span className="text-green-400">{competitorQuote}</span>
                          </span>
                        )}
                      </p>
                    </div>
                  ) : budgetIndicators && (
                    <div>
                      <p className="text-xs text-muted-foreground">BUDGET</p>
                      <p className="text-sm font-medium">{budgetIndicators}</p>
                    </div>
                  )}

                  {/* Legacy: Assets OR New: Current Coverage */}
                  {assets.length > 0 ? (
                    <div>
                      <p className="text-xs text-muted-foreground">ASSETS</p>
                      {assets.map((asset: string, i: number) => (
                        <p key={i} className="text-sm flex items-center gap-1">
                          <span className="w-1 h-4 bg-blue-500 rounded" />
                          {asset}
                        </p>
                      ))}
                    </div>
                  ) : currentCoverage && (
                    <div>
                      <p className="text-xs text-muted-foreground">CURRENT COVERAGE</p>
                      <p className="text-sm flex items-center gap-1">
                        <span className="w-1 h-4 bg-blue-500 rounded" />
                        {currentCoverage}
                      </p>
                    </div>
                  )}

                  {/* Legacy: Timeline OR New: Household */}
                  {timeline ? (
                    <div>
                      <p className="text-xs text-muted-foreground">FOLLOW UP PLAN</p>
                      <p className="text-sm text-yellow-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeline}
                      </p>
                    </div>
                  ) : householdSize && (
                    <div>
                      <p className="text-xs text-muted-foreground">HOUSEHOLD</p>
                      <p className="text-sm">{householdSize}</p>
                    </div>
                  )}

                  {/* New: Pain Points (no legacy equivalent) */}
                  {painPoints.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">PAIN POINTS</p>
                      {painPoints.map((point: string, i: number) => (
                        <p key={i} className="text-sm flex items-center gap-1 text-orange-400">
                          <span className="w-1 h-4 bg-orange-500 rounded" />
                          {point}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
          </div>

          {/* Three Section Scores OR Skill Breakdown */}
          {(() => {
            // Check for both normalized keys and alternate GPT output keys
            const rapportData = sectionScores.rapport || sectionScores.opening__rapport || sectionScores.opening_rapport;
            const coverageData = sectionScores.coverage || sectionScores.coverage_education || sectionScores.coverage__education;
            const closingData = sectionScores.closing;
            const hasLegacySections = rapportData || coverageData || closingData;
            
              // Handle both array and object formats for skill_scores
              // CRITICAL: Always enrich with feedback/tip from section_scores using normalized keys
              const skillScoresArray = (() => {
                const normalizedSkillScores = toNormalizedSkillScores(call.skill_scores as Json | null | undefined);

                // If skill_scores is an array, enrich each entry with section_scores data
                if (Array.isArray(call.skill_scores)) {
                  return normalizedSkillScores.map((row) => {
                    const key = normalizeKey(row.skill_name || '');
                    const sectionData = sectionScoresMap[key];
                    return {
                      ...row,
                      // Use existing feedback/tip if present, otherwise pull from section_scores
                      feedback: row.feedback ?? sectionData?.feedback ?? sectionData?.coaching ?? null,
                      tip: row.tip ?? sectionData?.tip ?? null
                    };
                  });
                  }
                  return normalizedSkillScores.map((row) => {
                    const normalizedKey = normalizeKey(row.skill_name);
                    const sectionData = sectionScoresMap[normalizedKey];
                    return {
                      ...row,
                      feedback: row.feedback ?? sectionData?.feedback ?? sectionData?.coaching ?? null,
                      tip: row.tip ?? sectionData?.tip ?? null
                    };
                  });
                  return [];
                })();
            
            if (hasLegacySections) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Rapport */}
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-sm">RAPPORT</h3>
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      
                      {/* Legacy: Wins */}
                      {rapportData?.wins?.map((win: string, i: number) => (
                        <p key={`win-${i}`} className="text-sm text-green-400 flex items-start gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{win}</span>
                        </p>
                      ))}
                      
                      {/* Legacy: Failures */}
                      {rapportData?.failures?.map((failure: string, i: number) => (
                        <p key={`fail-${i}`} className="text-sm text-red-400 flex items-start gap-2 mb-2">
                          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{failure}</span>
                        </p>
                      ))}
                      
                      {rapportData?.coaching && (
                        <div className="mt-4 pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-1">COACHING</p>
                          <p className="text-sm">{rapportData.coaching}</p>
                        </div>
                      )}
                      
                      {/* NEW: Handle feedback string format (STRENGTHS/GAPS/ACTION) */}
                      {rapportData?.feedback && (!rapportData?.wins || rapportData.wins.length === 0) && (() => {
                        const parsed = parseFeedback(rapportData.feedback);
                        if (parsed.strengths || parsed.gaps || parsed.action) {
                          return (
                            <div className="space-y-2">
                              {parsed.strengths && (
                                <div className="flex items-start gap-2">
                                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                                  <p className="text-sm text-green-400">
                                    <span className="font-semibold">STRENGTHS:</span> {parsed.strengths}
                                  </p>
                                </div>
                              )}
                              {parsed.gaps && (
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                                  <p className="text-sm text-amber-400">
                                    <span className="font-semibold">GAPS:</span> {parsed.gaps}
                                  </p>
                                </div>
                              )}
                              {parsed.action && (
                                <div className="flex items-start gap-2">
                                  <Target className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                                  <p className="text-sm text-blue-400">
                                    <span className="font-semibold">ACTION:</span> {parsed.action}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return <p className="text-sm text-muted-foreground">{rapportData.feedback}</p>;
                      })()}
                      {rapportData?.tip && (
                        <p className="text-xs text-green-400 mt-3">💡 {rapportData.tip}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Coverage */}
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-sm">COVERAGE</h3>
                        <Target className="h-4 w-4 text-muted-foreground" />
                      </div>
                      
                      {/* Legacy: Wins */}
                      {coverageData?.wins?.map((win: string, i: number) => (
                        <p key={`win-${i}`} className="text-sm text-green-400 flex items-start gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{win}</span>
                        </p>
                      ))}
                      
                      {/* Legacy: Failures */}
                      {coverageData?.failures?.map((failure: string, i: number) => (
                        <p key={`fail-${i}`} className="text-sm text-red-400 flex items-start gap-2 mb-2">
                          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{failure}</span>
                        </p>
                      ))}
                      
                      {coverageData?.coaching && (
                        <div className="mt-4 pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-1">COACHING</p>
                          <p className="text-sm">{coverageData.coaching}</p>
                        </div>
                      )}
                      
                      {/* NEW: Handle feedback string format */}
                      {coverageData?.feedback && (!coverageData?.wins || coverageData.wins.length === 0) && (() => {
                        const parsed = parseFeedback(coverageData.feedback);
                        if (parsed.strengths || parsed.gaps || parsed.action) {
                          return (
                            <div className="space-y-2">
                              {parsed.strengths && (
                                <div className="flex items-start gap-2">
                                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                                  <p className="text-sm text-green-400">
                                    <span className="font-semibold">STRENGTHS:</span> {parsed.strengths}
                                  </p>
                                </div>
                              )}
                              {parsed.gaps && (
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                                  <p className="text-sm text-amber-400">
                                    <span className="font-semibold">GAPS:</span> {parsed.gaps}
                                  </p>
                                </div>
                              )}
                              {parsed.action && (
                                <div className="flex items-start gap-2">
                                  <Target className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                                  <p className="text-sm text-blue-400">
                                    <span className="font-semibold">ACTION:</span> {parsed.action}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return <p className="text-sm text-muted-foreground">{coverageData.feedback}</p>;
                      })()}
                      {coverageData?.tip && (
                        <p className="text-xs text-green-400 mt-3">💡 {coverageData.tip}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Closing */}
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-sm">CLOSING</h3>
                        <Target className="h-4 w-4 text-muted-foreground" />
                      </div>
                      
                      {/* Legacy: Wins */}
                      {closingData?.wins?.map((win: string, i: number) => (
                        <p key={`win-${i}`} className="text-sm text-green-400 flex items-start gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{win}</span>
                        </p>
                      ))}
                      
                      {/* Legacy: Failures */}
                      {closingData?.failures?.map((failure: string, i: number) => (
                        <p key={`fail-${i}`} className="text-sm text-red-400 flex items-start gap-2 mb-2">
                          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{failure}</span>
                        </p>
                      ))}
                      
                      {closingData?.coaching && (
                        <div className="mt-4 pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-1">COACHING</p>
                          <p className="text-sm">{closingData.coaching}</p>
                        </div>
                      )}
                      
                      {/* NEW: Handle feedback string format */}
                      {closingData?.feedback && (!closingData?.wins || closingData.wins.length === 0) && (() => {
                        const parsed = parseFeedback(closingData.feedback);
                        if (parsed.strengths || parsed.gaps || parsed.action) {
                          return (
                            <div className="space-y-2">
                              {parsed.strengths && (
                                <div className="flex items-start gap-2">
                                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                                  <p className="text-sm text-green-400">
                                    <span className="font-semibold">STRENGTHS:</span> {parsed.strengths}
                                  </p>
                                </div>
                              )}
                              {parsed.gaps && (
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                                  <p className="text-sm text-amber-400">
                                    <span className="font-semibold">GAPS:</span> {parsed.gaps}
                                  </p>
                                </div>
                              )}
                              {parsed.action && (
                                <div className="flex items-start gap-2">
                                  <Target className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                                  <p className="text-sm text-blue-400">
                                    <span className="font-semibold">ACTION:</span> {parsed.action}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return <p className="text-sm text-muted-foreground">{closingData.feedback}</p>;
                      })()}
                      {closingData?.tip && (
                        <p className="text-xs text-green-400 mt-3">💡 {closingData.tip}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            } else if (skillScoresArray.length > 0) {
              return (
                <Card>
                  <CardContent className="pt-4">
                    <h3 className="font-bold text-sm mb-4">SKILL BREAKDOWN</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {skillScoresArray.map((skill: NormalizedSkillScore, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-sm">{skill.skill_name}</span>
                            <Badge variant={skill.score >= 7 ? "default" : skill.score >= 5 ? "secondary" : "destructive"}>
                              {skill.score}/{skill.max_score || 10}
                            </Badge>
                          </div>
                          {skill.feedback && (() => {
                            const parsed = parseFeedback(skill.feedback);
                            if (parsed.strengths || parsed.gaps || parsed.action) {
                              return (
                                <div className="space-y-2 mt-2">
                                  {parsed.strengths && (
                                    <div className="flex items-start gap-2">
                                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                                      <p className="text-xs text-green-400">
                                        <span className="font-semibold">STRENGTHS:</span> {parsed.strengths}
                                      </p>
                                    </div>
                                  )}
                                  {parsed.gaps && (
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                                      <p className="text-xs text-amber-400">
                                        <span className="font-semibold">GAPS:</span> {parsed.gaps}
                                      </p>
                                    </div>
                                  )}
                                  {parsed.action && (
                                    <div className="flex items-start gap-2">
                                      <Target className="h-3.5 w-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                                      <p className="text-xs text-blue-400">
                                        <span className="font-semibold">ACTION:</span> {parsed.action}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return <p className="text-xs text-muted-foreground mb-2">{skill.feedback}</p>;
                          })()}
                          {skill.tip && (
                            <p className="text-xs text-green-400 mt-2">💡 {skill.tip}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}

          {/* Visual Charts Row */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Price Resistance Gap */}
            {yourQuote && competitorQuote && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <h3 className="font-bold text-sm">PRICE RESISTANCE GAP</h3>
                  </div>
                  
                  <div className="flex items-end justify-center gap-8 h-40">
                    {/* Competitor Bar */}
                    <div className="flex flex-col items-center">
                      <div 
                        className="w-16 bg-green-500 rounded-t transition-all"
                        style={{ 
                          height: `${Math.max(20, (competitorQuoteValue / maxQuote) * 100)}px` 
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-2">Competitor</p>
                        <p className="text-sm font-medium text-green-400">{competitorQuote}</p>
                    </div>
                    
                    {/* Your Quote Bar */}
                    <div className="flex flex-col items-center">
                      <div 
                        className="w-16 bg-red-500 rounded-t transition-all"
                        style={{ height: `${Math.max(20, (yourQuoteValue / maxQuote) * 100)}px` }}
                      />
                      <p className="text-xs text-muted-foreground mt-2">Your Quote</p>
                      <p className="text-sm font-medium text-red-400">{yourQuote}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Skill Execution Gap - Radar Chart */}
            <Card className={!yourQuote || !competitorQuote ? 'md:col-span-2' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <h3 className="font-bold text-sm">SKILL EXECUTION GAP</h3>
                </div>
                
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={getRadarData()}>
                      <PolarGrid stroke="#333" />
                      <PolarAngleAxis 
                        dataKey="skill" 
                        tick={{ fill: '#888', fontSize: 11 }}
                      />
                      <Radar
                        name="Target"
                        dataKey="fullMark"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.1}
                        strokeDasharray="5 5"
                      />
                      <Radar
                        name="Actual"
                        dataKey="score"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.3}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex items-center justify-center gap-4 mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500/30 border border-red-500 rounded" />
                    <span className="text-muted-foreground">{salespersonName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500/10 border border-blue-500 border-dashed rounded" />
                    <span className="text-muted-foreground">Target</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Corrective Action Plan */}
          {(() => {
            const classifyPlanDomain = (value: unknown): 'rapport' | 'value' | 'closing' | 'unknown' => {
              if (typeof value !== 'string') return 'unknown';
              const text = value.toLowerCase();
              if (!text.trim()) return 'unknown';

              const rapportSignals = ['rapport', 'open-ended', 'open ended', 'home', 'work', 'family', 'greet', 'trust', 'connection', 'personal'];
              const valueSignals = ['coverage', 'value', 'liability', 'deductible', 'protect', 'premium', 'quote', 'asset', 'differentiate', 'discovery', 'advisor'];
              const closingSignals = ['close', 'closing', 'sale', 'assumptive', 'yes/no', 'follow-up', 'follow up', 'commitment', 'next step'];

              if (closingSignals.some((signal) => text.includes(signal))) return 'closing';
              if (rapportSignals.some((signal) => text.includes(signal))) return 'rapport';
              if (valueSignals.some((signal) => text.includes(signal))) return 'value';
              return 'unknown';
            };

            const extractSectionAction = (entry: SectionScoreEntry | undefined): string | null => {
              if (!entry) return null;
              if (entry.coaching?.trim()) return entry.coaching.trim();
              if (entry.tip?.trim()) return entry.tip.trim();
              if (!entry.feedback?.trim()) return null;
              const parsed = parseFeedback(entry.feedback);
              return parsed.action?.trim() || null;
            };

            const correctivePlan = isObject(call.critical_gaps)
              ? (isObject(call.critical_gaps.corrective_plan)
                  ? call.critical_gaps.corrective_plan
                  : isObject(call.critical_gaps.corrective_action_plan)
                    ? call.critical_gaps.corrective_action_plan
                    : {})
              : {};

            const planValue = (key: string): string | null => {
              const raw = correctivePlan[key];
              return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
            };

            const pickDomainText = (
              domain: 'rapport' | 'value' | 'closing',
              explicitKeys: string[],
              sectionFallback: string | null,
              hardFallback: string
            ): string => {
              for (const key of explicitKeys) {
                const directValue = planValue(key);
                if (directValue) return directValue;
              }

              const genericCandidates = [
                planValue('primary_focus'),
                planValue('secondary_focus'),
                planValue('closing_focus'),
              ].filter((item): item is string => Boolean(item));

              for (const candidate of genericCandidates) {
                if (classifyPlanDomain(candidate) === domain) {
                  return candidate;
                }
              }

              if (sectionFallback) return sectionFallback;
              return hardFallback;
            };

            // Get relevant tips from skill_scores based on keywords
            const getRelevantTips = (keywords: string[]) => {
              if (!Array.isArray(call.skill_scores)) return [];
              return call.skill_scores
                .filter((rawSkill): rawSkill is RawSkillScoreRow => isObject(rawSkill))
                .filter((s) => keywords.some(k => s.skill_name?.toLowerCase().includes(k.toLowerCase())))
                .map((s) => s.tip)
                .filter((tip): tip is string => typeof tip === 'string');
            };

            // Group tips by coaching category
            const rapportTips = getRelevantTips(['rapport', 'thanking', 'greeting', 'frame']);
            const valueTips = getRelevantTips(['question', 'coverage', 'liability', 'value']);
            const closingTips = getRelevantTips(['closing', 'assumptive', 'objection', 'follow-up', 'requote']);

            const rapportPlanText = pickDomainText(
              'rapport',
              ['rapport', 'rapport_focus'],
              extractSectionAction(sectionScores.rapport),
              'Build deeper connection using the HWF framework before discussing insurance details.'
            );
            const valuePlanText = pickDomainText(
              'value',
              ['value_building', 'value_focus'],
              extractSectionAction(sectionScores.coverage),
              'Explain liability protection before quoting price. Position as advisor, not order-taker.'
            );
            const closingPlanText = pickDomainText(
              'closing',
              ['closing', 'closing_focus'],
              extractSectionAction(sectionScores.closing),
              'Use assumptive close language and set hard follow-up appointments with specific times.'
            );

            return (
              <Card className="border-t-4 border-t-blue-500">
                <CardContent className="pt-4">
                  <h3 className="font-bold text-sm mb-4">CORRECTIVE ACTION PLAN</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Rapport Action */}
                    <div>
                      <h4 className="text-red-400 font-medium text-sm mb-2">RAPPORT</h4>
                      <p className="text-sm text-muted-foreground">
                        {rapportPlanText}
                      </p>
                      {rapportTips.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {rapportTips.map((tip: string, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground/80 flex items-start gap-1">
                              <span className="text-green-400 flex-shrink-0">💡</span> 
                              <span>{tip}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Value Building Action */}
                    <div>
                      <h4 className="text-red-400 font-medium text-sm mb-2">VALUE BUILDING</h4>
                      <p className="text-sm text-muted-foreground">
                        {valuePlanText}
                      </p>
                      {valueTips.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {valueTips.map((tip: string, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground/80 flex items-start gap-1">
                              <span className="text-green-400 flex-shrink-0">💡</span> 
                              <span>{tip}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Closing Action */}
                    <div>
                      <h4 className="text-red-400 font-medium text-sm mb-2">CLOSING</h4>
                      <p className="text-sm text-muted-foreground">
                        {closingPlanText}
                      </p>
                      {closingTips.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {closingTips.map((tip: string, i: number) => (
                            <p key={i} className="text-xs text-muted-foreground/80 flex items-start gap-1">
                              <span className="text-green-400 flex-shrink-0">💡</span> 
                              <span>{tip}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Execution Clean Sheet */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-bold text-sm mb-4">EXECUTION CLEAN SHEET</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Support new checklist array format with evidence objects */}
                {Array.isArray(executionChecklist) && executionChecklist.length > 0 && typeof executionChecklist[0] === 'object' && 'label' in executionChecklist[0] ? (
                  executionChecklist.map((item: { label: string; checked: boolean; evidence?: string | { text: string; timestamp_seconds?: number } | null }, idx: number) => {
                    const evidenceObj = typeof item.evidence === 'object' && item.evidence !== null ? item.evidence : null;
                    const evidenceStr = typeof item.evidence === 'string' ? item.evidence : null;
                    
                    return (
                      <div key={idx} className="flex items-start gap-2">
                        <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          item.checked ? 'bg-green-500/20 border-green-500' : 'border-muted-foreground/30'
                        }`}>
                          {item.checked && <CheckCircle2 className="h-3 w-3 text-green-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground uppercase block">
                            {item.label}
                          </span>
                          {evidenceObj && evidenceObj.text && (
                            <div className="flex items-start gap-2 mt-1">
                              {evidenceObj.timestamp_seconds !== undefined && (
                                <button
                                  onClick={() => handleTimestampClick(evidenceObj.timestamp_seconds!)}
                                  className="flex-shrink-0 px-1.5 py-0.5 text-xs font-mono bg-background/80 rounded border border-border hover:bg-muted"
                                  title="Click to copy timestamp"
                                >
                                  {formatTimestamp(evidenceObj.timestamp_seconds)}
                                </button>
                              )}
                              <p className="text-xs text-muted-foreground/70 italic line-clamp-2">
                                "{evidenceObj.text}"
                              </p>
                            </div>
                          )}
                          {evidenceStr && (
                            <p className="text-xs text-muted-foreground/70 italic mt-1 line-clamp-2">
                              "{evidenceStr}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  /* Legacy format: discovery_wins as object */
                  Object.entries(executionChecklist).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                        value ? 'bg-green-500/20 border-green-500' : 'border-muted-foreground/30'
                      }`}>
                        {value && <CheckCircle2 className="h-3 w-3 text-green-400" />}
                      </div>
                      <span className="text-xs text-muted-foreground uppercase">
                        {key.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* CRM Notes Expandable */}
          <Card>
            <CardContent className="pt-4">
              <button
                onClick={() => setShowCrmNotes(!showCrmNotes)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-bold text-sm">VIEW RAW CRM NOTES</h3>
                {showCrmNotes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {showCrmNotes && (
                <div className="mt-4 space-y-3 text-sm">
                  {/* Structured CRM notes fields */}
                  {crmNotes.personal_rapport && (
                    <div>
                      <p className="text-xs text-muted-foreground">Personal Rapport</p>
                      <p>{crmNotes.personal_rapport}</p>
                    </div>
                  )}
                  {crmNotes.motivation_to_switch && (
                    <div>
                      <p className="text-xs text-muted-foreground">Motivation to Switch</p>
                      <p>{crmNotes.motivation_to_switch}</p>
                    </div>
                  )}
                  {crmNotes.coverage_gaps_discussed && (
                    <div>
                      <p className="text-xs text-muted-foreground">Coverage & Gaps</p>
                      <p>{crmNotes.coverage_gaps_discussed}</p>
                    </div>
                  )}
                  {crmNotes.premium_insights && (
                    <div>
                      <p className="text-xs text-muted-foreground">Premium Insights</p>
                      <p>{crmNotes.premium_insights}</p>
                    </div>
                  )}
                  {crmNotes.decision_process && (
                    <div>
                      <p className="text-xs text-muted-foreground">Decision Process</p>
                      <p>{crmNotes.decision_process}</p>
                    </div>
                  )}
                  {crmNotes.quote_summary && (
                    <div>
                      <p className="text-xs text-muted-foreground">Quote Summary</p>
                      <p>{crmNotes.quote_summary}</p>
                    </div>
                  )}
                  {crmNotes.follow_up_details && (
                    <div>
                      <p className="text-xs text-muted-foreground">Follow-Up</p>
                      <p>{crmNotes.follow_up_details}</p>
                    </div>
                  )}
                  
                  {/* Fallback: if no known keys exist, show raw content */}
                  {!crmNotes.personal_rapport && !crmNotes.motivation_to_switch && !crmNotes.coverage_gaps_discussed && (
                    <>
                      {crmNotes.raw && (
                        <div>
                          <p className="text-xs text-muted-foreground">Notes</p>
                          <p className="whitespace-pre-wrap">{crmNotes.raw}</p>
                        </div>
                      )}
                      {/* Show any other keys that might exist */}
                      {Object.entries(crmNotes)
                        .filter(([key]) => !['raw', 'personal_rapport', 'motivation_to_switch', 'coverage_gaps_discussed', 'premium_insights', 'decision_process', 'quote_summary', 'follow_up_details'].includes(key))
                        .map(([key, value]) => (
                          <div key={key}>
                            <p className="text-xs text-muted-foreground">{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                            <p>{typeof value === 'string' ? value : JSON.stringify(value)}</p>
                          </div>
                        ))
                      }
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notable Quotes with Timestamps */}
          {call.notable_quotes && Array.isArray(call.notable_quotes) && call.notable_quotes.length > 0 && (
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-4">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <MessageSquareQuote className="h-4 w-4 text-purple-400" />
                  KEY MOMENTS
                </h3>
                <div className="space-y-3">
                  {call.notable_quotes.map((quote: {
                    text: string;
                    speaker: 'agent' | 'customer';
                    timestamp_seconds?: number;
                    context?: string;
                  }, idx: number) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border ${
                        quote.speaker === 'agent' 
                          ? 'bg-blue-500/10 border-blue-500/30' 
                          : 'bg-green-500/10 border-green-500/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Timestamp button */}
                        {quote.timestamp_seconds !== undefined && quote.timestamp_seconds !== null && (
                          <button
                            onClick={() => handleTimestampClick(quote.timestamp_seconds!)}
                            className="flex-shrink-0 px-2 py-1 text-xs font-mono bg-background/80 rounded border border-border hover:bg-muted transition-colors"
                            title="Click to copy timestamp"
                          >
                            {formatTimestamp(quote.timestamp_seconds)}
                          </button>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm italic">"{quote.text}"</p>
                          {quote.context && (
                            <p className="text-xs text-muted-foreground mt-1">
                              → {quote.context}
                            </p>
                          )}
                        </div>
                        
                        {/* Speaker badge */}
                        <Badge 
                          variant="outline" 
                          className={`flex-shrink-0 text-xs ${
                            quote.speaker === 'agent' 
                              ? 'text-blue-400 border-blue-500/50' 
                              : 'text-green-400 border-green-500/50'
                          }`}
                        >
                          {quote.speaker === 'agent' ? 'Agent' : 'Customer'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
          </Card>
          )}

          {/* Time-Based Q&A */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-400" />
                CALL TIMELINE Q&A
              </h3>
              {qaEnabled && (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-blue-400/90">
                    Ask timeline questions right here (for example: "When did we discuss liability limits?")
                  </p>
                  <span className={`text-xs font-medium ${qaQuestionsUsed >= QA_QUESTION_LIMIT ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {qaQuestionsUsed}/{QA_QUESTION_LIMIT} questions
                  </span>
                </div>
              )}

              {!qaEnabled ? (
                <p className="text-sm text-muted-foreground">
                  Ask-specific timeline questions are not enabled for your agency.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="qa-question">Ask about a moment in this call</Label>
                    <Textarea
                      id="qa-question"
                      value={qaQuestion}
                      onChange={(e) => setQaQuestion(e.target.value)}
                      placeholder="Example: When did they discuss liability limits?"
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <Button onClick={handleQaQuery} disabled={qaLoading || !qaQuestion.trim() || qaQuestionsUsed >= QA_QUESTION_LIMIT}>
                      {qaLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4 mr-2" />
                          Ask
                        </>
                      )}
                    </Button>
                  </div>

                  {qaError && (
                    <p className="mt-3 text-sm text-destructive">{qaError}</p>
                  )}

                  {qaResult && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {qaResult.summary} (confidence: {(qaResult.confidence * 100).toFixed(0)}%)
                      </p>
                      {qaResult.matches.length > 0 ? (
                        qaResult.matches.map((match, idx) => (
                          <div key={`${match.timestamp_seconds}-${idx}`} className="rounded-lg border border-border bg-muted/20 p-3">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              {match.timestamp_seconds !== null && match.timestamp_seconds !== undefined && (
                                <button
                                  type="button"
                                  onClick={() => handleTimestampClick(match.timestamp_seconds!)}
                                  className="px-2 py-1 text-xs font-mono bg-background/80 rounded border border-border hover:bg-muted"
                                >
                                  {toMmSs(match.timestamp_seconds)}
                                </button>
                              )}
                              {match.speaker && (
                                <Badge variant="outline" className="text-xs">{match.speaker}</Badge>
                              )}
                            </div>
                            <p className="text-sm italic">"{match.quote}"</p>
                            {match.context && (
                              <p className="text-xs text-muted-foreground mt-2">Context: {match.context}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No matching moments were found for this question.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Staff Acknowledgment Section */}
          <div className="mt-6 pt-6 border-t border-border">
            {acknowledgedAt ? (
              // Already acknowledged - show responses (visible to everyone)
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">
                    Staff reviewed on {new Date(acknowledgedAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-sm font-medium text-green-400 mb-2">What I did well:</p>
                    <p className="text-sm">{staffFeedbackPositive}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm font-medium text-blue-400 mb-2">What I'm working on:</p>
                    <p className="text-sm">{staffFeedbackImprovement}</p>
                  </div>
                </div>
              </div>
            ) : isStaffUser ? (
              // Staff viewing their own unacknowledged call
              !showAcknowledgeForm ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">
                    Take a moment to reflect on this call and acknowledge your review.
                  </p>
                  <Button 
                    onClick={() => setShowAcknowledgeForm(true)}
                    className="bg-primary"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Acknowledge & Reflect
                  </Button>
                </div>
              ) : (
                // Show reflection form
                <div className="space-y-4">
                  <h4 className="font-semibold text-center">Self-Reflection</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="positive" className="text-green-400">
                      What is one thing you did well on this call?
                    </Label>
                    <Textarea
                      id="positive"
                      value={feedbackPositive}
                      onChange={(e) => setFeedbackPositive(e.target.value)}
                      placeholder="I built great rapport by asking about their family..."
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="improvement" className="text-blue-400">
                      What is one thing you're going to work on moving forward?
                    </Label>
                    <Textarea
                      id="improvement"
                      value={feedbackImprovement}
                      onChange={(e) => setFeedbackImprovement(e.target.value)}
                      placeholder="I need to be more assumptive when asking for the sale..."
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowAcknowledgeForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAcknowledge}
                      disabled={isSubmitting || !feedbackPositive.trim() || !feedbackImprovement.trim()}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Submit Acknowledgment
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )
            ) : (
              // Owner/Manager viewing unacknowledged call
              <div className="flex items-center gap-2 text-yellow-500 py-4">
                <Clock className="h-5 w-5" />
                <span className="font-medium">Pending staff review</span>
              </div>
            )}
          </div>

          {/* Footer Meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-4">
              <span>{call.original_filename}</span>
              <span>{new Date(call.created_at).toLocaleDateString()}</span>
            </div>
            {call.analyzed_at && (
              <span>Analyzed: {new Date(call.analyzed_at).toLocaleTimeString()}</span>
            )}
          </div>
          </div>
        </div>
      </DialogContent>

      {/* Follow-Up Templates Dialog */}
      <FollowUpTemplateDisplay
        open={showFollowUpDialog}
        onClose={() => setShowFollowUpDialog(false)}
        callId={call.id}
        existingEmail={call.generated_email_template}
        existingText={call.generated_text_template}
        clientName={clientFirstName || 'Client'}
      />
    </Dialog>
  );
}
