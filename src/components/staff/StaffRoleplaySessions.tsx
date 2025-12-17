import { useState, useEffect } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, TrendingUp, Award, ThumbsUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface RoleplaySession {
  id: string;
  staff_name: string;
  staff_email: string;
  completed_at: string;
  overall_score: string;
  pdf_file_path: string;
}

export function StaffRoleplaySessions() {
  const { user, sessionToken } = useStaffAuth();
  const [sessions, setSessions] = useState<RoleplaySession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      if (!sessionToken || user?.role !== 'Manager') {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
          headers: { 'x-staff-session': sessionToken },
          body: { type: 'roleplay' },
        });

        if (error) {
          console.error('Error fetching roleplay sessions:', error);
        } else if (data?.roleplay_sessions) {
          setSessions(data.roleplay_sessions);
        }
      } catch (err) {
        console.error('Error fetching roleplay sessions:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSessions();
  }, [sessionToken, user?.role]);

  // Only render for managers
  if (user?.role !== 'Manager') {
    return null;
  }

  const handleDownloadPDF = async (session: RoleplaySession) => {
    try {
      const { data, error } = await supabase.storage
        .from('roleplay-pdfs')
        .download(session.pdf_file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roleplay-${session.staff_name.replace(/\s+/g, '-')}-${format(new Date(session.completed_at), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download PDF');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Team Roleplay Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  // Calculate stats
  const stats = {
    total: sessions.length,
    excellent: sessions.filter(s => s.overall_score === 'Excellent').length,
    good: sessions.filter(s => s.overall_score === 'Good').length,
    needsImprovement: sessions.filter(s => s.overall_score === 'Needs Improvement').length,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Team Roleplay Sessions
        </CardTitle>
        <CardDescription>Recent sales training roleplay performance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground">Excellent</p>
              <p className="text-xl font-bold text-green-600">{stats.excellent}</p>
            </div>
            <Award className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground">Good</p>
              <p className="text-xl font-bold text-blue-600">{stats.good}</p>
            </div>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground">Needs Work</p>
              <p className="text-xl font-bold text-amber-600">{stats.needsImprovement}</p>
            </div>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Sessions Table */}
        {sessions.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Score</th>
                  <th className="px-3 py-2 text-right font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 5).map((session) => (
                  <tr key={session.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{session.staff_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {format(new Date(session.completed_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-3 py-2">
                      <Badge 
                        variant={
                          session.overall_score === 'Excellent' ? 'default' :
                          session.overall_score === 'Good' ? 'secondary' : 'outline'
                        }
                        className="text-xs"
                      >
                        {session.overall_score}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadPDF(session)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            No roleplay sessions completed yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
