import React, { useState, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerTaskGroup } from "@/components/prototype/CustomerTaskGroup";
import { CompletedTodaySection } from "@/components/prototype/CompletedTodaySection";
import { TaskCompletionModal } from "@/components/prototype/TaskCompletionModal";
import { AddQuotedHouseholdModal } from "@/components/prototype/AddQuotedHouseholdModal";
import { OnboardingTask, TaskStatus, ActionType } from "@/components/prototype/TaskCard";
import { Button } from "@/components/ui/button";
import { ListTodo, Users, AlertTriangle, Clock, CalendarDays, Workflow, X, Plus } from "lucide-react";

// Mock data for prototype
const mockTeamMembers = [
  { id: 'user-1', name: 'Sarah Johnson' },
  { id: 'user-2', name: 'Mike Chen' },
  { id: 'user-3', name: 'Emily Davis' },
  { id: 'user-4', name: 'Ted Smith' },
];

const currentUser = mockTeamMembers[0]; // Pretend logged-in user is Sarah

function generateMockTasks(): OnboardingTask[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const inThreeDays = new Date(today);
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  const inFiveDays = new Date(today);
  inFiveDays.setDate(inFiveDays.getDate() + 5);

  return [
    // =============================================
    // JOHN SMITH - Has TWO sequences running:
    // 1. "New Auto Policy" (original onboarding)
    // 2. "Home Bundle Upsell" (cross-sell sequence)
    // =============================================

    // John Smith - New Auto Policy sequence (overdue)
    {
      id: 'task-1',
      customerName: 'John Smith',
      customerPhone: '(555) 123-4567',
      customerEmail: 'john.smith@email.com',
      title: 'Welcome Call - Introduce yourself and confirm policy details',
      description: 'Make initial welcome call to introduce yourself as their agent and confirm all policy details are correct.',
      actionType: 'call',
      dueDate: twoDaysAgo,
      status: 'overdue',
      assignedTo: 'Sarah Johnson',
      sequenceName: 'New Auto Policy',
      script: 'Hi [Customer Name], this is [Your Name] from [Agency]. I wanted to personally welcome you...',
    },
    {
      id: 'task-2',
      customerName: 'John Smith',
      customerPhone: '(555) 123-4567',
      title: 'Send Welcome Email with Documents',
      description: 'Email welcome packet with ID cards, policy declarations, and important contact information.',
      actionType: 'email',
      dueDate: yesterday,
      status: 'overdue',
      assignedTo: 'Sarah Johnson',
      sequenceName: 'New Auto Policy',
    },

    // John Smith - Home Bundle Upsell sequence (assigned to TED SMITH, not Sarah)
    {
      id: 'task-11',
      customerName: 'John Smith',
      customerPhone: '(555) 123-4567',
      title: 'Bundle Opportunity Call - Discuss home insurance',
      description: 'Call to discuss bundling auto with home insurance for additional savings.',
      actionType: 'call',
      dueDate: today,
      status: 'due_today',
      assignedTo: 'Ted Smith',  // Different assignee!
      sequenceName: 'Home Bundle Upsell',
    },
    {
      id: 'task-12',
      customerName: 'John Smith',
      customerPhone: '(555) 123-4567',
      title: 'Send Bundle Quote Comparison',
      description: 'Email comparison showing savings with bundled home + auto policy.',
      actionType: 'email',
      dueDate: inThreeDays,
      status: 'upcoming',
      assignedTo: 'Ted Smith',  // Different assignee!
      sequenceName: 'Home Bundle Upsell',
    },

    // John Smith - New Auto Policy sequence (due today)
    {
      id: 'task-4',
      customerName: 'John Smith',
      customerPhone: '(555) 123-4567',
      title: 'Text Reminder - Set Up Auto-Pay',
      description: 'Send text reminder to set up automatic payments to avoid lapses.',
      actionType: 'text',
      dueDate: today,
      status: 'due_today',
      assignedTo: 'Sarah Johnson',
      sequenceName: 'New Auto Policy',
    },

    // =============================================
    // OTHER CUSTOMERS - Single sequences
    // =============================================

    {
      id: 'task-3',
      customerName: 'Maria Garcia',
      customerPhone: '(555) 234-5678',
      title: 'Follow-up Call - Answer Questions',
      description: 'Check in to see if they have any questions about their coverage.',
      actionType: 'call',
      dueDate: yesterday,
      status: 'overdue',
      assignedTo: 'Mike Chen',
      sequenceName: 'New Auto Policy',
    },
    {
      id: 'task-6',
      customerName: 'Maria Garcia',
      customerPhone: '(555) 234-5678',
      title: 'Send Coverage Summary',
      description: 'Email detailed coverage summary and review next steps.',
      actionType: 'email',
      dueDate: today,
      status: 'due_today',
      assignedTo: 'Mike Chen',
      sequenceName: 'New Auto Policy',
    },
    {
      id: 'task-5',
      customerName: 'Robert Wilson',
      customerPhone: '(555) 345-6789',
      customerEmail: 'rwilson@email.com',
      title: 'Welcome Call - New Auto Policy',
      description: 'Welcome call for new auto policy customer.',
      actionType: 'call',
      dueDate: today,
      status: 'due_today',
      assignedTo: 'Sarah Johnson',
      sequenceName: 'New Auto Policy',
    },
    {
      id: 'task-7',
      customerName: 'Robert Wilson',
      customerPhone: '(555) 345-6789',
      title: 'Day 3: Check-in Text',
      description: 'Quick text to check if they received their ID cards.',
      actionType: 'text',
      dueDate: inThreeDays,
      status: 'upcoming',
      assignedTo: 'Sarah Johnson',
      sequenceName: 'New Auto Policy',
    },
    {
      id: 'task-8',
      customerName: 'Robert Wilson',
      customerPhone: '(555) 345-6789',
      title: 'Day 5: Review Call',
      description: 'Schedule call to review coverage and discuss any bundling opportunities.',
      actionType: 'call',
      dueDate: inFiveDays,
      status: 'upcoming',
      assignedTo: 'Sarah Johnson',
      sequenceName: 'New Auto Policy',
    },
    {
      id: 'task-9',
      customerName: 'Lisa Thompson',
      customerPhone: '(555) 456-7890',
      customerEmail: 'lisa.t@email.com',
      title: 'Welcome Call - Home Policy',
      description: 'Initial welcome call for new homeowners policy.',
      actionType: 'call',
      dueDate: tomorrow,
      status: 'upcoming',
      assignedTo: 'Emily Davis',
      sequenceName: 'New Home Policy',
    },
    {
      id: 'task-10',
      customerName: 'Lisa Thompson',
      customerPhone: '(555) 456-7890',
      title: 'Send Home Insurance Tips',
      description: 'Email helpful home insurance tips and claims process guide.',
      actionType: 'email',
      dueDate: inThreeDays,
      status: 'upcoming',
      assignedTo: 'Emily Davis',
      sequenceName: 'New Home Policy',
    },
  ];
}

