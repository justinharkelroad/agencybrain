import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  User, CheckCircle2, XCircle, Clock, Download,
  Loader2, Headphones, FileText, Lightbulb, ClipboardList,
  MessageSquareQuote, CheckCircle, AlertTriangle, Target,
  Sparkles, Mail, MessageSquare, Search
} from "lucide-react";
import { parseFeedback } from '@/lib/utils/feedback-parser';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef, useEffect } from "react";
import { toast } from 'sonner';
import { exportScorecardAsPNG, exportScorecardAsPDF } from '@/lib/exportScorecard';
import { FollowUpTemplateDisplay } from './FollowUpTemplateDisplay';
import { supabase } from '@/integrations/supabase/client';
import { resolveFunctionErrorMessage } from '@/lib/utils/resolve-function-error';

interface ServiceSectionScore {
  section_name: string;
  score: number;
  max_score: number;
  feedback: string;
  tip?: string;
}

interface ChecklistItem {
  label: string;
  checked: boolean;
  evidence?: string;
}

interface NotableQuote {
  text: string;
  speaker: 'agent' | 'customer';
  timestamp_seconds?: number;
  context?: string;
}

interface ServiceCallReportCardProps {
  call: {
    id: string;
    team_member_name?: string;
    original_filename?: string;
    call_duration_seconds?: number;
    created_at: string;
    overall_score?: number;
    section_scores?: ServiceSectionScore[];
    summary?: string;
    critical_gaps?: {
      service_outcome?: {
        status?: 'resolved' | 'partial' | 'unresolved' | 'follow_up_required';
        rationale?: string;
      };
      follow_up_validation?: {
        status?: 'specific' | 'partial' | 'missing';
        has_follow_up?: boolean;
        missing_fields?: string[];
      };
    } | null;
    // Direct fields
    crm_notes?: string;
    suggestions?: string[];
    checklist?: ChecklistItem[];
    client_first_name?: string;
    csr_name?: string;
    notable_quotes?: NotableQuote[];
    // Database column mappings (alternative field names)
    closing_attempts?: string;           // Maps to crm_notes
    coaching_recommendations?: string[]; // Maps to suggestions
    discovery_wins?: ChecklistItem[];    // Maps to checklist
    client_profile?: {
      csr_name?: string;
      client_first_name?: string;
    };
    // Follow-up templates
    generated_email_template?: string | null;
    generated_text_template?: string | null;
  };
  open: boolean;
  onClose: () => void;
  isReadOnly?: boolean;
  // Staff acknowledgment props
  isStaffUser?: boolean;
  staffTeamMemberId?: string;
  acknowledgedAt?: string | null;
  staffFeedbackPositive?: string | null;
  staffFeedbackImprovement?: string | null;
  qaEnabled?: boolean;
  onAcknowledge?: (positive: string, improvement: string) => Promise<void>;
}

// Inline colors for PNG export compatibility
const COLORS = {
  background: '#0f172a',
  cardBg: '#1e293b',
  border: '#334155',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  green: '#22c55e',
  greenBg: 'rgba(34, 197, 94, 0.1)',
  yellow: '#eab308',
  yellowBg: 'rgba(234, 179, 8, 0.1)',
  red: '#ef4444',
  redBg: 'rgba(239, 68, 68, 0.1)',
  blue: '#3b82f6',
  blueBg: 'rgba(59, 130, 246, 0.1)',
};

