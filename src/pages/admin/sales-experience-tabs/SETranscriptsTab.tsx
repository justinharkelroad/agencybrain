import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Loader2,
  Upload,
  FileText,
  CheckCircle2,
  Circle,
  Sparkles,
  Calendar,
  Building2,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

interface Agency {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  agency_id: string;
  status: string;
  start_date: string;
  end_date: string;
  agency: Agency;
}

interface ActionItem {
  action: string;
  owner?: string;
}

interface Transcript {
  id: string;
  assignment_id: string;
  week_number: number;
  meeting_date: string;
  transcript_text: string;
  summary_ai: string | null;
  action_items_json: (ActionItem | string)[];
  created_at: string;
}

const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8];

export function SETranscriptsTab() {
  const queryClient = useQueryClient();
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingTranscript, setViewingTranscript] = useState<Transcript | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [meetingDate, setMeetingDate] = useState('');

  // Fetch active/completed assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['admin-se-assignments-with-agencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_assignments')
        .select(`
          id,
          agency_id,
          status,
          start_date,
          end_date,
          agency:agencies(id, name)
        `)
        .in('status', ['active', 'completed'])
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data as Assignment[];
    },
  });

  // Fetch all transcripts
  const { data: transcripts, isLoading: transcriptsLoading } = useQuery({
    queryKey: ['admin-se-transcripts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_transcripts')
        .select('*')
        .order('week_number', { ascending: true });

      if (error) throw error;
      return data as Transcript[];
    },
  });

  // Upload transcript mutation
  const uploadMutation = useMutation({
    mutationFn: async ({
      assignmentId,
      weekNumber,
      meetingDate,
      transcriptText,
    }: {
      assignmentId: string;
      weekNumber: number;
      meetingDate: string;
      transcriptText: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-sales-transcript`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            assignment_id: assignmentId,
            week_number: weekNumber,
            meeting_date: meetingDate,
            transcript_text: transcriptText,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload transcript');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-se-transcripts'] });
      setIsUploadDialogOpen(false);
      setTranscriptText('');
      setMeetingDate('');
      toast.success(
        data.transcript?.has_ai_summary
          ? 'Transcript uploaded with AI summary'
          : 'Transcript uploaded successfully'
      );
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error(error.message);
    },
  });

  const handleOpenUpload = (assignment: Assignment, week: number) => {
    setSelectedAssignment(assignment);
    setSelectedWeek(week);
    setMeetingDate(new Date().toISOString().split('T')[0]);
    setTranscriptText('');
    setIsUploadDialogOpen(true);
  };

  const handleUpload = () => {
    if (!selectedAssignment || !transcriptText.trim() || !meetingDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    uploadMutation.mutate({
      assignmentId: selectedAssignment.id,
      weekNumber: selectedWeek,
      meetingDate,
      transcriptText: transcriptText.trim(),
    });
  };

  const handleViewTranscript = (transcript: Transcript) => {
    setViewingTranscript(transcript);
    setIsViewDialogOpen(true);
  };

  // Get transcripts for an assignment
  const getTranscriptsForAssignment = (assignmentId: string) => {
    return transcripts?.filter((t) => t.assignment_id === assignmentId) || [];
  };

  // Check if week has transcript
  const hasTranscript = (assignmentId: string, weekNumber: number) => {
    return transcripts?.some(
      (t) => t.assignment_id === assignmentId && t.week_number === weekNumber
    );
  };

  // Get transcript for week
  const getTranscript = (assignmentId: string, weekNumber: number) => {
    return transcripts?.find(
      (t) => t.assignment_id === assignmentId && t.week_number === weekNumber
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (assignmentsLoading || transcriptsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Transcript Management</h2>
        <p className="text-sm text-muted-foreground">
          Upload and manage coaching call transcripts for each agency's 8-week program
        </p>
      </div>

      {!assignments || assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Active Assignments</h3>
            <p className="text-sm text-muted-foreground">
              Create an assignment in the Assignments tab to start uploading transcripts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-4">
          {assignments.map((assignment) => {
            const assignmentTranscripts = getTranscriptsForAssignment(assignment.id);
            const completedCount = assignmentTranscripts.length;

            return (
              <AccordionItem
                key={assignment.id}
                value={assignment.id}
                className="border rounded-lg"
              >
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-4 w-full">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {assignment.agency?.name || 'Unknown Agency'}
                        </span>
                        <Badge
                          variant={assignment.status === 'active' ? 'default' : 'secondary'}
                        >
                          {assignment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(assignment.start_date)} - {formatDate(assignment.end_date)}
                      </p>
                    </div>
                    <div className="text-right mr-4">
                      <p className="text-sm font-medium">{completedCount}/8 transcripts</p>
                      <p className="text-xs text-muted-foreground">uploaded</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    {WEEKS.map((week) => {
                      const transcript = getTranscript(assignment.id, week);
                      const hasAI = transcript?.summary_ai;

                      return (
                        <Card
                          key={week}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            transcript ? 'border-green-500/30 bg-green-500/5' : ''
                          }`}
                          onClick={() =>
                            transcript
                              ? handleViewTranscript(transcript)
                              : handleOpenUpload(assignment, week)
                          }
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">Week {week}</span>
                              {transcript ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            {transcript ? (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(transcript.meeting_date)}
                                </p>
                                <div className="flex items-center gap-1">
                                  {hasAI && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Sparkles className="h-3 w-3 mr-1" />
                                      AI Summary
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Click to upload
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Transcript - Week {selectedWeek}
            </DialogTitle>
            <DialogDescription>
              {selectedAssignment?.agency?.name} - Paste the Zoom transcript text below
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Meeting Date</Label>
              <Input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Transcript Text</Label>
              <Textarea
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="Paste the full Zoom transcript here..."
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {transcriptText.length.toLocaleString()} characters
                {transcriptText.length > 0 &&
                  ` • ~${Math.ceil(transcriptText.split(/\s+/).length / 250)} min read`}
              </p>
            </div>

            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">AI Processing</p>
                    <p className="text-xs text-muted-foreground">
                      After upload, the transcript will be automatically summarized and action
                      items will be extracted using AI.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending || !transcriptText.trim() || !meetingDate}
              className="gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload & Process
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Transcript Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Week {viewingTranscript?.week_number} Transcript
            </DialogTitle>
            <DialogDescription>
              Meeting date: {viewingTranscript && formatDate(viewingTranscript.meeting_date)}
            </DialogDescription>
          </DialogHeader>

          {viewingTranscript && (
            <div className="space-y-4 py-4">
              {/* AI Summary */}
              {viewingTranscript.summary_ai && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">
                      {viewingTranscript.summary_ai}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Action Items */}
              {viewingTranscript.action_items_json &&
                viewingTranscript.action_items_json.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        Action Items ({viewingTranscript.action_items_json.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {viewingTranscript.action_items_json.map((item, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                              {i + 1}
                            </span>
                            <div>
                              <span>{typeof item === 'string' ? item : item.action}</span>
                              {typeof item !== 'string' && item.owner && (
                                <span className="text-muted-foreground ml-2">
                                  — {item.owner}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

              {/* Full Transcript */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Full Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-4 rounded-lg max-h-[300px] overflow-y-auto">
                    {viewingTranscript.transcript_text}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (viewingTranscript && selectedAssignment) {
                  setIsViewDialogOpen(false);
                  handleOpenUpload(
                    assignments?.find((a) => a.id === viewingTranscript.assignment_id) ||
                      selectedAssignment,
                    viewingTranscript.week_number
                  );
                }
              }}
            >
              <Upload className="h-4 w-4" />
              Re-upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
