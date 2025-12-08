import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { FlowTemplate, FlowSession, FlowQuestion } from '@/types/flows';

export interface PromptSegment {
  type: 'text' | 'interpolated';
  content: string;
}

interface UseFlowSessionProps {
  templateSlug?: string;
  sessionId?: string;
}

export function useFlowSession({ templateSlug, sessionId }: UseFlowSessionProps) {
  const { user } = useAuth();
  
  const [template, setTemplate] = useState<FlowTemplate | null>(null);
  const [session, setSession] = useState<FlowSession | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadExistingSession(sessionId);
    } else if (templateSlug) {
      loadTemplate(templateSlug);
    }
  }, [sessionId, templateSlug]);

  const loadTemplate = async (slug: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flow_templates')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      
      const templateData = {
        ...data,
        questions_json: typeof data.questions_json === 'string' 
          ? JSON.parse(data.questions_json) 
          : data.questions_json
      } as FlowTemplate;
      
      setTemplate(templateData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingSession = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flow_sessions')
        .select('*, flow_template:flow_templates(*)')
        .eq('id', id)
        .single();

      if (error) throw error;

      const templateData = {
        ...data.flow_template,
        questions_json: typeof data.flow_template.questions_json === 'string'
          ? JSON.parse(data.flow_template.questions_json)
          : data.flow_template.questions_json
      } as FlowTemplate;

      setSession(data as FlowSession);
      setTemplate(templateData);
      setResponses((data.responses_json as Record<string, string>) || {});
      
      const questions = templateData.questions_json as FlowQuestion[];
      const firstUnanswered = questions.findIndex(
        q => !(data.responses_json as Record<string, string>)?.[q.id]
      );
      setCurrentQuestionIndex(firstUnanswered === -1 ? questions.length - 1 : firstUnanswered);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    if (!user?.id || !template) return null;

    try {
      const { data, error } = await supabase
        .from('flow_sessions')
        .insert({
          user_id: user.id,
          flow_template_id: template.id,
          status: 'in_progress',
          responses_json: {},
        })
        .select()
        .single();

      if (error) throw error;
      
      setSession(data as FlowSession);
      return data as FlowSession;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  };

  const saveResponse = async (questionId: string, value: string) => {
    const newResponses = { ...responses, [questionId]: value };
    setResponses(newResponses);

    let currentSession = session;
    if (!currentSession) {
      currentSession = await createSession();
      if (!currentSession) return;
    }

    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        responses_json: newResponses,
        updated_at: new Date().toISOString(),
      };

      const questions = template?.questions_json as FlowQuestion[];
      const titleQuestion = questions?.find(q => q.interpolation_key === 'stack_title' || q.id === 'title');
      const domainQuestion = questions?.find(q => q.id === 'domain');

      if (titleQuestion && questionId === titleQuestion.id) {
        updateData.title = value;
      }
      if (domainQuestion && questionId === domainQuestion.id) {
        updateData.domain = value;
      }

      const { error } = await supabase
        .from('flow_sessions')
        .update(updateData)
        .eq('id', currentSession.id);

      if (error) throw error;

      setSession(prev => prev ? { ...prev, ...updateData } : prev);
    } catch (err: any) {
      console.error('Error saving response:', err);
    } finally {
      setSaving(false);
    }
  };

  const goToNextQuestion = () => {
    const questions = template?.questions_json as FlowQuestion[];
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const goToQuestion = (index: number) => {
    const questions = template?.questions_json as FlowQuestion[];
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  const interpolatePrompt = useCallback((prompt: string): PromptSegment[] => {
    const segments: PromptSegment[] = [];
    const questions = template?.questions_json as FlowQuestion[];
    
    const regex = /\{([^}]+)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(prompt)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = prompt.slice(lastIndex, match.index).trim();
        if (textBefore) {
          segments.push({ type: 'text', content: textBefore });
        }
      }

      const key = match[1];
      const sourceQuestion = questions?.find(
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
      const remaining = prompt.slice(lastIndex).trim();
      if (remaining) {
        segments.push({ type: 'text', content: remaining });
      }
    }

    if (segments.length === 0) {
      segments.push({ type: 'text', content: prompt });
    }

    return segments;
  }, [responses, template]);

  const questions = (template?.questions_json || []) as FlowQuestion[];
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const progress = questions.length > 0 
    ? ((currentQuestionIndex + 1) / questions.length) * 100 
    : 0;

  return {
    template,
    session,
    questions,
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
    createSession,
  };
}
