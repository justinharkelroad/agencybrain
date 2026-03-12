import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar as CalendarIcon, MoreVertical, Plus, Trash2, Edit, AlertCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  listStaffUsers,
  listAssignments,
  bulkCreateAssignments,
  updateAssignment,
  deleteAssignment,
  getLessonProgressAll,
  listTeamMembersWithLogins,
  getContentTree,
  type TrainingAssignment
} from '@/lib/trainingAdminApi';
import {
  TrainingContentPicker,
  trainingTreeToContentNodes,
  selectedToTrainingItems,
  type SelectedItem,
} from '@/components/training/TrainingContentPicker';

// Session storage key for filter state
const ASSIGNMENTS_FILTERS_KEY = 'training_assignments_filters';

interface TrainingAssignmentsTabProps {
  agencyId: string;
}

export function TrainingAssignmentsTab({ agencyId }: TrainingAssignmentsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Initialize filter state from sessionStorage to survive tab switches
  const getInitialFilters = () => {
    try {
      const saved = sessionStorage.getItem(ASSIGNMENTS_FILTERS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  };
  const initialFilters = getInitialFilters();

  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [bulkDueDate, setBulkDueDate] = useState<Date | undefined>();

  const [editingAssignment, setEditingAssignment] = useState<TrainingAssignment | null>(null);
  const [editDueDate, setEditDueDate] = useState<Date | undefined>();

  const [deletingAssignment, setDeletingAssignment] = useState<TrainingAssignment | null>(null);

  const [filterStaffId, setFilterStaffId] = useState<string>(initialFilters?.filterStaffId || 'all');
  const [filterModuleId, setFilterModuleId] = useState<string>(initialFilters?.filterModuleId || 'all');
  const [filterStatus, setFilterStatus] = useState<string>(initialFilters?.filterStatus || 'all');

  // Persist filter state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(ASSIGNMENTS_FILTERS_KEY, JSON.stringify({
      filterStaffId,
      filterModuleId,
      filterStatus,
    }));
  }, [filterStaffId, filterModuleId, filterStatus]);

  // Fetch roster with staff login status via API
  const { data: rosterData } = useQuery({
    queryKey: ['team-members-with-logins', agencyId],
    queryFn: async () => {
      const data = await listTeamMembersWithLogins(agencyId);
      const staffUserByTeamMemberId = new Map<string, any>();
      for (const su of data.staff_users) {
        if (su.team_member_id && !staffUserByTeamMemberId.has(su.team_member_id)) {
          staffUserByTeamMemberId.set(su.team_member_id, su);
        }
      }
      const roster = data.team_members.map(tm => {
        const su = staffUserByTeamMemberId.get(tm.id);
        return {
          id: tm.id,
          name: tm.name,
          email: tm.email,
          role: tm.role,
          status: tm.status,
          staffUser: su || null,
          loginStatus: su ? (su.is_active ? 'active' : 'pending') : 'none'
        };
      });
      return { roster };
    },
    enabled: !!agencyId,
  });
  const roster = rosterData?.roster || [];

  // Get staff users with active logins for assignments
  const activeStaffRoster = roster.filter(m => m.loginStatus === 'active' && m.staffUser);

  // Fetch staff users (for assignment display - we still need this for existing assignments)
  const { data: staffUsers } = useQuery({
    queryKey: ['staff-users', agencyId],
    queryFn: () => listStaffUsers(agencyId),
    enabled: !!agencyId,
  });

  // Fetch content tree for drill-down picker
  const { data: contentTree } = useQuery({
    queryKey: ['training-content-tree', agencyId],
    queryFn: () => getContentTree(agencyId),
    enabled: !!agencyId,
  });

  // Fetch assignments
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['training-assignments', agencyId],
    queryFn: () => listAssignments(agencyId),
    enabled: !!agencyId,
  });

  // Fetch lesson progress to calculate status
  const { data: lessonProgressData } = useQuery({
    queryKey: ['staff-lesson-progress-all', agencyId],
    queryFn: () => getLessonProgressAll(agencyId),
    enabled: !!agencyId,
  });

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      await bulkCreateAssignments(
        agencyId,
        selectedStaffIds,
        selectedToTrainingItems(selectedItems),
        bulkDueDate ? format(bulkDueDate, 'yyyy-MM-dd') : undefined,
        user?.id
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-assignments'] });
      toast.success('Assignments created successfully');
      setIsBulkDialogOpen(false);
      setSelectedStaffIds([]);
      setSelectedItems([]);
      setBulkDueDate(undefined);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create assignments');
    },
  });

  // Update assignment mutation
  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, due_date }: { id: string; due_date: string | null }) => {
      await updateAssignment(id, due_date);
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
      await deleteAssignment(id);
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

  const getAssignmentName = (a: TrainingAssignment) => {
    if (a.training_categories?.name) return a.training_categories.name;
    if (a.training_modules?.name) return a.training_modules.name;
    if (a.training_lessons?.name) return a.training_lessons.name;
    return 'Unknown';
  };

  const getAssignmentLevel = (a: TrainingAssignment): string => {
    if (a.level) return a.level;
    if (a.category_id) return 'category';
    if (a.module_id) return 'module';
    if (a.lesson_id) return 'lesson';
    return 'module';
  };

  const getStatus = (assignment: TrainingAssignment) => {
    const { progress, lessons, allLessons } = lessonProgressData || {};
    const lessonToModule = new Map(lessons?.map(l => [l.id, l.module_id]));

    const level = getAssignmentLevel(assignment);

    if (level === 'lesson') {
      // Single lesson: check progress row
      const completed = progress?.some(
        p => p.staff_user_id === assignment.staff_user_id && p.lesson_id === assignment.lesson_id && p.completed
      );
      if (completed) return 'Completed';
      if (assignment.due_date && isPast(new Date(assignment.due_date))) return 'Overdue';
      return 'Not Started';
    }

    if (level === 'category') {
      // All lessons in modules belonging to this category
      // Get module IDs for this category from contentTree
      const cat = contentTree?.find(c => c.id === assignment.category_id);
      const moduleIds = cat?.training_modules?.map(m => m.id) || [];
      const totalLessons = allLessons?.filter(l => moduleIds.includes(l.module_id)).length || 0;
      const completedLessons = progress?.filter(p =>
        p.staff_user_id === assignment.staff_user_id &&
        moduleIds.includes(lessonToModule.get(p.lesson_id) || '') &&
        p.completed
      ).length || 0;

      if (totalLessons > 0 && completedLessons >= totalLessons) return 'Completed';
      if (completedLessons > 0) return 'In Progress';
      if (assignment.due_date && isPast(new Date(assignment.due_date))) return 'Overdue';
      return 'Not Started';
    }

    // module level (existing logic)
    if (!assignment.module_id) return 'Not Started';
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

  // Derive flat module list from content tree for filter dropdown
  const allModulesFlat = contentTree?.flatMap(cat =>
    (cat.training_modules || []).map(mod => ({ id: mod.id, name: mod.name, categoryName: cat.name }))
  ) || [];

  const filteredAssignments = assignments?.filter(a => {
    if (filterStaffId !== 'all' && a.staff_user_id !== filterStaffId) return false;
    if (filterModuleId !== 'all') {
      // Direct module match
      if (a.module_id === filterModuleId) { /* pass */ }
      // Lesson-level: check if lesson's parent module matches
      else if (a.lesson_id && a.training_lessons?.module_id === filterModuleId) { /* pass */ }
      // Category-level: check if category contains this module
      else if (a.category_id) {
        const cat = contentTree?.find(c => c.id === a.category_id);
        if (!cat?.training_modules?.some(m => m.id === filterModuleId)) return false;
      } else {
        return false;
      }
    }
    if (filterStatus !== 'all' && getStatus(a) !== filterStatus) return false;
    return true;
  }) || [];

  const handleBulkAssign = () => {
    if (selectedStaffIds.length === 0) {
      toast.error('Please select at least one staff member');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Please select at least one content item');
      return;
    }
    bulkAssignMutation.mutate();
  };

  const handleEditAssignment = () => {
    if (!editingAssignment) return;
    updateAssignmentMutation.mutate({
      id: editingAssignment.id,
      due_date: editDueDate ? format(editDueDate, 'yyyy-MM-dd') : null,
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
          Assign
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
                  {allModulesFlat.map(mod => (
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
                  <SelectItem value="Not Started">Not Started</SelectItem>
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
                <TableHead>Assigned Content</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Assigned Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
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
                      <TableCell>{getAssignmentName(assignment)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {getAssignmentLevel(assignment)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(assignment.assigned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        {assignment.due_date ? (
                          new Date(assignment.due_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
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
            <DialogTitle>Assign Training</DialogTitle>
            <DialogDescription>
              Select staff members and modules to create assignments
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label className="mb-2 block">Select Staff Members</Label>
              <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                {roster.filter(m => m.status === 'active').map(member => {
                  const hasAccess = member.loginStatus === 'active';
                  const staffUserId = member.staffUser?.id;
                  
                  return (
                    <TooltipProvider key={member.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn(
                            "flex items-center gap-2",
                            !hasAccess && "opacity-50"
                          )}>
                            <Checkbox
                              id={`staff-${member.id}`}
                              checked={staffUserId ? selectedStaffIds.includes(staffUserId) : false}
                              onCheckedChange={(checked) => {
                                if (!staffUserId || !hasAccess) return;
                                if (checked) {
                                  setSelectedStaffIds([...selectedStaffIds, staffUserId]);
                                } else {
                                  setSelectedStaffIds(selectedStaffIds.filter(id => id !== staffUserId));
                                }
                              }}
                              disabled={!hasAccess}
                            />
                            <label 
                              htmlFor={`staff-${member.id}`} 
                              className={cn("text-sm cursor-pointer flex items-center gap-2", !hasAccess && "cursor-not-allowed")}
                            >
                              {member.name}
                              {!hasAccess && (
                                <AlertCircle className="h-3 w-3 text-amber-500" />
                              )}
                            </label>
                          </div>
                        </TooltipTrigger>
                        {!hasAccess && (
                          <TooltipContent>
                            <p>Grant staff portal access first in Training → Staff Users</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
                {roster.filter(m => m.status === 'active').length === 0 && (
                  <p className="text-sm text-muted-foreground">No team members found</p>
                )}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Select Content to Assign</Label>
              <TrainingContentPicker
                tree={contentTree ? trainingTreeToContentNodes(contentTree) : []}
                selected={selectedItems}
                onSelectionChange={setSelectedItems}
              />
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
            <DialogDescription className="sr-only">
              Change the due date for this training assignment
            </DialogDescription>
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
