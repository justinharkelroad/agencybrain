import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen,
  ChevronRight,
  Loader2,
  Building2,
  Settings,
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

export default function UnifiedTrainingHub() {
  const navigate = useNavigate();
  const { user, isAgencyOwner, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [spStats, setSpStats] = useState<TrainingStats | null>(null);
  const [agencyStats, setAgencyStats] = useState<AgencyTrainingStats | null>(null);
  const [agencyInfo, setAgencyInfo] = useState<AgencyInfo | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user's profile to get agency_id and membership tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, membership_tier')
        .eq('id', user!.id)
        .single();

      const accessTier = profile?.membership_tier === 'Boardroom' ? 'boardroom' : 'one_on_one';

      // Fetch Standard Playbook stats
      const { data: spCategories } = await supabase
        .from('sp_categories')
        .select(`
          id,
          sp_modules(
            id,
            sp_lessons(id)
          )
        `)
        .eq('is_published', true)
        .contains('access_tiers', [accessTier]);

      const { data: spProgress } = await supabase
        .from('sp_progress')
        .select('lesson_id')
        .eq('user_id', user!.id)
        .eq('quiz_passed', true);

      const completedLessonIds = new Set(spProgress?.map(p => p.lesson_id) || []);
      let spTotalLessons = 0;
      let spCompletedLessons = 0;

      spCategories?.forEach(cat => {
        cat.sp_modules?.forEach((mod: any) => {
          mod.sp_lessons?.forEach((lesson: any) => {
            spTotalLessons++;
            if (completedLessonIds.has(lesson.id)) {
              spCompletedLessons++;
            }
          });
        });
      });

      setSpStats({
        categoryCount: spCategories?.length || 0,
        completedLessons: spCompletedLessons,
        totalLessons: spTotalLessons,
      });

      // Fetch Agency Training stats if user has agency
      if (profile?.agency_id) {
        const { data: agency } = await supabase
          .from('agencies')
          .select('id, name, logo_url')
          .eq('id', profile.agency_id)
          .single();

        if (agency) {
          setAgencyInfo(agency);
        }

        // For agency owners, get ALL modules for their agency (they own the training, not assigned)
        const { data: modules } = await supabase
          .from('training_modules')
          .select('id, training_lessons(id)')
          .eq('agency_id', profile.agency_id)
          .eq('is_active', true);

        const moduleIds = modules?.map(m => m.id).filter(Boolean) || [];
        
        let agencyTotalLessons = 0;
        let agencyCompletedLessons = 0;

        if (moduleIds.length > 0) {
          // Fetch lesson progress for this user
          const { data: lessonProgress } = await supabase
            .from('training_lesson_progress')
            .select('lesson_id')
            .eq('staff_user_id', user!.id)
            .eq('completed', true);

          const completedAgencyLessons = new Set(lessonProgress?.map(p => p.lesson_id) || []);

          modules?.forEach((mod: any) => {
            mod.training_lessons?.forEach((lesson: any) => {
              agencyTotalLessons++;
              if (completedAgencyLessons.has(lesson.id)) {
                agencyCompletedLessons++;
              }
            });
          });
        }

        setAgencyStats({
          moduleCount: moduleIds.length,
          completedLessons: agencyCompletedLessons,
          totalLessons: agencyTotalLessons,
        });
      }
    } catch (err) {
      console.error('Error fetching training data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
          Access your training resources
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
                onClick={() => navigate('/training/standard')}
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
                  {agencyStats?.moduleCount || 0} modules
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={agencyProgressPercent} className="flex-1 h-2" />
                  <span className="text-sm text-muted-foreground">
                    {agencyProgressPercent}% complete
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Button 
                  className="w-full"
                  onClick={() => navigate('/training/agency')}
                >
                  View Training
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>

                {/* Manage Training - Only for agency owners */}
                {(isAgencyOwner || isAdmin) && (
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate('/training/agency/manage')}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Training
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
