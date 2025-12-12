import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Upload, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface UsageInfo {
  calls_used: number;
  calls_limit: number;
  billing_period_start: string;
  billing_period_end: string;
}

export default function CallScoring() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // TEMPORARY: Admin-only gate until feature is complete
  useEffect(() => {
    if (user && !isAdmin) {
      navigate('/');
      toast.error('Call Scoring is coming soon!');
    }
  }, [user, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsageAndCalls();
    }
  }, [isAdmin]);

  const fetchUsageAndCalls = async () => {
    setLoading(true);
    
    // For now, show placeholder usage (will connect to real data later)
    setUsage({
      calls_used: 0,
      calls_limit: 20,
      billing_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      billing_period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
    });

    // Fetch recent calls (will be empty initially)
    const { data: calls } = await supabase
      .from('agency_calls')
      .select(`
        id,
        overall_score,
        potential_rank,
        created_at,
        team_members(name)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    setRecentCalls(calls || []);
    setLoading(false);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header with Usage Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            Call Scoring
          </h1>
          <p className="text-muted-foreground">
            Upload sales calls for AI-powered coaching analysis
          </p>
        </div>
        {usage && (
          <Badge variant="outline" className="text-sm px-3 py-1">
            {usage.calls_used} / {usage.calls_limit} calls this month
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Upload Section (Placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Call Recording
            </CardTitle>
            <CardDescription>
              Upload an audio file to analyze (MP3, WAV, M4A, OGG - max 25MB)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Upload functionality coming in Phase 2B...
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Calls
            </CardTitle>
            <CardDescription>
              Your last 10 analyzed calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-4">Loading...</p>
            ) : recentCalls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No calls analyzed yet</p>
                <p className="text-sm">Upload your first call to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentCalls.map((call) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer"
                  >
                    <div>
                      <p className="font-medium">{call.team_members?.name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(call.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {call.overall_score !== null && (
                        <Badge variant={call.overall_score >= 70 ? 'default' : 'secondary'}>
                          {call.overall_score}/100
                        </Badge>
                      )}
                      {call.potential_rank && (
                        <Badge variant="outline">{call.potential_rank}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
