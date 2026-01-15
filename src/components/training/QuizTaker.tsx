import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { TrainingQuiz } from '@/hooks/useTrainingQuizzes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QuizResultsWithFeedback } from './QuizResultsWithFeedback';
import { RevisionRequiredCard } from './RevisionRequiredCard';

interface QuizTakerProps {
  quiz: TrainingQuiz;
  sessionToken: string;
  onBack: () => void;
  onComplete: () => void;
}

interface EngagementEvaluation {
  engagement_score: number;
  passed: boolean;
  issues: string[];
  specific_guidance: string;
  lesson_highlights: string[];
  revision_count: number;
}

export function QuizTaker({ quiz, sessionToken, onBack, onComplete }: QuizTakerProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  // Revision flow state
  const [revisionRequired, setRevisionRequired] = useState(false);
  const [engagementEvaluation, setEngagementEvaluation] = useState<EngagementEvaluation | null>(null);
  const [revisionCount, setRevisionCount] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const questions = quiz.questions || [];

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  // Evaluate engagement before final submission
  const evaluateEngagement = async (): Promise<boolean> => {
    try {
      setIsEvaluating(true);

      const { data, error } = await supabase.functions.invoke('evaluate_quiz_engagement', {
        body: {
          session_token: sessionToken,
          quiz_id: quiz.id,
          reflection_1: answers['reflection_1'] || '',
          reflection_2: answers['reflection_2'] || '',
          revision_count: revisionCount
        }
      });

      if (error) {
        console.error('Engagement evaluation error:', error);
        // On error, allow through
        return true;
      }

      const evaluation = data as EngagementEvaluation;

      if (!evaluation.passed) {
        setEngagementEvaluation(evaluation);
        setRevisionRequired(true);
        setIsEvaluating(false);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Engagement evaluation error:', error);
      // On error, allow through
      return true;
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmit = async () => {
    // Validate all questions answered
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      toast.error(`Please answer all questions (${unanswered.length} remaining)`);
      return;
    }

    // Validate reflection answers exist
    if (!answers['reflection_1']?.trim() || !answers['reflection_2']?.trim()) {
      toast.error('Please complete both reflection questions');
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Evaluate engagement (only if not in revision mode or first submission)
      const engagementPassed = await evaluateEngagement();

      if (!engagementPassed) {
        setIsSubmitting(false);
        return;
      }

      // Step 2: Submit the quiz
      setIsGeneratingFeedback(true);

      const { data, error } = await supabase.functions.invoke('submit_quiz_attempt', {
        body: {
          session_token: sessionToken,
          quiz_id: quiz.id,
          answers
        }
      });

      if (error) throw error;

      setResults(data);
      setSubmitted(true);
      setRevisionRequired(false);
      setIsGeneratingFeedback(false);

    } catch (error: any) {
      console.error('Quiz submission error:', error);
      toast.error(error.message || 'Failed to submit quiz');
      setIsGeneratingFeedback(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevisionResubmit = async () => {
    setRevisionCount(prev => prev + 1);
    setRevisionRequired(false);
    setEngagementEvaluation(null);
    await handleSubmit();
  };

  const handleConfirmComplete = () => {
    if (results?.passed) {
      toast.success(`Quiz passed! Score: ${results.score}%`);
    }
    onComplete();
  };

  // Show results after submission
  if (submitted && results) {
    return (
      <QuizResultsWithFeedback
        results={results}
        sessionToken={sessionToken}
        onConfirm={handleConfirmComplete}
        onBack={onBack}
      />
    );
  }

  // Show revision required card
  if (revisionRequired && engagementEvaluation) {
    return (
      <RevisionRequiredCard
        engagementScore={engagementEvaluation.engagement_score}
        issues={engagementEvaluation.issues}
        specificGuidance={engagementEvaluation.specific_guidance}
        lessonHighlights={engagementEvaluation.lesson_highlights}
        revisionCount={revisionCount}
        reflection1={answers['reflection_1'] || ''}
        reflection2={answers['reflection_2'] || ''}
        onReflectionChange={handleAnswerChange}
        onResubmit={handleRevisionResubmit}
        isSubmitting={isSubmitting || isEvaluating}
      />
    );
  }

  // Show loading state while generating feedback
  if (isGeneratingFeedback) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Generating your coaching feedback...</h3>
            <p className="text-sm text-muted-foreground">
              This may take a few seconds as we analyze your reflections
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Show evaluating state
  if (isEvaluating) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Reviewing your reflections...</h3>
            <p className="text-sm text-muted-foreground">
              Checking if your answers demonstrate engagement with the lesson content
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lesson
          </Button>
        </div>
        <CardTitle>{quiz.name}</CardTitle>
        {quiz.description && <CardDescription>{quiz.description}</CardDescription>}
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary">{questions.length} Questions</Badge>
          <Badge variant="outline">
            {Object.keys(answers).filter(k => !k.startsWith('reflection_')).length}/{questions.length} Answered
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px] max-h-[600px]">
          <div className="space-y-6 pr-4">
            {questions.map((question, idx) => (
              <Card key={question.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    Question {idx + 1}
                    <Badge variant="outline" className="ml-2 font-normal">
                      {question.question_type === 'multiple_choice' && 'Multiple Choice'}
                      {question.question_type === 'true_false' && 'True/False'}
                      {question.question_type === 'text_response' && 'Text Response'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="font-medium">{question.question_text}</p>

                  {question.question_type === 'text_response' ? (
                    <Textarea
                      placeholder="Enter your answer..."
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      rows={4}
                    />
                  ) : (
                    <RadioGroup
                      value={answers[question.id] || ''}
                      onValueChange={(value) => handleAnswerChange(question.id, value)}
                    >
                      {(question.options || []).map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.id} id={option.id} />
                          <Label htmlFor={option.id} className="cursor-pointer">
                            {option.option_text}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Reflection Questions */}
            <Card className="border-primary/50">
              <CardHeader>
                <CardTitle className="text-base">Reflection Questions</CardTitle>
                <CardDescription>
                  These questions help you integrate what you learned. Your answers will be evaluated for depth and specificity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reflection1" className="font-medium">
                    1. What was the most valuable insight you gained from this lesson?
                  </Label>
                  <Textarea
                    id="reflection1"
                    placeholder="Be specific about concepts, techniques, or examples from the lesson..."
                    value={answers['reflection_1'] || ''}
                    onChange={(e) => handleAnswerChange('reflection_1', e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: Reference specific concepts from the training content, not generic statements.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reflection2" className="font-medium">
                    2. How will you apply what you learned to your work?
                  </Label>
                  <Textarea
                    id="reflection2"
                    placeholder="Describe a specific situation where you'll use this..."
                    value={answers['reflection_2'] || ''}
                    onChange={(e) => handleAnswerChange('reflection_2', e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: Be concrete about WHEN and HOW you'll apply this learning.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleSubmit}
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
            </Button>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
