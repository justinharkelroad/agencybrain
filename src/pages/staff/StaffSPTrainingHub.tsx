import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  Search,
  ChevronRight,
  Loader2,
  Flame,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { VideoEmbed } from '@/components/training/VideoEmbed';

interface SPCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  module_count: number;
  lesson_count: number;
  completed_count: number;
}

interface TrainingStats {
  totalLessons: number;
  completedLessons: number;
  currentStreak: number;
}

export default function StaffSPTrainingHub() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useStaffAuth();

  const [categories, setCategories] = useState<SPCategory[]>([]);
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.id) {
      fetchData();
    }
  }, [authLoading, isAuthenticated, user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const sessionToken = localStorage.getItem('staff_session_token');
      if (!sessionToken) {
        console.error('No session token found');
        return;
      }

      const { data, error } = await supabase.functions.invoke('get_staff_sp_content', {
        body: { session_token: sessionToken }
      });

      if (error) throw error;

      setCategories(data.categories || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Error fetching training data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium flex items-center gap-2">
          <BookOpen className="h-6 w-6" strokeWidth={1.5} />
          Standard Playbook
        </h1>
        <p className="text-muted-foreground/70 mt-1">
          Welcome back, {user?.display_name || 'Team Member'}
        </p>
      </div>

      {/* Intro Video */}
      <div className="mb-8">
        <VideoEmbed 
          url="https://vimeo.com/1152848197"
          autoplay
          muted
          controls
          className="rounded-xl shadow-lg"
        />
      </div>

      {/* Stats Card */}
      {stats && (
        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="flex items-stretch divide-x divide-border/50">
              {/* Progress Ring */}
              <div className="flex items-center justify-center p-6 min-w-[140px]">
                <div className="relative">
                  <svg width="80" height="80" className="transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      className="text-muted/30"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 32}
                      strokeDashoffset={2 * Math.PI * 32 * (1 - (stats.completedLessons / Math.max(stats.totalLessons, 1)))}
                      className="text-primary transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold">
                      {stats.totalLessons > 0
                        ? Math.round((stats.completedLessons / stats.totalLessons) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 p-6 flex items-center justify-around">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold">{stats.completedLessons}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <span className="text-2xl font-bold">{stats.totalLessons - stats.completedLessons}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <span className="text-2xl font-bold">{stats.currentStreak}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Day Streak</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search training..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Categories */}
      {filteredCategories.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" strokeWidth={1} />
            <h3 className="font-medium mb-2">No training available</h3>
            <p className="text-sm text-muted-foreground/70">
              Training content will appear here when available.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCategories.map(category => {
            const progressPercent = category.lesson_count > 0
              ? Math.round((category.completed_count / category.lesson_count) * 100)
              : 0;

            return (
              <Card
                key={category.id}
                className="cursor-pointer hover:bg-accent/5 transition-colors"
                onClick={() => navigate(`/staff/training/standard/${category.slug}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{category.icon}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium mb-1">{category.name}</h3>
                      <p className="text-sm text-muted-foreground/70 line-clamp-2 mb-3">
                        {category.description || `${category.module_count} modules`}
                      </p>

                      <div className="flex items-center gap-3">
                        <Progress value={progressPercent} className="flex-1 h-2" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {category.completed_count}/{category.lesson_count}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
