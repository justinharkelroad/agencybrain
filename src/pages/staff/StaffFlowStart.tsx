import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useStaffAuth } from '@/hooks/useStaffAuth';
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

interface StaffFlowSession {
  id: string;
  staff_user_id: string;
  flow_template_id: string;
  title: string | null;
  responses_json: Record<string, string>;
  status: string;
  updated_at: string;
}

export default function StaffFlowStart() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { sessionToken, loading: authLoading } = useStaffAuth();

  const [loading, setLoading] = useState(true);
  const [draftSession, setDraftSession] = useState<StaffFlowSession | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (slug && sessionToken && !authLoading) {
      checkForDrafts();
    } else if (!authLoading && !sessionToken) {
      // No session token, redirect to staff login
      navigate('/staff/login');
    }
  }, [slug, sessionToken, authLoading]);

  const checkForDrafts = async () => {
    if (!sessionToken) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage_staff_flow_session', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          action: 'check_draft',
          templateSlug: slug,
        },
      });

      if (error) {
        console.error('[StaffFlowStart] Error checking for drafts:', error);
        navigate('/staff/flows');
        return;
      }

      if (data?.error) {
        console.error('[StaffFlowStart] API error:', data.error);
        navigate('/staff/flows');
        return;
      }

      setTemplateName(data.template?.name || '');

      if (data.hasDraft && data.draft) {
        setDraftSession(data.draft);
        setLoading(false);
      } else if (data.shouldNavigate) {
        // No draft - navigate directly to session
        navigate(`/staff/flows/session/${slug}`, { replace: true });
      }
    } catch (err) {
      console.error('[StaffFlowStart] Error:', err);
      navigate('/staff/flows');
    }
  };

  const handleContinueDraft = () => {
    navigate(`/staff/flows/session/${slug}`, { 
      replace: true,
      state: { sessionId: draftSession?.id }
    });
  };

  const handleDeleteDraft = async () => {
    if (!draftSession || !sessionToken) return;
    
    try {
      await supabase.functions.invoke('manage_staff_flow_session', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          action: 'delete_session',
          sessionId: draftSession.id,
        },
      });

      setDraftSession(null);
      setShowDeleteConfirm(false);
      
      navigate(`/staff/flows/session/${slug}`, { replace: true });
    } catch (err) {
      console.error('[StaffFlowStart] Error deleting draft:', err);
    }
  };

  const handleStartNew = async () => {
    if (!sessionToken) return;
    
    // Delete the existing draft first
    if (draftSession) {
      await supabase.functions.invoke('manage_staff_flow_session', {
        headers: {
          'x-staff-session': sessionToken,
        },
        body: {
          action: 'delete_session',
          sessionId: draftSession.id,
        },
      });
    }
    
    navigate(`/staff/flows/session/${slug}`, { replace: true });
  };

  const getProgress = () => {
    if (!draftSession?.responses_json) return 0;
    return Object.keys(draftSession.responses_json).length;
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Preparing your flow...</p>
        </div>
      </div>
    );
  }

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
              onClick={() => navigate('/staff/flows')}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>

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

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
