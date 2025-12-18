import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen,
  ChevronRight,
  Loader2,
  Building2,
} from 'lucide-react';
import { HelpVideoButton } from '@/components/HelpVideoButton';
import standardPlaybookLogo from '@/assets/standard-playbook-logo.png';

interface TrainingStats {
  categoryCount: number;
  completedLessons: number;
  totalLessons: number;
}

interface AgencyTrainingStats {
  moduleCount: number;
  completedLessons: number;
  totalLessons: number;
}

interface AgencyInfo {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function StaffUnifiedTrainingHub() {
  const navigate = useNavigate();
  const { user, sessionToken, isAuthenticated, loading: authLoading } = useStaffAuth();

  const [loading, setLoading] = useState(true);
  const [spStats, setSpStats] = useState<TrainingStats | null>(null);
  const [agencyStats, setAgencyStats] = useState<AgencyTrainingStats | null>(null);
  const [agencyInfo, setAgencyInfo] = useState<AgencyInfo | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated && sessionToken) {
      fetchData();
    }
  }, [authLoading, isAuthenticated, sessionToken]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Use edge function to bypass RLS (staff users don't have Supabase auth)
      const { data, error } = await supabase.functions.invoke('get_staff_training_hub_stats', {
        body: { session_token: sessionToken }
      });

      if (error) {
        console.error('Edge function error:', error);
        return;
      }

      if (data?.success) {
        setSpStats(data.sp_stats);
        setAgencyStats(data.agency_stats);
        setAgencyInfo(data.agency_info);
      } else {
        console.error('Failed to fetch training stats:', data?.error);
      }
    } catch (err) {
      console.error('Error fetching training data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const spProgressPercent = spStats && spStats.totalLessons > 0
    ? Math.round((spStats.completedLessons / spStats.totalLessons) * 100)
    : 0;

  const agencyProgressPercent = agencyStats && agencyStats.totalLessons > 0
    ? Math.round((agencyStats.completedLessons / agencyStats.totalLessons) * 100)
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium flex items-center gap-2">
          <BookOpen className="h-6 w-6" strokeWidth={1.5} />
          Training
          <HelpVideoButton videoKey="training-overview" />
        </h1>
        <p className="text-muted-foreground/70 mt-1">
          Welcome back, {user?.display_name || 'Team Member'}
        </p>
      </div>

      {/* Training Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Standard Playbook Card */}
        <Card className="overflow-hidden hover:border-primary/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex flex-col h-full">
              {/* Logo */}
              <div className="h-12 mb-4 flex items-center">
                <img 
                  src={standardPlaybookLogo} 
                  alt="Standard Playbook" 
                  className="h-8 object-contain"
                />
              </div>

              {/* Title & Description */}
              <h3 className="text-lg font-semibold mb-1">Standard Playbook</h3>
              <p className="text-sm text-muted-foreground/70 mb-4 flex-1">
                Training from the Standard Playbook system to level up your insurance game.
              </p>

              {/* Stats */}
              <div className="space-y-3 mb-4">
                <div className="text-sm text-muted-foreground">
                  {spStats?.categoryCount || 0} categories
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={spProgressPercent} className="flex-1 h-2" />
                  <span className="text-sm text-muted-foreground">
                    {spProgressPercent}% complete
                  </span>
                </div>
              </div>

              {/* Action */}
              <Button 
                className="w-full"
                onClick={() => navigate('/staff/training/standard')}
              >
                Enter
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Agency Training Card */}
        <Card className="overflow-hidden hover:border-primary/30 transition-colors">
          <CardContent className="p-6">
            <div className="flex flex-col h-full">
              {/* Logo */}
              <div className="h-12 mb-4 flex items-center">
                {agencyInfo?.logo_url ? (
                  <img 
                    src={agencyInfo.logo_url} 
                    alt={agencyInfo.name} 
                    className="h-10 object-contain"
                  />
                ) : (
                  <Building2 className="h-10 w-10 text-muted-foreground" strokeWidth={1} />
                )}
              </div>

              {/* Title & Description */}
              <h3 className="text-lg font-semibold mb-1">
                {agencyInfo?.name ? `${agencyInfo.name} Training` : 'Agency Training'}
              </h3>
              <p className="text-sm text-muted-foreground/70 mb-4 flex-1">
                Training created by your agency leadership.
              </p>

              {/* Stats */}
              <div className="space-y-3 mb-4">
                <div className="text-sm text-muted-foreground">
                  {agencyStats?.moduleCount || 0} modules assigned
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={agencyProgressPercent} className="flex-1 h-2" />
                  <span className="text-sm text-muted-foreground">
                    {agencyProgressPercent}% complete
                  </span>
                </div>
              </div>

              {/* Action */}
              <Button 
                className="w-full"
                onClick={() => navigate('/staff/training/agency')}
              >
                View Training
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
