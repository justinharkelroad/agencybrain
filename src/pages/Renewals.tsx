import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import type { RenewalUploadContext } from '@/types/renewal';

export default function Renewals() {
  const { user } = useAuth();
  const [uploadContext, setUploadContext] = useState<RenewalUploadContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchContext() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('agency_id, full_name')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Failed to fetch profile:', error);
          setIsLoading(false);
          return;
        }

        if (profile?.agency_id) {
          setUploadContext({
            agencyId: profile.agency_id,
            userId: user.id,
            staffMemberId: null, // Will be populated in Phase 2 for staff portal
            displayName: profile.full_name || user.email || 'Unknown',
          });
        }
      } catch (err) {
        console.error('Error fetching context:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchContext();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!uploadContext) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need to be logged in and associated with an agency to access renewals.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <RefreshCw className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Renewals</h1>
          <p className="text-muted-foreground">
            Manage upcoming policy renewals and retention efforts
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 1 Complete</CardTitle>
          <CardDescription>
            Database tables, types, parser, and upload hook are ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Phase 2 will add the full UI including:
          </p>
          <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Excel file upload modal</li>
            <li>Renewal records list with filters</li>
            <li>Record detail cards with activity tracking</li>
            <li>Staff portal edge function support</li>
            <li>Status management and assignment</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