export function ServiceCallReportCard({
  call,
  open,
  onClose,
  isReadOnly = false,
  isStaffUser = false,
  staffTeamMemberId,
  acknowledgedAt,
  staffFeedbackPositive,
  staffFeedbackImprovement,
  qaEnabled = false,
  onAcknowledge
}: ServiceCallReportCardProps) {
  const [exporting, setExporting] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
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

  // Reset QA state when switching calls
  useEffect(() => {
    setQaQuestion('');
    setQaQuestionsUsed(0);
    setQaLoading(false);
    setQaError(null);
    setQaResult(null);
  }, [call?.id]);

  // Staff acknowledgment state
  const [showAcknowledgeForm, setShowAcknowledgeForm] = useState(false);
  const [feedbackPositive, setFeedbackPositive] = useState('');
  const [feedbackImprovement, setFeedbackImprovement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  if (!call) return null;

  // Map database columns to expected field names (handle both direct fields and DB column names)
  const mappedCrmNotes = call.crm_notes || call.closing_attempts;
  const mappedSuggestions = call.suggestions || call.coaching_recommendations || [];
  const mappedChecklist = call.checklist || call.discovery_wins || [];
  const mappedCsrName = call.csr_name || call.client_profile?.csr_name || call.team_member_name;
  const mappedClientName = call.client_first_name || call.client_profile?.client_first_name;
  const serviceOutcome = call.critical_gaps?.service_outcome;
  const followUpValidation = call.critical_gaps?.follow_up_validation;

  const getScoreColor = (score: number) => {
    if (score >= 7) return { text: COLORS.green, bg: COLORS.greenBg };
    if (score >= 5) return { text: COLORS.yellow, bg: COLORS.yellowBg };
    return { text: COLORS.red, bg: COLORS.redBg };
  };

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (seconds: number | undefined | null): string => {
    if (seconds === undefined || seconds === null) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatChecklistLabel = (label: unknown) => {
    if (typeof label !== 'string') return '';
    return label.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const handleTimestampClick = (seconds: number) => {
    const formatted = formatTimestamp(seconds);
    navigator.clipboard.writeText(formatted);
    toast.success(`Timestamp ${formatted} copied`);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleExportPNG = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    const filename = `service-scorecard-${mappedCsrName || 'agent'}-${new Date().toISOString().split('T')[0]}`;
    const success = await exportScorecardAsPNG(reportRef.current, filename);
    if (success) toast.success('Downloaded as PNG');
    else toast.error('Export failed');
    setExporting(false);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    const filename = `service-scorecard-${mappedCsrName || 'agent'}-${new Date().toISOString().split('T')[0]}`;
    const success = await exportScorecardAsPDF(reportRef.current, filename);
    if (success) toast.success('Downloaded as PDF');
    else toast.error('Export failed');
    setExporting(false);
  };

  const copyResults = () => {
    const text = `
SERVICE CALL GRADED RESULT
CSR: ${mappedCsrName || 'Agent'}
Client: ${mappedClientName || 'Unknown'}
Date: ${formatDate(call.created_at)}
Overall Score: ${call.overall_score}/10

${sectionScores.map(s => `${s.section_name}: ${s.score}/${s.max_score}\n${s.feedback}`).join('\n\n') || ''}

CRM NOTES:
${mappedCrmNotes || 'None'}

SUGGESTIONS:
${mappedSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'None'}
    `.trim();
    
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const scoreColors = getScoreColor(call.overall_score || 0);
  const sectionScores = Array.isArray(call.section_scores) ? call.section_scores : [];
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">Service Call Report</DialogTitle>
        {/* Export buttons - OUTSIDE the ref */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={copyResults}
          >
            <FileText className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Copy</span>
          </Button>
        </div>

        {/* Report content for export */}
        <div 
          ref={reportRef} 
          style={{ backgroundColor: COLORS.background, color: COLORS.text }}
          className="p-6"
        >
          {/* Header */}
          <div 
            className="border-b pb-6 mb-6"
            style={{ borderColor: COLORS.border }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Headphones className="h-5 w-5" style={{ color: COLORS.blue }} />
                  <p 
                    className="text-xs font-medium tracking-wider"
                    style={{ color: COLORS.blue }}
                  >
                    SERVICE CALL GRADED RESULT
                  </p>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">
                  CSR: {(mappedCsrName || 'Agent').toUpperCase()}
                </h1>
                <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: COLORS.textMuted }}>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(call.created_at)}
                  </span>
                  <span>{formatDuration(call.call_duration_seconds)}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs mb-1" style={{ color: COLORS.textMuted }}>OVERALL SCORE</p>
                <Badge 
                  className="text-2xl px-4 py-2 font-bold"
                  style={{ 
                    backgroundColor: scoreColors.bg, 
                    color: scoreColors.text,
                    border: `1px solid ${scoreColors.text}30`
                  }}
                >
                  {call.overall_score ?? '--'}/10
                </Badge>
              </div>
            </div>
          </div>

          {/* Privacy & Names Section */}
          <Card 
            className="mb-6"
            style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.border }}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4" style={{ color: COLORS.blue }} />
                <span className="text-sm font-medium">Call Participants</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>CSR</p>
                  <p className="font-medium">{mappedCsrName || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>CLIENT</p>
                  <p className="font-medium">{mappedClientName || 'Unknown'}</p>
                </div>
              </div>
              <p className="text-xs mt-3" style={{ color: COLORS.textMuted }}>
                Names shown are first names only for privacy
              </p>
            </CardContent>
          </Card>

          {/* Scored Sections */}
          {sectionScores.length > 0 && (
            <div className="space-y-4 mb-6">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                SCORED SECTIONS
              </h3>
              {sectionScores.map((section, i) => {
                const sectionColors = getScoreColor(section.score);
                return (
                  <Card 
                    key={i}
                    style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.border }}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-medium">{section.section_name}</h4>
                        <Badge 
                          style={{ 
                            backgroundColor: sectionColors.bg, 
                            color: sectionColors.text,
                            border: `1px solid ${sectionColors.text}30`
                          }}
                        >
                          {section.score}/{section.max_score}
                        </Badge>
                      </div>
                      {section.feedback && (() => {
                        const parsed = parseFeedback(section.feedback);
                        if (parsed.strengths || parsed.gaps || parsed.action) {
                          return (
                            <div className="space-y-2 mb-2">
                              {parsed.strengths && (
                                <div className="flex items-start gap-2">
                                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }} />
                                  <p className="text-sm" style={{ color: '#4ade80' }}>
                                    <span className="font-semibold">STRENGTHS:</span> {parsed.strengths}
                                  </p>
                                </div>
                              )}
                              {parsed.gaps && (
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                                  <p className="text-sm" style={{ color: '#fbbf24' }}>
                                    <span className="font-semibold">GAPS:</span> {parsed.gaps}
                                  </p>
                                </div>
                              )}
                              {parsed.action && (
                                <div className="flex items-start gap-2">
                                  <Target className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: '#3b82f6' }} />
                                  <p className="text-sm" style={{ color: '#60a5fa' }}>
                                    <span className="font-semibold">ACTION:</span> {parsed.action}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        }
                        // Fallback for legacy feedback without markers
                        return (
                          <p className="text-sm mb-2" style={{ color: COLORS.textMuted }}>
                            {section.feedback}
                          </p>
                        );
                      })()}
                      {section.tip && (
                        <p className="text-sm italic" style={{ color: COLORS.blue }}>
                          <span className="font-medium">Tip:</span> {section.tip}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Final Score Section */}
          <Card 
            className="mb-6 text-center"
            style={{ 
              backgroundColor: scoreColors.bg, 
              borderColor: scoreColors.text,
              borderWidth: '2px'
            }}
          >
            <CardContent className="py-8">
              <p className="text-sm font-medium mb-2" style={{ color: scoreColors.text }}>
                FINAL SCORE
              </p>
              <p className="text-5xl font-bold" style={{ color: scoreColors.text }}>
                {call.overall_score ?? '--'}/10
              </p>
            </CardContent>
          </Card>

          {/* CRM Notes Section */}
          {mappedCrmNotes && (
            <Card 
              className="mb-6"
              style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.border }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  CRM NOTES
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="text-sm whitespace-pre-wrap"
                  style={{ color: COLORS.textMuted }}
                >
                  {mappedCrmNotes}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {call.summary && (
            <Card 
              className="mb-6"
              style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.border }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">CALL SUMMARY</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm" style={{ color: COLORS.textMuted }}>
                  {call.summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Top 3 Suggestions */}
          {mappedSuggestions.length > 0 && (
            <Card 
              className="mb-6"
              style={{ 
                backgroundColor: COLORS.blueBg, 
                borderColor: COLORS.blue,
                borderWidth: '1px'
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2" style={{ color: COLORS.blue }}>
                  <Lightbulb className="h-4 w-4" />
                  TOP 3 SUGGESTIONS FOR IMPROVEMENT
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {mappedSuggestions.slice(0, 3).map((suggestion, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span 
                        className="font-bold min-w-[20px]"
                        style={{ color: COLORS.blue }}
                      >
                        {i + 1}.
                      </span>
                      <span style={{ color: COLORS.text }}>{suggestion}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-sm font-bold mt-4" style={{ color: COLORS.blue }}>
                  Goal: Implement these improvements on your next call.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Notable Quotes with Timestamps */}
          {call.notable_quotes && Array.isArray(call.notable_quotes) && call.notable_quotes.length > 0 && (
            <Card 
              className="border-l-4"
              style={{ 
                backgroundColor: COLORS.cardBg, 
                borderColor: COLORS.border,
                borderLeftColor: '#a855f7' 
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquareQuote className="h-4 w-4" style={{ color: '#a855f7' }} />
                  KEY MOMENTS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {call.notable_quotes.map((quote, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 rounded-lg"
                      style={{ 
                        backgroundColor: quote.speaker === 'agent' ? COLORS.blueBg : COLORS.greenBg,
                        border: `1px solid ${quote.speaker === 'agent' ? COLORS.blue : COLORS.green}30`
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {quote.timestamp_seconds !== undefined && quote.timestamp_seconds !== null && (
                          <button
                            onClick={() => handleTimestampClick(quote.timestamp_seconds!)}
                            className="flex-shrink-0 px-2 py-1 text-xs font-mono rounded border hover:opacity-80 transition-opacity"
                            style={{ 
                              backgroundColor: COLORS.cardBg, 
                              borderColor: COLORS.border,
                              color: COLORS.text 
                            }}
                            title="Click to copy timestamp"
                          >
                            {formatTimestamp(quote.timestamp_seconds)}
                          </button>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm italic" style={{ color: COLORS.text }}>"{quote.text}"</p>
                          {quote.context && (
                            <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                              → {quote.context}
                            </p>
                          )}
                        </div>
                        
                        <Badge 
                          variant="outline" 
                          className="flex-shrink-0 text-xs"
                          style={{ 
                            color: quote.speaker === 'agent' ? COLORS.blue : COLORS.green,
                            borderColor: quote.speaker === 'agent' ? `${COLORS.blue}50` : `${COLORS.green}50`
                          }}
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

          {(serviceOutcome || followUpValidation) && (
            <Card
              className="mb-6"
              style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.border }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">SERVICE OUTCOME TRACKING</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {serviceOutcome && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs" style={{ color: COLORS.textMuted }}>Resolution Status</p>
                    <Badge
                      variant="outline"
                      style={{
                        color:
                          serviceOutcome.status === 'resolved' ? COLORS.green :
                          serviceOutcome.status === 'follow_up_required' ? COLORS.blue :
                          serviceOutcome.status === 'unresolved' ? COLORS.red : COLORS.yellow,
                        borderColor:
                          serviceOutcome.status === 'resolved' ? `${COLORS.green}60` :
                          serviceOutcome.status === 'follow_up_required' ? `${COLORS.blue}60` :
                          serviceOutcome.status === 'unresolved' ? `${COLORS.red}60` : `${COLORS.yellow}60`,
                      }}
                    >
                      {(serviceOutcome.status || 'partial').replace(/_/g, ' ')}
                    </Badge>
                  </div>
                )}
                {serviceOutcome?.rationale && (
                  <p className="text-sm" style={{ color: COLORS.textMuted }}>
                    {serviceOutcome.rationale}
                  </p>
                )}
                {followUpValidation && (
                  <div className="pt-2 border-t" style={{ borderColor: COLORS.border }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs" style={{ color: COLORS.textMuted }}>Follow-Up Plan Quality</p>
                      <Badge
                        variant="outline"
                        style={{
                          color:
                            followUpValidation.status === 'specific' ? COLORS.green :
                            followUpValidation.status === 'partial' ? COLORS.yellow : COLORS.red,
                          borderColor:
                            followUpValidation.status === 'specific' ? `${COLORS.green}60` :
                            followUpValidation.status === 'partial' ? `${COLORS.yellow}60` : `${COLORS.red}60`,
                        }}
                      >
                        {(followUpValidation.status || 'missing').replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    {Array.isArray(followUpValidation.missing_fields) && followUpValidation.missing_fields.length > 0 && (
                      <p className="text-xs mt-2" style={{ color: COLORS.textMuted }}>
                        Missing: {followUpValidation.missing_fields.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Final Checklist */}
          {mappedChecklist.length > 0 && (
            <Card
              style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.border }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  EXECUTION CHECKLIST
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mappedChecklist.map((item, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg"
                      style={{
                        backgroundColor: item.checked ? COLORS.greenBg : COLORS.redBg,
                        border: `1px solid ${item.checked ? COLORS.green : COLORS.red}30`
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {item.checked ? (
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: COLORS.green }} />
                        ) : (
                          <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: COLORS.red }} />
                        )}
                        <span className="text-sm font-medium">{formatChecklistLabel(item.label)}</span>
                      </div>
                      {item.evidence && (
                        <p
                          className="text-xs italic mt-2 ml-6"
                          style={{ color: COLORS.textMuted }}
                        >
                          "{item.evidence}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Time-Based Q&A */}
          <Card
            className="mt-6 border-l-4 border-l-blue-500"
            style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.border }}
          >
            <CardContent className="pt-4">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: COLORS.blue }}>
                <Search className="h-4 w-4" />
                CALL TIMELINE Q&A
              </h3>
              {qaEnabled ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs" style={{ color: COLORS.textMuted }}>
                      Ask timeline questions right here (for example: "When did we discuss liability limits?")
                    </p>
                    <span className="text-xs font-medium" style={{ color: qaQuestionsUsed >= QA_QUESTION_LIMIT ? '#f87171' : COLORS.textMuted }}>
                      {qaQuestionsUsed}/{QA_QUESTION_LIMIT} questions
                    </span>
                  </div>
                  <div className="space-y-2 mt-3">
                    <Label htmlFor="qa-question-service" style={{ color: COLORS.text }}>
                      Ask about a moment in this call
                    </Label>
                    <Textarea
                      id="qa-question-service"
                      value={qaQuestion}
                      onChange={(e) => setQaQuestion(e.target.value)}
                      placeholder="Example: When did they discuss liability limits?"
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <Button
                      onClick={handleQaQuery}
                      disabled={qaLoading || !qaQuestion.trim() || qaQuestionsUsed >= QA_QUESTION_LIMIT}
                      className="bg-primary"
                    >
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
                    <p className="mt-3 text-sm" style={{ color: '#f87171' }}>
                      {qaError}
                    </p>
                  )}

                  {qaResult && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm" style={{ color: COLORS.textMuted }}>
                        {qaResult.summary} (confidence: {(qaResult.confidence * 100).toFixed(0)}%)
                      </p>
                      {qaResult.matches.length > 0 ? (
                        qaResult.matches.map((match, idx) => (
                          <div
                            key={`${match.timestamp_seconds}-${idx}`}
                            className="rounded-lg border p-3"
                            style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.border }}
                          >
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              {match.timestamp_seconds !== null &&
                                match.timestamp_seconds !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() => handleTimestampClick(match.timestamp_seconds!)}
                                    className="px-2 py-1 text-xs font-mono rounded border hover:opacity-80 transition-opacity"
                                    style={{
                                      borderColor: COLORS.border,
                                      backgroundColor: COLORS.cardBg,
                                      color: COLORS.text,
                                    }}
                                  >
                                    {formatTimestamp(match.timestamp_seconds)}
                                  </button>
                                )}
                              {match.speaker && (
                                <Badge variant="outline" className="text-xs">
                                  {match.speaker}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm italic" style={{ color: COLORS.text }}>
                              &quot;{match.quote}&quot;
                            </p>
                            {match.context && (
                              <p className="text-xs mt-2" style={{ color: COLORS.textMuted }}>
                                Context: {match.context}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm" style={{ color: COLORS.textMuted }}>
                          No matching moments were found for this question.
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm" style={{ color: COLORS.textMuted }}>
                  Ask-specific timeline questions are not enabled for your agency.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Staff Acknowledgment Section */}
          <div className="mt-6 pt-6 border-t" style={{ borderColor: COLORS.border }}>
            {acknowledgedAt ? (
              // Already acknowledged - show responses (visible to everyone)
              <div className="space-y-4">
                <div className="flex items-center gap-2" style={{ color: COLORS.green }}>
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">
                    Staff reviewed on {new Date(acknowledgedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: COLORS.greenBg, border: `1px solid ${COLORS.green}30` }}
                  >
                    <p className="text-sm font-medium mb-2" style={{ color: COLORS.green }}>What I did well:</p>
                    <p className="text-sm">{staffFeedbackPositive}</p>
                  </div>
                  <div
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: COLORS.blueBg, border: `1px solid ${COLORS.blue}30` }}
                  >
                    <p className="text-sm font-medium mb-2" style={{ color: COLORS.blue }}>What I'm working on:</p>
                    <p className="text-sm">{staffFeedbackImprovement}</p>
                  </div>
                </div>
              </div>
            ) : isStaffUser ? (
              // Staff viewing their own unacknowledged call
              !showAcknowledgeForm ? (
                <div className="text-center py-4">
                  <p className="mb-4" style={{ color: COLORS.textMuted }}>
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
                    <Label htmlFor="positive" style={{ color: COLORS.green }}>
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
                    <Label htmlFor="improvement" style={{ color: COLORS.blue }}>
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
              <div className="flex items-center gap-2 py-4" style={{ color: COLORS.yellow }}>
                <Clock className="h-5 w-5" />
                <span className="font-medium">Pending staff review</span>
              </div>
            )}
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
        clientName={mappedClientName || 'Client'}
      />
    </Dialog>
  );
}
