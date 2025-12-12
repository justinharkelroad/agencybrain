import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, Target, AlertTriangle, 
  Lightbulb, MessageSquareQuote, CheckCircle2, XCircle,
  Clock, FileAudio
} from "lucide-react";

interface CallScorecardProps {
  call: any;
  open: boolean;
  onClose: () => void;
}

export function CallScorecard({ call, open, onClose }: CallScorecardProps) {
  if (!call) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileAudio className="h-5 w-5" />
              <span>{call.original_filename}</span>
            </div>
            {call.overall_score !== null && (
              <div className={`text-3xl font-bold ${getScoreColor(call.overall_score)}`}>
                {call.overall_score}%
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          {call.summary && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-muted-foreground">{call.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Skill Scores */}
          {call.skill_scores && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Skill Scores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(call.skill_scores).map(([skill, score]) => (
                  <div key={skill} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{skill}</span>
                      <span className={getScoreColor(score as number)}>{score as number}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getProgressColor(score as number)} transition-all`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Client Profile */}
          {call.client_profile && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Client Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {call.client_profile.name && (
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <span className="ml-2 font-medium">{call.client_profile.name}</span>
                    </div>
                  )}
                  {call.client_profile.current_carrier && (
                    <div>
                      <span className="text-muted-foreground">Current Carrier:</span>
                      <span className="ml-2 font-medium">{call.client_profile.current_carrier}</span>
                    </div>
                  )}
                  {call.client_profile.estimated_premium && (
                    <div>
                      <span className="text-muted-foreground">Est. Premium:</span>
                      <span className="ml-2 font-medium">{call.client_profile.estimated_premium}</span>
                    </div>
                  )}
                </div>
                
                {call.client_profile.policies_discussed?.length > 0 && (
                  <div className="mt-3">
                    <span className="text-muted-foreground text-sm">Policies Discussed:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {call.client_profile.policies_discussed.map((policy: string, i: number) => (
                        <Badge key={i} variant="secondary">{policy}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {call.client_profile.hot_buttons?.length > 0 && (
                  <div className="mt-3">
                    <span className="text-muted-foreground text-sm">Hot Buttons:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {call.client_profile.hot_buttons.map((button: string, i: number) => (
                        <Badge key={i} variant="outline" className="border-yellow-500/50 text-yellow-400">
                          {button}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Two Column Layout for Wins/Gaps */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Discovery Wins */}
            {call.discovery_wins?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    Discovery Wins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {call.discovery_wins.map((win: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>{win}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Critical Gaps */}
            {call.critical_gaps?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    Critical Gaps
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {call.critical_gaps.map((gap: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Closing Attempts & Missed Signals */}
          <div className="grid md:grid-cols-2 gap-4">
            {call.closing_attempts?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Closing Attempts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {call.closing_attempts.map((attempt: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">• {attempt}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {call.missed_signals?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="h-5 w-5" />
                    Missed Signals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {call.missed_signals.map((signal: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">• {signal}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coaching Recommendations */}
          {call.coaching_recommendations?.length > 0 && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  <Lightbulb className="h-5 w-5" />
                  Coaching Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 list-decimal list-inside">
                  {call.coaching_recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-sm">{rec}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Notable Quotes */}
          {call.notable_quotes?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquareQuote className="h-5 w-5" />
                  Notable Quotes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {call.notable_quotes.map((quote: string, i: number) => (
                  <blockquote key={i} className="border-l-2 border-muted-foreground/30 pl-3 italic text-sm text-muted-foreground">
                    "{quote}"
                  </blockquote>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Call Meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(call.duration_seconds || call.call_duration_seconds || 0)}
              </span>
              <span>
                {new Date(call.created_at).toLocaleDateString()} at {new Date(call.created_at).toLocaleTimeString()}
              </span>
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
