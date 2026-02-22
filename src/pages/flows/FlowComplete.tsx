import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useFlowProfile } from '@/hooks/useFlowProfile';
import { useFlowStats } from '@/hooks/useFlowStats';
import { useToast } from '@/hooks/use-toast';
import { generateFlowPDF } from '@/lib/generateFlowPDF';
import { FlowSession, FlowTemplate, FlowAnalysis, FlowQuestion } from '@/types/flows';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Download, RotateCcw, Home, CheckCircle2, Lightbulb, Target, Tags, Brain, HelpCircle, Share2 } from 'lucide-react';
import { isHtmlContent } from '@/components/flows/ChatBubble';
import DOMPurify from 'dompurify';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';
import { ExchangeShareModal } from '@/components/exchange/ExchangeShareModal';

export default function FlowComplete() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useFlowProfile();
  const stats = useFlowStats();
  const { toast } = useToast();
  const celebrationShownRef = useRef(false);
  
  const [session, setSession] = useState<FlowSession | null>(null);
  const [template, setTemplate] = useState<FlowTemplate | null>(null);
  const [analysis, setAnalysis] = useState<FlowAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Celebration effect for milestones and streaks
  useEffect(() => {
    if (!stats.loading && !celebrationShownRef.current && stats.totalFlows > 0) {
      celebrationShownRef.current = true;
      
      // Check if we just hit a milestone
      const justHitMilestone = stats.milestones.find(m => 
        m.achieved && stats.currentStreak === m.days
      );

      if (justHitMilestone) {
        // Fire confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });

        toast({
          title: `${justHitMilestone.icon} ${justHitMilestone.label} Milestone!`,
          description: `You've maintained a ${justHitMilestone.days}-day streak! Keep going!`,
        });
      } else if (stats.todayCompleted && stats.currentStreak > 1) {
        // Show streak alive toast
        toast({
          title: '🔥 Streak Alive!',
          description: `Day ${stats.currentStreak} in the books!`,
        });
      }
    }
  }, [stats, toast]);

  // Update browser tab title
  useEffect(() => {
    document.title = "Flow Complete | AgencyBrain";
  }, []);

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

      // Check if we already have analysis
      if (data.ai_analysis_json) {
        setAnalysis(data.ai_analysis_json);
        setLoading(false);
      } else {
        // Trigger AI analysis
        setLoading(false);
        await runAnalysis(sessionId!);
      }
    } catch (err) {
      console.error('Error loading session:', err);
      navigate('/flows');
    }
  };

  const runAnalysis = async (id: string) => {
    setAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze_flow_session', {
        body: { session_id: id },
      });

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis(data.analysis);
        // Update local session state
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
    
    const questions: FlowQuestion[] = (typeof template.questions_json === 'string' 
      ? JSON.parse(template.questions_json) 
      : template.questions_json) || [];
    
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

  if (loading) {
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
            <Button className="mt-4" onClick={() => navigate('/flows')}>
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

                {/* Connections to Profile */}
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

        {/* Actions */}
        <div className="space-y-3">
          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => setShareModalOpen(true)}
          >
            <Share2 className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Share to The Exchange
          </Button>
          
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
            onClick={() => navigate(`/flows/start/${template.slug}`)}
          >
            <RotateCcw className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Start New {template.name} Flow
          </Button>
          
          <Button 
            className="w-full" 
            variant="ghost"
            onClick={() => navigate('/flows')}
          >
            <Home className="h-4 w-4 mr-2" strokeWidth={1.5} />
            Back to Flows
          </Button>
        </div>
        
        {/* Share Modal */}
        <ExchangeShareModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          contentType="flow_result"
          sourceReference={{
            type: 'flow_result',
            id: session.id,
            title: session.title || `${template.name} Flow`,
          }}
        />
      </div>
    </div>
  );
}
