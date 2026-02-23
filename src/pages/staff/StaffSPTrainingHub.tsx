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
  AlertCircle,
  FolderOpen,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, isPast } from 'date-fns';
import { VideoEmbed } from '@/components/training/VideoEmbed';

interface SPCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  image_url: string | null;
  module_count: number;
  lesson_count: number;
  completed_count: number;
}

interface AssignedItem {
  id: string;
  level: 'category' | 'module' | 'lesson';
  target_id: string;
  target_name: string;
  target_slug: string;
  breadcrumb: string | null;
  breadcrumb_slug?: string;
  module_slug?: string;
  due_date: string | null;
  assigned_at: string;
  seen_at: string | null;
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

  const [assignedItems, setAssignedItems] = useState<AssignedItem[]>([]);
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

      setAssignedItems(data.assignedItems || []);
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

  const filteredAssigned = assignedItems.filter(item =>
    item.target_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.breadcrumb?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const navigateToItem = (item: AssignedItem) => {
    if (item.level === 'category') {
      navigate(`/staff/training/standard/${item.target_slug}`);
    } else if (item.level === 'module') {
      navigate(`/staff/training/standard/${item.breadcrumb_slug || ''}`);
    } else if (item.level === 'lesson' && item.breadcrumb_slug && item.module_slug && item.target_slug) {
      // lesson — navigate directly to the lesson page
      navigate(`/staff/training/standard/${item.breadcrumb_slug}/${item.module_slug}/${item.target_slug}`);
    } else {
      // fallback — navigate to category
      navigate(`/staff/training/standard/${item.breadcrumb_slug || ''}`);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasAssignments = assignedItems.length > 0;

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

      {/* Your Assignments Section */}
      {hasAssignments && (
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            Your Assignments
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAssigned.map(item => {
              const progressPercent = item.lesson_count > 0
                ? Math.round((item.completed_count / item.lesson_count) * 100)
                : 0;

              const levelIcon = item.level === 'category'
                ? <FolderOpen className="h-4 w-4 text-muted-foreground" />
                : item.level === 'module'
                ? <BookOpen className="h-4 w-4 text-muted-foreground" />
                : <FileText className="h-4 w-4 text-muted-foreground" />;

              return (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:bg-accent/5 transition-colors border border-blue-200 dark:border-blue-900"
                  onClick={() => navigateToItem(item)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{levelIcon}</div>
                      <div className="flex-1 min-w-0">
                        {item.breadcrumb && (
                          <p className="text-xs text-muted-foreground mb-1 truncate">{item.breadcrumb}</p>
                        )}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium">{item.target_name}</h3>
                          <Badge variant="secondary" className="text-xs bg-blue-500/15 text-blue-600 dark:text-blue-400 capitalize">
                            {item.level}
                          </Badge>
                          {item.due_date && (() => {
                            const due = new Date(item.due_date);
                            const daysUntil = differenceInDays(due, new Date());
                            if (isPast(due)) {
                              return (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Overdue {Math.abs(daysUntil)}d
                                </Badge>
                              );
                            }
                            if (daysUntil <= 3) {
                              return <Badge variant="destructive" className="text-xs">Due in {daysUntil}d</Badge>;
                            }
                            if (daysUntil <= 7) {
                              return <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">Due in {daysUntil}d</Badge>;
                            }
                            return <Badge variant="secondary" className="text-xs">Due in {daysUntil}d</Badge>;
                          })()}
                        </div>

                        <div className="flex items-center gap-3 mt-2">
                          <Progress value={progressPercent} className="flex-1 h-2" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {item.completed_count}/{item.lesson_count}
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
        </div>
      )}

      {/* All Training Section */}
      <div>
        {hasAssignments && filteredCategories.length > 0 && (
          <h2 className="text-lg font-medium mb-4">All Training</h2>
        )}
        {filteredCategories.length === 0 && !hasAssignments ? (
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
                  className="cursor-pointer hover:bg-accent/5 transition-colors border border-border overflow-hidden"
                  onClick={() => navigate(`/staff/training/standard/${category.slug}`)}
                >
                  {category.image_url && (
                    <img
                      src={category.image_url}
                      alt={category.name}
                      className="w-full aspect-[3/1] object-cover"
                    />
                  )}
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
    </div>
  );
}
