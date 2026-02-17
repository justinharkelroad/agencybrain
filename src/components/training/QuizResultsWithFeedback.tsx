import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuizResultsWithFeedbackProps {
  results: {
    attempt_id: string;
    score: number;
    passed: boolean;
    correct_count: number;
    total_questions: number;
    gradable_questions: number;
    passing_score: number;
    detailed_results: Array<{
      question_text: string;
      user_answer: string;
      correct_answer_text?: string;
      is_correct: boolean | null;
      type: string;
    }>;
    reflection_answers: {
      reflection_1: string;
      reflection_2: string;
    };
    ai_feedback: string | null;
  };
  sessionToken: string;
  onConfirm: () => void;
  onBack: () => void;
}

export function QuizResultsWithFeedback({
  results,
  sessionToken,
  onConfirm,
  onBack,
}: QuizResultsWithFeedbackProps) {
  const [reflection1, setReflection1] = useState(results.reflection_answers.reflection_1 || "");
  const [reflection2, setReflection2] = useState(results.reflection_answers.reflection_2 || "");
  const [hasEdited, setHasEdited] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleReflectionChange = (field: 'reflection_1' | 'reflection_2', value: string) => {
    if (field === 'reflection_1') {
      setReflection1(value);
    } else {
      setReflection2(value);
    }
    
    const changed = 
      value !== results.reflection_answers[field] ||
      (field === 'reflection_1' ? reflection2 !== results.reflection_answers.reflection_2 : reflection1 !== results.reflection_answers.reflection_1);
    
    setHasEdited(changed);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke('update_quiz_reflection', {
        body: {
          session_token: sessionToken,
          attempt_id: results.attempt_id,
          reflection_answers: {
            reflection_1: reflection1,
            reflection_2: reflection2
          }
        }
      });

      if (error) throw error;

      toast.success('Reflections updated');
      setHasEdited(false);
    } catch (error) {
      console.error('Error saving reflections:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const { error } = await supabase.functions.invoke('confirm_quiz_feedback', {
        body: {
          session_token: sessionToken,
          attempt_id: results.attempt_id
        }
      });

      if (error) throw error;

      onConfirm();
    } catch (error) {
      console.error('Error confirming feedback:', error);
      toast.error('Failed to confirm feedback');
      setIsConfirming(false);
    }
  };

  // Format AI feedback for better readability
  const formatAIFeedback = (text: string) => {
    return text.split('\n').map((line, i) => (
      <p key={i} className={line.trim() ? "mb-3" : "mb-1"}>
        {line.trim()}
      </p>
    ));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 md:px-6">
      {/* Header with Score */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
            <div className="flex items-center gap-3">
              {results.passed ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              <span className="text-lg">
                Score: {results.correct_count}/{results.gradable_questions} ({results.score}%)
              </span>
              <Badge variant={results.passed ? "default" : "destructive"}>
                {results.passed ? "Passed" : "Failed"}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </Card>

      {/* AI Coaching Feedback */}
      {results.ai_feedback ? (
        <Card className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100">
                Your Coaching Feedback
              </h3>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Personalized insights on your reflections
              </p>
            </div>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">
            {formatAIFeedback(results.ai_feedback)}
          </div>
        </Card>
      ) : (
        <Card className="p-6 border-dashed">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-5 w-5" />
            <p>Coaching feedback unavailable. You can still continue.</p>
          </div>
        </Card>
      )}

      {/* Editable Reflections */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">📝 Your Reflections</h3>
          {hasEdited && (
            <Button 
              onClick={handleSaveChanges} 
              disabled={isSaving}
              size="sm"
              className="gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          )}
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              What is your main takeaway from this lesson?
            </label>
            <Textarea
              value={reflection1}
              onChange={(e) => handleReflectionChange('reflection_1', e.target.value)}
              rows={4}
              className="resize-none"
              placeholder="Your main takeaway..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Why is that important to you?
            </label>
            <Textarea
              value={reflection2}
              onChange={(e) => handleReflectionChange('reflection_2', e.target.value)}
              rows={4}
              className="resize-none"
              placeholder="Why it matters to you..."
            />
          </div>
        </div>
      </Card>

      {/* Confirm Button */}
      <div className="flex justify-center pb-8">
        <Button
          onClick={handleConfirm}
          disabled={isConfirming || hasEdited}
          size="lg"
          className="gap-2 min-w-[200px]"
        >
          {isConfirming ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Confirming...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Confirm & Continue
            </>
          )}
        </Button>
      </div>

      {hasEdited && (
        <p className="text-center text-sm text-muted-foreground">
          Please save your changes before continuing
        </p>
      )}
    </div>
  );
}
