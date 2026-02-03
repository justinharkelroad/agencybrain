import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronRight,
  Calendar,
  Sparkles,
  CheckSquare,
  ClipboardList,
  FileText,
} from 'lucide-react';

interface MeetingResult {
  id: string;
  week_number: number;
  meeting_date: string;
  summary_ai: string | null;
  action_items_json: Array<{ action: string; owner: string; deadline: string | null }> | null;
  key_points_json: string[] | null;
  created_at: string;
}

interface MeetingResultsCardProps {
  assignmentId: string;
  currentWeek: number;
}

export function MeetingResultsCard({ assignmentId, currentWeek }: MeetingResultsCardProps) {
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingResult | null>(null);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['meeting-results', assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_transcripts')
        .select('id, week_number, meeting_date, summary_ai, action_items_json, key_points_json, created_at')
        .eq('assignment_id', assignmentId)
        .order('week_number', { ascending: false });

      if (error) throw error;
      return data as MeetingResult[];
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const hasAnyFeedback = meetings && meetings.length > 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Meeting Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Meeting Results
          </CardTitle>
          <CardDescription>
            AI-generated summaries and action items from your coaching calls
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasAnyFeedback ? (
            <div className="space-y-3">
              {meetings?.map((meeting) => (
                <button
                  key={meeting.id}
                  onClick={() => setSelectedMeeting(meeting)}
                  className="w-full text-left"
                >
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <span className="font-bold text-amber-600">W{meeting.week_number}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">Week {meeting.week_number} Results</span>
                          {meeting.summary_ai && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI Summary
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(meeting.meeting_date)}</span>
                          {meeting.action_items_json && meeting.action_items_json.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{meeting.action_items_json.length} action item{meeting.action_items_json.length !== 1 ? 's' : ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No meeting results yet. Results will appear here after your coaching calls.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meeting Details Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={(open) => !open && setSelectedMeeting(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Week {selectedMeeting?.week_number} Meeting Results
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {selectedMeeting?.meeting_date && formatDate(selectedMeeting.meeting_date)}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(85vh-120px)]">
            <div className="space-y-6 pr-4">
              {/* AI Summary */}
              {selectedMeeting?.summary_ai && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Summary
                  </h3>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {selectedMeeting.summary_ai}
                  </p>
                </div>
              )}

              {/* Key Points */}
              {selectedMeeting?.key_points_json && selectedMeeting.key_points_json.length > 0 && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4" />
                    Key Discussion Points
                  </h3>
                  <ul className="space-y-2">
                    {selectedMeeting.key_points_json.map((point, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm">
                        <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {selectedMeeting?.action_items_json && selectedMeeting.action_items_json.length > 0 && (
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <CheckSquare className="h-4 w-4" />
                    Action Items
                  </h3>
                  <div className="space-y-2">
                    {selectedMeeting.action_items_json.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm"
                      >
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0 mt-0.5">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{item.action}</p>
                          <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                            {item.owner && <span>Owner: {item.owner}</span>}
                            {item.deadline && <span>Due: {item.deadline}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!selectedMeeting?.summary_ai &&
                (!selectedMeeting?.key_points_json || selectedMeeting.key_points_json.length === 0) &&
                (!selectedMeeting?.action_items_json || selectedMeeting.action_items_json.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No AI feedback available for this meeting yet.</p>
                  </div>
                )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
