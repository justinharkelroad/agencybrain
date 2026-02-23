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
import { listTeamMembersWithLogins, listStaffUsers } from '@/lib/trainingAdminApi';
import {
  listSPAssignments,
  bulkCreateSPAssignments,
  updateSPAssignment,
  deleteSPAssignment,
  listSPContentTree,
  type SPAssignment,
} from '@/lib/spAssignmentAdminApi';
import {
  TrainingContentPicker,
  spTreeToContentNodes,
  selectedToSPItems,
  type SelectedItem,
} from '@/components/training/TrainingContentPicker';

const SP_ASSIGNMENTS_FILTERS_KEY = 'sp_assignments_filters';

interface SPAssignmentsTabProps {
  agencyId: string;
}

export function SPAssignmentsTab({ agencyId }: SPAssignmentsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const getInitialFilters = () => {
    try {
      const saved = sessionStorage.getItem(SP_ASSIGNMENTS_FILTERS_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* empty */ }
    return null;
  };
  const initialFilters = getInitialFilters();

  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [bulkDueDate, setBulkDueDate] = useState<Date | undefined>();

  const [editingAssignment, setEditingAssignment] = useState<SPAssignment | null>(null);
  const [editDueDate, setEditDueDate] = useState<Date | undefined>();
  const [deletingAssignment, setDeletingAssignment] = useState<SPAssignment | null>(null);

  const [filterStaffId, setFilterStaffId] = useState<string>(initialFilters?.filterStaffId || 'all');
  const [filterCategoryId, setFilterCategoryId] = useState<string>(initialFilters?.filterCategoryId || 'all');
  const [filterStatus, setFilterStatus] = useState<string>(initialFilters?.filterStatus || 'all');

  // Persist filters
  useEffect(() => {
    sessionStorage.setItem(SP_ASSIGNMENTS_FILTERS_KEY, JSON.stringify({
      filterStaffId,
      filterCategoryId,
      filterStatus,
    }));
  }, [filterStaffId, filterCategoryId, filterStatus]);

  // Fetch roster with login status
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
      const roster = data.team_members.map((tm: any) => {
        const su = staffUserByTeamMemberId.get(tm.id);
        return {
          id: tm.id,
          name: tm.name,
          email: tm.email,
          role: tm.role,
          status: tm.status,
          staffUser: su || null,
          loginStatus: su ? (su.is_active ? 'active' : 'pending') : 'none',
        };
      });
      return { roster };
    },
    enabled: !!agencyId,
  });
  const roster = rosterData?.roster || [];

  // Staff users for filter dropdown
  const { data: staffUsers } = useQuery({
    queryKey: ['staff-users', agencyId],
    queryFn: () => listStaffUsers(agencyId),
    enabled: !!agencyId,
  });

  // SP content tree for drill-down picker
  const { data: spContentTree } = useQuery({
    queryKey: ['sp-content-tree', agencyId],
    queryFn: () => listSPContentTree(agencyId),
    enabled: !!agencyId,
  });

  // Assignments
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['sp-assignments', agencyId],
    queryFn: () => listSPAssignments(agencyId),
    enabled: !!agencyId,
  });

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      await bulkCreateSPAssignments(
        agencyId,
        selectedStaffIds,
        selectedToSPItems(selectedItems),
        bulkDueDate?.toISOString().split('T')[0],
        user?.id
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sp-assignments'] });
      toast.success('SP assignments created successfully');
      setIsBulkDialogOpen(false);
      setSelectedStaffIds([]);
      setSelectedItems([]);
      setBulkDueDate(undefined);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create SP assignments');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, due_date }: { id: string; due_date: string | null }) => {
      await updateSPAssignment(id, due_date);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sp-assignments'] });
      toast.success('Assignment updated');
      setIsEditDialogOpen(false);
      setEditingAssignment(null);
      setEditDueDate(undefined);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update assignment');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteSPAssignment(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sp-assignments'] });
      toast.success('Assignment removed');
      setIsDeleteDialogOpen(false);
      setDeletingAssignment(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove assignment');
    },
  });

  const getStatusBadge = (assignment: SPAssignment) => {
    const status = assignment.status || 'Not Started';
    // If no status from edge function (owner direct path), compute simple version
    const effectiveStatus = status !== 'Not Started' ? status
      : (assignment.due_date && isPast(new Date(assignment.due_date)) ? 'Overdue' : 'Not Started');

    return (
      <Badge
        variant={
          effectiveStatus === 'Completed' ? 'default' :
          effectiveStatus === 'In Progress' ? 'secondary' :
          effectiveStatus === 'Overdue' ? 'destructive' : 'outline'
        }
      >
        {effectiveStatus}
      </Badge>
    );
  };

  const getAssignmentName = (a: SPAssignment) => {
    if (a.sp_categories?.name) return a.sp_categories.name;
    if (a.sp_modules?.name) return a.sp_modules.name;
    if (a.sp_lessons?.name) return a.sp_lessons.name;
    return 'Unknown';
  };

  const getAssignmentLevel = (a: SPAssignment): string => {
    if (a.level) return a.level;
    if (a.sp_category_id) return 'category';
    if (a.sp_module_id) return 'module';
    if (a.sp_lesson_id) return 'lesson';
    return 'category';
  };

  const filteredAssignments = assignments?.filter(a => {
    if (filterStaffId !== 'all' && a.staff_user_id !== filterStaffId) return false;
    if (filterCategoryId !== 'all') {
      // Direct category match
      if (a.sp_category_id === filterCategoryId) { /* pass */ }
      // Module-level: check if module belongs to this category
      else if (a.sp_module_id) {
        const cat = spContentTree?.find(c => c.sp_modules?.some(m => m.id === a.sp_module_id));
        if (cat?.id !== filterCategoryId) return false;
      }
      // Lesson-level: check if lesson's parent module belongs to this category
      else if (a.sp_lesson_id) {
        const matchesCat = spContentTree?.some(c =>
          c.id === filterCategoryId &&
          c.sp_modules?.some(m => m.sp_lessons?.some(l => l.id === a.sp_lesson_id))
        );
        if (!matchesCat) return false;
      } else {
        return false;
      }
    }
    if (filterStatus !== 'all') {
      const rawStatus = a.status || 'Not Started';
      const effectiveStatus = rawStatus !== 'Not Started' ? rawStatus
        : (a.due_date && isPast(new Date(a.due_date)) ? 'Overdue' : 'Not Started');
      if (effectiveStatus !== filterStatus) return false;
    }
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
    updateMutation.mutate({
      id: editingAssignment.id,
      due_date: editDueDate?.toISOString().split('T')[0] || null,
    });
  };

  const handleDeleteAssignment = () => {
    if (!deletingAssignment) return;
    deleteMutation.mutate(deletingAssignment.id);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">SP Assignments</h2>
          <p className="text-muted-foreground text-sm">Assign Standard Playbook categories to staff members</p>
        </div>
        <Button onClick={() => setIsBulkDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Assign
        </Button>
      </div>

      {/* Filters */}
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
                  {staffUsers?.map((staff: any) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {spContentTree?.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
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

      {/* Assignments Table */}
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
                    No SP assignments found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      {assignment.staff_users?.display_name || assignment.staff_users?.username}
                    </TableCell>
                    <TableCell>{getAssignmentName(assignment)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {getAssignmentLevel(assignment)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(assignment.assigned_at).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      {assignment.due_date ? (
                        new Date(assignment.due_date + 'T12:00:00').toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })
                      ) : (
                        <span className="text-muted-foreground">No due date</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(assignment)}</TableCell>
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Bulk Assign Dialog */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign SP Training</DialogTitle>
            <DialogDescription>
              Select staff members and Standard Playbook categories to create assignments
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label className="mb-2 block">Select Staff Members</Label>
              <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
                {roster.filter((m: any) => m.status === 'active').map((member: any) => {
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
                              id={`sp-staff-${member.id}`}
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
                              htmlFor={`sp-staff-${member.id}`}
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
                            <p>Grant staff portal access first in Training &rarr; Staff Users</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
                {roster.filter((m: any) => m.status === 'active').length === 0 && (
                  <p className="text-sm text-muted-foreground">No team members found</p>
                )}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Select Content to Assign</Label>
              <TrainingContentPicker
                tree={spContentTree ? spTreeToContentNodes(spContentTree) : []}
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
              Change the due date for this SP assignment
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
            <Button onClick={handleEditAssignment} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove SP Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this SP assignment? This action cannot be undone.
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
