import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { useFlowProfile } from '@/hooks/useFlowProfile';
import { generateFlowPDF } from '@/lib/generateFlowPDF';
import { FlowSession, FlowTemplate, FlowQuestion, FlowAnalysis } from '@/types/flows';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ExchangeShareModal } from '@/components/exchange/ExchangeShareModal';
import { FlowReportCard } from '@/components/flows/FlowReportCard';

export default function FlowView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useFlowProfile();
  
  const [session, setSession] = useState<FlowSession | null>(null);
  const [template, setTemplate] = useState<FlowTemplate | null>(null);
  const [questions, setQuestions] = useState<FlowQuestion[]>([]);
  const [analysis, setAnalysis] = useState<FlowAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Check if current user is the owner of this flow
  const isOwner = session?.user_id === user?.id;

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

      // If completed but no analysis, trigger it (only for owner)
      if (data.status === 'completed' && !data.ai_analysis_json && data.user_id === user?.id) {
        await runAnalysis(sessionId);
      }
    } catch (err) {
      console.error('Error loading session:', err);
      navigate(-1);
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

  const handleBack = () => {
    if (isOwner) {
      navigate('/flows/library');
    } else {
      navigate(-1);
    }
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
            <Button className="mt-4" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" strokeWidth={1.5} />
          {isOwner ? 'Back to Library' : 'Back'}
        </Button>

        {/* Flow Report Card */}
        <FlowReportCard
          session={session}
          template={template}
          questions={questions}
          analysis={analysis}
          analyzing={analyzing}
          isReadOnly={!isOwner}
          generatingPDF={generatingPDF}
          onShare={isOwner ? () => setShareModalOpen(true) : undefined}
          onDownloadPDF={handleDownloadPDF}
          onNewFlow={isOwner ? () => navigate(`/flows/start/${template.slug}`) : undefined}
        />
        
        {/* Share Modal - only for owners */}
        {isOwner && (
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
        )}
      </div>
    </div>
  );
}
