import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User, CheckCircle2, XCircle, Clock, Download, 
  Loader2, Headphones, FileText, Lightbulb, ClipboardList
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from 'sonner';
import { exportScorecardAsPNG, exportScorecardAsPDF } from '@/lib/exportScorecard';

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
    // Direct fields
    crm_notes?: string;
    suggestions?: string[];
    checklist?: ChecklistItem[];
    client_first_name?: string;
    csr_name?: string;
    // Database column mappings (alternative field names)
    closing_attempts?: string;           // Maps to crm_notes
    coaching_recommendations?: string[]; // Maps to suggestions
    discovery_wins?: ChecklistItem[];    // Maps to checklist
    client_profile?: {
      csr_name?: string;
      client_first_name?: string;
    };
  };
  open: boolean;
  onClose: () => void;
  isReadOnly?: boolean;
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
  isReadOnly = false
}: ServiceCallReportCardProps) {
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  if (!call) return null;

  // Map database columns to expected field names (handle both direct fields and DB column names)
  const mappedCrmNotes = call.crm_notes || call.closing_attempts;
  const mappedSuggestions = call.suggestions || call.coaching_recommendations || [];
  const mappedChecklist = call.checklist || call.discovery_wins || [];
  const mappedCsrName = call.csr_name || call.client_profile?.csr_name || call.team_member_name;
  const mappedClientName = call.client_first_name || call.client_profile?.client_first_name;

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

${call.section_scores?.map(s => `${s.section_name}: ${s.score}/${s.max_score}\n${s.feedback}`).join('\n\n') || ''}

CRM NOTES:
${mappedCrmNotes || 'None'}

SUGGESTIONS:
${call.suggestions?.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'None'}
    `.trim();
    
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const scoreColors = getScoreColor(call.overall_score || 0);
  const sectionScores = call.section_scores || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Export buttons - OUTSIDE the ref */}
        <div className="absolute top-4 right-12 z-10 flex gap-2">
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
                      <p className="text-sm mb-2" style={{ color: COLORS.textMuted }}>
                        {section.feedback}
                      </p>
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
                        <span className="text-sm font-medium">{item.label}</span>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}