import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, Target, AlertTriangle, CheckCircle2, XCircle,
  FileAudio, Clock, ChevronDown, ChevronUp
} from "lucide-react";
import { useState } from "react";

interface CallScorecardProps {
  call: any;
  open: boolean;
  onClose: () => void;
}

export function CallScorecard({ call, open, onClose }: CallScorecardProps) {
  const [showCrmNotes, setShowCrmNotes] = useState(false);
  
  if (!call) return null;

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="bg-background border-b p-6">
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

        <div className="p-6 space-y-6">
          {/* Critical Assessment + Extracted Data Row */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Critical Assessment - Takes 2 columns */}
            <Card className="md:col-span-2 border-l-4 border-l-red-500">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  CRITICAL ASSESSMENT
                </p>
                <p className="text-sm">
                  {call.critical_gaps?.[0] || call.summary || 'Analysis pending...'}
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
                    <p className="text-xs text-muted-foreground">TIMELINE</p>
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
          <div className="grid md:grid-cols-3 gap-4">
            {/* Rapport */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm">RAPPORT</h3>
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  {sectionScores.rapport?.failures?.map((failure: string, i: number) => (
                    <p key={i} className="text-sm text-red-400 flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {failure}
                    </p>
                  ))}
                </div>
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
                <div className="space-y-2">
                  {sectionScores.coverage?.failures?.map((failure: string, i: number) => (
                    <p key={i} className="text-sm text-red-400 flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {failure}
                    </p>
                  ))}
                </div>
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
                <div className="space-y-2">
                  {sectionScores.closing?.failures?.map((failure: string, i: number) => (
                    <p key={i} className="text-sm text-red-400 flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {failure}
                    </p>
                  ))}
                </div>
                {sectionScores.closing?.coaching && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-1">COACHING</p>
                    <p className="text-sm">{sectionScores.closing.coaching}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Execution Clean Sheet */}
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-bold text-sm mb-4">EXECUTION CLEAN SHEET</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(executionChecklist).map(([key, value]) => (
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
                ))}
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
      </DialogContent>
    </Dialog>
  );
}
