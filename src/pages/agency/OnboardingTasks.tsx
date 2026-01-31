import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Workflow,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Users,
  User,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useOnboardingTasksToday,
  useCompleteOnboardingTask,
  useStaffUsersForFilter,
} from '@/hooks/useOnboardingTasks';
import {
  CustomerTasksGroup,
  groupTasksByCustomer,
} from '@/components/onboarding/CustomerTasksGroup';
import { CompletedTodaySection } from '@/components/onboarding/CompletedTodaySection';
import { ReassignSequenceModal } from '@/components/onboarding/ReassignSequenceModal';

interface ReassignState {
  instanceId: string;
  customerName: string;
  pendingCount: number;
}

export default function OnboardingTasksPage() {
  const { user, isAdmin, isAgencyOwner } = useAuth();
  const [showAllAgency, setShowAllAgency] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [reassignState, setReassignState] = useState<ReassignState | null>(null);

  // Fetch user's profile for agency_id
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('agency_id, role')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get the user's linked staff_user_id (if any)
  // NOTE: linked_profile_id column doesn't exist on staff_users table yet
  // This feature is disabled until the column is created
  const { data: linkedStaffUser } = useQuery({
    queryKey: ['linked-staff-user', user?.id, profile?.agency_id],
    queryFn: async () => {
      // DISABLED: linked_profile_id column doesn't exist on staff_users table
      // Return null - user will see "No linked staff account" message
      return null;
    },
    enabled: false, // Disabled until linked_profile_id column is created
  });

  // Get staff users for filter dropdown
  const { data: staffUsers = [] } = useStaffUsersForFilter(profile?.agency_id || null);

  // Track if user has no linked staff account (for "My Tasks" mode)
  const hasNoLinkedStaffUser = !linkedStaffUser?.id && profile?.agency_id;

  // Determine the assignee filter
  const assigneeFilter = useMemo(() => {
    if (showAllAgency) {
      return selectedAssignee === 'all' ? null : selectedAssignee;
    }
    // If not showing all agency, show the user's linked staff user tasks
    // If no linked staff user, use a placeholder UUID that won't match any tasks
    // This prevents showing all agency tasks when user has no staff account
    return linkedStaffUser?.id || '00000000-0000-0000-0000-000000000000';
  }, [showAllAgency, selectedAssignee, linkedStaffUser?.id]);

  // Fetch tasks
  const {
    activeTasks,
    completedTodayTasks,
    isLoading: tasksLoading,
    error: tasksError,
    refetch,
  } = useOnboardingTasksToday({
    agencyId: profile?.agency_id || null,
    assigneeId: assigneeFilter,
  });

  // Complete task mutation
  const completeTask = useCompleteOnboardingTask();

  const handleCompleteTask = async (taskId: string, notes?: string) => {
    setCompletingTaskId(taskId);
    try {
      await completeTask.mutateAsync({ taskId, notes });
      toast.success('Task completed!');
    } catch (error: any) {
      console.error('Error completing task:', error);
      toast.error(error.message || 'Failed to complete task');
    } finally {
      setCompletingTaskId(null);
    }
  };

  // Group active tasks by customer
  const groupedTasks = useMemo(
    () => groupTasksByCustomer(activeTasks),
    [activeTasks]
  );

  // Calculate stats
  const stats = useMemo(() => {
    const overdue = activeTasks.filter(t => t.status === 'overdue').length;
    const dueToday = activeTasks.filter(t => t.status === 'due').length;
    const upcoming = activeTasks.filter(t => t.status === 'pending').length;
    const completedToday = completedTodayTasks.length;

    return { overdue, dueToday, upcoming, completedToday };
  }, [activeTasks, completedTodayTasks]);

  const isLoading = profileLoading || tasksLoading;
  // Managers, owners, and admins can view all agency tasks
  const canViewAllAgency = isAdmin || isAgencyOwner;
  // Only owners and admins can reassign sequences
  const canReassign = isAdmin || isAgencyOwner;

  // Handle reassign button click
  const handleReassign = (instanceId: string, customerName: string, pendingCount: number) => {
    setReassignState({ instanceId, customerName, pendingCount });
  };

  // Get instance info for the reassign modal
  const reassignInstance = reassignState ? {
    id: reassignState.instanceId,
    customer_name: reassignState.customerName,
    assigned_to_staff_user_id: activeTasks.find(t => t.instance_id === reassignState.instanceId)?.assigned_to_staff_user_id || null,
    sequence: activeTasks.find(t => t.instance_id === reassignState.instanceId)?.instance?.sequence || null,
  } : null;

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Workflow className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Onboarding Tasks</h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className={stats.overdue > 0 ? 'border-red-300 bg-red-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className={`h-5 w-5 ${stats.overdue > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-2xl font-bold">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={stats.dueToday > 0 ? 'border-blue-300 bg-blue-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className={`h-5 w-5 ${stats.dueToday > 0 ? 'text-blue-500' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-2xl font-bold">{stats.dueToday}</p>
                <p className="text-xs text-muted-foreground">Due Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.upcoming}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={stats.completedToday > 0 ? 'border-green-300 bg-green-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`h-5 w-5 ${stats.completedToday > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-2xl font-bold">{stats.completedToday}</p>
                <p className="text-xs text-muted-foreground">Done Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {canViewAllAgency && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              {/* My Tasks / All Agency Toggle */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="view-toggle" className="text-sm">
                    My Tasks
                  </Label>
                </div>
                <Switch
                  id="view-toggle"
                  checked={showAllAgency}
                  onCheckedChange={setShowAllAgency}
                />
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="view-toggle" className="text-sm">
                    All Agency
                  </Label>
                </div>
              </div>

              {/* Assignee Filter (only when viewing all agency) */}
              {showAllAgency && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Filter by:</Label>
                  <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All team members" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All team members</SelectItem>
                      {staffUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.display_name || user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {tasksError && (
        <Card className="mb-6 border-red-300 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <p className="flex-1">Failed to load tasks: {tasksError.message}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !tasksError && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !tasksError && activeTasks.length === 0 && completedTodayTasks.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Workflow className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No tasks</h3>
              <p className="text-sm text-muted-foreground">
                {showAllAgency
                  ? 'No onboarding tasks in your agency.'
                  : hasNoLinkedStaffUser
                    ? 'Your account is not linked to a staff user. Tasks can only be assigned to staff users.'
                    : 'You have no assigned onboarding tasks.'}
              </p>
              {!hasNoLinkedStaffUser && (
                <p className="text-sm text-muted-foreground mt-2">
                  Tasks are created when you apply a sequence to a sale.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Groups */}
      {!isLoading && activeTasks.length > 0 && (
        <div className="space-y-4 mb-6">
          {Array.from(groupedTasks.entries()).map(([customerName, tasks]) => (
            <CustomerTasksGroup
              key={customerName}
              customerName={customerName}
              tasks={tasks}
              onCompleteTask={handleCompleteTask}
              completingTaskId={completingTaskId}
              showAssignee={showAllAgency}
              canReassign={canReassign}
              onReassign={handleReassign}
            />
          ))}
        </div>
      )}

      {/* Completed Today Section */}
      {!isLoading && completedTodayTasks.length > 0 && (
        <CompletedTodaySection
          tasks={completedTodayTasks}
          showAssignee={showAllAgency}
        />
      )}

      {/* Reassign Modal */}
      <ReassignSequenceModal
        open={!!reassignState}
        onOpenChange={(open) => !open && setReassignState(null)}
        instance={reassignInstance}
        agencyId={profile?.agency_id || ''}
        pendingTaskCount={reassignState?.pendingCount || 0}
        onSuccess={() => {
          setReassignState(null);
          refetch();
        }}
      />
    </div>
  );
}
