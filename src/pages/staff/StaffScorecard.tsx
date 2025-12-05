import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, FileText } from 'lucide-react';

interface FormTemplate {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export default function StaffScorecard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useStaffAuth();
  
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [teamMemberRole, setTeamMemberRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFormsForUser() {
      if (!user?.agency_id || !user?.team_member_id) return;

      try {
        setLoading(true);
        setError(null);

        // Get team member's role
        const { data: teamMember, error: tmError } = await supabase
          .from('team_members')
          .select('role')
          .eq('id', user.team_member_id)
          .single();

        if (tmError || !teamMember) {
          setError('Could not determine your role. Contact your administrator.');
          return;
        }

        setTeamMemberRole(teamMember.role);

        // Get forms matching agency + role (or Hybrid which can use any)
        const roles = teamMember.role === 'Hybrid' 
          ? ['Sales', 'Service', 'Hybrid']
          : [teamMember.role, 'Hybrid'];

        const { data: formTemplates, error: formsError } = await supabase
          .from('form_templates')
          .select('id, name, slug, role')
          .eq('agency_id', user.agency_id)
          .eq('is_active', true)
          .in('role', roles);

        if (formsError) {
          console.error('Error loading forms:', formsError);
          setError('Failed to load available forms.');
          return;
        }

        setForms(formTemplates || []);

        // If exactly one form, auto-navigate to it
        if (formTemplates && formTemplates.length === 1) {
          navigate(`/staff/submit/${formTemplates[0].slug}`, { replace: true });
        }

      } catch (err) {
        console.error('Error:', err);
        setError('An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    }

    if (isAuthenticated && user) {
      loadFormsForUser();
    }
  }, [user, isAuthenticated, navigate]);

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to submit forms</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/staff/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not linked to team member
  if (!user?.team_member_id) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/staff/training')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Training
          </Button>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Account Not Linked</AlertTitle>
            <AlertDescription>
              Your staff account is not linked to a team member. Please contact your administrator to set up your account before submitting forms.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/staff/training')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Training
          </Button>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // No forms available
  if (forms.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/staff/training')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Training
          </Button>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Forms Available</AlertTitle>
            <AlertDescription>
              There are no forms available for your role ({teamMemberRole}). Please contact your administrator.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Multiple forms - show selection
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/staff/training')} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Training
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Select a Form</CardTitle>
            <CardDescription>
              Choose which scorecard to submit for today
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {forms.map((form) => (
              <Button
                key={form.id}
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => navigate(`/staff/submit/${form.slug}`)}
              >
                <FileText className="h-5 w-5 mr-3 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-medium">{form.name}</p>
                  <p className="text-xs text-muted-foreground">{form.role} Role</p>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
