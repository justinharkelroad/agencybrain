import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatDateLocal } from "@/lib/utils";
import { User, Building2, Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";

interface ChallengeAssignment {
  id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  timezone: string;
  created_at: string;
  staff_users: {
    id: string;
    display_name: string | null;
    email: string;
  } | null;
  challenge_products: {
    name: string;
  } | null;
  agencies: {
    name: string;
  } | null;
}

export function ChallengeAssignmentsTab() {
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["challenge-assignments-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenge_assignments")
        .select(`
          id,
          status,
          start_date,
          end_date,
          timezone,
          created_at,
          staff_users (
            id,
            display_name,
            email
          ),
          challenge_products (
            name
          ),
          agencies (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ChallengeAssignment[];
    },
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-primary"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>;
      case 'completed':
        return <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Stats
  const activeCount = assignments?.filter(a => a.status === 'active').length || 0;
  const completedCount = assignments?.filter(a => a.status === 'completed').length || 0;
  const pendingCount = assignments?.filter(a => a.status === 'pending').length || 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl">{completedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Assignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Assignments</CardTitle>
          <CardDescription>View and manage challenge assignments</CardDescription>
        </CardHeader>
        <CardContent>
          {!assignments || assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No challenge assignments yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Challenge</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {assignment.staff_users?.display_name || 'Unknown'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {assignment.staff_users?.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {assignment.agencies?.name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>{assignment.challenge_products?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDateLocal(assignment.start_date)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
