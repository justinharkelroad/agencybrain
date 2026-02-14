import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, Check, Clock, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CallScorecard } from '@/components/CallScorecard';
import { ServiceCallReportCard } from '@/components/call-scoring/ServiceCallReportCard';
import { fetchWithAuth } from '@/lib/staffRequest';
import type { Database } from '@/integrations/supabase/types';

type CallScorecardCall = Database['public']['Tables']['agency_calls']['Row'];

interface CallScoringSubmissionsProps {
  agencyId: string;
  teamMemberId: string;
  teamMemberName: string;
  startDate: Date;
  endDate: Date;
  onDataChange?: (data: CallScoringData[]) => void;
  qaEnabled?: boolean;
}

export interface CallScoringData {
  id: string;
  original_filename: string;
  status: string;
  overall_score: number | null;
  potential_rank: string | null;
  created_at: string;
  call_duration_seconds: number | null;
  call_type?: string;
}

export function CallScoringSubmissionsSection({
  agencyId,
  teamMemberId,
  teamMemberName,
  startDate,
  endDate,
  onDataChange,
  qaEnabled = false,
}: CallScoringSubmissionsProps) {
  const [submissions, setSubmissions] = useState<CallScoringData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallScorecardCall | null>(null);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [loadingCallDetails, setLoadingCallDetails] = useState(false);

  // Detect staff mode
  const staffToken = localStorage.getItem('staff_session_token');
  const isStaffMode = !!staffToken;

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

        if (isStaffMode) {
          // Staff mode: use fetchWithAuth to avoid JWT collision
          const response = await fetchWithAuth('scorecards_admin', {
            method: 'POST',
            body: { 
              action: 'meeting_frame_call_submissions',
              team_member_id: teamMemberId,
              start_date: startStr,
              end_date: endStr,
            },
          });
          
          const data = await response.json();

          if (!response.ok || data?.error) {
            console.error('Error fetching call scoring submissions via edge function:', data?.error);
            setSubmissions([]);
          } else {
            setSubmissions(data?.submissions || []);
            onDataChange?.(data?.submissions || []);
          }
        } else {
          // Owner mode: direct Supabase query
          const { data, error } = await supabase
            .from('agency_calls')
            .select('id, original_filename, status, overall_score, potential_rank, created_at, call_duration_seconds, call_type')
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
        }
      } catch (err) {
        console.error('Error fetching call scoring submissions:', err);
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [agencyId, teamMemberId, startDate, endDate, onDataChange, isStaffMode]);

  const handleViewCallScore = async (submissionId: string) => {
    setLoadingCallDetails(true);
    try {
      if (isStaffMode) {
        // Staff mode: use fetchWithAuth to avoid JWT collision
        const response = await fetchWithAuth('scorecards_admin', {
          method: 'POST',
          body: { 
            action: 'meeting_frame_call_details',
            call_id: submissionId,
          },
        });
        
        const data = await response.json();

        if (!response.ok || data?.error) {
          console.error('Error fetching call details via edge function:', data?.error);
          toast.error('Failed to load call details');
          return;
        }

        setSelectedCall(data?.call);
        setScorecardOpen(true);
      } else {
        // Owner mode: direct Supabase query
        const { data, error } = await supabase
          .from('agency_calls')
          .select('*')
          .eq('id', submissionId)
          .single();

        if (error) {
          console.error('Error fetching call details:', error);
          toast.error('Failed to load call details');
          return;
        }

        setSelectedCall(data);
        setScorecardOpen(true);
      }
    } catch (err) {
      console.error('Error fetching call details:', err);
      toast.error('Failed to load call details');
    } finally {
      setLoadingCallDetails(false);
    }
  };

  const handleCloseScorecard = () => {
    setScorecardOpen(false);
    setSelectedCall(null);
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

  // Score ranges for the new scoring system
  const SCORE_RANGES = [
    { label: 'Excellent', min: 80, max: 100, bgClass: 'bg-green-600 hover:bg-green-600' },
    { label: 'Good', min: 60, max: 79, bgClass: 'bg-yellow-600 hover:bg-yellow-600' },
    { label: 'Needs Work', min: 40, max: 59, bgClass: 'bg-orange-600 hover:bg-orange-600' },
    { label: 'Poor', min: 0, max: 39, bgClass: 'bg-red-600 hover:bg-red-600' },
  ];

  const getScoreRange = (score: number) => {
    return SCORE_RANGES.find(r => score >= r.min && score <= r.max) || SCORE_RANGES[SCORE_RANGES.length - 1];
  };

  // Legacy function for historical calls with rank but no score
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
                className={cn(
                  "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                  loadingCallDetails && "opacity-50 pointer-events-none"
                )}
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

                    {/* Score Badge - using score ranges */}
                    {submission.overall_score !== null ? (
                      <Badge className={cn(
                        'min-w-[55px] justify-center text-white',
                        getScoreRange(submission.overall_score).bgClass
                      )}>
                        {submission.overall_score}%
                      </Badge>
                    ) : submission.potential_rank ? (
                      // Legacy: show rank for historical calls without score
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

      {/* Call Scorecard Modal */}
      {selectedCall?.call_type === 'service' ? (
        <ServiceCallReportCard
          call={selectedCall}
          open={scorecardOpen}
          onClose={handleCloseScorecard}
          isReadOnly={true}
        />
      ) : (
        <CallScorecard
          call={selectedCall}
          open={scorecardOpen}
          onClose={handleCloseScorecard}
          isStaffUser={false}
          qaEnabled={qaEnabled}
        />
      )}
    </div>
  );
}

export default CallScoringSubmissionsSection;
