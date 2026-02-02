import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
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
  Calendar,
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
  useProfileUsersForFilter,
} from '@/hooks/useOnboardingTasks';
import {
  CustomerTasksGroup,
  groupTasksByCustomer,
} from '@/components/onboarding/CustomerTasksGroup';
import { CompletedTodaySection } from '@/components/onboarding/CompletedTodaySection';
import { ReassignSequenceModal } from '@/components/onboarding/ReassignSequenceModal';
import { SevenDayOutlook } from '@/components/onboarding/SevenDayOutlook';
import { ContactProfileModal } from '@/components/contacts/ContactProfileModal';

interface ReassignState {
  instanceId: string;
  customerName: string;
  pendingCount: number;
}

interface ProfileViewState {
  contactId: string;
  customerName: string;
}

// Composite filter option for unified dropdown
interface ViewFilterOption {
  value: string; // "my", "all", "staff:<uuid>", or "user:<uuid>"
  type: 'my' | 'all' | 'staff' | 'user';
  id?: string;
  label: string;
  badge?: string;
  isSeparator?: boolean;
}

export default function OnboardingTasksPage() {
  const { user, isAdmin, isAgencyOwner, isKeyEmployee } = useAuth();
  // Single dropdown: "my" = my tasks, "all" = all agency, or specific person
  const [viewFilter, setViewFilter] = useState<string>('my');
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [reassignState, setReassignState] = useState<ReassignState | null>(null);
  // Profile sidebar state
  const [profileViewState, setProfileViewState] = useState<ProfileViewState | null>(null);
  // Date filter - when a day is clicked in the outlook
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // Sequence filter - filter by specific sequence
  const [selectedSequence, setSelectedSequence] = useState<string>('all');

  // Fetch user's profile for agency_id
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('agency_id, role, full_name')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get staff users for filter dropdown
  const { data: staffUsers = [] } = useStaffUsersForFilter(profile?.agency_id || null);
  
  // Get profile users (owners/managers) for filter dropdown
  const { data: profileUsers = [] } = useProfileUsersForFilter(profile?.agency_id || null);

  // Build unified view filter options
  const viewFilterOptions = useMemo((): ViewFilterOption[] => {
    const options: ViewFilterOption[] = [
      { value: 'my', type: 'my', label: 'My Tasks' },
      { value: 'all', type: 'all', label: 'All Agency' },
    ];

    // Add separator and team members if there are any
    if (profileUsers.length > 0 || staffUsers.length > 0) {
      // Add profile users (owners/managers)
      for (const p of profileUsers) {
        // Skip the current user (they're already covered by "My Tasks")
        if (p.id === user?.id) continue;

        const label = p.full_name || p.email || 'Unnamed User';
        const badge = p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : undefined;
        options.push({
          value: `user:${p.id}`,
          type: 'user',
          id: p.id,
          label,
          badge,
        });
      }

      // Add staff users
      for (const staff of staffUsers) {
        const label = staff.display_name || staff.username;
        options.push({
          value: `staff:${staff.id}`,
          type: 'staff',
          id: staff.id,
          label,
          badge: 'Staff',
        });
      }
    }

    return options;
  }, [staffUsers, profileUsers, user?.id]);

  // Determine the assignee filters based on current selection
  const { assigneeId, assigneeUserId, showAssigneeColumn } = useMemo(() => {
    if (viewFilter === 'my') {
      // My Tasks - filter to current user
      return { assigneeId: undefined, assigneeUserId: user?.id, showAssigneeColumn: false };
    }

    if (viewFilter === 'all') {
      // All Agency - no filter, show assignee column
      return { assigneeId: undefined, assigneeUserId: undefined, showAssigneeColumn: true };
    }

    // Specific person selected
    const [type, id] = viewFilter.split(':') as ['staff' | 'user', string];
    if (type === 'staff') {
      return { assigneeId: id, assigneeUserId: undefined, showAssigneeColumn: false };
    } else {
      return { assigneeId: undefined, assigneeUserId: id, showAssigneeColumn: false };
    }
  }, [viewFilter, user?.id]);

  // Fetch tasks
  const {
    activeTasks,
    completedTodayTasks,
    isLoading: tasksLoading,
    error: tasksError,
    refetch,
  } = useOnboardingTasksToday({
    agencyId: profile?.agency_id || null,
    assigneeId,
    assigneeUserId,
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

  // Extract unique sequences from tasks for filter dropdown
  const availableSequences = useMemo(() => {
    const sequenceMap = new Map<string, { id: string; name: string }>();
    for (const task of activeTasks) {
      const seq = task.instance?.sequence;
      if (seq && !sequenceMap.has(seq.id)) {
        sequenceMap.set(seq.id, { id: seq.id, name: seq.name });
      }
    }
    return Array.from(sequenceMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeTasks]);

  // Filter tasks by selected date and sequence
  const filteredTasks = useMemo(() => {
    let filtered = activeTasks;

    // Filter by date if selected
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      filtered = filtered.filter(task => {
        const taskDate = task.due_date.split('T')[0];
        return taskDate === dateStr;
      });
    }

    // Filter by sequence if selected
    if (selectedSequence !== 'all') {
      filtered = filtered.filter(task => task.instance?.sequence?.id === selectedSequence);
    }

    return filtered;
  }, [activeTasks, selectedDate, selectedSequence]);

  // Group filtered tasks by customer
  const groupedTasks = useMemo(
    () => groupTasksByCustomer(filteredTasks),
    [filteredTasks]
  );

  // Auto-collapse if more than 1 customer
  const shouldAutoCollapse = groupedTasks.size > 1;

  // Handle day click in outlook
  const handleDayClick = (date: Date) => {
    // Toggle - click same date to deselect
    if (selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const overdue = activeTasks.filter(t => t.status === 'overdue').length;
    const dueToday = activeTasks.filter(t => t.status === 'due').length;
    const upcoming = activeTasks.filter(t => t.status === 'pending').length;
    const completedToday = completedTodayTasks.length;

    return { overdue, dueToday, upcoming, completedToday };
  }, [activeTasks, completedTodayTasks]);

  const isLoading = profileLoading || tasksLoading;
  // Managers, owners, key employees, and admins can view all agency tasks
  const canViewAllAgency = isAdmin || isAgencyOwner || isKeyEmployee;
  // Only owners and admins can reassign sequences
  const canReassign = isAdmin || isAgencyOwner;

  // Handle reassign button click
  const handleReassign = (instanceId: string, customerName: string, pendingCount: number) => {
    setReassignState({ instanceId, customerName, pendingCount });
  };

  // Handle view profile button click
  const handleViewProfile = (contactId: string, customerName: string) => {
    setProfileViewState({ contactId, customerName });
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
          <h1 className="text-2xl font-bold">Your Sequence Queue</h1>
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
        <Card className={stats.overdue > 0 ? 'border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-500/10' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${stats.overdue > 0 ? 'bg-red-100 dark:bg-red-500/20' : 'bg-muted'}`}>
                <AlertCircle className={`h-4 w-4 ${stats.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={stats.dueToday > 0 ? 'border-blue-300 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-500/10' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${stats.dueToday > 0 ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-muted'}`}>
                <CalendarClock className={`h-4 w-4 ${stats.dueToday > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.dueToday}</p>
                <p className="text-xs text-muted-foreground">Due Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-muted">
                <Workflow className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.upcoming}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={stats.completedToday > 0 ? 'border-green-200 dark:border-green-500/30 bg-green-50/50 dark:bg-green-500/10' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${stats.completedToday > 0 ? 'bg-green-100 dark:bg-green-500/20' : 'bg-muted'}`}>
                <CheckCircle2 className={`h-4 w-4 ${stats.completedToday > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completedToday}</p>
                <p className="text-xs text-muted-foreground">Done Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Dropdowns - above the week view */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {/* View/Assignee Filter */}
        {canViewAllAgency && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Viewing:</span>
            <Select value={viewFilter} onValueChange={setViewFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {viewFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.type === 'my' && <User className="h-4 w-4 text-muted-foreground" />}
                      {option.type === 'all' && <Users className="h-4 w-4 text-muted-foreground" />}
                      {(option.type === 'staff' || option.type === 'user') && (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{option.label}</span>
                      {option.badge && (
                        <Badge variant="secondary" className="text-xs ml-1">
                          {option.badge}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sequence Filter */}
        {availableSequences.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sequence:</span>
            <Select value={selectedSequence} onValueChange={setSelectedSequence}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-muted-foreground" />
                    <span>All Sequences</span>
                  </div>
                </SelectItem>
                {availableSequences.map((seq) => (
                  <SelectItem key={seq.id} value={seq.id}>
                    <div className="flex items-center gap-2">
                      <Workflow className="h-4 w-4 text-muted-foreground" />
                      <span>{seq.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* This Week Outlook */}
      {!isLoading && (
        <SevenDayOutlook
          tasks={activeTasks}
          onDayClick={handleDayClick}
          selectedDate={selectedDate}
        />
      )}

      {/* Date Filter Indicator */}
      {selectedDate && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm">
            Showing tasks for <strong>{format(selectedDate, 'EEEE, MMM d')}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 ml-auto text-xs"
            onClick={() => setSelectedDate(null)}
          >
            Clear filter
          </Button>
        </div>
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

      {/* Empty State - when filters show no results */}
      {!isLoading && !tasksError && (selectedDate || selectedSequence !== 'all') && filteredTasks.length === 0 && activeTasks.length > 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Calendar className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-base font-medium mb-1">
                No tasks match your filters
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedDate && `No tasks on ${format(selectedDate, 'EEEE, MMM d')}`}
                {selectedDate && selectedSequence !== 'all' && ' for this sequence'}
                {!selectedDate && selectedSequence !== 'all' && 'No tasks for this sequence'}
                .{' '}
                <button
                  className="text-primary underline hover:no-underline"
                  onClick={() => {
                    setSelectedDate(null);
                    setSelectedSequence('all');
                  }}
                >
                  Clear filters
                </button>{' '}
                to see all tasks.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State - no tasks at all */}
      {!isLoading && !tasksError && !selectedDate && selectedSequence === 'all' && activeTasks.length === 0 && completedTodayTasks.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Workflow className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No tasks</h3>
              <p className="text-sm text-muted-foreground">
                {viewFilter === 'all'
                  ? 'No onboarding tasks in your agency.'
                  : viewFilter === 'my'
                    ? 'You have no assigned onboarding tasks.'
                    : 'No onboarding tasks for this team member.'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Tasks are created when you apply a sequence to a sale.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Groups */}
      {!isLoading && filteredTasks.length > 0 && (
        <div className="space-y-4 mb-6">
          {/* Show collapse hint when auto-collapsing */}
          {shouldAutoCollapse && (
            <p className="text-xs text-muted-foreground">
              {groupedTasks.size} customers shown • Click to expand each group
            </p>
          )}
          {Array.from(groupedTasks.entries()).map(([customerName, tasks]) => (
            <CustomerTasksGroup
              key={customerName}
              customerName={customerName}
              tasks={tasks}
              onCompleteTask={handleCompleteTask}
              completingTaskId={completingTaskId}
              showAssignee={showAssigneeColumn}
              canReassign={canReassign}
              onReassign={handleReassign}
              onViewProfile={handleViewProfile}
              defaultExpanded={!shouldAutoCollapse}
            />
          ))}
        </div>
      )}

      {/* Completed Today Section */}
      {!isLoading && completedTodayTasks.length > 0 && (
        <CompletedTodaySection
          tasks={completedTodayTasks}
          showAssignee={showAssigneeColumn}
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

      {/* Contact Profile Sidebar */}
      <ContactProfileModal
        contactId={profileViewState?.contactId || null}
        open={!!profileViewState}
        onClose={() => setProfileViewState(null)}
        agencyId={profile?.agency_id || null}
        displayName={profile?.full_name || user?.email || undefined}
        defaultSourceModule="manual"
        userId={user?.id}
        onActivityLogged={() => refetch()}
      />
    </div>
  );
}
