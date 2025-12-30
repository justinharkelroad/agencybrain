import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  FileAudio, Clock, ChevronDown, ChevronUp, Download, 
  Image, FileText, Share2, Loader2, CheckCircle, Mic, VolumeX
} from "lucide-react";
import { useState, useRef } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { exportScorecardAsPNG, exportScorecardAsPDF } from '@/lib/exportScorecard';

interface CallScorecardProps {
  call: any;
  open: boolean;
  onClose: () => void;
  isStaffUser?: boolean;
  staffTeamMemberId?: string;
  acknowledgedAt?: string | null;
  staffFeedbackPositive?: string | null;
  staffFeedbackImprovement?: string | null;
  onAcknowledge?: (positive: string, improvement: string) => Promise<void>;
  loading?: boolean;
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
  loading = false
}: CallScorecardProps) {
  const [showCrmNotes, setShowCrmNotes] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showAcknowledgeForm, setShowAcknowledgeForm] = useState(false);
  const [feedbackPositive, setFeedbackPositive] = useState('');
  const [feedbackImprovement, setFeedbackImprovement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scorecardRef = useRef<HTMLDivElement>(null);

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
  
  // Debug logging
  console.log('=== CallScorecard received call ===');
  console.log('call object:', call);
  console.log('call.section_scores:', call?.section_scores);
  console.log('call.skill_scores:', call?.skill_scores);
  console.log('call.critical_gaps:', call?.critical_gaps);
  console.log('call.summary:', call?.summary);
  console.log('call.potential_rank:', call?.potential_rank);
  console.log('call.client_profile:', call?.client_profile);

  // IMPORTANT: keep the dialog open and show a loading/empty state even when call is null
  if (!call) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

  const sectionScores = call.section_scores || {};
  const executionChecklist = call.discovery_wins || {};
  const crmNotes = call.closing_attempts || {};
  const extractedData = call.client_profile || {};

  // Get salesperson name from various possible locations
  const salespersonName = call.team_member_name || 
    extractedData?.salesperson_name || 
    'Agent';

  // Prepare radar chart data
  const getRadarData = () => {
    const scores = call.skill_scores || {};
    
    return [
      { skill: 'Rapport', score: sectionScores.rapport?.score || scores.rapport || 50, fullMark: 100 },
      { skill: 'Discovery', score: scores.discovery || 50, fullMark: 100 },
      { skill: 'Coverage', score: sectionScores.coverage?.score || scores.coverage || 50, fullMark: 100 },
      { skill: 'Objection', score: scores.objection_handling || 50, fullMark: 100 },
      { skill: 'Closing', score: sectionScores.closing?.score || scores.closing || 50, fullMark: 100 },
    ];
  };

  // Parse price for comparison bars
  const parsePrice = (priceStr: string) => {
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
  const agentTalkPercent = call.agent_talk_percent;
  const customerTalkPercent = call.customer_talk_percent;
  const deadAirPercent = call.dead_air_percent;
  const agentTalkSeconds = call.agent_talk_seconds;
  const customerTalkSeconds = call.customer_talk_seconds;
  const deadAirSeconds = call.dead_air_seconds;

  const yourQuoteValue = parsePrice(extractedData.your_quote);
  const competitorQuoteValue = parsePrice(extractedData.competitor_quote);
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
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Export buttons - OUTSIDE the ref so they don't appear in export */}
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
                <p className="text-xs text-muted-foreground mb-1">PERFORMANCE RANK</p>
                <Badge className={`text-lg px-3 py-1 ${getRankColor(call.potential_rank)}`}>
                  {call.potential_rank || 'PENDING'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="p-6 space-y-6">
          {/* Key Metrics Row - Stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Your Quote */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">YOUR QUOTE</p>
                <p className="text-xl sm:text-2xl font-bold break-words">
                  {extractedData.your_quote || '--'}
                </p>
              </CardContent>
            </Card>
            
            {/* Competitor */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">COMPETITOR AVG</p>
                <p className="text-xl sm:text-2xl font-bold text-green-400 break-words">
                  {extractedData.competitor_quote ? `~${extractedData.competitor_quote}` : '--'}
                </p>
              </CardContent>
            </Card>
            
            {/* Asset Profile */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1 text-center sm:text-left">ASSET PROFILE</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs sm:text-sm">
                  {extractedData.assets?.slice(0, 2).map((asset: string, i: number) => (
                    <span key={i} className="truncate max-w-full sm:max-w-[120px]">{asset}</span>
                  )) || <span className="text-muted-foreground">--</span>}
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
                
                {extractedData.your_quote && (
                  <div>
                    <p className="text-xs text-muted-foreground">QUOTE COMPARISON</p>
                    <p className="text-lg font-bold">
                      {extractedData.your_quote}
                      {extractedData.competitor_quote && (
                        <span className="text-sm text-muted-foreground ml-2">
                          vs <span className="text-green-400">{extractedData.competitor_quote}</span>
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {extractedData.assets?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">ASSETS</p>
                    {extractedData.assets.map((asset: string, i: number) => (
                      <p key={i} className="text-sm flex items-center gap-1">
                        <span className="w-1 h-4 bg-blue-500 rounded" />
                        {asset}
                      </p>
                    ))}
                  </div>
                )}

                {extractedData.timeline && (
                  <div>
                    <p className="text-xs text-muted-foreground">FOLLOW UP PLAN</p>
                    <p className="text-sm text-yellow-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {extractedData.timeline}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Three Section Scores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Rapport */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm">RAPPORT</h3>
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                
                {/* Wins */}
                {sectionScores.rapport?.wins?.map((win: string, i: number) => (
                  <p key={`win-${i}`} className="text-sm text-green-400 flex items-start gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{win}</span>
                  </p>
                ))}
                
                {/* Failures */}
                {sectionScores.rapport?.failures?.map((failure: string, i: number) => (
                  <p key={`fail-${i}`} className="text-sm text-red-400 flex items-start gap-2 mb-2">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{failure}</span>
                  </p>
                ))}
                
                {sectionScores.rapport?.coaching && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-1">COACHING</p>
                    <p className="text-sm">{sectionScores.rapport.coaching}</p>
                  </div>
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
                
                {sectionScores.coverage?.wins?.map((win: string, i: number) => (
                  <p key={`win-${i}`} className="text-sm text-green-400 flex items-start gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{win}</span>
                  </p>
                ))}
                
                {sectionScores.coverage?.failures?.map((failure: string, i: number) => (
                  <p key={`fail-${i}`} className="text-sm text-red-400 flex items-start gap-2 mb-2">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{failure}</span>
                  </p>
                ))}
                
                {sectionScores.coverage?.coaching && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-1">COACHING</p>
                    <p className="text-sm">{sectionScores.coverage.coaching}</p>
                  </div>
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
                
                {sectionScores.closing?.wins?.map((win: string, i: number) => (
                  <p key={`win-${i}`} className="text-sm text-green-400 flex items-start gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{win}</span>
                  </p>
                ))}
                
                {sectionScores.closing?.failures?.map((failure: string, i: number) => (
                  <p key={`fail-${i}`} className="text-sm text-red-400 flex items-start gap-2 mb-2">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{failure}</span>
                  </p>
                ))}
                
                {sectionScores.closing?.coaching && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-1">COACHING</p>
                    <p className="text-sm">{sectionScores.closing.coaching}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Visual Charts Row */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Price Resistance Gap */}
            {extractedData.your_quote && extractedData.competitor_quote && (
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
                      <p className="text-sm font-medium text-green-400">{extractedData.competitor_quote}</p>
                    </div>
                    
                    {/* Your Quote Bar */}
                    <div className="flex flex-col items-center">
                      <div 
                        className="w-16 bg-red-500 rounded-t transition-all"
                        style={{ height: `${Math.max(20, (yourQuoteValue / maxQuote) * 100)}px` }}
                      />
                      <p className="text-xs text-muted-foreground mt-2">Your Quote</p>
                      <p className="text-sm font-medium text-red-400">{extractedData.your_quote}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Skill Execution Gap - Radar Chart */}
            <Card className={!extractedData.your_quote || !extractedData.competitor_quote ? 'md:col-span-2' : ''}>
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
          <Card className="border-t-4 border-t-blue-500">
            <CardContent className="pt-4">
              <h3 className="font-bold text-sm mb-4">CORRECTIVE ACTION PLAN</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Rapport Action */}
                <div>
                  <h4 className="text-red-400 font-medium text-sm mb-2">RAPPORT</h4>
                  <p className="text-sm text-muted-foreground">
                    {call.critical_gaps?.corrective_plan?.rapport || 
                     sectionScores.rapport?.coaching || 
                     'Build deeper connection using the HWF framework before discussing insurance details.'}
                  </p>
                </div>
                
                {/* Value Building Action */}
                <div>
                  <h4 className="text-red-400 font-medium text-sm mb-2">VALUE BUILDING</h4>
                  <p className="text-sm text-muted-foreground">
                    {call.critical_gaps?.corrective_plan?.value_building || 
                     sectionScores.coverage?.coaching || 
                     'Explain liability protection before quoting price. Position as advisor, not order-taker.'}
                  </p>
                </div>
                
                {/* Closing Action */}
                <div>
                  <h4 className="text-red-400 font-medium text-sm mb-2">CLOSING</h4>
                  <p className="text-sm text-muted-foreground">
                    {call.critical_gaps?.corrective_plan?.closing || 
                     sectionScores.closing?.coaching || 
                     'Use assumptive close language and set hard follow-up appointments with specific times.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Execution Clean Sheet */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-bold text-sm mb-4">EXECUTION CLEAN SHEET</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Support new checklist array format */}
                {Array.isArray(call.checklist) && call.checklist.length > 0 ? (
                  call.checklist.map((item: { label: string; checked: boolean; evidence?: string | null }, idx: number) => (
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
                        {item.evidence && (
                          <p className="text-xs text-muted-foreground/70 italic mt-1 line-clamp-2">
                            "{item.evidence}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))
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
                </div>
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
    </Dialog>
  );
}
