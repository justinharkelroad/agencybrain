import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Download,
  Send,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
}

interface LessonDocument {
  id: string;
  url: string;
  name: string;
}

interface SPLesson {
  id: string;
  module_id: string;
  name: string;
  slug: string;
  description: string | null;
  video_url: string | null;
  content_html: string | null;
  document_url: string | null;
  document_name: string | null;
  documents_json: LessonDocument[] | null;
  has_quiz: boolean;
  estimated_minutes: number;
  thumbnail_url: string | null;
  module?: {
    id: string;
    name: string;
    slug: string;
    category?: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

interface SPQuiz {
  id: string;
  lesson_id: string;
  questions_json: QuizQuestion[];
}

const REFLECTION_QUESTIONS = [
  "What was your biggest takeaway from the lesson?",
  "How will you immediately take action on that takeaway?",
  "What is the result you will see to know you completed this as you desire?",
];

export default function TrainingLesson() {
  const { categorySlug, moduleSlug, lessonSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [lesson, setLesson] = useState<SPLesson | null>(null);
  const [quiz, setQuiz] = useState<SPQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false);
  const [mcAnswers, setMcAnswers] = useState<Record<string, number>>({});
  const [reflections, setReflections] = useState<string[]>(['', '', '']);

  // Navigation
  const [nextLesson, setNextLesson] = useState<{ slug: string; name: string } | null>(null);

  useEffect(() => {
    if (user?.id && lessonSlug) {
      fetchData();
    }
  }, [user?.id, lessonSlug]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch lesson with module and category
      const { data: lessonData, error: lessonError } = await supabase
        .from('sp_lessons')
        .select(`
          *,
          module:sp_modules(
            id, name, slug,
            category:sp_categories(id, name, slug)
          )
        `)
        .eq('slug', lessonSlug)
        .eq('is_published', true)
        .single();

      if (lessonError) throw lessonError;
      setLesson(lessonData);

      // Fetch quiz if has_quiz
      if (lessonData.has_quiz) {
        const { data: quizData, error: quizError } = await supabase
          .from('sp_quizzes')
          .select('*')
          .eq('lesson_id', lessonData.id)
          .single();

        if (!quizError && quizData) {
          setQuiz(quizData);
        }
      }

      // Check if already completed
      const { data: progressData } = await supabase
        .from('sp_progress')
        .select('quiz_passed')
        .eq('user_id', user!.id)
        .eq('lesson_id', lessonData.id)
        .single();

      if (progressData?.quiz_passed) {
        setCompleted(true);
      }

      // Find next lesson
      const { data: lessonsInModule } = await supabase
        .from('sp_lessons')
        .select('slug, name, display_order')
        .eq('module_id', lessonData.module_id)
        .eq('is_published', true)
        .order('display_order', { ascending: true });

      if (lessonsInModule) {
        const currentIndex = lessonsInModule.findIndex(l => l.slug === lessonSlug);
        if (currentIndex >= 0 && currentIndex < lessonsInModule.length - 1) {
          setNextLesson(lessonsInModule[currentIndex + 1]);
        }
      }
    } catch (err) {
      console.error('Error fetching lesson:', err);
      navigate('/training/standard');
    } finally {
      setLoading(false);
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return null;

    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }

    // Loom
    const loomMatch = url.match(/loom\.com\/share\/([^?\s]+)/);
    if (loomMatch) {
      return `https://www.loom.com/embed/${loomMatch[1]}`;
    }

    return url;
  };

  const handleSubmitQuiz = async () => {
    // Validate reflections
    if (reflections.some(r => !r.trim())) {
      toast({ 
        title: 'Please answer all reflection questions', 
        variant: 'destructive' 
      });
      return;
    }

    // Validate MC questions if any
    const mcQuestions = quiz?.questions_json || [];
    if (mcQuestions.length > 0) {
      const unanswered = mcQuestions.filter(q => mcAnswers[q.id] === undefined);
      if (unanswered.length > 0) {
        toast({ 
          title: 'Please answer all multiple choice questions', 
          variant: 'destructive' 
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      // Calculate MC score
      let mcScore = 100;
      if (mcQuestions.length > 0) {
        const correct = mcQuestions.filter(q => mcAnswers[q.id] === q.correct_index).length;
        mcScore = Math.round((correct / mcQuestions.length) * 100);
      }

      // Save progress
      const { error: progressError } = await supabase
        .from('sp_progress')
        .upsert({
          user_id: user!.id,
          lesson_id: lesson!.id,
          video_watched: true,
          content_viewed: true,
          quiz_completed: true,
          quiz_score: mcScore,
          quiz_passed: true, // For now, always pass
          quiz_answers_json: mcAnswers,
          reflection_takeaway: reflections[0],
          reflection_action: reflections[1],
          reflection_result: reflections[2],
          completed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,lesson_id',
        });

      if (progressError) throw progressError;

      // Call edge function to generate AI summary (fire-and-forget)
      try {
        await supabase.functions.invoke('sp_lesson_complete', {
          body: {
            user_id: user!.id,
            lesson_id: lesson!.id,
            reflections: {
              takeaway: reflections[0],
              action: reflections[1],
              result: reflections[2],
            },
          },
        });
      } catch (fnErr) {
        console.error('Edge function error:', fnErr);
        // Don't fail the whole submission if edge function fails
      }

      setCompleted(true);
      toast({ title: '🎉 Lesson completed!' });
    } catch (err) {
      console.error('Error submitting quiz:', err);
      toast({ title: 'Error saving progress', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Lesson not found</p>
      </div>
    );
  }

  const embedUrl = lesson.video_url ? getEmbedUrl(lesson.video_url) : null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/training/standard/${categorySlug}`)}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
          Back to {lesson.module?.category?.name}
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {lesson.module?.name}
            </p>
            <h1 className="text-2xl font-medium flex items-center gap-2">
              {lesson.name}
              {completed && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            </h1>
          </div>
        </div>
      </div>

      {/* Header Image */}
      {lesson.thumbnail_url && (
        <Card className="mb-6 overflow-hidden">
          <img
            src={lesson.thumbnail_url}
            alt={lesson.name}
            className="w-full h-auto"
          />
        </Card>
      )}

      {/* Video */}
      {embedUrl && (
        <Card className="mb-6 overflow-hidden">
          <div className="aspect-video">
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </Card>
      )}

      {/* Content */}
      {lesson.content_html && (
        <Card className="mb-6">
          <CardContent className="p-6">
            {/<[^>]+>/.test(lesson.content_html) ? (
              <div 
                className="prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: lesson.content_html }} 
              />
            ) : (
              <div className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                {lesson.content_html}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Document Downloads */}
      {(() => {
        // Get documents from documents_json or fallback to legacy document_url
        const documents: LessonDocument[] = lesson.documents_json?.length 
          ? lesson.documents_json 
          : lesson.document_url 
            ? [{ id: 'legacy', url: lesson.document_url, name: lesson.document_name || 'Download Resource' }]
            : [];
        
        const normalizeUrl = (url: string) => {
          if (!url) return url;
          if (url.startsWith('http://') || url.startsWith('https://')) return url;
          return `https://${url}`;
        };

        return documents.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-4 space-y-3">
              {documents.map((doc, index) => (
                <div key={doc.id || index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Download className="h-5 w-5 text-muted-foreground" />
                    <span>{doc.name || 'Download Resource'}</span>
                  </div>
                  <Button variant="outline" asChild>
                    <a href={normalizeUrl(doc.url)} target="_blank" rel="noopener noreferrer">
                      Download
                    </a>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {/* Quiz Section */}
      {lesson.has_quiz && !completed && (
        <>
          {!showQuiz ? (
            <Card>
              <CardContent className="p-8 text-center">
                <h3 className="text-lg font-medium mb-2">Ready to complete this lesson?</h3>
                <p className="text-muted-foreground mb-4">
                  Complete the quiz to mark this lesson as done.
                </p>
                <Button onClick={() => setShowQuiz(true)}>
                  Start Quiz
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Complete This Lesson</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Multiple Choice Questions */}
                {quiz?.questions_json && quiz.questions_json.length > 0 && (
                  <div className="space-y-6">
                    <h4 className="font-medium">Knowledge Check</h4>
                    {quiz.questions_json.map((q, qIndex) => (
                      <div key={q.id} className="space-y-3">
                        <p className="font-medium">{qIndex + 1}. {q.question}</p>
                        <RadioGroup
                          value={mcAnswers[q.id]?.toString()}
                          onValueChange={v => setMcAnswers(prev => ({ ...prev, [q.id]: parseInt(v) }))}
                        >
                          {q.options.map((opt, optIndex) => (
                            <div key={optIndex} className="flex items-center space-x-2">
                              <RadioGroupItem value={optIndex.toString()} id={`${q.id}-${optIndex}`} />
                              <Label htmlFor={`${q.id}-${optIndex}`}>{opt}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reflection Questions */}
                <div className="space-y-6">
                  <h4 className="font-medium">Reflection</h4>
                  {REFLECTION_QUESTIONS.map((question, index) => (
                    <div key={index} className="space-y-2">
                      <Label>{index + 1}. {question}</Label>
                      <Textarea
                        value={reflections[index]}
                        onChange={e => {
                          const newReflections = [...reflections];
                          newReflections[index] = e.target.value;
                          setReflections(newReflections);
                        }}
                        placeholder="Your answer..."
                        rows={3}
                      />
                    </div>
                  ))}
                </div>

                {/* Submit */}
                <Button
                  className="w-full"
                  onClick={handleSubmitQuiz}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {submitting ? 'Submitting...' : 'Complete Lesson'}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Completed State */}
      {completed && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-2">Lesson Complete!</h3>
            <p className="text-muted-foreground mb-4">
              Great work! You've completed this lesson.
            </p>
            {nextLesson ? (
              <Button onClick={() => navigate(`/training/standard/${categorySlug}/${lesson.module?.slug}/${nextLesson.slug}`)}>
                Next: {nextLesson.name}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={() => navigate(`/training/standard/${categorySlug}`)}>
                Back to {lesson.module?.category?.name}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
