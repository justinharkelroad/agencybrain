import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  Plus,
  Calendar,
  Building2,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, nextMonday, differenceInBusinessDays, isBefore, startOfDay } from 'date-fns';

interface Agency {
  id: string;
  name: string;
  slug: string;
}

interface DelegateCandidate {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Assignment {
  id: string;
  agency_id: string;
  assigned_by: string | null;
  delegate_team_member_id: string | null;
  start_date: string;
  end_date: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  agencies: {
    name: string;
    slug: string;
  };
  profiles: {
    full_name: string | null;
  } | null;
  delegate_team_member: {
    name: string;
  } | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  active: 'bg-green-500/15 text-green-600 border-green-500/50 dark:border-green-500/30',
  paused: 'bg-blue-500/15 text-blue-600 border-blue-500/50 dark:border-blue-500/30',
  completed: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
  cancelled: 'bg-red-500/15 text-red-600 border-red-500/50 dark:border-red-500/30',
};

async function fetchDelegateCandidates(agencyId: string): Promise<DelegateCandidate[]> {
  // Show all managers and owners from team_members for this agency
  const { data: teamMembers } = await supabase
    .from('team_members')
    .select('id, name, email, role')
    .eq('agency_id', agencyId)
    .in('role', ['Manager', 'Owner'])
    .eq('status', 'active')
    .order('name');

  return (teamMembers || []).map((tm) => ({
    id: tm.id,
    name: tm.name,
    email: tm.email,
    role: tm.role,
  }));
}

function DelegateInlinePicker({
  assignment,
  onUpdate,
}: {
  assignment: Assignment;
  onUpdate: (delegateId: string | null) => void;
}) {
  const { data: candidates } = useQuery({
    queryKey: ['admin-delegate-candidates', assignment.agency_id],
    queryFn: () => fetchDelegateCandidates(assignment.agency_id),
  });

  return (
    <Select
      value={assignment.delegate_team_member_id || 'none'}
      onValueChange={(value) => onUpdate(value === 'none' ? null : value)}
    >
      <SelectTrigger className="h-8 w-[180px]">
        <SelectValue>
          {assignment.delegate_team_member?.name || (
            <span className="text-muted-foreground flex items-center gap-1">
              <UserRound className="h-3 w-3" />
              None
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No delegate</SelectItem>
        {candidates?.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name} ({c.role})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SEAssignmentsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedDelegate, setSelectedDelegate] = useState<string>('');

  // Fetch all agencies
  const { data: agencies, isLoading: agenciesLoading } = useQuery({
    queryKey: ['admin-agencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name, slug')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Agency[];
    },
  });

  // Fetch delegate candidates for selected agency
  const { data: delegateCandidates } = useQuery({
    queryKey: ['admin-delegate-candidates', selectedAgency],
    enabled: !!selectedAgency,
    queryFn: () => fetchDelegateCandidates(selectedAgency),
  });

  // Fetch assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['admin-se-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_assignments')
        .select(`
          *,
          agencies(name, slug),
          profiles:assigned_by(full_name),
          delegate_team_member:team_members!delegate_team_member_id(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Assignment[];
    },
  });

  // Create assignment mutation
  const createAssignment = useMutation({
    mutationFn: async (params: { agency_id: string; start_date: string; notes: string; delegate_team_member_id?: string; auto_activate?: boolean }) => {
      const { data, error } = await supabase.from('sales_experience_assignments').insert({
        agency_id: params.agency_id,
        assigned_by: user?.id,
        start_date: params.start_date,
        notes: params.notes || null,
        delegate_team_member_id: params.delegate_team_member_id || null,
        status: params.auto_activate ? 'active' : 'pending',
      }).select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Insert blocked by RLS policy. Check admin permissions.');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-se-assignments'] });
      setIsCreateDialogOpen(false);
      setSelectedAgency('');
      setStartDate('');
      setNotes('');
      setSelectedDelegate('');
      toast.success('Assignment created successfully');
    },
    onError: (error: Error) => {
      console.error('Error creating assignment:', error);
      toast.error(`Failed to create assignment: ${error.message}`);
    },
  });

  // Update delegate mutation
  const updateDelegate = useMutation({
    mutationFn: async (params: { id: string; delegate_team_member_id: string | null }) => {
      const { error } = await supabase
        .from('sales_experience_assignments')
        .update({ delegate_team_member_id: params.delegate_team_member_id })
        .eq('id', params.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-se-assignments'] });
      toast.success('Delegate updated');
    },
    onError: (error) => {
      console.error('Error updating delegate:', error);
      toast.error('Failed to update delegate');
    },
  });

  // Update assignment status mutation
  const updateStatus = useMutation({
    mutationFn: async (params: { id: string; status: string }) => {
      const { error } = await supabase
        .from('sales_experience_assignments')
        .update({ status: params.status })
        .eq('id', params.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-se-assignments'] });
      toast.success('Assignment status updated');
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    },
  });

  const handleCreateAssignment = () => {
    if (!selectedAgency || !startDate) {
      toast.error('Please select an agency and start date');
      return;
    }

    // Validate that start date is a Monday
    const selectedDate = new Date(startDate + 'T00:00:00');
    if (selectedDate.getDay() !== 1) {
      toast.error('Start date must be a Monday');
      return;
    }

    // Auto-activate if start date is in the past (arrears mode)
    const isArrears = startingWeekInfo?.isArrears ?? false;

    createAssignment.mutate({
      agency_id: selectedAgency,
      start_date: startDate,
      notes,
      delegate_team_member_id: selectedDelegate && selectedDelegate !== 'none' ? selectedDelegate : undefined,
      auto_activate: isArrears,
    });
  };

  const getNextMonday = () => {
    const monday = nextMonday(new Date());
    return format(monday, 'yyyy-MM-dd');
  };

  // Calculate what week/day they'll be in based on selected start date
  const getStartingWeekInfo = () => {
    if (!startDate) return null;

    const selected = new Date(startDate + 'T00:00:00');
    const today = startOfDay(new Date());

    // If start date is in the future, they'll start at Week 1, Day 1
    if (!isBefore(selected, today)) {
      return { week: 1, day: 1, isArrears: false, businessDays: 0 };
    }

    // Calculate business days since start date
    let businessDays = 0;
    const currentDate = new Date(selected);
    while (currentDate <= today) {
      const dow = currentDate.getDay();
      if (dow !== 0 && dow !== 6) {
        businessDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const week = Math.min(8, Math.max(1, Math.ceil(businessDays / 5)));
    const day = ((businessDays - 1) % 5) + 1;

    return { week, day, isArrears: true, businessDays };
  };

  const startingWeekInfo = getStartingWeekInfo();

  if (assignmentsLoading || agenciesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Agency Assignments</h2>
          <p className="text-sm text-muted-foreground">
            Assign agencies to the 8-Week Sales Experience program
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Assignment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Assignment</DialogTitle>
              <DialogDescription>
                Assign an agency to the 8-Week Sales Experience program
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Agency</Label>
                <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies?.map((agency) => (
                      <SelectItem key={agency.id} value={agency.id}>
                        {agency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date (must be a Monday)</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Next Monday: {getNextMonday()}
                </p>
                {startingWeekInfo && (
                  <div className={`text-sm p-3 rounded-md ${
                    startingWeekInfo.isArrears
                      ? 'bg-amber-500/10 border border-amber-500/30'
                      : 'bg-green-500/15 border border-green-500/50 dark:border-green-500/30'
                  }`}>
                    {startingWeekInfo.isArrears ? (
                      <>
                        <p className="font-medium text-amber-600">Starting in Arrears</p>
                        <p className="text-muted-foreground">
                          They'll start at <strong>Week {startingWeekInfo.week}, Day {startingWeekInfo.day}</strong> ({startingWeekInfo.businessDays} business days in).
                          All prior content will be immediately available.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Assignment will be auto-activated since the start date has passed.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-green-600">Starting Fresh</p>
                        <p className="text-muted-foreground">
                          They'll start at Week 1, Day 1 when the program begins.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this assignment..."
                />
              </div>
              <div className="space-y-2">
                <Label>Delegate (optional)</Label>
                <Select value={selectedDelegate} onValueChange={setSelectedDelegate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a delegate..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No delegate</SelectItem>
                    {delegateCandidates?.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.name} ({candidate.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The delegate will see the full 8-Week Sales Experience dashboard, same as the agency owner.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateAssignment}
                disabled={createAssignment.isPending}
              >
                {createAssignment.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agency</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned By</TableHead>
              <TableHead>Delegate</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No assignments yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              assignments?.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{assignment.agencies.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {assignment.agencies.slug}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(assignment.start_date), 'MMM d, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(assignment.end_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[assignment.status]}>
                      {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {assignment.profiles?.full_name || 'System'}
                  </TableCell>
                  <TableCell>
                    {['pending', 'active'].includes(assignment.status) ? (
                      <DelegateInlinePicker
                        assignment={assignment}
                        onUpdate={(delegateId) =>
                          updateDelegate.mutate({
                            id: assignment.id,
                            delegate_team_member_id: delegateId,
                          })
                        }
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {assignment.delegate_team_member?.name || '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {assignment.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() =>
                            updateStatus.mutate({ id: assignment.id, status: 'active' })
                          }
                        >
                          <Play className="h-3 w-3" />
                          Start
                        </Button>
                      )}
                      {assignment.status === 'active' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() =>
                              updateStatus.mutate({ id: assignment.id, status: 'paused' })
                            }
                          >
                            <Pause className="h-3 w-3" />
                            Pause
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-green-600"
                            onClick={() =>
                              updateStatus.mutate({ id: assignment.id, status: 'completed' })
                            }
                          >
                            <CheckCircle className="h-3 w-3" />
                            Complete
                          </Button>
                        </>
                      )}
                      {assignment.status === 'paused' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() =>
                            updateStatus.mutate({ id: assignment.id, status: 'active' })
                          }
                        >
                          <Play className="h-3 w-3" />
                          Resume
                        </Button>
                      )}
                      {(assignment.status === 'pending' || assignment.status === 'paused') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-red-600"
                          onClick={() =>
                            updateStatus.mutate({ id: assignment.id, status: 'cancelled' })
                          }
                        >
                          <XCircle className="h-3 w-3" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
