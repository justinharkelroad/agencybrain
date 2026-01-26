import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { FlowTemplate, FlowQuestion } from '@/types/flows';

export interface PromptSegment {
  type: 'text' | 'interpolated';
  content: string;
}

interface StaffFlowSession {
  id: string;
  staff_user_id: string;
  flow_template_id: string;
  title: string | null;
  domain: string | null;
  responses_json: Record<string, string>;
  ai_analysis_json: unknown;
  status: 'in_progress' | 'completed';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UseStaffFlowSessionProps {
  templateSlug?: string;
  sessionId?: string;
}

export function useStaffFlowSession({ templateSlug, sessionId }: UseStaffFlowSessionProps) {
  const { sessionToken } = useStaffAuth();
  
  const [template, setTemplate] = useState<FlowTemplate | null>(null);
  const [session, setSession] = useState<StaffFlowSession | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionLoadedFromDb, setSessionLoadedFromDb] = useState(false);

  useEffect(() => {
    if (!sessionToken) {
      setLoading(false);
      return;
    }
    
    if (sessionId) {
      loadExistingSession(sessionId);
    } else if (templateSlug) {
      loadOrCreateSession(templateSlug);
    }
  }, [sessionId, templateSlug, sessionToken]);

  const loadOrCreateSession = async (slug: string) => {
    if (!sessionToken) return;
    
    setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('manage_staff_flow_session', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          action: 'create_session',
          templateSlug: slug,
        },
      });

      if (invokeError || data?.error) {
        throw new Error(data?.error || invokeError?.message || 'Failed to load session');
      }

      const templateData = {
        ...data.template,
        questions_json: typeof data.template.questions_json === 'string'
          ? JSON.parse(data.template.questions_json)
          : data.template.questions_json
      } as FlowTemplate;

      setTemplate(templateData);
      setSession(data.session);
      setResponses((data.session.responses_json as Record<string, string>) || {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useStaffFlowSession] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingSession = async (id: string) => {
    if (!sessionToken) return;
    
    setLoading(true);
    try {
      // For now, we'll use get_staff_flows to fetch sessions
      const { data, error: invokeError } = await supabase.functions.invoke('get_staff_flows', {
        headers: {
          'x-staff-session': sessionToken,
        },
      });

      if (invokeError || data?.error) {
        throw new Error(data?.error || invokeError?.message || 'Failed to load session');
      }

      // Find the session with matching ID from staff_flow_sessions
      // We need to update get_staff_flows to return staff sessions, or create a dedicated endpoint
      // For now, try to create/get the session via manage endpoint
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('manage_staff_flow_session', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          action: 'create_session',
          templateSlug: data.templates?.[0]?.slug, // Fallback
        },
      });

      if (sessionError || sessionData?.error) {
        throw new Error(sessionData?.error || sessionError?.message || 'Failed to load session');
      }

      if (sessionData.template) {
        const templateData = {
          ...sessionData.template,
          questions_json: typeof sessionData.template.questions_json === 'string'
            ? JSON.parse(sessionData.template.questions_json)
            : sessionData.template.questions_json
        } as FlowTemplate;

        setTemplate(templateData);
        setSession(sessionData.session);
        setResponses((sessionData.session?.responses_json as Record<string, string>) || {});
        setSessionLoadedFromDb(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[useStaffFlowSession] Error loading existing session:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get all questions from template
  const allQuestions = useMemo(() => {
    return (template?.questions_json || []) as FlowQuestion[];
  }, [template]);

  // Compute visible questions based on show_if conditions
  const visibleQuestions = useMemo(() => {
    return allQuestions.filter(q => {
      if (!q.show_if) return true;
      const gateAnswer = responses[q.show_if.question_id];
      return gateAnswer === q.show_if.equals;
    });
  }, [allQuestions, responses]);

  // Set initial question index when resuming from DB
  useEffect(() => {
    if (!loading && template && session && sessionLoadedFromDb) {
      const firstUnanswered = visibleQuestions.findIndex(
        q => !responses[q.id]
      );
      const newIndex = firstUnanswered === -1 ? visibleQuestions.length - 1 : firstUnanswered;
      setCurrentQuestionIndex(newIndex);
    }
  }, [loading, template, session, sessionLoadedFromDb, visibleQuestions, responses]);

  const saveResponse = async (questionId: string, value: string) => {
    const newResponses = { ...responses, [questionId]: value };
    setResponses(newResponses);

    if (!session || !sessionToken) return;

    setSaving(true);
    try {
      const updateData: Record<string, string | undefined> = {
        questionId,
        value,
      };

      const titleQuestion = allQuestions.find(q => q.interpolation_key === 'stack_title' || q.id === 'title');
      const domainQuestion = allQuestions.find(q => q.id === 'domain');

      if (titleQuestion && questionId === titleQuestion.id) {
        updateData.title = value;
      }
      if (domainQuestion && questionId === domainQuestion.id) {
        updateData.domain = value;
      }

      const { error: saveError } = await supabase.functions.invoke('manage_staff_flow_session', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          action: 'save_response',
          sessionId: session.id,
          ...updateData,
        },
      });

      if (saveError) {
        console.error('[useStaffFlowSession] Error saving response:', saveError);
      }
    } catch (err) {
      console.error('[useStaffFlowSession] Error saving response:', err);
    } finally {
      setSaving(false);
    }
  };

  const goToNextQuestion = useCallback(() => {
    if (currentQuestionIndex < visibleQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }, [currentQuestionIndex, visibleQuestions.length]);

  const goToPreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  }, [currentQuestionIndex]);

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < visibleQuestions.length) {
      setCurrentQuestionIndex(index);
    }
  }, [visibleQuestions.length]);

  const interpolatePrompt = useCallback((prompt: string): PromptSegment[] => {
    const segments: PromptSegment[] = [];
    
    const regex = /\{([^}]+)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(prompt)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = prompt.slice(lastIndex, match.index);
        if (textBefore) {
          segments.push({ type: 'text', content: textBefore });
        }
      }

      const key = match[1];
      const sourceQuestion = allQuestions.find(
        q => q.interpolation_key === key || q.id === key
      );

      if (sourceQuestion && responses[sourceQuestion.id]) {
        segments.push({ type: 'interpolated', content: responses[sourceQuestion.id] });
      } else {
        segments.push({ type: 'text', content: match[0] });
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < prompt.length) {
      const remaining = prompt.slice(lastIndex);
      if (remaining) {
        segments.push({ type: 'text', content: remaining });
      }
    }

    if (segments.length === 0) {
      segments.push({ type: 'text', content: prompt });
    }

    return segments;
  }, [responses, allQuestions]);

  const currentQuestion = visibleQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === visibleQuestions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const progress = visibleQuestions.length > 0 
    ? ((currentQuestionIndex + 1) / visibleQuestions.length) * 100 
    : 0;

  return {
    template,
    session,
    questions: visibleQuestions,
    currentQuestion,
    currentQuestionIndex,
    responses,
    loading,
    saving,
    error,
    isFirstQuestion,
    isLastQuestion,
    progress,
    saveResponse,
    goToNextQuestion,
    goToPreviousQuestion,
    goToQuestion,
    interpolatePrompt,
  };
}
