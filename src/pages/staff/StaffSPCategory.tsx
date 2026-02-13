import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Circle,
  Video,
  FileText,
  FileDown,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SPCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
}

interface SPModule {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  image_url: string | null;
  display_order: number;
  lessons: SPLesson[];
}

interface SPLesson {
  id: string;
  name: string;
  slug: string;
  video_url: string | null;
  content_html: string | null;
  document_url: string | null;
  has_quiz: boolean;
  estimated_minutes: number;
  display_order: number;
  completed: boolean;
}

export default function StaffSPCategory() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useStaffAuth();

  const [category, setCategory] = useState<SPCategory | null>(null);
  const [modules, setModules] = useState<SPModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.id && categorySlug) {
      fetchData();
    }
  }, [authLoading, isAuthenticated, user?.id, categorySlug]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const sessionToken = localStorage.getItem('staff_session_token');
      if (!sessionToken) {
        console.error('No session token found');
        navigate('/staff/training/standard');
        return;
      }

      const { data, error } = await supabase.functions.invoke('get_staff_sp_content', {
        body: { 
          session_token: sessionToken,
          category_slug: categorySlug
        }
      });

      if (error) throw error;

      if (!data.category) {
        navigate('/staff/training/standard');
        return;
      }

      setCategory(data.category);
      setModules(data.modules || []);

    } catch (err) {
      console.error('Error fetching category:', err);
      navigate('/staff/training/standard');
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const getModuleProgress = (module: SPModule) => {
    const completed = module.lessons.filter(l => l.completed).length;
    const total = module.lessons.length;
    return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Category not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/staff/training/standard')}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
          Back to Standard Playbook
        </Button>

        <div className="flex items-center gap-4">
          <div className="text-5xl">{category.icon}</div>
          <div>
            <h1 className="text-2xl font-medium">{category.name}</h1>
            <p className="text-muted-foreground/70 mt-1">
              {category.description}
            </p>
          </div>
        </div>
      </div>

      {/* Modules */}
      {modules.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No modules available yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {modules.map((module, moduleIndex) => {
            const progress = getModuleProgress(module);
            const isExpanded = expandedModules.has(module.id);

            return (
              <Card key={module.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Module Cover Image */}
                  {module.image_url && (
                    <img
                      src={module.image_url}
                      alt={module.name}
                      className="w-full aspect-[6/1] object-cover"
                    />
                  )}
                  {/* Module Header */}
                  <button
                    className="w-full p-4 flex items-center gap-4 text-left hover:bg-accent/5 transition-colors"
                    onClick={() => toggleModule(module.id)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center text-lg font-medium">
                      {moduleIndex + 1}
                    </div>
                    <div className="text-2xl">{module.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{module.name}</h3>
                        {progress.percent === 100 && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <Progress value={progress.percent} className="w-24 h-1.5" />
                        <span className="text-xs text-muted-foreground">
                          {progress.completed}/{progress.total} lessons
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        "h-5 w-5 text-muted-foreground transition-transform",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </button>

                  {/* Lessons List */}
                  {isExpanded && (
                    <div className="border-t border-border/50">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <button
                          key={lesson.id}
                          className="w-full p-4 pl-20 flex items-center gap-4 text-left hover:bg-accent/5 transition-colors border-b border-border/30 last:border-0"
                          onClick={() => navigate(`/staff/training/standard/${categorySlug}/${module.slug}/${lesson.slug}`)}
                        >
                          <div className="flex-shrink-0">
                            {lesson.completed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground/40" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "font-medium",
                              lesson.completed && "text-muted-foreground"
                            )}>
                              {lessonIndex + 1}. {lesson.name}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground/70">
                              {lesson.video_url && (
                                <span className="flex items-center gap-1">
                                  <Video className="h-3 w-3" /> Video
                                </span>
                              )}
                              {lesson.content_html && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> Content
                                </span>
                              )}
                              {lesson.document_url && (
                                <span className="flex items-center gap-1">
                                  <FileDown className="h-3 w-3" /> Download
                                </span>
                              )}
                              {lesson.has_quiz && (
                                <span className="flex items-center gap-1">
                                  <HelpCircle className="h-3 w-3" /> Quiz
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {lesson.estimated_minutes} min
                              </span>
                            </div>
                          </div>

                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
