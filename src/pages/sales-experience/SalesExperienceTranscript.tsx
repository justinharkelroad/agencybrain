import { Link, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useSalesExperienceAccess } from '@/hooks/useSalesExperienceAccess';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  ArrowLeft,
  MessageSquare,
  Calendar,
  CheckSquare,
  Sparkles,
  FileText,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

interface Transcript {
  id: string;
  assignment_id: string;
  week_number: number;
  meeting_date: string;
  transcript_text: string;
  summary_ai: string | null;
  action_items_json: Array<{ action: string; owner: string; deadline: string | null }>;
  key_points_json: string[];
  created_at: string;
}

interface Module {
  id: string;
  week_number: number;
  title: string;
}

export default function SalesExperienceTranscript() {
  const { week } = useParams<{ week: string }>();
  const weekNumber = parseInt(week || '1', 10);
  const { hasAccess, currentWeek, assignment, isLoading: accessLoading } = useSalesExperienceAccess();

  // Fetch module for this week
  const { data: module, isLoading: moduleLoading } = useQuery({
    queryKey: ['sales-experience-module', weekNumber],
    enabled: hasAccess && !isNaN(weekNumber),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_modules')
        .select('id, week_number, title')
        .eq('week_number', weekNumber)
        .single();

      if (error) throw error;
      return data as Module;
    },
  });

  // Fetch transcript for this week
  const { data: transcript, isLoading: transcriptLoading } = useQuery({
    queryKey: ['sales-experience-transcript', weekNumber, assignment?.id],
    enabled: hasAccess && !!assignment?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_transcripts')
        .select('*')
        .eq('assignment_id', assignment!.id)
        .eq('week_number', weekNumber)
        .maybeSingle();

      if (error) throw error;
      return data as Transcript | null;
    },
  });

  const isWeekUnlocked = currentWeek >= weekNumber;

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isWeekUnlocked) {
    return <Navigate to="/sales-experience" replace />;
  }

  const isLoading = moduleLoading || transcriptLoading;

  const handleCopyTranscript = () => {
    if (transcript?.transcript_text) {
      navigator.clipboard.writeText(transcript.transcript_text);
      toast.success('Transcript copied to clipboard');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Back Link */}
      <Link
        to={`/sales-experience/week/${weekNumber}`}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Week {weekNumber}
      </Link>

      {/* Header */}
      {isLoading ? (
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
      ) : (
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Week {weekNumber} Transcript
          </h1>
          <p className="text-muted-foreground">
            {module?.title} - Coaching call transcript
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : transcript ? (
        <div className="space-y-6">
          {/* Meeting Info */}
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Coaching Call</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(transcript.meeting_date)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          {transcript.summary_ai && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{transcript.summary_ai}</p>
              </CardContent>
            </Card>
          )}

          {/* Key Points */}
          {transcript.key_points_json && transcript.key_points_json.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckSquare className="h-5 w-5" />
                  Key Discussion Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {transcript.key_points_json.map((point, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium mt-0.5">
                        {index + 1}
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Action Items */}
          {transcript.action_items_json && transcript.action_items_json.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckSquare className="h-5 w-5" />
                  Action Items
                </CardTitle>
                <CardDescription>
                  Follow-up items from your coaching call
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transcript.action_items_json.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary mt-0.5">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.action}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          {item.owner && (
                            <span>Owner: {item.owner}</span>
                          )}
                          {item.deadline && (
                            <span>Due: {item.deadline}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full Transcript */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5" />
                  Full Transcript
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleCopyTranscript}
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/50 p-4 rounded-lg max-h-[600px] overflow-y-auto">
                  {transcript.transcript_text}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-16">
            <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Transcript Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              The transcript for this week's coaching call hasn't been uploaded yet.
              Your coach will add it after your session.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Link to={`/sales-experience/week/${weekNumber}`}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Lessons
          </Button>
        </Link>
        <Link to={`/sales-experience/week/${weekNumber}/documents`}>
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            View Documents
          </Button>
        </Link>
      </div>
    </div>
  );
}
