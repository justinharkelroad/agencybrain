import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFlowSession } from '@/hooks/useFlowSession';
import { useFlowProfile } from '@/hooks/useFlowProfile';
import { ChatBubble } from '@/components/flows/ChatBubble';
import { ChatInput } from '@/components/flows/ChatInput';
import { TypingIndicator } from '@/components/flows/TypingIndicator';
import { FlowChallenge } from '@/components/flows/FlowChallenge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [isTyping, setIsTyping] = useState(false);
  const [showCurrentQuestion, setShowCurrentQuestion] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    if (currentQuestion) {
      setCurrentValue(responses[currentQuestion.id] || '');
      setShowChallenge(false);
      setChallengeText('');
      setShowCurrentQuestion(true);
    }
  }, [currentQuestion?.id, responses]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentQuestionIndex, showChallenge, isTyping]);

  // Handle scroll position to show/hide scroll button
  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  // Auto-save on page unload/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentValue.trim() && currentQuestion) {
        saveResponse(currentQuestion.id, currentValue.trim());
      }
      
      if (currentValue.trim()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentValue, currentQuestion, saveResponse]);

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

  const handleSubmitAnswer = async (valueOverride?: string) => {
    const valueToSubmit = (valueOverride ?? currentValue).trim();
    if (!valueToSubmit || !currentQuestion || isTyping) return;

    // Save immediately
    await saveResponse(currentQuestion.id, valueToSubmit);
    setAnsweredQuestions(prev => new Set(prev).add(currentQuestion.id));

    const challenge = await checkForChallenge(currentQuestion.id, valueToSubmit);
    
    if (challenge && !answeredQuestions.has(currentQuestion.id)) {
      setChallengeText(challenge);
      setShowChallenge(true);
    } else if (isLastQuestion) {
      navigate(`/flows/complete/${session?.id}`);
    } else {
      // Start typing animation
      setShowCurrentQuestion(false);
      setIsTyping(true);
      
      // Wait for typing indicator, then show next question
      setTimeout(() => {
        setIsTyping(false);
        goToNextQuestion();
      }, 2000);
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
      // Start typing animation
      setShowCurrentQuestion(false);
      setIsTyping(true);
      
      setTimeout(() => {
        setIsTyping(false);
        goToNextQuestion();
      }, 2000);
    }
  };

  const handleExit = async () => {
    if (currentValue.trim() && currentQuestion) {
      await saveResponse(currentQuestion.id, currentValue.trim());
    }
    navigate('/flows');
  };

  const handleClickPreviousAnswer = (idx: number) => {
    if (idx < currentQuestionIndex && !isTyping) {
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

  const promptSegments = interpolatePrompt(currentQuestion.prompt);
  const flowIcon = template.icon || '🧠';

  // Build prompt text from segments
  const getPromptText = (segments: typeof promptSegments) => {
    return segments.map(s => s.content).join(' ');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header - minimal with progress */}
      <header className="border-b border-border/10 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{flowIcon}</span>
              <h1 className="font-medium text-sm text-muted-foreground">{template.name}</h1>
            </div>
            <Button variant="ghost" size="sm" onClick={handleExit} className="h-8 px-2">
              <X className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      </header>

      {/* Chat Container */}
      <main 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto pb-4"
        onScroll={handleScroll}
      >
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {/* Previous Q&A as chat bubbles */}
          {questions.slice(0, currentQuestionIndex).map((q, idx) => {
            const segments = interpolatePrompt(q.prompt);
            const response = responses[q.id];
            
            return (
              <div key={q.id} className="space-y-3">
                {/* Question bubble */}
                <ChatBubble 
                  variant="incoming" 
                  icon={flowIcon}
                  className="opacity-70 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => handleClickPreviousAnswer(idx)}
                >
                  {getPromptText(segments)}
                </ChatBubble>
                
                {/* Answer bubble */}
                {response && (
                  <ChatBubble 
                    variant="outgoing"
                    className="opacity-70"
                  >
                    {response}
                  </ChatBubble>
                )}
              </div>
            );
          })}

          {/* Current Question */}
          {showCurrentQuestion && !isTyping && (
            <div className="space-y-3">
              <ChatBubble 
                variant="incoming" 
                icon={flowIcon}
                animate={currentQuestionIndex > 0}
              >
                {promptSegments.map((segment, idx) => (
                  <span 
                    key={idx}
                    className={segment.type === 'interpolated' ? 'font-medium' : ''}
                  >
                    {segment.content}
                  </span>
                ))}
              </ChatBubble>
            </div>
          )}

          {/* User's current answer preview (if they've typed something) */}
          {currentValue.trim() && showCurrentQuestion && !isTyping && (
            <ChatBubble variant="outgoing" className="opacity-50">
              {currentValue}
            </ChatBubble>
          )}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-end gap-2">
              <span className="text-lg">{flowIcon}</span>
              <TypingIndicator />
            </div>
          )}

          {/* AI Challenge */}
          {showChallenge && (
            <div className="space-y-3 animate-chat-message-in">
              <ChatBubble variant="incoming" icon={flowIcon}>
                {challengeText}
              </ChatBubble>
              <div className="flex gap-2 pl-8">
                <Button size="sm" onClick={handleRevise} className="rounded-full">
                  Revise Answer
                </Button>
                <Button size="sm" variant="ghost" onClick={handleSkipChallenge} className="rounded-full">
                  Continue →
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          variant="secondary"
          size="icon"
          className="fixed bottom-24 right-4 rounded-full shadow-lg z-20"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}

      {/* Fixed Input Area */}
      <footer className="border-t border-border/10 bg-background/95 backdrop-blur sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {saving && (
            <div className="flex items-center justify-center mb-2">
              <span className="text-xs text-muted-foreground flex items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Saving...
              </span>
            </div>
          )}
          
          {!isTyping && currentQuestion && (
            <ChatInput
              question={currentQuestion}
              value={currentValue}
              onChange={setCurrentValue}
              onSubmit={handleSubmitAnswer}
              disabled={checkingChallenge || showChallenge}
              isLast={isLastQuestion}
            />
          )}
          {isTyping && (
            <div className="text-center text-sm text-muted-foreground py-2">
              Thinking...
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
