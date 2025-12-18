import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, Check, Clock, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CallScoringSubmissionsProps {
  agencyId: string;
  teamMemberId: string;
  teamMemberName: string;
  startDate: Date;
  endDate: Date;
  onDataChange?: (data: CallScoringData[]) => void;
}

export interface CallScoringData {
  id: string;
  original_filename: string;
  status: string;
  overall_score: number | null;
  potential_rank: string | null;
  created_at: string;
  call_duration_seconds: number | null;
}

export function CallScoringSubmissionsSection({
  agencyId,
  teamMemberId,
  teamMemberName,
  startDate,
  endDate,
  onDataChange,
}: CallScoringSubmissionsProps) {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<CallScoringData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!teamMemberId || !startDate || !endDate) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const startStr = format(startDate, 'yyyy-MM-dd');
        const endStr = format(endDate, 'yyyy-MM-dd');

        const { data, error } = await supabase
          .from('agency_calls')
          .select('id, original_filename, status, overall_score, potential_rank, created_at, call_duration_seconds')
          .eq('team_member_id', teamMemberId)
          .eq('agency_id', agencyId)
          .gte('created_at', startStr)
          .lte('created_at', endStr + 'T23:59:59')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching call scoring submissions:', error);
          setSubmissions([]);
        } else {
          setSubmissions(data || []);
          onDataChange?.(data || []);
        }
      } catch (err) {
        console.error('Error fetching call scoring submissions:', err);
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [agencyId, teamMemberId, startDate, endDate, onDataChange]);

  const handleViewCallScore = (submissionId: string) => {
    // Navigate to Call Scoring page with the submission ID as a query param
    navigate(`/call-scoring?id=${submissionId}`);
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusInfo = (status: string, score: number | null) => {
    const isReviewed = status === 'reviewed' || status === 'scored' || score !== null;
    return {
      isReviewed,
      label: isReviewed ? 'Reviewed' : 'Pending',
    };
  };

  const getPriorityColor = (rank: string | null) => {
    switch (rank?.toLowerCase()) {
      case 'high':
        return 'border-destructive text-destructive';
      case 'medium':
        return 'border-amber-500 text-amber-500';
      case 'low':
        return 'border-green-500 text-green-500';
      default:
        return 'border-muted-foreground text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="font-bold uppercase tracking-wide text-center text-foreground">
          Call Scoring Submissions
        </h3>
        <Card className="p-6 text-center text-muted-foreground">
          Loading submissions...
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-bold uppercase tracking-wide text-center text-foreground">
        Call Scoring Submissions
      </h3>

      {submissions.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No call scoring submissions found for this date range.
        </Card>
      ) : (
        <div className="space-y-2">
          {submissions.map((submission) => {
            const statusInfo = getStatusInfo(submission.status, submission.overall_score);
            const createdDate = new Date(submission.created_at);

            return (
              <Card
                key={submission.id}
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleViewCallScore(submission.id)}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left side: Icon + Name + Filename */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Home className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{teamMemberName}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {submission.original_filename || 'Unknown file'}
                      </p>
                    </div>
                  </div>

                  {/* Right side: Status + Duration + Date + Score/Priority */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Status Badge */}
                    <Badge
                      className={cn(
                        'flex items-center gap-1',
                        statusInfo.isReviewed
                          ? 'bg-green-600 hover:bg-green-600 text-white'
                          : 'bg-amber-600 hover:bg-amber-600 text-white'
                      )}
                    >
                      {statusInfo.isReviewed ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {statusInfo.label}
                    </Badge>

                    {/* Duration */}
                    <div className="text-sm text-muted-foreground min-w-[50px] text-right">
                      {formatDuration(submission.call_duration_seconds)}
                    </div>

                    {/* Date */}
                    <div className="text-sm text-muted-foreground min-w-[85px] text-right">
                      {format(createdDate, 'MM/dd/yyyy')}
                    </div>

                    {/* Score or Priority Badge */}
                    {submission.overall_score !== null ? (
                      <Badge className="bg-amber-600 hover:bg-amber-600 min-w-[55px] justify-center">
                        {submission.overall_score.toFixed(1)}/10
                      </Badge>
                    ) : submission.potential_rank ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          'min-w-[70px] justify-center',
                          getPriorityColor(submission.potential_rank)
                        )}
                      >
                        {submission.potential_rank.toUpperCase()}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="min-w-[70px] justify-center text-muted-foreground">
                        --
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CallScoringSubmissionsSection;
