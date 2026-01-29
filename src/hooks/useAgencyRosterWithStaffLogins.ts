import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamMemberWithLogin {
  // Team member fields (source of truth)
  id: string; // team_member.id
  name: string;
  email: string | null;
  role: string;
  status: string; // team member status (active/inactive)
  
  // Staff login overlay
  staffUser: {
    id: string;
    username: string;
    display_name: string | null;
    email: string | null;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
  } | null;
  
  // Computed login status
  loginStatus: 'active' | 'pending' | 'none';
}

export interface OrphanStaffUser {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export function useAgencyRosterWithStaffLogins(agencyId: string | null) {
  return useQuery({
    queryKey: ['agency-roster-with-logins', agencyId],
    queryFn: async () => {
      if (!agencyId) return { roster: [], orphanStaffUsers: [] };

      // Fetch team members and staff users in parallel
      const [teamMembersRes, staffUsersRes] = await Promise.all([
        supabase
          .from('team_members')
          .select('id, name, email, role, status')
          .eq('agency_id', agencyId)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('staff_users')
          .select('id, username, display_name, email, is_active, last_login_at, created_at, team_member_id')
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false })
      ]);

      if (teamMembersRes.error) throw teamMembersRes.error;
      if (staffUsersRes.error) throw staffUsersRes.error;

      const teamMembers = teamMembersRes.data || [];
      const staffUsers = staffUsersRes.data || [];

      // Build a map of team_member_id -> staff_user
      const staffUserByTeamMemberId = new Map<string, typeof staffUsers[0]>();
      const orphanStaffUsers: OrphanStaffUser[] = [];

      for (const su of staffUsers) {
        if (su.team_member_id) {
          // If multiple staff users link to same team member, keep the first (most recent)
          if (!staffUserByTeamMemberId.has(su.team_member_id)) {
            staffUserByTeamMemberId.set(su.team_member_id, su);
          }
        } else {
          // Orphan staff user (no team_member_id)
          orphanStaffUsers.push({
            id: su.id,
            username: su.username,
            display_name: su.display_name,
            email: su.email,
            is_active: su.is_active,
            last_login_at: su.last_login_at,
            created_at: su.created_at
          });
        }
      }

      // Build merged roster
      const roster: TeamMemberWithLogin[] = teamMembers.map(tm => {
        const su = staffUserByTeamMemberId.get(tm.id);
        
        let loginStatus: 'active' | 'pending' | 'none' = 'none';
        if (su) {
          loginStatus = su.is_active ? 'active' : 'pending';
        }

        return {
          id: tm.id,
          name: tm.name,
          email: tm.email,
          role: tm.role,
          status: tm.status,
          staffUser: su ? {
            id: su.id,
            username: su.username,
            display_name: su.display_name,
            email: su.email,
            is_active: su.is_active,
            last_login_at: su.last_login_at,
            created_at: su.created_at
          } : null,
          loginStatus
        };
      });

      return { roster, orphanStaffUsers };
    },
    enabled: !!agencyId,
  });
}
