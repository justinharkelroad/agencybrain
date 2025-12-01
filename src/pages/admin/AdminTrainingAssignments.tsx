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
import { format, isPast, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AdminTrainingAssignments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Fetch user's agency_id from profile
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
  
  const agencyId = profile?.agency_id;
  
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

  // Fetch progress to calculate status
  const { data: progressData } = useQuery({
    queryKey: ['staff-training-progress-all', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_training_progress')
        .select('*')
        .eq('agency_id', agencyId);
      if (error) throw error;
      return data;
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

  // Backfill existing progress mutation
  const backfillMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Fetch all necessary data in separate queries
      const [
        { data: allProgress, error: progressError },
        { data: lessons, error: lessonsError },
        { data: staffUsers, error: staffError },
        { data: existingAssignments, error: assignmentError }
      ] = await Promise.all([
        supabase.from('staff_lesson_progress').select('staff_user_id, lesson_id'),
        supabase.from('training_lessons').select('id, module_id, agency_id'),
        supabase.from('staff_users').select('id, agency_id').eq('agency_id', agencyId),
        supabase.from('training_assignments').select('staff_user_id, module_id').eq('agency_id', agencyId)
      ]);

      if (progressError) throw progressError;
      if (lessonsError) throw lessonsError;
      if (staffError) throw staffError;
      if (assignmentError) throw assignmentError;

      // Step 2: Join data in JavaScript
      const lessonToModule = new Map<string, { module_id: string; agency_id: string }>(
        lessons?.map(l => [l.id, { module_id: l.module_id, agency_id: l.agency_id }])
      );
      const staffAgencyMap = new Map(staffUsers?.map(s => [s.id, s.agency_id]));

      // Filter progress to current agency staff only
      const agencyProgress = allProgress?.filter(p => staffAgencyMap.has(p.staff_user_id));

      // Find unique staff_user_id + module_id combinations from progress
      const progressCombos = new Set<string>();
      agencyProgress?.forEach(p => {
        const lesson = lessonToModule.get(p.lesson_id);
        if (lesson && lesson.agency_id === agencyId) {
          progressCombos.add(`${p.staff_user_id}|${lesson.module_id}`);
        }
      });

      // Find which don't have assignments
      const existingSet = new Set(
        existingAssignments?.map(a => `${a.staff_user_id}|${a.module_id}`)
      );
      const missingAssignments = [...progressCombos]
        .filter(combo => !existingSet.has(combo))
        .map(combo => {
          const [staff_user_id, module_id] = combo.split('|');
          return {
            agency_id: agencyId,
            staff_user_id,
            module_id,
            assigned_by: user?.id,
            assigned_at: new Date().toISOString(),
          };
        });

      // Step 3: Insert missing assignments
      if (missingAssignments.length === 0) {
        return { count: 0 };
      }

      const { error: insertError } = await supabase
        .from('training_assignments')
        .insert(missingAssignments);

      if (insertError) throw insertError;

      return { count: missingAssignments.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['training-assignments'] });
      const count = data?.count || 0;
      if (count === 0) {
        toast.info('No missing assignments found');
      } else {
        toast.success(`Backfilled ${count} assignment${count === 1 ? '' : 's'}`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to backfill assignments');
    },
  });

  const getStatus = (assignment: any) => {
    if (!assignment.module_id || !assignment.staff_user_id) return 'In Progress';
    
    // Check if all lessons in the module are completed
    const moduleProgress = progressData?.filter(
      p => p.staff_user_id === assignment.staff_user_id
    ) || [];
    
    // For simplicity, if any progress exists for this staff user, consider it in progress
    // A full implementation would check all lessons in the module
    const hasProgress = moduleProgress.length > 0;
    const isComplete = moduleProgress.some(p => p.completed);
    
    if (isComplete) return 'Completed';
    if (assignment.due_date && isPast(new Date(assignment.due_date))) return 'Overdue';
    return 'In Progress';
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Training Assignments</h1>
          <p className="text-muted-foreground">Assign training modules to staff members</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
          >
            {backfillMutation.isPending ? 'Backfilling...' : 'Backfill Existing Progress'}
          </Button>
          <Button onClick={() => setIsBulkDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Bulk Assign
          </Button>
        </div>
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
                          status === 'Overdue' ? 'destructive' :
                          'secondary'
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
                            onClick={() => {
                              setEditingAssignment(assignment);
                              setEditDueDate(assignment.due_date ? new Date(assignment.due_date) : undefined);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Due Date
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setDeletingAssignment(assignment);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Assignment
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
      </Card>

      {/* Bulk Assign Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Assign Training</DialogTitle>
            <DialogDescription>
              Assign modules to multiple staff members at once
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div>
              <Label>Select Staff Members</Label>
              <div className="mt-2 space-y-2 border rounded-lg p-4 max-h-48 overflow-y-auto">
                {staffUsers?.map(staff => (
                  <div key={staff.id} className="flex items-center space-x-2">
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
                    <label
                      htmlFor={`staff-${staff.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {staff.display_name} ({staff.username})
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Select Modules</Label>
              <div className="mt-2 space-y-2 border rounded-lg p-4 max-h-48 overflow-y-auto">
                {modules?.map(module => (
                  <div key={module.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`module-${module.id}`}
                      checked={selectedModuleIds.includes(module.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedModuleIds([...selectedModuleIds, module.id]);
                        } else {
                          setSelectedModuleIds(selectedModuleIds.filter(id => id !== module.id));
                        }
                      }}
                    />
                    <label
                      htmlFor={`module-${module.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {module.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Due Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal mt-2',
                      !bulkDueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bulkDueDate ? format(bulkDueDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={bulkDueDate}
                    onSelect={setBulkDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssign} disabled={bulkAssignMutation.isPending}>
              {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Due Date Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Due Date</DialogTitle>
            <DialogDescription>
              Update the due date for this assignment
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal mt-2',
                    !editDueDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {editDueDate ? format(editDueDate, 'PPP') : 'No due date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={editDueDate}
                  onSelect={setEditDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditAssignment} disabled={updateAssignmentMutation.isPending}>
              {updateAssignmentMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this training assignment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAssignment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAssignmentMutation.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
