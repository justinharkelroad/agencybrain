import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useFlowSession } from '@/hooks/useFlowSession';
import { useFlowProfile } from '@/hooks/useFlowProfile';
import { useFocusItems } from '@/hooks/useFocusItems';
import { ChatBubble, isHtmlContent } from '@/components/flows/ChatBubble';
import { ChatInput } from '@/components/flows/ChatInput';
import { TypingIndicator } from '@/components/flows/TypingIndicator';
import { FlowChallenge } from '@/components/flows/FlowChallenge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { X, Loader2, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export default function FlowSession() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useFlowProfile();
  const { user } = useAuth();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const isNearBottomRef = useRef(true);
  const forceScrollRef = useRef(false);
  
  // Dynamic footer height for proper scroll padding
  const [footerHeight, setFooterHeight] = useState(128);

  // Get session ID from location state (when resuming a draft)
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
  } = useFlowSession({ templateSlug: slug, sessionId });

  const { createItem } = useFocusItems();

  const [currentValue, setCurrentValue] = useState('');
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeText, setChallengeText] = useState('');
  const [checkingChallenge, setCheckingChallenge] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [showCurrentQuestion, setShowCurrentQuestion] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showAddToFocus, setShowAddToFocus] = useState(false);
  const [addingToFocus, setAddingToFocus] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState('??');
  
  // Ref for typing timeout to prevent race conditions
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track footer height changes (for select buttons vs text input)
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

  // Fetch user profile photo
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('full_name, profile_photo_url')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setUserPhotoUrl(data.profile_photo_url || null);
        const name = data.full_name || user.email || '';
        const initials = name
          ? name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
          : user.email?.[0].toUpperCase() || '??';
        setUserInitials(initials);
      }
    };
    
    fetchUserProfile();
  }, [user?.id, user?.email]);
  
  // Cleanup timeout on unmount or question change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);
  
  // Clear timeout when question changes
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
    if (currentQuestion && !isTyping) {
      setCurrentValue(responses[currentQuestion.id] || '');
      setShowChallenge(false);
      setChallengeText('');
      setShowCurrentQuestion(true);
    }
  }, [currentQuestion?.id, responses, isTyping]);

  // Auto-scroll to current question bubble (center it so footer doesn't cover it)
  const scrollToCurrentQuestion = useCallback(() => {
    // Find the current question bubble (last one with data attribute)
    const messages = document.querySelectorAll('[data-current-question="true"]');
    const currentQuestionEl = messages[messages.length - 1];
    
    if (currentQuestionEl) {
      currentQuestionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // Fallback to bottom ref
      bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  }, []);

  // Auto-scroll after DOM commits when relevant chat UI changes
  useLayoutEffect(() => {
    const shouldScroll = forceScrollRef.current || isNearBottomRef.current;
    if (!shouldScroll) return;

    // Small delay to ensure DOM has updated with new question
    const timer = setTimeout(() => {
      scrollToCurrentQuestion();
      forceScrollRef.current = false;
    }, 100);

    return () => clearTimeout(timer);
  }, [
    currentQuestionIndex,
    isTyping,
    showChallenge,
    showAddToFocus,
    showCurrentQuestion,
    answeredQuestions.size,
    scrollToCurrentQuestion,
    currentQuestion?.type, // Re-scroll when input type changes (text vs select)
  ]);

  // Handle scroll position to show/hide scroll button
  const handleScroll = () => {
    if (!chatContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    isNearBottomRef.current = isNearBottom;
    setShowScrollButton(!isNearBottom);
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

  // Get the action text from the last question's response
  const getActionText = useCallback(() => {
    if (!questions.length) return null;
    const lastQuestion = questions[questions.length - 1];
    return responses[lastQuestion.id]?.trim() || null;
  }, [questions, responses]);

  const handleCompleteFlow = useCallback(() => {
    navigate(`/flows/complete/${session?.id}`);
  }, [navigate, session?.id]);

  const handleAddToFocus = async () => {
    setAddingToFocus(true);
    
    const actionText = getActionText();
    
    if (!actionText || !template || !session) {
      setAddingToFocus(false);
      handleCompleteFlow();
      return;
    }
    
    try {
      await createItem.mutateAsync({
        title: actionText,
        description: `Action from ${template.name} flow session`,
        priority_level: "mid",
        source_type: "flow",
        source_name: template.name,
        source_session_id: session.id,
      });
      
      toast.success("Action added to your Focus List!");
    } catch (error) {
      console.error("Failed to add to focus:", error);
      toast.error("Failed to add to Focus List");
    } finally {
      setAddingToFocus(false);
      setShowAddToFocus(false);
      handleCompleteFlow();
    }
  };

  const handleSkipAddToFocus = () => {
    setShowAddToFocus(false);
    handleCompleteFlow();
  };

  const handleSubmitAnswer = async (valueOverride?: string) => {
    const valueToSubmit = (valueOverride ?? currentValue).trim();
    
    console.log('[FlowSession] handleSubmitAnswer called:', {
      valueOverride,
      currentValue,
      valueToSubmit,
      currentQuestionId: currentQuestion?.id,
      currentQuestionType: currentQuestion?.type,
      isTyping,
      checkingChallenge,
      showChallenge
    });
    
    if (!valueToSubmit) {
      console.warn('[FlowSession] handleSubmitAnswer: No value to submit');
      return;
    }
    if (!currentQuestion) {
      console.warn('[FlowSession] handleSubmitAnswer: No current question');
      return;
    }
    if (isTyping) {
      console.warn('[FlowSession] handleSubmitAnswer: Already typing, ignoring');
      return;
    }

    console.log('[FlowSession] Saving response:', currentQuestion.id, valueToSubmit);
    
    // Save immediately and clear input
    forceScrollRef.current = true;
    setCurrentValue('');
    await saveResponse(currentQuestion.id, valueToSubmit);
    setAnsweredQuestions(prev => new Set(prev).add(currentQuestion.id));

    const challenge = await checkForChallenge(currentQuestion.id, valueToSubmit);
    
    if (challenge && !answeredQuestions.has(currentQuestion.id)) {
      setChallengeText(challenge);
      setShowChallenge(true);
    } else if (isLastQuestion) {
      // Show "Add to Focus" prompt if there's an action text
      const actionText = valueToSubmit;
      if (actionText) {
        setShowAddToFocus(true);
      } else {
        handleCompleteFlow();
      }
    } else {
      // Clear any pending timeout first
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Store the pending answer to display immediately
      setPendingAnswer(valueToSubmit);
      
      // Start typing animation
      setShowCurrentQuestion(false);
      setIsTyping(true);
      
      console.log('[FlowSession] Moving to next question after typing delay...');
      
      // Wait for typing indicator, then show next question
      typingTimeoutRef.current = setTimeout(() => {
        console.log('[FlowSession] Timeout fired, advancing to next question');
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
      // Show "Add to Focus" prompt
      const actionText = getActionText();
      if (actionText) {
        setShowAddToFocus(true);
      } else {
        handleCompleteFlow();
      }
    } else {
      // Clear any pending timeout first
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Store the pending answer to display immediately
      setPendingAnswer(responses[currentQuestion?.id || ''] || currentValue);
      
      // Start typing animation
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

  if (!template) {
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

  // If all questions are answered (currentQuestion is undefined), navigate to completion
  if (!currentQuestion) {
    if (session?.id) {
      navigate(`/flows/complete/${session.id}`, { replace: true });
    } else {
      navigate('/flows', { replace: true });
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
        style={{ 
          paddingBottom: footerHeight + 32,
          scrollPaddingBottom: footerHeight + 32 
        }}
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

          {/* Current Question */}
          {showCurrentQuestion && !isTyping && (
            <div className="space-y-3" data-current-question="true">
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

          {/* Show the pending answer during typing state */}
          {isTyping && pendingAnswer && currentQuestion && (
            <div className="space-y-3">
              {/* Show current question as faded (now part of history) */}
              <ChatBubble 
                variant="incoming" 
                icon={flowIcon}
                className="opacity-70"
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
              
              {/* Show the user's answer immediately */}
              <ChatBubble
                variant="outgoing"
                avatarUrl={userPhotoUrl}
                avatarFallback={userInitials}
                html={isHtmlContent(pendingAnswer) ? pendingAnswer : undefined}
              >
                {pendingAnswer}
              </ChatBubble>
            </div>
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

          {/* Add to Focus List Prompt */}
          {showAddToFocus && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ChatBubble variant="incoming" icon={flowIcon} animate>
                Great intention! Would you like me to add this action to your <strong>Focus List</strong> so you can track it to completion?
              </ChatBubble>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkipAddToFocus}
                  disabled={addingToFocus}
                  className="rounded-full"
                >
                  No, skip
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddToFocus}
                  disabled={addingToFocus}
                  className="rounded-full"
                >
                  {addingToFocus ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Yes, add to Focus List
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-px w-full" style={{ scrollMarginBottom: footerHeight + 32 }} />
        </div>
      </main>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          variant="secondary"
          size="icon"
          className="fixed bottom-24 right-4 rounded-full shadow-lg z-20"
          onClick={() => scrollToCurrentQuestion()}
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}

      {/* Fixed Input Area */}
      <footer ref={footerRef} className="border-t border-border/10 bg-background/95 backdrop-blur sticky bottom-0">
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
            <>
              <ChatInput
                question={currentQuestion}
                value={currentValue}
                onChange={setCurrentValue}
                onSubmit={handleSubmitAnswer}
                disabled={checkingChallenge || showChallenge}
                isLast={isLastQuestion}
              />
            </>
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
