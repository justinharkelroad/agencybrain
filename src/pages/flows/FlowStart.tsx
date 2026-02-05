import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { FlowSession } from '@/types/flows';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileEdit, Trash2, PlusCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function FlowStart() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [draftSession, setDraftSession] = useState<FlowSession | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Update browser tab title
  useEffect(() => {
    if (templateName) {
      document.title = `Start ${templateName} | AgencyBrain`;
    } else {
      document.title = "Start Flow | AgencyBrain";
    }
  }, [templateName]);

  useEffect(() => {
    if (slug && user?.id) {
      checkForDrafts();
    }
  }, [slug, user?.id]);

  const checkForDrafts = async () => {
    setLoading(true);
    try {
      // Get template
      const { data: template, error: templateError } = await supabase
        .from('flow_templates')
        .select('id, name')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (templateError || !template) {
        navigate('/flows');
        return;
      }

      setTemplateId(template.id);
      setTemplateName(template.name);

      // Check for existing in-progress session (use maybeSingle for safety)
      const { data: existingSession } = await supabase
        .from('flow_sessions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('flow_template_id', template.id)
        .eq('status', 'in_progress')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        // Check if this is an empty phantom draft (0 questions answered)
        const answeredCount = Object.keys(existingSession.responses_json || {}).length;
        
        if (answeredCount === 0) {
          // Empty phantom draft - delete silently and navigate directly
          console.log('[FlowStart] Auto-deleting empty phantom draft:', existingSession.id);
          await supabase.from('flow_sessions').delete().eq('id', existingSession.id);
          navigate(`/flows/session/${slug}`, { replace: true });
          return;
        }
        
        // Found a real draft with answers - show options
        setDraftSession(existingSession);
        setLoading(false);
      } else {
        // No draft - navigate directly, session will be created lazily by useFlowSession
        navigate(`/flows/session/${slug}`, { replace: true });
      }
    } catch (err) {
      console.error('Error checking for drafts:', err);
      navigate('/flows');
    }
  };

  const handleContinueDraft = () => {
    navigate(`/flows/session/${slug}`, { 
      replace: true,
      state: { sessionId: draftSession?.id }
    });
  };

  const handleDeleteDraft = async () => {
    if (!draftSession) return;
    
    try {
      await supabase
        .from('flow_sessions')
        .delete()
        .eq('id', draftSession.id);

      setDraftSession(null);
      setShowDeleteConfirm(false);
      
      // Just navigate - session will be created lazily on first answer
      navigate(`/flows/session/${slug}`, { replace: true });
    } catch (err) {
      console.error('Error deleting draft:', err);
    }
  };

  const handleStartNew = async () => {
    if (!templateId) return;
    
    // Delete the existing draft first to prevent orphaned in_progress sessions
    if (draftSession) {
      await supabase
        .from('flow_sessions')
        .delete()
        .eq('id', draftSession.id);
    }
    
    // Navigate directly, session will be created lazily by useFlowSession
    navigate(`/flows/session/${slug}`, { replace: true });
  };

  // Count answered questions
  const getProgress = () => {
    if (!draftSession?.responses_json) return 0;
    return Object.keys(draftSession.responses_json).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Preparing your flow...</p>
        </div>
      </div>
    );
  }

  // Show draft options
  if (draftSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500/10 mx-auto mb-2">
              <FileEdit className="h-6 w-6 text-yellow-500" />
            </div>
            <CardTitle>Draft Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="font-medium">
                {draftSession.title || `Untitled ${templateName} Flow`}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(draftSession.updated_at), 'MMM d, h:mm a')}
                </span>
                <span>
                  {getProgress()} questions answered
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                className="w-full" 
                onClick={handleContinueDraft}
              >
                <FileEdit className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Continue Draft
              </Button>
              
              <Button 
                className="w-full" 
                variant="outline"
                onClick={handleStartNew}
              >
                <PlusCircle className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Start Fresh
              </Button>
              
              <Button 
                className="w-full" 
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" strokeWidth={1.5} />
                Delete Draft & Start New
              </Button>
            </div>

            <Button 
              className="w-full" 
              variant="ghost"
              onClick={() => navigate('/flows')}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your in-progress flow. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteDraft}>
                Delete Draft
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Fallback loading
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
