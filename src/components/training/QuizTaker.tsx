import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { TrainingQuiz } from '@/hooks/useTrainingQuizzes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QuizTakerProps {
  quiz: TrainingQuiz;
  sessionToken: string;
  onBack: () => void;
  onComplete: () => void;
}

export function QuizTaker({ quiz, sessionToken, onBack, onComplete }: QuizTakerProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = quiz.questions || [];

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    // Validate all questions answered
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      toast.error(`Please answer all questions (${unanswered.length} remaining)`);
      return;
    }

    setIsSubmitting(true);
    try {
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
      
      if (data.passed) {
        toast.success(`Quiz passed! Score: ${data.score}%`);
        onComplete();
      } else {
        toast.error(`Quiz not passed. Score: ${data.score}%`);
      }
    } catch (error: any) {
      console.error('Quiz submission error:', error);
      toast.error(error.message || 'Failed to submit quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted && results) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Lesson
            </Button>
          </div>
          <CardTitle className="flex items-center gap-2">
            {results.passed ? (
              <>
                <CheckCircle className="h-6 w-6 text-green-500" />
                Quiz Passed!
              </>
            ) : (
              <>
                <XCircle className="h-6 w-6 text-destructive" />
                Quiz Not Passed
              </>
            )}
          </CardTitle>
          <CardDescription>
            Your Score: {results.score}% ({results.correct_count}/{results.total_questions})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {results.detailed_results?.map((result: any, idx: number) => (
                <Card key={idx} className={result.is_correct ? 'border-green-500/50' : result.type !== 'text_response' ? 'border-destructive/50' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        Question {idx + 1}
                        {result.type !== 'text_response' && (
                          result.is_correct ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )
                        )}
                      </CardTitle>
                      {result.type === 'text_response' && (
                        <Badge variant="secondary">Text Response</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="font-medium">{result.question_text}</p>
                    <div>
                      <p className="text-sm text-muted-foreground">Your answer:</p>
                      <p className="text-sm">{result.user_answer || 'No answer provided'}</p>
                    </div>
                    {result.type !== 'text_response' && !result.is_correct && (
                      <div>
                        <p className="text-sm text-muted-foreground">Correct answer:</p>
                        <p className="text-sm text-green-600 dark:text-green-400">{result.correct_answer_text}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
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
            {Object.keys(answers).length}/{questions.length} Answered
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
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
                          <RadioGroupItem value={option.option_text} id={option.id} />
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
                <CardDescription>Please answer these reflection questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reflection1" className="font-medium">
                    1. What was the most valuable insight you gained from this lesson?
                  </Label>
                  <Textarea
                    id="reflection1"
                    placeholder="Your reflection..."
                    value={answers['reflection_1'] || ''}
                    onChange={(e) => handleAnswerChange('reflection_1', e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reflection2" className="font-medium">
                    2. How will you apply what you learned to your work?
                  </Label>
                  <Textarea
                    id="reflection2"
                    placeholder="Your reflection..."
                    value={answers['reflection_2'] || ''}
                    onChange={(e) => handleAnswerChange('reflection_2', e.target.value)}
                    rows={3}
                  />
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
