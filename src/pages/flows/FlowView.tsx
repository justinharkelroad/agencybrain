import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useFlowProfile } from '@/hooks/useFlowProfile';
import { generateFlowPDF } from '@/lib/generateFlowPDF';
import { FlowSession, FlowTemplate, FlowQuestion, FlowAnalysis } from '@/types/flows';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, RotateCcw, Sparkles, Lightbulb, Target, Tags, Loader2, Brain, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function FlowView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useFlowProfile();
  
  const [session, setSession] = useState<FlowSession | null>(null);
  const [template, setTemplate] = useState<FlowTemplate | null>(null);
  const [questions, setQuestions] = useState<FlowQuestion[]>([]);
  const [analysis, setAnalysis] = useState<FlowAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const { data, error } = await supabase
        .from('flow_sessions')
        .select('*, flow_template:flow_templates(*)')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      const templateData = {
        ...data.flow_template,
        questions_json: typeof data.flow_template.questions_json === 'string'
          ? JSON.parse(data.flow_template.questions_json)
          : data.flow_template.questions_json
      };

      setSession(data);
      setTemplate(templateData);
      setQuestions(templateData.questions_json);
      setAnalysis(data.ai_analysis_json);

      // If completed but no analysis, trigger it
      if (data.status === 'completed' && !data.ai_analysis_json) {
        await runAnalysis(sessionId);
      }
    } catch (err) {
      console.error('Error loading session:', err);
      navigate('/flows/library');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async (id: string) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze_flow_session', {
        body: { session_id: id },
      });

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!session || !template) return;
    
    setGeneratingPDF(true);
    try {
      await generateFlowPDF({
        session,
        template,
        questions,
        analysis,
        userName: profile?.preferred_name || undefined,
      });
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Interpolate prompt with responses
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session || !template) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="border-border/10">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Flow not found.</p>
            <Button className="mt-4" onClick={() => navigate('/flows/library')}>
              Back to Library
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/flows/library')}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Back to Library
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{template.icon}</span>
                <span className="text-sm text-muted-foreground">{template.name} Flow</span>
              </div>
              <h1 className="text-2xl font-medium">
                {session.title || 'Untitled Flow'}
              </h1>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {session.domain && <span className="mr-3">{session.domain}</span>}
                {format(new Date(session.created_at), 'MMMM d, yyyy • h:mm a')}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadPDF}
                disabled={generatingPDF}
              >
                {generatingPDF ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" strokeWidth={1.5} />
                )}
                PDF
              </Button>
              <Button size="sm" onClick={() => navigate(`/flows/start/${template.slug}`)}>
                <RotateCcw className="h-4 w-4 mr-1" strokeWidth={1.5} />
                New
              </Button>
            </div>
          </div>
        </div>

        {/* AI Analysis Section */}
        {(analysis || analyzing) && (
          <Card className="mb-8 border-border/10">
            <CardContent className="p-6">
              {analyzing ? (
                <div className="text-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-primary" />
                  <p className="text-muted-foreground">Generating insights...</p>
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
                        <p className="text-sm italic">
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
                        <p className="text-sm">
                          {analysis.suggested_action}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Q&A Section */}
        <div className="space-y-6">
          <h2 className="font-medium text-lg">Your Responses</h2>
          
          {questions.map((question, idx) => {
            const response = session.responses_json?.[question.id];
            if (!response) return null;
            
            return (
              <div key={question.id} className="border-b border-border/10 pb-6 last:border-0">
                <p className="text-muted-foreground/70 text-sm mb-2">
                  {interpolatePrompt(question.prompt)}
                </p>
                <p className="text-foreground leading-relaxed">
                  {response}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