type StatusFilter = 'all' | 'overdue' | 'due_today' | 'upcoming' | 'completed';

export default function OnboardingTasksPrototype() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<OnboardingTask[]>(generateMockTasks);
  const [showAllAgencyTasks, setShowAllAgencyTasks] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sequenceFilter, setSequenceFilter] = useState<string | null>(null);

  // Modal state for task completion
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<OnboardingTask | null>(null);

  // Modal state for adding quoted household
  const [addHouseholdModalOpen, setAddHouseholdModalOpen] = useState(false);

  // Toggle status filter - click to filter, click again to show all
  const toggleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(current => current === status ? 'all' : status);
  };

  // Handle customer name click - would open contact sidebar in production
  const handleCustomerClick = (customerName: string) => {
    toast({
      title: "Contact Sidebar",
      description: `Would open activity timeline for ${customerName}`,
    });
  };

  // Handle sequence filter click
  const handleSequenceClick = (sequenceName: string) => {
    setSequenceFilter(current => current === sequenceName ? null : sequenceName);
  };

  // Handle task completion - show modal for calls, direct complete for others
  const handleCompleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Calls require notes via modal
    if (task.actionType === 'call') {
      setTaskToComplete(task);
      setCompletionModalOpen(true);
    } else {
      // Non-calls complete directly
      completeTask(taskId);
    }
  };

  // Actually complete the task (called directly or from modal)
  const completeTask = (taskId: string, notes?: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, status: 'completed' as TaskStatus, completedAt: new Date() }
          : task
      )
    );

    if (notes) {
      toast({
        title: "Task Completed",
        description: `Notes saved: "${notes.substring(0, 50)}${notes.length > 50 ? '...' : ''}"`,
      });
    }
  };

  // Modal confirmation handler
  const handleModalConfirm = (taskId: string, notes: string) => {
    completeTask(taskId, notes);
    setCompletionModalOpen(false);
    setTaskToComplete(null);
  };

  // Handle adding a quoted household
  const handleAddHousehold = (data: any) => {
    toast({
      title: "Quoted Household Added",
      description: data.applySequence
        ? `${data.customerName} added with "${mockSequences.find((s: any) => s.id === data.sequenceId)?.name || 'sequence'}" sequence`
        : `${data.customerName} added without sequence`,
    });
    setAddHouseholdModalOpen(false);
  };

  // Mock sequences for the modal (same as in the modal component)
  const mockSequences = [
    { id: 'seq-1', name: 'New Auto Policy' },
    { id: 'seq-2', name: 'New Home Policy' },
    { id: 'seq-3', name: 'Home Bundle Upsell' },
    { id: 'seq-4', name: 'Life Insurance Follow-up' },
  ];

  // Filter tasks based on view mode, assignee, and status filter
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter by view mode (My Tasks vs All Agency Tasks)
    if (!showAllAgencyTasks) {
      result = result.filter(task => task.assignedTo === currentUser.name);
    }

    // Filter by selected assignee (only in agency view)
    if (showAllAgencyTasks && selectedAssignee !== 'all') {
      result = result.filter(task => task.assignedTo === selectedAssignee);
    }

    return result;
  }, [tasks, showAllAgencyTasks, selectedAssignee]);

  // Apply status and sequence filters for display (separate from filteredTasks to keep stats accurate)
  const displayTasks = useMemo(() => {
    let result = filteredTasks;

    if (statusFilter !== 'all') {
      result = result.filter(task => task.status === statusFilter);
    }

    if (sequenceFilter) {
      result = result.filter(task => task.sequenceName === sequenceFilter);
    }

    return result;
  }, [filteredTasks, statusFilter, sequenceFilter]);

  // Separate active and completed tasks (using displayTasks for filtered view)
  // When filtering by "completed", show completed tasks in main view instead of separate section
  const isShowingCompletedFilter = statusFilter === 'completed';
  const activeTasks = isShowingCompletedFilter
    ? displayTasks  // Show all (which are all completed when this filter is active)
    : displayTasks.filter(t => t.status !== 'completed');
  const completedTodayTasks = isShowingCompletedFilter
    ? []  // Hide the separate section when filtering by completed
    : displayTasks.filter(t => t.status === 'completed');

  // Group tasks by customer
  const tasksByCustomer = useMemo(() => {
    const grouped: Record<string, OnboardingTask[]> = {};

    // Sort tasks: overdue first, then due_today, then upcoming, then completed
    const sortedTasks = [...activeTasks].sort((a, b) => {
      const statusOrder = { overdue: 0, due_today: 1, upcoming: 2, completed: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });

    sortedTasks.forEach(task => {
      if (!grouped[task.customerName]) {
        grouped[task.customerName] = [];
      }
      grouped[task.customerName].push(task);
    });

    // Sort customers by urgency (those with overdue tasks first)
    const sortedEntries = Object.entries(grouped).sort((a, b) => {
      const aHasOverdue = a[1].some(t => t.status === 'overdue');
      const bHasOverdue = b[1].some(t => t.status === 'overdue');
      if (aHasOverdue && !bHasOverdue) return -1;
      if (!aHasOverdue && bHasOverdue) return 1;

      const aHasDueToday = a[1].some(t => t.status === 'due_today');
      const bHasDueToday = b[1].some(t => t.status === 'due_today');
      if (aHasDueToday && !bHasDueToday) return -1;
      if (!aHasDueToday && bHasDueToday) return 1;

      return 0;
    });

    return sortedEntries;
  }, [activeTasks]);

  // Calculate stats
  const stats = useMemo(() => {
    const overdue = filteredTasks.filter(t => t.status === 'overdue').length;
    const dueToday = filteredTasks.filter(t => t.status === 'due_today').length;
    const upcoming = filteredTasks.filter(t => t.status === 'upcoming').length;
    const completedToday = filteredTasks.filter(t => t.status === 'completed').length;
    return { overdue, dueToday, upcoming, completedToday };
  }, [filteredTasks]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Workflow className="w-6 h-6 text-primary" />
              Onboarding Sequences
            </h1>
            <p className="text-muted-foreground mt-1">
              {showAllAgencyTasks ? 'All agency onboarding tasks' : 'Your assigned onboarding tasks'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {/* Add Quoted Household Button */}
            <Button onClick={() => setAddHouseholdModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Quoted Household
            </Button>

            {/* Manager View Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="agency-view"
                checked={showAllAgencyTasks}
                onCheckedChange={setShowAllAgencyTasks}
              />
              <Label htmlFor="agency-view" className="text-sm cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  All Agency Tasks
                </div>
              </Label>
            </div>

            {/* Assignee Filter (only in agency view) */}
            {showAllAgencyTasks && (
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  {mockTeamMembers.map(member => (
                    <SelectItem key={member.id} value={member.name}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Stats Cards - Clickable Filters */}
        <div className="grid grid-cols-4 gap-4">
          <Card
            className={cn(
              'cursor-pointer transition-all hover:scale-[1.02]',
              statusFilter === 'overdue' && 'ring-2 ring-red-500 ring-offset-2 ring-offset-background',
              stats.overdue > 0 ? 'border-red-500/30 bg-red-500/5' : ''
            )}
            onClick={() => toggleStatusFilter('overdue')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${stats.overdue > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">Overdue</span>
              </div>
              <p className={`text-2xl font-semibold mt-1 ${stats.overdue > 0 ? 'text-red-500' : ''}`}>
                {stats.overdue}
              </p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'cursor-pointer transition-all hover:scale-[1.02]',
              statusFilter === 'due_today' && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background',
              stats.dueToday > 0 ? 'border-blue-500/30 bg-blue-500/5' : ''
            )}
            onClick={() => toggleStatusFilter('due_today')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${stats.dueToday > 0 ? 'text-blue-500' : 'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">Due Today</span>
              </div>
              <p className={`text-2xl font-semibold mt-1 ${stats.dueToday > 0 ? 'text-blue-500' : ''}`}>
                {stats.dueToday}
              </p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'cursor-pointer transition-all hover:scale-[1.02]',
              statusFilter === 'upcoming' && 'ring-2 ring-purple-500 ring-offset-2 ring-offset-background',
              stats.upcoming > 0 ? 'border-purple-500/30 bg-purple-500/5' : ''
            )}
            onClick={() => toggleStatusFilter('upcoming')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CalendarDays className={`w-4 h-4 ${stats.upcoming > 0 ? 'text-purple-500' : 'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">This Week</span>
              </div>
              <p className={`text-2xl font-semibold mt-1 ${stats.upcoming > 0 ? 'text-purple-500' : ''}`}>
                {stats.upcoming}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Future tasks</p>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'cursor-pointer transition-all hover:scale-[1.02]',
              statusFilter === 'completed' && 'ring-2 ring-green-500 ring-offset-2 ring-offset-background',
              stats.completedToday > 0 ? 'border-green-500/30 bg-green-500/5' : ''
            )}
            onClick={() => toggleStatusFilter('completed')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ListTodo className={`w-4 h-4 ${stats.completedToday > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">Done Today</span>
              </div>
              <p className={`text-2xl font-semibold mt-1 ${stats.completedToday > 0 ? 'text-green-500' : ''}`}>
                {stats.completedToday}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Active Filters Indicator */}
        {sequenceFilter && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-sm text-muted-foreground">Filtering by sequence:</span>
            <Badge variant="outline" className="font-medium">
              {sequenceFilter}
            </Badge>
            <button
              onClick={() => setSequenceFilter(null)}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Task List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tasks by Customer</CardTitle>
            <CardDescription>
              {showAllAgencyTasks
                ? "You can view all tasks but can only complete your own"
                : "Click the checkbox to mark tasks as completed"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tasksByCustomer.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ListTodo className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  {statusFilter !== 'all' ? `No ${statusFilter.replace('_', ' ')} tasks` : 'No pending tasks'}
                </p>
                <p className="text-sm mt-1">
                  {statusFilter !== 'all'
                    ? 'Click the card again to show all tasks'
                    : 'Great job! All tasks are completed.'}
                </p>
              </div>
            ) : (
              tasksByCustomer.map(([customerName, customerTasks]) => (
                <CustomerTaskGroup
                  key={customerName}
                  customerName={customerName}
                  tasks={customerTasks}
                  onCompleteTask={handleCompleteTask}
                  onCustomerClick={handleCustomerClick}
                  onSequenceClick={handleSequenceClick}
                  currentUserName={currentUser.name}
                  showAssignee={showAllAgencyTasks}
                />
              ))
            )}

            {/* Completed Today Section */}
            <CompletedTodaySection
              tasks={completedTodayTasks}
              showAssignee={showAllAgencyTasks}
              currentUserName={currentUser.name}
            />
          </CardContent>
        </Card>

        {/* Prototype Notice */}
        <div className="text-center text-xs text-muted-foreground/50 py-4">
          <p>UI Prototype - No database connection. Using mock data.</p>
          <p className="mt-1">Navigate to: <code className="bg-muted px-1 py-0.5 rounded">/prototype/onboarding-tasks</code></p>
        </div>
      </div>

      {/* Task Completion Modal (required notes for calls) */}
      <TaskCompletionModal
        task={taskToComplete}
        open={completionModalOpen}
        onOpenChange={setCompletionModalOpen}
        onConfirm={handleModalConfirm}
      />

      {/* Add Quoted Household Modal */}
      <AddQuotedHouseholdModal
        open={addHouseholdModalOpen}
        onOpenChange={setAddHouseholdModalOpen}
        onSubmit={handleAddHousehold}
      />
    </div>
  );
}
