import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useToast } from '@/hooks/use-toast';
import { generateFlowPDF } from '@/lib/generateFlowPDF';
import { FlowTemplate, FlowAnalysis, FlowQuestion, FlowSession } from '@/types/flows';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Download, RotateCcw, Home, CheckCircle2, Lightbulb, Target, Tags, Brain, HelpCircle } from 'lucide-react';
import { isHtmlContent } from '@/components/flows/ChatBubble';
import DOMPurify from 'dompurify';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';

interface StaffFlowSession {
  id: string;
  staff_user_id: string;
  flow_template_id: string;
  title: string | null;
  domain: string | null;
  responses_json: Record<string, string>;
  ai_analysis_json: FlowAnalysis | null;
  status: 'in_progress' | 'completed';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function StaffFlowComplete() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isViewMode = location.pathname.includes('/view/');
  const { sessionToken, user: staffUser, loading: authLoading } = useStaffAuth();
  const { toast } = useToast();
  const celebrationShownRef = useRef(false);
  
const [session, setSession] = useState<StaffFlowSession | null>(null);
  const [template, setTemplate] = useState<FlowTemplate | null>(null);
  const [questions, setQuestions] = useState<FlowQuestion[]>([]);
  const [analysis, setAnalysis] = useState<FlowAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Interpolate placeholders in question prompts
  const interpolatePrompt = (prompt: string): string => {
    let result = prompt;
    const matches = prompt.match(/\{([^}]+)\}/g);
    
    if (matches && session?.responses_json) {
      matches.forEach(match => {
        const key = match.slice(1, -1);
        const sourceQuestion = questions.find(
          q => q.interpolation_key === key || q.id === key
        );
        if (sourceQuestion && session.responses_json[sourceQuestion.id]) {
          result = result.replace(match, session.responses_json[sourceQuestion.id]);
        }
      });
    }
    
