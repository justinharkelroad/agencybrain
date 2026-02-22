import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useStaffFlowSession } from '@/hooks/useStaffFlowSession';
import { useStaffFlowProfile } from '@/hooks/useStaffFlowProfile';
import { ChatBubble, isHtmlContent } from '@/components/flows/ChatBubble';
import { ChatInput } from '@/components/flows/ChatInput';
import { TypingIndicator } from '@/components/flows/TypingIndicator';
import { FlowChallenge } from '@/components/flows/FlowChallenge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStaffAuth } from '@/hooks/useStaffAuth';

export default function StaffFlowSession() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useStaffFlowProfile();
  const { user: staffUser } = useStaffAuth();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const isNearBottomRef = useRef(true);
  const forceScrollRef = useRef(false);
  
  const [footerHeight, setFooterHeight] = useState(128);
  const sessionId = (location.state as { sessionId?: string } | null)?.sessionId;
  
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
  } = useStaffFlowSession({ templateSlug: slug, sessionId });

  const [currentValue, setCurrentValue] = useState('');
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeText, setChallengeText] = useState('');
  const [checkingChallenge, setCheckingChallenge] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [showCurrentQuestion, setShowCurrentQuestion] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track footer height changes
  useEffect(() => {
    if (!footerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setFooterHeight(entry.contentRect.height);
      }
    });
    
    observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [currentQuestion?.id]);

  // Update browser tab title
  useEffect(() => {
    if (template?.name) {
      document.title = `${template.name} | AgencyBrain`;
    } else {
      document.title = "Flow Session | AgencyBrain";
    }
  }, [template?.name]);

  useEffect(() => {
    if (currentQuestion) {
      setCurrentValue(responses[currentQuestion.id] || '');
      setShowChallenge(false);
      setChallengeText('');
      setShowCurrentQuestion(true);
    }
  }, [currentQuestion?.id, responses]);

  const scrollToCurrentQuestion = useCallback(() => {
    const messages = document.querySelectorAll('[data-current-question="true"]');
    const currentQuestionEl = messages[messages.length - 1];
    
    if (currentQuestionEl) {
      currentQuestionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }, []);

  useLayoutEffect(() => {
    const shouldScroll = forceScrollRef.current || isNearBottomRef.current;
    if (!shouldScroll) return;

    const timer = setTimeout(() => {
      scrollToCurrentQuestion();
      forceScrollRef.current = false;
    }, 100);

    return () => clearTimeout(timer);
  }, [
    currentQuestionIndex,
    isTyping,
    showChallenge,
    showCurrentQuestion,
    answeredQuestions.size,
    scrollToCurrentQuestion,
    currentQuestion?.type,
  ]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    isNearBottomRef.current = isNearBottom;
    setShowScrollButton(!isNearBottom);
  };

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

  const handleCompleteFlow = useCallback(() => {
    navigate(`/staff/flows/complete/${session?.id}`);
  }, [navigate, session?.id]);

  const handleSubmitAnswer = async (valueOverride?: string) => {
    const valueToSubmit = (valueOverride ?? currentValue).trim();
    
    if (!valueToSubmit || !currentQuestion || isTyping) return;

    forceScrollRef.current = true;
    await saveResponse(currentQuestion.id, valueToSubmit);
    setAnsweredQuestions(prev => new Set(prev).add(currentQuestion.id));

    const challenge = await checkForChallenge(currentQuestion.id, valueToSubmit);
    
    if (challenge && !answeredQuestions.has(currentQuestion.id)) {
      setChallengeText(challenge);
      setShowChallenge(true);
    } else if (isLastQuestion) {
      handleCompleteFlow();
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      setPendingAnswer(valueToSubmit);
      setShowCurrentQuestion(false);
      setIsTyping(true);
      
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        setPendingAnswer(null);
        setShowCurrentQuestion(true);
        goToNextQuestion();
        typingTimeoutRef.current = null;
      }, 2000);
    }
  };

  const handleRevise = () => {
    setShowChallenge(false);
    setChallengeText('');
  };

  const handleSkipChallenge = () => {
    forceScrollRef.current = true;
    setShowChallenge(false);
    setChallengeText('');
    
    if (isLastQuestion) {
      handleCompleteFlow();
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      setPendingAnswer(responses[currentQuestion?.id || ''] || currentValue);
      setShowCurrentQuestion(false);
      setIsTyping(true);
      
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        setPendingAnswer(null);
        setShowCurrentQuestion(true);
        goToNextQuestion();
        typingTimeoutRef.current = null;
      }, 2000);
    }
  };

  const handleExit = async () => {
    if (currentValue.trim() && currentQuestion) {
      await saveResponse(currentQuestion.id, currentValue.trim());
    }
    navigate('/staff/flows');
  };

  const handleClickPreviousAnswer = (idx: number) => {
    if (idx < currentQuestionIndex && !isTyping) {
      if (currentValue.trim() && currentQuestion) {
        saveResponse(currentQuestion.id, currentValue.trim());
      }
      goToQuestion(idx);
    }
  };

  // Show loading while auth is loading OR session is loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading your flow...</p>
        </div>
      </div>
    );
  }

  if (!template || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Flow template not found.</p>
            <Button className="mt-4" onClick={() => navigate('/staff/flows')}>
              Back to Flows
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const promptSegments = interpolatePrompt(currentQuestion.prompt);
  const flowIcon = template.icon || '🧠';
  const userInitials = staffUser?.display_name
    ? staffUser.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';
  const userPhotoUrl = staffUser?.profile_photo_url || null;

  const getPromptText = (segments: typeof promptSegments) => {
    return segments.map(s => s.content).join(' ');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
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
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
        style={{ 
          paddingBottom: footerHeight + 32,
          scrollPaddingBottom: footerHeight + 32 
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {/* Previous Q&A */}
          {questions.slice(0, currentQuestionIndex).map((q, idx) => {
            const segments = interpolatePrompt(q.prompt);
            const response = responses[q.id];
            
            return (
              <div key={q.id} className="space-y-3">
                <ChatBubble 
                  variant="incoming" 
                  icon={flowIcon}
                  className="opacity-70 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => handleClickPreviousAnswer(idx)}
                >
                  {getPromptText(segments)}
                </ChatBubble>
                
                {response && (
                  <ChatBubble
                    variant="outgoing"
                    className="opacity-70"
                    avatarUrl={userPhotoUrl}
                    avatarFallback={userInitials}
                    html={isHtmlContent(response) ? response : undefined}
                  >
                    {response}
                  </ChatBubble>
                )}
              </div>
            );
          })}

          {/* Pending answer (immediately after submission, before next question) */}
          {pendingAnswer && (
            <ChatBubble
              variant="outgoing"
              avatarUrl={userPhotoUrl}
              avatarFallback={userInitials}
              html={isHtmlContent(pendingAnswer) ? pendingAnswer : undefined}
            >
              {pendingAnswer}
            </ChatBubble>
          )}

          {/* Current question */}
          {showCurrentQuestion && !isTyping && (
            <div data-current-question="true" className="space-y-3">
              <ChatBubble variant="incoming" icon={flowIcon}>
                {getPromptText(promptSegments)}
              </ChatBubble>
            </div>
          )}

          {/* Typing indicator */}
          {isTyping && (
            <TypingIndicator />
          )}

          {/* Challenge */}
          {showChallenge && challengeText && (
            <FlowChallenge
              challenge={challengeText}
              onRevise={handleRevise}
              onSkip={handleSkipChallenge}
            />
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => {
            forceScrollRef.current = true;
            scrollToCurrentQuestion();
          }}
          className="fixed bottom-32 right-4 z-20 p-2 bg-background border border-border rounded-full shadow-lg hover:bg-muted transition-colors"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}

      {/* Footer */}
      <footer 
        ref={footerRef}
        className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/10"
      >
        <div className="max-w-2xl mx-auto px-4 py-4">
          {!showChallenge && currentQuestion && (
            <ChatInput
              question={currentQuestion}
              value={currentValue}
              onChange={setCurrentValue}
              onSubmit={handleSubmitAnswer}
              disabled={saving || checkingChallenge || isTyping}
              isLast={isLastQuestion}
            />
          )}
        </div>
      </footer>
    </div>
  );
}
