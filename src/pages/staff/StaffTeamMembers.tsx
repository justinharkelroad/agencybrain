import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useStaffPermissions } from '@/hooks/useStaffPermissions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Mail, Phone as PhoneIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
}

export default function StaffTeamMembers() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useStaffAuth();
  const { isManager, loading: permissionsLoading } = useStaffPermissions();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect non-managers
    if (!permissionsLoading && !isManager) {
      navigate('/staff/dashboard');
    }
  }, [isManager, permissionsLoading, navigate]);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!user?.agency_id || !isManager) return;

      try {
        const token = localStorage.getItem('staff_session_token');
        const { data, error } = await supabase.functions.invoke('get_staff_team_data', {
          body: { type: 'team_members' },
          headers: token ? { 'x-staff-session': token } : {}
        });

        if (error) throw error;
        setTeamMembers(data?.team_members || []);
      } catch (err) {
        console.error('Error fetching team members:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isManager && user?.agency_id) {
      fetchTeamMembers();
    }
  }, [user?.agency_id, isManager]);

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

  const getRoleBadgeVariant = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'manager': return 'default';
      case 'sales': return 'secondary';
      case 'service': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Members</h1>
        <p className="text-muted-foreground">View your team members</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team ({teamMembers.length})
          </CardTitle>
          <CardDescription>
            Active team members in your agency
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No team members found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.email ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.phone ? (
                          <span className="flex items-center gap-1 text-sm">
                            <PhoneIcon className="h-3 w-3" />
                            {member.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                          {member.status}
                        </Badge>
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
