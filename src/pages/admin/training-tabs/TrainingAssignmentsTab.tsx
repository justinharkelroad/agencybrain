import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Calendar as CalendarIcon, MoreVertical, Plus, Trash2, Edit } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TrainingAssignmentsTabProps {
  agencyId: string;
}

export function TrainingAssignmentsTab({ agencyId }: TrainingAssignmentsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [bulkDueDate, setBulkDueDate] = useState<Date | undefined>();
  
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [editDueDate, setEditDueDate] = useState<Date | undefined>();
  
  const [deletingAssignment, setDeletingAssignment] = useState<any>(null);
  
  const [filterStaffId, setFilterStaffId] = useState<string>('all');
  const [filterModuleId, setFilterModuleId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch staff users
  const { data: staffUsers } = useQuery({
    queryKey: ['staff-users', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_users')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('display_name');
      if (error) throw error;
      return data;
    },
    enabled: !!agencyId,
  });

  // Fetch modules
  const { data: modules } = useQuery({
    queryKey: ['training-modules', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_modules')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!agencyId,
  });

  // Fetch assignments
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['training-assignments', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_assignments')
        .select(`
          *,
          staff_users!inner(display_name, username),
          training_modules!inner(name)
        `)
        .eq('agency_id', agencyId)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!agencyId,
  });

  // Fetch lesson progress to calculate status
  const { data: lessonProgressData } = useQuery({
    queryKey: ['staff-lesson-progress-all', agencyId],
    queryFn: async () => {
      const [
        { data: progress, error: progressError },
        { data: lessons, error: lessonsError },
        { data: agencyStaff, error: staffError },
        { data: allLessons, error: allLessonsError }
      ] = await Promise.all([
        supabase.from('staff_lesson_progress').select('staff_user_id, lesson_id, completed'),
        supabase.from('training_lessons').select('id, module_id').eq('agency_id', agencyId),
        supabase.from('staff_users').select('id').eq('agency_id', agencyId),
        supabase.from('training_lessons').select('module_id').eq('agency_id', agencyId)
      ]);

      if (progressError) throw progressError;
      if (lessonsError) throw lessonsError;
      if (staffError) throw staffError;
      if (allLessonsError) throw allLessonsError;

      return { progress, lessons, allLessons, agencyStaff };
    },
    enabled: !!agencyId,
  });

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      const records = [];
      for (const staffId of selectedStaffIds) {
        for (const moduleId of selectedModuleIds) {
          records.push({
            agency_id: agencyId,
            staff_user_id: staffId,
            module_id: moduleId,
            assigned_by: user?.id,
            due_date: bulkDueDate?.toISOString().split('T')[0],
          });
        }
      }
      
      const { error } = await supabase
        .from('training_assignments')
        .insert(records)
        .select();
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-assignments'] });
      toast.success('Assignments created successfully');
      setIsBulkDialogOpen(false);
      setSelectedStaffIds([]);
      setSelectedModuleIds([]);
      setBulkDueDate(undefined);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create assignments');
    },
  });

  // Update assignment mutation
  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, due_date }: { id: string; due_date: string | null }) => {
      const { error } = await supabase
        .from('training_assignments')
        .update({ due_date })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-assignments'] });
      toast.success('Assignment updated');
      setIsEditDialogOpen(false);
      setEditingAssignment(null);
      setEditDueDate(undefined);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update assignment');
    },
  });

  // Delete assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('training_assignments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-assignments'] });
      toast.success('Assignment removed');
      setIsDeleteDialogOpen(false);
      setDeletingAssignment(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove assignment');
    },
  });

  const getStatus = (assignment: any) => {
    if (!assignment.module_id || !assignment.staff_user_id) return 'Not Started';
    
    const { progress, lessons, allLessons } = lessonProgressData || {};
    
    const lessonToModule = new Map(lessons?.map(l => [l.id, l.module_id]));
    const totalLessonsInModule = allLessons?.filter(l => l.module_id === assignment.module_id).length || 0;
    
    const completedLessons = progress?.filter(p => 
      p.staff_user_id === assignment.staff_user_id &&
      lessonToModule.get(p.lesson_id) === assignment.module_id &&
      p.completed
    ).length || 0;
    
    if (totalLessonsInModule > 0 && completedLessons >= totalLessonsInModule) {
      return 'Completed';
    }
    if (completedLessons > 0) {
      return 'In Progress';
    }
    if (assignment.due_date && isPast(new Date(assignment.due_date))) {
      return 'Overdue';
    }
    return 'Not Started';
  };

  const filteredAssignments = assignments?.filter(a => {
    if (filterStaffId !== 'all' && a.staff_user_id !== filterStaffId) return false;
    if (filterModuleId !== 'all' && a.module_id !== filterModuleId) return false;
    if (filterStatus !== 'all' && getStatus(a) !== filterStatus) return false;
    return true;
  }) || [];

  const handleBulkAssign = () => {
    if (selectedStaffIds.length === 0) {
      toast.error('Please select at least one staff member');
      return;
    }
    if (selectedModuleIds.length === 0) {
      toast.error('Please select at least one module');
      return;
    }
    bulkAssignMutation.mutate();
  };

  const handleEditAssignment = () => {
    if (!editingAssignment) return;
    updateAssignmentMutation.mutate({
      id: editingAssignment.id,
      due_date: editDueDate?.toISOString().split('T')[0] || null,
    });
  };

  const handleDeleteAssignment = () => {
    if (!deletingAssignment) return;
    deleteAssignmentMutation.mutate(deletingAssignment.id);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Training Assignments</h2>
          <p className="text-muted-foreground text-sm">Assign training modules to staff members</p>
        </div>
        <Button onClick={() => setIsBulkDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Bulk Assign
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Staff User</Label>
              <Select value={filterStaffId} onValueChange={setFilterStaffId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staffUsers?.map(staff => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Module</Label>
              <Select value={filterModuleId} onValueChange={setFilterModuleId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {modules?.map(mod => (
                    <SelectItem key={mod.id} value={mod.id}>
                      {mod.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Name</TableHead>
                <TableHead>Module Name</TableHead>
                <TableHead>Assigned Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No assignments found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssignments.map((assignment) => {
                  const status = getStatus(assignment);
                  return (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {assignment.staff_users?.display_name}
                      </TableCell>
                      <TableCell>{assignment.training_modules?.name}</TableCell>
                      <TableCell>
                        {format(new Date(assignment.assigned_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {assignment.due_date ? (
                          format(new Date(assignment.due_date), 'MMM d, yyyy')
                        ) : (
                          <span className="text-muted-foreground">No due date</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === 'Completed' ? 'default' :
                            status === 'In Progress' ? 'secondary' :
                            status === 'Overdue' ? 'destructive' : 'outline'
                          }
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditingAssignment(assignment);
                                setEditDueDate(assignment.due_date ? new Date(assignment.due_date) : undefined);
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Due Date
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                setDeletingAssignment(assignment);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Bulk Assign Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Assign Training</DialogTitle>
            <DialogDescription>
              Select staff members and modules to create assignments
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label className="mb-2 block">Select Staff Members</Label>
              <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                {staffUsers?.map(staff => (
                  <div key={staff.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`staff-${staff.id}`}
                      checked={selectedStaffIds.includes(staff.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedStaffIds([...selectedStaffIds, staff.id]);
                        } else {
                          setSelectedStaffIds(selectedStaffIds.filter(id => id !== staff.id));
                        }
                      }}
                    />
                    <label htmlFor={`staff-${staff.id}`} className="text-sm cursor-pointer">
                      {staff.display_name || staff.username}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Select Modules</Label>
              <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                {modules?.map(mod => (
                  <div key={mod.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`mod-${mod.id}`}
                      checked={selectedModuleIds.includes(mod.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedModuleIds([...selectedModuleIds, mod.id]);
                        } else {
                          setSelectedModuleIds(selectedModuleIds.filter(id => id !== mod.id));
                        }
                      }}
                    />
                    <label htmlFor={`mod-${mod.id}`} className="text-sm cursor-pointer">
                      {mod.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Due Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left", !bulkDueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bulkDueDate ? format(bulkDueDate, 'PPP') : 'Select due date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={bulkDueDate} onSelect={setBulkDueDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkAssign} disabled={bulkAssignMutation.isPending}>
              {bulkAssignMutation.isPending ? 'Assigning...' : 'Create Assignments'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Due Date Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Due Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left", !editDueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDueDate ? format(editDueDate, 'PPP') : 'Select due date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={editDueDate} onSelect={setEditDueDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditAssignment} disabled={updateAssignmentMutation.isPending}>
              {updateAssignmentMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this assignment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssignment}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
