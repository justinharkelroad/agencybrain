import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RotateCcw, Upload, Users, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { WinbackUploadModal, WinbackSettings } from '@/components/winback';
import { toast } from 'sonner';

interface Stats {
  totalHouseholds: number;
  untouched: number;
  inProgress: number;
  wonBack: number;
  teedUpThisWeek: number;
}

export default function WinbackHQ() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [contactDaysBefore, setContactDaysBefore] = useState(45);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalHouseholds: 0,
    untouched: 0,
    inProgress: 0,
    wonBack: 0,
    teedUpThisWeek: 0,
  });
  const [loading, setLoading] = useState(true);

  // Fetch agency ID and settings
  useEffect(() => {
    const fetchAgencyData = async () => {
      if (!user?.id) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .single();

        if (!profile?.agency_id) {
          toast.error('No agency found');
          navigate('/');
          return;
        }

        setAgencyId(profile.agency_id);

        // Fetch settings
        const { data: settings } = await supabase
          .from('winback_settings')
          .select('contact_days_before')
          .eq('agency_id', profile.agency_id)
          .maybeSingle();

        if (settings) {
          setContactDaysBefore(settings.contact_days_before);
        }

        // Fetch stats
        await fetchStats(profile.agency_id);
      } catch (err) {
        console.error('Error fetching agency data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAgencyData();
  }, [user?.id, navigate]);

  const fetchStats = async (agency: string) => {
    try {
      // Get total households and status counts
      const { data: households } = await supabase
        .from('winback_households')
        .select('status')
        .eq('agency_id', agency);

      const statusCounts = {
        totalHouseholds: households?.length || 0,
        untouched: households?.filter(h => h.status === 'untouched').length || 0,
        inProgress: households?.filter(h => h.status === 'in_progress').length || 0,
        wonBack: households?.filter(h => h.status === 'won_back').length || 0,
        teedUpThisWeek: 0,
      };

      // Get count of households teed up this week (not dismissed, won_back, etc.)
      const today = new Date();
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay())); // End of Sunday

      const { count: teedUpCount } = await supabase
        .from('winback_households')
        .select('*', { count: 'exact', head: true })
        .eq('agency_id', agency)
        .in('status', ['untouched', 'in_progress'])
        .lte('earliest_winback_date', endOfWeek.toISOString().split('T')[0])
        .gte('earliest_winback_date', today.toISOString().split('T')[0]);

      statusCounts.teedUpThisWeek = teedUpCount || 0;

      setStats(statusCounts);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleUploadComplete = () => {
    if (agencyId) {
      fetchStats(agencyId);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <RotateCcw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Win-Back HQ</h1>
            <p className="text-muted-foreground">
              Track terminated policies and win back former customers
            </p>
          </div>
        </div>
        <Button onClick={() => setUploadModalOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Terminations
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Households</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{stats.totalHouseholds}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Teed Up This Week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{stats.teedUpThisWeek}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Untouched</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{stats.untouched}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Won Back</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{stats.wonBack}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      {agencyId && (
        <WinbackSettings
          agencyId={agencyId}
          contactDaysBefore={contactDaysBefore}
          onSettingsChange={setContactDaysBefore}
        />
      )}

      {/* Empty State or Coming Soon for Table */}
      {stats.totalHouseholds === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <RotateCcw className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">No win-back opportunities yet</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm mt-1">
              Upload a termination audit file to start tracking win-back opportunities.
            </p>
            <Button className="mt-4" onClick={() => setUploadModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Terminations
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Win-Back Opportunities</CardTitle>
            <CardDescription>
              Households ready for win-back outreach. Full list and filtering coming in Phase 3.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {stats.totalHouseholds} households loaded. Table view with date filtering, assignment, and status management coming soon.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upload Modal */}
      {agencyId && (
        <WinbackUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          agencyId={agencyId}
          contactDaysBefore={contactDaysBefore}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </div>
  );
}
