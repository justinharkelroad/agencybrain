import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface RoleplaySession {
  id: string;
  staff_name: string;
  overall_score: number | null;
  completed_at: string | null;
  pdf_file_path: string | null;
}

export default function StaffRoleplayReports() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useStaffAuth();
  const { isManager, loading: permissionsLoading } = useStaffPermissions();
  const [sessions, setSessions] = useState<RoleplaySession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect non-managers
    if (!permissionsLoading && !isManager) {
      navigate('/staff/dashboard');
    }
  }, [isManager, permissionsLoading, navigate]);

  useEffect(() => {
    const fetchRoleplaySessions = async () => {
      if (!user?.agency_id || !isManager) return;

      try {
        const token = localStorage.getItem('staff_session_token');
        const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
          body: { type: 'roleplay' },
          headers: token ? { 'x-staff-session': token } : {}
        });

        if (error) throw error;
        setSessions(data?.sessions || []);
      } catch (err) {
        console.error('Error fetching roleplay sessions:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isManager && user?.agency_id) {
      fetchRoleplaySessions();
    }
  }, [user?.agency_id, isManager]);

  const handleDownloadPDF = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('roleplay-reports')
        .createSignedUrl(filePath, 3600);
      
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      console.error('Error downloading PDF:', err);
    }
  };

  if (authLoading || permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isManager) {
    return null;
  }

  const getScoreBadgeVariant = (score: number | null) => {
    if (score === null) return 'secondary';
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roleplay Reports</h1>
        <p className="text-muted-foreground">View your team's roleplay training sessions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Team Sessions ({sessions.length})
          </CardTitle>
          <CardDescription>
            Completed roleplay training sessions from your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No roleplay sessions found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.staff_name}</TableCell>
                      <TableCell>
                        {session.overall_score !== null ? (
                          <Badge variant={getScoreBadgeVariant(session.overall_score)}>
                            {session.overall_score}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {session.completed_at
                          ? new Date(session.completed_at).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {session.pdf_file_path && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPDF(session.pdf_file_path!)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
