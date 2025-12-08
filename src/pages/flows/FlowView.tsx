import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { FlowSession, FlowTemplate, FlowQuestion } from '@/types/flows';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Download, RotateCcw, Home, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

export default function FlowView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<FlowSession | null>(null);
  const [template, setTemplate] = useState<FlowTemplate | null>(null);
  const [loading, setLoading] = useState(true);

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

      setSession(data);
      setTemplate(data.flow_template);
    } catch (err) {
      console.error('Error loading session:', err);
      navigate('/flows');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    alert('PDF export coming soon!');
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

  const questions = template.questions_json as FlowQuestion[];
  const responses = session.responses_json as Record<string, string>;

  // Get key insight (revelation or lesson)
  const keyInsight = responses?.revelation || responses?.lesson || null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/10 bg-card/50">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/flows')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              Back to Flows
            </Button>
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(`/flows/start/${template.slug}`)}
              >
                <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Title Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{template.icon || '🧠'}</span>
            <span className="text-sm text-muted-foreground">{template.name} Stack</span>
          </div>
          <h1 className="text-2xl font-medium">
            {session.title || 'Untitled Stack'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(session.created_at), 'MMMM d, yyyy • h:mm a')}
            {session.completed_at && (
              <span className="ml-2 text-green-500">• Completed</span>
            )}
          </p>
        </div>

        {/* Key Insight */}
        {keyInsight && (
          <Card className="border-border/10 bg-primary/5 mb-8">
            <CardContent className="p-6">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Key Insight
              </h3>
              <p className="text-foreground">{keyInsight}</p>
            </CardContent>
          </Card>
        )}

        {/* Q&A History */}
        <div className="space-y-6">
          {questions.map((question, idx) => {
            const answer = responses[question.id];
            if (!answer) return null;

            return (
              <div key={question.id} className="border-l-2 border-border/20 pl-6">
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-lg flex-shrink-0">🧠</span>
                  <p className="text-muted-foreground">{question.prompt}</p>
                </div>
                <div className="ml-8">
                  <p className="bg-muted/30 rounded-lg px-4 py-3 text-foreground">
                    {answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="mt-12 pt-8 border-t border-border/10">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="flat"
              onClick={() => navigate(`/flows/start/${template.slug}`)}
              className="flex-1"
            >
              <RotateCcw className="h-4 w-4 mr-2" strokeWidth={1.5} />
              Start New {template.name} Stack
            </Button>
            <Button 
              variant="ghost"
              onClick={() => navigate('/flows')}
              className="flex-1"
            >
              <Home className="h-4 w-4 mr-2" strokeWidth={1.5} />
              Back to Flows
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
