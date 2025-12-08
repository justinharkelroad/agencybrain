import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFlowSession } from '@/hooks/useFlowSession';
import { useFlowProfile } from '@/hooks/useFlowProfile';
import { FlowQuestionComponent } from '@/components/flows/FlowQuestion';
import { FlowChallenge } from '@/components/flows/FlowChallenge';
import { FlowProgress } from '@/components/flows/FlowProgress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Check, X, Loader2 } from 'lucide-react';

export default function FlowSession() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { profile } = useFlowProfile();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const {
    template,
    session,
    questions,
    currentQuestion,
    currentQuestionIndex,
    responses,
    loading,
    saving,
    isFirstQuestion,
    isLastQuestion,
    progress,
    saveResponse,
    goToNextQuestion,
    goToPreviousQuestion,
    goToQuestion,
    interpolatePrompt,
  } = useFlowSession({ templateSlug: slug });

  const [currentValue, setCurrentValue] = useState('');
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeText, setChallengeText] = useState('');
  const [checkingChallenge, setCheckingChallenge] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentQuestion) {
      setCurrentValue(responses[currentQuestion.id] || '');
      setShowChallenge(false);
      setChallengeText('');
    }
  }, [currentQuestion?.id, responses]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [currentQuestionIndex, showChallenge]);

  const checkForChallenge = async (questionId: string, response: string): Promise<string | null> => {
    if (!currentQuestion?.ai_challenge || !template?.ai_challenge_enabled) {
      return null;
    }

    const vaguePatterns = [
      /^(good|fine|okay|ok|idk|dunno|stuff|things|whatever)\.?$/i,
      /^.{0,15}$/,
      /^(i don'?t know|not sure|maybe|i guess)\.?$/i,
    ];

    const isVague = vaguePatterns.some(pattern => pattern.test(response.trim()));
    
    if (!isVague) return null;

    setCheckingChallenge(true);
    
    try {
      const challenges: Record<string, string> = {
        'actions': `That's a good start! Could you be more specific? What's ONE concrete action you'll take in the next 24 hours?`,
        'revelation': `I'd love to hear more about this insight. Can you expand on why this feels significant to you right now?`,
        'why_grateful': `Can you share a specific moment or detail that made this meaningful to you?`,
        'default': `Could you tell me a bit more about that? The more specific you are, the more powerful this reflection becomes.`,
      };

      return challenges[questionId] || challenges['default'];
    } finally {
      setCheckingChallenge(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentValue.trim() || !currentQuestion) return;

    await saveResponse(currentQuestion.id, currentValue.trim());
    setAnsweredQuestions(prev => new Set(prev).add(currentQuestion.id));

    const challenge = await checkForChallenge(currentQuestion.id, currentValue);
    
    if (challenge && !answeredQuestions.has(currentQuestion.id)) {
      setChallengeText(challenge);
      setShowChallenge(true);
    } else if (isLastQuestion) {
      navigate(`/flows/complete/${session?.id}`);
    } else {
      goToNextQuestion();
    }
  };

  const handleRevise = () => {
    setShowChallenge(false);
    setChallengeText('');
  };

  const handleSkipChallenge = () => {
    setShowChallenge(false);
    setChallengeText('');
    
    if (isLastQuestion) {
      navigate(`/flows/complete/${session?.id}`);
    } else {
      goToNextQuestion();
    }
  };

  const handleExit = () => {
    navigate('/flows');
  };

  const handleClickPreviousAnswer = (idx: number) => {
    if (idx < currentQuestionIndex) {
      if (currentValue.trim() && currentQuestion) {
        saveResponse(currentQuestion.id, currentValue.trim());
      }
      goToQuestion(idx);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Flow template not found.</p>
            <Button className="mt-4" onClick={() => navigate('/flows')}>
              Back to Flows
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const interpolatedPrompt = interpolatePrompt(currentQuestion.prompt);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/10 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{template.icon}</span>
              <h1 className="font-medium">{template.name} Stack</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={handleExit}>
              <X className="h-4 w-4 mr-1" strokeWidth={1.5} />
              Exit
            </Button>
          </div>
          <FlowProgress 
            current={currentQuestionIndex + 1} 
            total={questions.length}
            percentage={progress}
          />
        </div>
      </header>

      {/* Chat Container */}
      <main 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Previous Q&A */}
          <div className="space-y-8 mb-8">
            {questions.slice(0, currentQuestionIndex).map((q, idx) => (
              <div 
                key={q.id} 
                className="opacity-60 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => handleClickPreviousAnswer(idx)}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">🧠</span>
                  <p className="text-base">{interpolatePrompt(q.prompt)}</p>
                </div>
                <div className="pl-10 mt-2">
                  <p className="text-muted-foreground bg-muted/30 rounded-lg px-4 py-2 inline-block">
                    {responses[q.id]}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Current Question */}
          <FlowQuestionComponent
            question={currentQuestion}
            prompt={interpolatedPrompt}
            value={currentValue}
            onChange={setCurrentValue}
            onSubmit={handleSubmitAnswer}
            isLast={isLastQuestion}
          />

          {/* AI Challenge */}
          {showChallenge && (
            <FlowChallenge
              challenge={challengeText}
              onRevise={handleRevise}
              onSkip={handleSkipChallenge}
            />
          )}
        </div>
      </main>

      {/* Footer Actions */}
      <footer className="border-t border-border/10 bg-background/95 backdrop-blur sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={goToPreviousQuestion}
              disabled={isFirstQuestion}
            >
              <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {saving && (
                <span className="text-sm text-muted-foreground flex items-center">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Saving...
                </span>
              )}
            </div>

            <Button
              onClick={handleSubmitAnswer}
              disabled={!currentValue.trim() || checkingChallenge}
            >
              {checkingChallenge ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isLastQuestion ? (
                <>
                  <Check className="h-4 w-4 mr-2" strokeWidth={1.5} />
                  Complete
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" strokeWidth={1.5} />
                </>
              )}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
