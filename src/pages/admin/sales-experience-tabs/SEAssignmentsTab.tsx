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
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, nextMonday } from 'date-fns';

interface Agency {
  id: string;
  name: string;
  slug: string;
}

interface Assignment {
  id: string;
  agency_id: string;
  assigned_by: string | null;
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
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  active: 'bg-green-500/10 text-green-600 border-green-500/30',
  paused: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  completed: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/30',
};

export function SEAssignmentsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

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

  // Fetch assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['admin-se-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_experience_assignments')
        .select(`
          *,
          agencies(name, slug),
          profiles:assigned_by(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Assignment[];
    },
  });

  // Create assignment mutation
  const createAssignment = useMutation({
    mutationFn: async (params: { agency_id: string; start_date: string; notes: string }) => {
      const { error } = await supabase.from('sales_experience_assignments').insert({
        agency_id: params.agency_id,
        assigned_by: user?.id,
        start_date: params.start_date,
        notes: params.notes || null,
        status: 'pending',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-se-assignments'] });
      setIsCreateDialogOpen(false);
      setSelectedAgency('');
      setStartDate('');
      setNotes('');
      toast.success('Assignment created successfully');
    },
    onError: (error) => {
      console.error('Error creating assignment:', error);
      toast.error('Failed to create assignment');
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

    createAssignment.mutate({
      agency_id: selectedAgency,
      start_date: startDate,
      notes,
    });
  };

  const getNextMonday = () => {
    const monday = nextMonday(new Date());
    return format(monday, 'yyyy-MM-dd');
  };

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
                  min={getNextMonday()}
                />
                <p className="text-xs text-muted-foreground">
                  Next Monday: {getNextMonday()}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this assignment..."
                />
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
