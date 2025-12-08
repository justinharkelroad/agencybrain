import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useFlowProfile } from '@/hooks/useFlowProfile';
import { FlowSession, FlowTemplate } from '@/types/flows';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Download, RotateCcw, Home, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function FlowComplete() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useFlowProfile();
  
  const [session, setSession] = useState<FlowSession | null>(null);
  const [template, setTemplate] = useState<FlowTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

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

      // Mark as completed if not already
      if (data.status !== 'completed') {
        await markComplete(data.id);
      }
    } catch (err) {
      console.error('Error loading session:', err);
      navigate('/flows');
    } finally {
      setLoading(false);
    }
  };

  const markComplete = async (id: string) => {
    setCompleting(true);
    try {
      const { error } = await supabase
        .from('flow_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setSession(prev => prev ? { 
        ...prev, 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      } : null);
    } catch (err) {
      console.error('Error completing session:', err);
    } finally {
      setCompleting(false);
    }
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation in Phase 4
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

  const userName = profile?.preferred_name || 'there';

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        <Card className="border-border/10">
          <CardContent className="p-8">
            {/* Success Icon */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-medium">Stack Complete!</h1>
            </div>

            {/* Congratulations */}
            <div className="text-center mb-8">
              <p className="text-lg">
                Amazing work, <span className="font-medium">{userName}</span>! 🎉
              </p>
              <p className="text-muted-foreground mt-2">
                You've completed your {template.name} Stack:
              </p>
              <p className="font-medium mt-1">
                "{session.title || 'Untitled Stack'}"
              </p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                {format(new Date(session.created_at), 'MMMM d, yyyy • h:mm a')}
              </p>
            </div>

            {/* Quick Summary */}
            <div className="bg-muted/30 rounded-lg p-4 mb-8">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Your Key Insight
              </h3>
              <p className="text-muted-foreground text-sm">
                {session.responses_json?.revelation || session.responses_json?.lesson || 
                 'Take a moment to reflect on what you discovered in this stack.'}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button 
                className="w-full" 
                variant="outline"
                onClick={handleDownloadPDF}
              >
                <Download className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Download PDF
              </Button>
              
              <Button 
                className="w-full"
                onClick={() => navigate(`/flows/start/${template.slug}`)}
              >
                <RotateCcw className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Start New {template.name} Stack
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
