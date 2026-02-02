import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  ArrowLeft,
  Play,
  CheckCircle2,
  BookOpen,
  Send,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'text';
  options?: string[];
  correct_answer?: string;
}

interface LessonData {
  id: string;
  title: string;
  description: string | null;
  day_of_week: number;
  video_url: string | null;
  video_platform: string | null;
  content_html: string | null;
  quiz_questions: QuizQuestion[];
  module: {
    id: string;
    week_number: number;
    title: string;
    pillar: string;
  };
  progress: {
    id: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    quiz_score_percent: number | null;
    quiz_feedback_ai: string | null;
  } | null;
}

const dayLabels: Record<number, string> = {
  1: 'Monday',
  3: 'Wednesday',
  5: 'Friday',
};

export default function StaffSalesLesson() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, sessionToken, isAuthenticated, loading: authLoading } = useStaffAuth();

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    score: number;
    feedback: string | null;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/staff/login');
      return;
    }

    if (isAuthenticated && id && sessionToken) {
      fetchLessonData();
    }
  }, [authLoading, isAuthenticated, id, sessionToken]);

  const fetchLessonData = async () => {
    if (!sessionToken || !id) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-staff-sales-lessons`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            staff_user_id: user?.id,
            lesson_id: id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch lesson');
      }

      const result = await response.json();
      setLesson(result.lesson);

      // Check if already completed
      if (result.lesson.progress?.status === 'completed') {
        setQuizSubmitted(true);
        if (result.lesson.progress.quiz_score_percent !== null) {
          setQuizResult({
            score: result.lesson.progress.quiz_score_percent,
            feedback: result.lesson.progress.quiz_feedback_ai,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching lesson:', error);
      toast.error('Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  const handleQuizSubmit = async () => {
    if (!sessionToken || !lesson || !user) return;

    // Validate all questions are answered
    const unanswered = lesson.quiz_questions.filter(
      (q) => !quizAnswers[q.id]?.trim()
    );
    if (unanswered.length > 0) {
      toast.error('Please answer all questions before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-sales-quiz`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            staff_user_id: user.id,
            lesson_id: lesson.id,
            answers: quizAnswers,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit quiz');
      }

      const result = await response.json();
      setQuizSubmitted(true);
      setQuizResult({
        score: result.score_percent,
        feedback: result.feedback_ai,
      });
      toast.success('Quiz submitted successfully!');
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVideoComplete = async () => {
    setVideoWatched(true);
    // Mark lesson as started if not already
    if (!lesson?.progress?.started_at && sessionToken && user) {
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-sales-lesson`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              staff_user_id: user.id,
              lesson_id: lesson?.id,
              action: 'start',
            }),
          }
        );
      } catch (error) {
        console.error('Error marking lesson as started:', error);
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="text-center py-16">
            <p className="text-muted-foreground">Lesson not found.</p>
            <Link to="/staff/sales-training">
              <Button variant="link">Return to Training</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasQuiz = lesson.quiz_questions && lesson.quiz_questions.length > 0;
  const hasVideo = !!lesson.video_url;

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      {/* Back Link */}
      <Link
        to="/staff/sales-training"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Training
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline">
            Week {lesson.module.week_number} - {dayLabels[lesson.day_of_week]}
          </Badge>
          {lesson.progress?.status === 'completed' && (
            <Badge className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Completed
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2">{lesson.title}</h1>
        {lesson.description && (
          <p className="text-muted-foreground">{lesson.description}</p>
        )}
      </div>

      {/* Video Section */}
      {hasVideo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Play className="h-5 w-5" />
              Video Lesson
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              {lesson.video_platform === 'vimeo' ? (
                <iframe
                  src={lesson.video_url || ''}
                  className="w-full h-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  onLoad={() => handleVideoComplete()}
                />
              ) : lesson.video_platform === 'youtube' ? (
                <iframe
                  src={lesson.video_url?.replace('watch?v=', 'embed/') || ''}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => handleVideoComplete()}
                />
              ) : (
                <video
                  src={lesson.video_url || ''}
                  controls
                  className="w-full h-full"
                  onEnded={() => handleVideoComplete()}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Section */}
      {lesson.content_html && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Lesson Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: lesson.content_html }}
            />
          </CardContent>
        </Card>
      )}

      {/* Quiz Section */}
      {hasQuiz && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" />
              Quiz
            </CardTitle>
            <CardDescription>
              Answer the questions below to complete this lesson
            </CardDescription>
          </CardHeader>
          <CardContent>
            {quizSubmitted && quizResult ? (
              <div className="space-y-6">
                {/* Results */}
                <div className="text-center py-8">
                  <div
                    className={`text-5xl font-bold mb-2 ${
                      quizResult.score >= 80
                        ? 'text-green-500'
                        : quizResult.score >= 60
                        ? 'text-amber-500'
                        : 'text-red-500'
                    }`}
                  >
                    {quizResult.score}%
                  </div>
                  <p className="text-muted-foreground">Your Score</p>
                </div>

                {/* AI Feedback */}
                {quizResult.feedback && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold">Feedback</h4>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">
                      {quizResult.feedback}
                    </p>
                  </div>
                )}

                <div className="text-center">
                  <Link to="/staff/sales-training">
                    <Button>Return to Training</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {lesson.quiz_questions.map((question, index) => (
                  <div key={question.id} className="space-y-3">
                    <Label className="text-base font-medium">
                      {index + 1}. {question.question}
                    </Label>

                    {question.type === 'multiple_choice' && question.options ? (
                      <RadioGroup
                        value={quizAnswers[question.id] || ''}
                        onValueChange={(value) =>
                          setQuizAnswers((prev) => ({
                            ...prev,
                            [question.id]: value,
                          }))
                        }
                      >
                        {question.options.map((option, optIndex) => (
                          <div
                            key={optIndex}
                            className="flex items-center space-x-2"
                          >
                            <RadioGroupItem
                              value={option}
                              id={`${question.id}-${optIndex}`}
                            />
                            <Label
                              htmlFor={`${question.id}-${optIndex}`}
                              className="font-normal"
                            >
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <Textarea
                        placeholder="Type your answer..."
                        value={quizAnswers[question.id] || ''}
                        onChange={(e) =>
                          setQuizAnswers((prev) => ({
                            ...prev,
                            [question.id]: e.target.value,
                          }))
                        }
                        rows={4}
                      />
                    )}

                    {index < lesson.quiz_questions.length - 1 && (
                      <Separator className="my-4" />
                    )}
                  </div>
                ))}

                <div className="pt-4">
                  <Button
                    onClick={handleQuizSubmit}
                    disabled={submitting}
                    className="w-full gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit Quiz
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Complete without quiz */}
      {!hasQuiz && !lesson.progress?.completed_at && (
        <div className="text-center mt-6">
          <Button
            onClick={async () => {
              if (!sessionToken || !user) return;
              setSubmitting(true);
              try {
                await fetch(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-sales-lesson`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${sessionToken}`,
                    },
                    body: JSON.stringify({
                      staff_user_id: user.id,
                      lesson_id: lesson.id,
                      action: 'complete',
                    }),
                  }
                );
                toast.success('Lesson completed!');
                navigate('/staff/sales-training');
              } catch (error) {
                toast.error('Failed to complete lesson');
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            className="gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Mark as Complete
          </Button>
        </div>
      )}
    </div>
  );
}
