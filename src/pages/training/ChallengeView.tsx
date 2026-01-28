import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Play,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Dumbbell,
  Brain,
  Heart,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';

interface ChallengeLesson {
  id: string;
  title: string;
  day_number: number;
  week_number: number;
  day_of_week: number;
  video_url: string | null;
  video_thumbnail_url: string | null;
  preview_text: string | null;
  content_html: string | null;
  questions: any[];
  action_items: any[];
  is_discovery_flow: boolean;
}

interface ChallengeModule {
  id: string;
  name: string;
  week_number: number;
  description: string | null;
  icon: string | null;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const MODULE_ICONS: Record<string, React.ElementType> = {
  body: Dumbbell,
  being: Brain,
  balance: Heart,
  business: Briefcase,
};

export default function ChallengeView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ChallengeModule[]>([]);
  const [lessons, setLessons] = useState<ChallengeLesson[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('1');
  const [selectedLesson, setSelectedLesson] = useState<ChallengeLesson | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchChallengeContent();
    }
  }, [user?.id]);

  const fetchChallengeContent = async () => {
    setLoading(true);
    try {
      // Fetch modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('challenge_modules')
        .select('*')
        .order('week_number', { ascending: true });

      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      // Fetch lessons
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('challenge_lessons')
        .select('*')
        .order('day_number', { ascending: true });

      if (lessonsError) throw lessonsError;
      setLessons(lessonsData || []);

      // Auto-select first lesson
      if (lessonsData && lessonsData.length > 0) {
        setSelectedLesson(lessonsData[0]);
      }
    } catch (err) {
      console.error('Error loading challenge content:', err);
      toast.error('Failed to load challenge content');
    } finally {
      setLoading(false);
    }
  };

  const getVideoEmbedUrl = (url: string | null): string | null => {
    if (!url) return null;

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Loom
    const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (loomMatch) {
      return `https://www.loom.com/embed/${loomMatch[1]}`;
    }

    return url;
  };

  const selectLesson = (lesson: ChallengeLesson) => {
    setSelectedLesson(lesson);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Challenge content not available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const weekLessons = lessons.filter(l => l.week_number === parseInt(selectedWeek));
  const currentModule = modules.find(m => m.week_number === parseInt(selectedWeek));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Back Link */}
      <Link
        to="/training/challenge"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Challenge Purchase
      </Link>

      {/* Header */}
      <div
        className="rounded-xl p-4 sm:p-6"
        style={{
          background: 'linear-gradient(135deg, #1e283a 0%, #020817 100%)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">The Challenge - Preview</h1>
            <p className="text-sm text-slate-400 mt-1">
              Browse all {lessons.length} lessons across {modules.length} weeks
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Week Tabs */}
          <Tabs value={selectedWeek} onValueChange={setSelectedWeek}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {modules.map((module) => (
                <TabsTrigger
                  key={module.week_number}
                  value={module.week_number.toString()}
                  className="flex-shrink-0"
                >
                  Week {module.week_number}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedWeek} className="mt-4">
              {/* Module Info */}
              {currentModule && (
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{currentModule.name}</h2>
                  {currentModule.description && (
                    <p className="text-sm text-muted-foreground mt-1">{currentModule.description}</p>
                  )}
                </div>
              )}

              {/* Lesson List */}
              <div className="grid gap-2">
                {weekLessons.map((lesson) => {
                  const isSelected = selectedLesson?.id === lesson.id;

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => selectLesson(lesson)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="p-2 rounded-full bg-primary/10">
                        <Play className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {DAY_NAMES[lesson.day_of_week - 1]} - Day {lesson.day_number}
                          </span>
                          {lesson.is_discovery_flow && (
                            <Badge variant="outline" className="text-xs">Discovery Flow</Badge>
                          )}
                        </div>
                        <p className="font-medium truncate">{lesson.title}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          {/* Selected Lesson Content */}
          {selectedLesson && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Day {selectedLesson.day_number}</span>
                  <span>·</span>
                  <span>Week {selectedLesson.week_number}</span>
                  {selectedLesson.is_discovery_flow && (
                    <>
                      <span>·</span>
                      <Badge variant="outline">Discovery Flow</Badge>
                    </>
                  )}
                </div>
                <CardTitle>{selectedLesson.title}</CardTitle>
                {selectedLesson.preview_text && (
                  <CardDescription>{selectedLesson.preview_text}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Video */}
                {selectedLesson.video_url && (
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <iframe
                      src={getVideoEmbedUrl(selectedLesson.video_url) || ''}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                {/* Content HTML */}
                {selectedLesson.content_html && (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: selectedLesson.content_html }}
                  />
                )}

                {/* Questions/Reflection */}
                {selectedLesson.questions && selectedLesson.questions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Reflection Questions</h3>
                    <ul className="space-y-2">
                      {selectedLesson.questions.map((question: any, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          {i + 1}. {question.text || question}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Items */}
                {selectedLesson.action_items && selectedLesson.action_items.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Action Items</h3>
                    <ul className="space-y-2">
                      {selectedLesson.action_items.map((item: any, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-primary">•</span>
                          <span>{item.text || item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Module Overview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Challenge Overview</CardTitle>
              <CardDescription>6 weeks of transformation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {modules.map((module) => {
                const weekLessonCount = lessons.filter(l => l.week_number === module.week_number).length;
                const isCurrentWeek = module.week_number.toString() === selectedWeek;

                return (
                  <button
                    key={module.id}
                    onClick={() => setSelectedWeek(module.week_number.toString())}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      isCurrentWeek ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isCurrentWeek ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {module.week_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{module.name}</p>
                      <p className="text-xs text-muted-foreground">{weekLessonCount} lessons</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* What's Included */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What Staff Receive</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Daily video lessons with reflection questions</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Core 4 daily habit tracking</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Weekly Discovery Flow reflections</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Progress tracking and streaks</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Email reminders to stay on track</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