    return result;
  };

  // Celebration effect (only on fresh completion, not when re-viewing from library)
  useEffect(() => {
    if (!loading && session && !celebrationShownRef.current && !isViewMode) {
      celebrationShownRef.current = true;
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast({
        title: '🎉 Flow Complete!',
        description: 'Great job on your reflection.',
      });
    }
  }, [loading, session, toast, isViewMode]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!sessionToken) {
      navigate('/staff/login');
      return;
    }
    
    if (sessionId) {
      loadSession();
    }
  }, [sessionId, sessionToken, authLoading]);

  const loadSession = async () => {
    if (!sessionToken) return;
    
    try {
      // Use edge function to fetch staff session
      const { data, error } = await supabase.functions.invoke('manage_staff_flow_session', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          action: 'get_session',
          sessionId,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to load session');
      }

      if (!data?.session) {
        throw new Error('Session not found');
      }

      const templateData = {
        ...data.template,
        questions_json: typeof data.template.questions_json === 'string'
          ? JSON.parse(data.template.questions_json)
          : data.template.questions_json
      };

      setSession(data.session);
      setTemplate(templateData);
      setQuestions(templateData.questions_json || []);

      // Check if we already have analysis
      if (data.session.ai_analysis_json) {
        setAnalysis(data.session.ai_analysis_json);
        setLoading(false);
      } else {
        // Trigger AI analysis
        setLoading(false);
        await runAnalysis(sessionId!);
      }
    } catch (err) {
      console.error('Error loading session:', err);
      toast({
        title: 'Error',
        description: 'Could not load your flow session.',
        variant: 'destructive',
      });
      navigate('/staff/flows');
    }
  };

  const runAnalysis = async (id: string) => {
    if (!sessionToken) return;
    
    setAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze_staff_flow_session', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: { session_id: id },
      });

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis(data.analysis);
        setSession(prev => prev ? {
          ...prev,
          ai_analysis_json: data.analysis,
          status: 'completed',
        } : null);
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      setAnalysisError('Unable to generate AI insights. Your flow has been saved.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!session || !template) return;

    setGeneratingPDF(true);
    try {
      await generateFlowPDF({
        session: session as unknown as FlowSession,
        template,
        questions,
        analysis,
        userName: staffUser?.display_name || undefined,
      });
    } catch (err) {
      console.error('PDF generation error:', err);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading your flow...</p>
        </div>
      </div>
    );
  }

  if (!session || !template) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Session not found.</p>
            <Button className="mt-4" onClick={() => navigate('/staff/flows')}>
              Back to Flows
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-medium">Flow Complete!</h1>
          <p className="text-muted-foreground mt-2">
            {template.icon} {template.name} Flow
          </p>
        </div>

        {/* Flow Info Card */}
        <Card className="mb-6 border-border/10">
          <CardContent className="p-6">
            <h2 className="text-xl font-medium mb-1">
              {session.title || 'Untitled Flow'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {session.domain && <span className="mr-3">📊 {session.domain}</span>}
              {format(new Date(session.created_at), 'MMMM d, yyyy • h:mm a')}
            </p>
          </CardContent>
        </Card>

        {/* AI Analysis Section */}
        <Card className="mb-6 border-border/10">
          <CardContent className="p-6">
            {analyzing ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-primary" />
                <p className="text-muted-foreground">Generating personalized insights...</p>
                <p className="text-xs text-muted-foreground/60 mt-1">This may take a few seconds</p>
              </div>
            ) : analysisError ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">{analysisError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => runAnalysis(sessionId!)}
                >
                  Try Again
                </Button>
              </div>
            ) : analysis ? (
              <div className="space-y-6">
                {/* Headline */}
                {analysis.headline && (
                  <div className="text-center pb-4 border-b border-border/10">
                    <h3 className="text-xl font-semibold text-foreground">
                      {analysis.headline}
                    </h3>
                  </div>
                )}

                {/* Congratulations */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" strokeWidth={1.5} />
                    <h3 className="font-medium">Recognition</h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {analysis.congratulations}
                  </p>
                </div>

                {/* Deep Dive Insight */}
                {analysis.deep_dive_insight && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-5 w-5 text-indigo-500" strokeWidth={1.5} />
                      <h3 className="font-medium">Deep Dive</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {analysis.deep_dive_insight}
                    </p>
                  </div>
                )}

                {/* Connections */}
                {analysis.connections && analysis.connections.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-5 w-5 text-blue-500" strokeWidth={1.5} />
                      <h3 className="font-medium">Connections</h3>
                    </div>
                    <ul className="space-y-2">
                      {analysis.connections.map((connection, idx) => (
                        <li key={idx} className="text-muted-foreground text-sm flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          {connection}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Themes */}
                {analysis.themes && analysis.themes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Tags className="h-5 w-5 text-purple-500" strokeWidth={1.5} />
                      <h3 className="font-medium">Themes</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.themes.map((theme, idx) => (
                        <span 
                          key={idx}
                          className="px-3 py-1 bg-muted/50 rounded-full text-sm text-muted-foreground"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Provocative Question */}
                {analysis.provocative_question && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <HelpCircle className="h-5 w-5 text-amber-500" strokeWidth={1.5} />
                      <h3 className="font-medium">Question to Consider</h3>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                      <p className="text-sm text-foreground italic">
                        {analysis.provocative_question}
                      </p>
                    </div>
                  </div>
                )}

                {/* Suggested Action */}
                {analysis.suggested_action && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-green-500" strokeWidth={1.5} />
                      <h3 className="font-medium">Micro-Step</h3>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                      <p className="text-sm text-foreground">
                        {analysis.suggested_action}
                      </p>
                    </div>
                  </div>
                )}

                {/* User's Original Action */}
                {session.responses_json?.actions && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                      <h3 className="font-medium text-muted-foreground">Your Committed Action</h3>
                    </div>
                    {isHtmlContent(session.responses_json.actions) ? (
                      <div
                        className="text-muted-foreground/80 text-sm italic prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(session.responses_json.actions),
                        }}
                      />
                    ) : (
                      <p className="text-muted-foreground/80 text-sm italic">
                        "{session.responses_json.actions}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground">No analysis available.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Full Flow Q&A Section */}
        {questions.length > 0 && (
          <Card className="mb-6 border-border/10">
            <CardContent className="p-6">
              <h2 className="font-medium text-lg mb-6">Your Flow Responses</h2>
              <div className="space-y-6">
                {questions.map((question) => {
                  const response = session.responses_json?.[question.id];
                  if (!response) return null;
                  
                  return (
                    <div key={question.id} className="border-b border-border/10 pb-6 last:border-0 last:pb-0">
                      <p className="text-muted-foreground/70 text-sm mb-2">
                        {interpolatePrompt(question.prompt)}
                      </p>
                      {isHtmlContent(response) ? (
                        <div
                          className="text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(response),
                          }}
                        />
                      ) : (
                        <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                          {response}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            className="w-full"
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
          >
            {generatingPDF ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" strokeWidth={1.5} />
            )}
            {generatingPDF ? 'Generating PDF...' : 'Download PDF'}
          </Button>

          <Button
            className="w-full"
            onClick={() => navigate(`/staff/flows/start/${template.slug}`)}
          >
            <RotateCcw className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Start New {template.name} Flow
          </Button>

          <Button
            className="w-full"
            variant="ghost"
            onClick={() => navigate('/staff/flows')}
          >
            <Home className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Back to Flows
          </Button>
        </div>
      </div>
    </div>
  );
}
