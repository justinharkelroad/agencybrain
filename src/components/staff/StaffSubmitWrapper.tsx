import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, FileText } from 'lucide-react';

interface FormTemplate {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function StaffSubmitWrapper() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useStaffAuth();
  
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const teamMemberRole = user?.role || null;

  useEffect(() => {
    async function loadFormsForUser() {
      if (!user?.agency_id || !user?.team_member_id || !user?.role) return;

      try {
        setLoading(true);
        setError(null);

        // Get forms matching agency + role
        const roles = user.role === 'Hybrid' 
          ? ['Sales', 'Service', 'Hybrid']
          : [user.role, 'Hybrid'];

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

        // If exactly one form, auto-navigate
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user?.team_member_id) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Account Not Linked</AlertTitle>
          <AlertDescription>
            Your staff account is not linked to a team member. Please contact your administrator to set up your account before submitting forms.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Forms Available</AlertTitle>
          <AlertDescription>
            There are no forms available for your role ({teamMemberRole}). Please contact your administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Multiple forms - show selection
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
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
              variant="flat"
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
  );
}
