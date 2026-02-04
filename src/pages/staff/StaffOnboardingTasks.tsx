import { useState, useMemo, useEffect } from 'react';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import {
  useStaffOnboardingTasks,
  useCompleteStaffOnboardingTask,
  type StaffOnboardingTask,
} from '@/hooks/useStaffOnboardingTasks';
import { useCreateAdhocTask } from '@/hooks/useCreateAdhocTask';
import { useScheduleAdhocTask } from '@/hooks/useScheduleAdhocTask';
import { ScheduleTaskDialog } from '@/components/onboarding/ScheduleTaskDialog';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Phone,
  MessageSquare,
  Mail,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  List,
  Grid3X3,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  CalendarClock,
  Workflow,
  RefreshCw,
  Zap,
  Plus,
} from 'lucide-react';
import { format, parseISO, isToday, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { SevenDayOutlook } from '@/components/onboarding/SevenDayOutlook';
import { MonthlyTaskCalendar } from '@/components/onboarding/MonthlyTaskCalendar';
import { ContactProfileModal } from '@/components/contacts/ContactProfileModal';
import { TaskCompleteDialog } from '@/components/onboarding/TaskCompleteDialog';
import type { ActionType } from '@/hooks/useStaffOnboardingTasks';
import type { OnboardingTask } from '@/hooks/useOnboardingTasks';

type CalendarViewType = 'week' | 'month';

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  other: MoreHorizontal,
};

const ACTION_COLORS: Record<ActionType, string> = {
  call: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-500/20',
  text: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20',
  email: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20',
  other: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-500/20',
};

const ACTION_LABELS: Record<ActionType, string> = {
  call: 'Call',
  text: 'Text',
  email: 'Email',
  other: 'Task',
};

function getStatusStyles(task: StaffOnboardingTask): {
  border: string;
  bg: string;
  badge: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  if (task.status === 'completed') {
    return {
      border: 'border-gray-200 dark:border-gray-700',
      bg: 'bg-gray-50 dark:bg-gray-800/50',
      badge: 'Completed',
      badgeVariant: 'secondary',
    };
  }

  const dueDate = parseISO(task.due_date);

  if (task.status === 'overdue' || (isPast(dueDate) && !isToday(dueDate))) {
    return {
      border: 'border-red-300 dark:border-red-500/50 border-2',
      bg: 'bg-red-50 dark:bg-red-500/10',
      badge: 'Overdue',
      badgeVariant: 'destructive',
    };
  }

  if (isToday(dueDate) || task.status === 'due') {
    return {
      border: 'border-blue-300 dark:border-blue-500/50 border-2',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      badge: 'Due Today',
      badgeVariant: 'default',
    };
  }

  return {
    border: 'border-gray-200 dark:border-gray-700',
    bg: 'bg-white dark:bg-card',
    badge: 'Upcoming',
    badgeVariant: 'outline',
  };
}

interface FollowUpData {
  dueDate: Date;
  actionType: ActionType;
  title: string;
}

interface StaffTaskCardProps {
  task: StaffOnboardingTask;
  onComplete: (taskId: string, notes?: string, followUp?: FollowUpData) => Promise<void>;
  isCompleting?: boolean;
  onViewProfile?: (contactId: string, customerName: string) => void;
}

/**
 * Get customer name from task - handles both instance-based and adhoc tasks
 */
function getCustomerName(task: StaffOnboardingTask): string {
  if (task.instance?.customer_name) {
    return task.instance.customer_name;
  }
  if (task.contact) {
    const firstName = task.contact.first_name || '';
    const lastName = task.contact.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'Unknown';
  }
  return 'Unknown';
}

/**
 * Get contact ID from task - handles both instance-based and adhoc tasks
 */
function getContactId(task: StaffOnboardingTask): string | null {
  return task.contact_id || task.instance?.contact_id || null;
}

/**
 * Get customer phone from task - handles both instance-based and adhoc tasks
 */
function getCustomerPhone(task: StaffOnboardingTask): string | null {
  return task.instance?.customer_phone || task.contact?.phone || null;
}

/**
 * Get customer email from task - handles both instance-based and adhoc tasks
 */
function getCustomerEmail(task: StaffOnboardingTask): string | null {
  return task.instance?.customer_email || task.contact?.email || null;
}

function StaffTaskCard({ task, onComplete, isCompleting = false, onViewProfile }: StaffTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  const ActionIcon = ACTION_ICONS[task.action_type] || MoreHorizontal;
  const actionColor = ACTION_COLORS[task.action_type] || ACTION_COLORS.other;
  const actionLabel = ACTION_LABELS[task.action_type] || 'Task';
  const statusStyles = getStatusStyles(task);

  const handleCheckboxChange = () => {
    if (completing || isCompleting) return;
    // For call tasks, show the dialog to require notes
    if (task.action_type === 'call') {
      setShowCompleteDialog(true);
    } else {
      // For other tasks, complete immediately
      handleQuickComplete();
    }
  };

  const handleQuickComplete = async () => {
    if (completing || isCompleting) return;
    setCompleting(true);
    try {
      await onComplete(task.id);
    } finally {
      setCompleting(false);
    }
  };

  const handleComplete = async (taskId: string, notes?: string, followUp?: FollowUpData) => {
    if (completing || isCompleting) return;
    setCompleting(true);
    try {
      await onComplete(taskId, notes, followUp);
    } finally {
      setCompleting(false);
    }
  };

  const dueDate = parseISO(task.due_date);
  const isTaskCompleting = completing || isCompleting;
  const contactId = getContactId(task);
  const customerName = getCustomerName(task);
  const customerPhone = getCustomerPhone(task);
  const customerEmail = getCustomerEmail(task);
  const isAdhoc = task.is_adhoc === true;

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        statusStyles.border,
        statusStyles.bg,
        isTaskCompleting && 'opacity-50'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="pt-0.5">
            {isTaskCompleting ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Checkbox
                checked={task.status === 'completed'}
                disabled={task.status === 'completed' || isTaskCompleting}
                onCheckedChange={handleCheckboxChange}
                className="h-5 w-5"
              />
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Action Type Icon */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn('p-1.5 rounded-md', actionColor)}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{actionLabel}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Title */}
              <h4
                className={cn(
                  'font-medium text-sm flex-1',
                  task.status === 'completed' && 'line-through text-muted-foreground'
                )}
              >
                {task.title}
              </h4>

              {/* Status Badge */}
              <Badge variant={statusStyles.badgeVariant} className="text-xs">
                {statusStyles.badge}
              </Badge>
            </div>

            {/* Meta Info */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              {/* Customer Name - Clickable */}
              {onViewProfile && contactId ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="font-medium text-foreground hover:text-primary hover:underline cursor-pointer transition-colors"
                  onClick={() => onViewProfile(contactId, customerName)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onViewProfile(contactId, customerName);
                    }
                  }}
                >
                  {customerName}
                </span>
              ) : (
                <span className="font-medium text-foreground">{customerName}</span>
              )}

              {/* Due Date */}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(dueDate, 'MMM d')}
              </span>

              {/* Day Number - hide for adhoc tasks */}
              {!isAdhoc && <span>Day {task.day_number}</span>}

              {/* Sequence Name or Ad-hoc badge */}
              {isAdhoc ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  Ad-hoc
                </Badge>
              ) : task.instance?.sequence && (
                <span className="text-muted-foreground/70">{task.instance.sequence.name}</span>
              )}
            </div>

            {/* Description & Script (Expandable) */}
            {(task.description || task.script_template) && (
              <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 px-2 mt-2 text-xs">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 mr-1" />
                    ) : (
                      <ChevronRight className="h-3 w-3 mr-1" />
                    )}
                    {task.script_template ? 'View Script' : 'View Details'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {task.description && (
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  )}
                  {task.script_template && (
                    <div className="bg-muted/50 rounded-md p-3">
                      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                        <FileText className="h-3 w-3" />
                        Script
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{task.script_template}</p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Contact Info Quick Actions */}
            {task.status !== 'completed' && (customerPhone || customerEmail) && (
              <div className="flex items-center gap-2 mt-2">
                {customerPhone && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                          <a href={`tel:${customerPhone}`}>
                            <Phone className="h-3 w-3 mr-1" />
                            {customerPhone}
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Click to call</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {customerEmail && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                          <a href={`mailto:${customerEmail}`}>
                            <Mail className="h-3 w-3 mr-1" />
                            Email
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{customerEmail}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}

            {/* Completed Info */}
            {task.status === 'completed' && task.completed_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Completed {format(parseISO(task.completed_at), 'MMM d, h:mm a')}
              </p>
            )}
          </div>
        </div>
      </CardContent>

      {/* Complete Task Dialog (for call tasks that require notes) */}
      <TaskCompleteDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        taskId={task.id}
        taskTitle={task.title}
        customerName={customerName}
        actionType={task.action_type}
        onComplete={handleComplete}
        contactId={contactId || undefined}
      />
    </Card>
  );
}

// Group tasks by customer
function groupTasksByCustomer(tasks: StaffOnboardingTask[]) {
  const groups: Map<string, { customerName: string; contactId: string | null; tasks: StaffOnboardingTask[] }> = new Map();

  for (const task of tasks) {
    const customerName = getCustomerName(task);
    const contactId = getContactId(task);
    const key = customerName || 'Unknown Customer';
    if (!groups.has(key)) {
      groups.set(key, { customerName: key, contactId: contactId, tasks: [] });
    }
    groups.get(key)!.tasks.push(task);
  }

  // Sort groups by priority (has overdue first, then due today, then by customer name)
  return Array.from(groups.values()).sort((a, b) => {
    const aHasOverdue = a.tasks.some((t) => t.status === 'overdue');
    const bHasOverdue = b.tasks.some((t) => t.status === 'overdue');
    if (aHasOverdue !== bHasOverdue) return aHasOverdue ? -1 : 1;

    const aHasDue = a.tasks.some((t) => t.status === 'due');
    const bHasDue = b.tasks.some((t) => t.status === 'due');
    if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;

    return a.customerName.localeCompare(b.customerName);
  });
}

// Completed Today Section
function CompletedTodaySection({
  tasks,
  onComplete,
  onViewProfile,
}: {
  tasks: StaffOnboardingTask[];
  onComplete: (taskId: string) => Promise<void>;
  onViewProfile?: (contactId: string, customerName: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="border border-green-200 dark:border-green-500/30 rounded-lg bg-green-50/30 dark:bg-green-500/10">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto hover:bg-green-50/50 dark:hover:bg-green-500/15"
          >
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}

              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-700 dark:text-green-400">Completed Today</span>
              </div>
            </div>

            <Badge variant="secondary" className="bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </Badge>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-3">
            {tasks.map((task) => (
              <StaffTaskCard key={task.id} task={task} onComplete={onComplete} onViewProfile={onViewProfile} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface ProfileViewState {
  contactId: string;
  customerName: string;
}

export default function StaffOnboardingTasks() {
  const { user, sessionToken } = useStaffAuth();
  const { activeTasks, completedTodayTasks, stats, isLoading, error, refetch } =
    useStaffOnboardingTasks();
  const completeTask = useCompleteStaffOnboardingTask();
  const createAdhocTask = useCreateAdhocTask();
  const { toast } = useToast();

  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  // Date filter - when a day is clicked in the outlook
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // Sequence filter
  const [selectedSequence, setSelectedSequence] = useState<string>('all');
  // Profile sidebar state
  const [profileViewState, setProfileViewState] = useState<ProfileViewState | null>(null);
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  const MAX_ITEMS = 50;
  // Calendar view toggle
  const [calendarView, setCalendarView] = useState<CalendarViewType>('week');
  // Schedule task dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const scheduleTask = useScheduleAdhocTask({ staffSessionToken: sessionToken });

  const handleScheduleTask = async (data: {
    contactId: string;
    contactName: string;
    dueDate: string;
    actionType: 'call' | 'text' | 'email' | 'other';
    title: string;
    description?: string;
  }) => {
    await scheduleTask.mutateAsync({
      contactId: data.contactId,
      dueDate: data.dueDate,
      actionType: data.actionType,
      title: data.title,
      description: data.description,
    });
    toast({
      title: 'Task scheduled',
      description: `${data.title} for ${data.contactName} on ${data.dueDate}.`,
    });
  };

  const handleComplete = async (taskId: string, notes?: string, followUp?: FollowUpData) => {
    setCompletingTaskId(taskId);
    try {
      await completeTask.mutateAsync({ taskId, notes });

      // If follow-up was scheduled, create the adhoc task
      if (followUp) {
        // Find the task to get its contact ID
        const task = activeTasks.find(t => t.id === taskId);
        const contactId = task ? getContactId(task) : null;

        if (contactId) {
          try {
            await createAdhocTask.mutateAsync({
              contactId,
              dueDate: format(followUp.dueDate, 'yyyy-MM-dd'),
              actionType: followUp.actionType,
              title: followUp.title,
              parentTaskId: taskId,
            });
            toast({
              title: 'Task completed',
              description: `Great job! Follow-up scheduled for ${format(followUp.dueDate, 'MMM d')}.`,
            });
          } catch (followUpErr) {
            toast({
              title: 'Task completed, but follow-up failed',
              description: followUpErr instanceof Error ? followUpErr.message : 'Could not create follow-up.',
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Task completed',
            description: 'Great job! The task has been marked as done.',
          });
        }
      } else {
        toast({
          title: 'Task completed',
          description: 'Great job! The task has been marked as done.',
        });
      }
    } catch (err) {
      toast({
        title: 'Failed to complete task',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCompletingTaskId(null);
    }
  };

  // Handle view profile
  const handleViewProfile = (contactId: string, customerName: string) => {
    setProfileViewState({ contactId, customerName });
  };

  // Handle day click in outlook
  const handleDayClick = (date: Date) => {
    if (selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
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

    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      filtered = filtered.filter(task => {
        const taskDate = task.due_date.split('T')[0];
        return taskDate === dateStr;
      });
    }

    if (selectedSequence !== 'all') {
      filtered = filtered.filter(task => task.instance?.sequence?.id === selectedSequence);
    }

    return filtered;
  }, [activeTasks, selectedDate, selectedSequence]);

  // Group filtered tasks by customer
  const allGroupedTasks = useMemo(() => groupTasksByCustomer(filteredTasks), [filteredTasks]);

  // Limit to MAX_ITEMS
  const groupedTasksArray = useMemo(() => {
    return allGroupedTasks.slice(0, MAX_ITEMS);
  }, [allGroupedTasks]);

  // Pagination
  const totalPages = Math.ceil(groupedTasksArray.length / ITEMS_PER_PAGE);
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return groupedTasksArray.slice(start, end);
  }, [groupedTasksArray, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, selectedSequence]);

  // Convert StaffOnboardingTask[] to OnboardingTask[] for SevenDayOutlook
  const tasksForOutlook = useMemo(() => {
    return activeTasks.map(task => ({
      ...task,
      assigned_to_user_id: null,
      instance: task.instance ? {
        ...task.instance,
        contact_id: task.instance.contact_id || null,
      } : undefined,
    })) as unknown as OnboardingTask[];
  }, [activeTasks]);

  if (!sessionToken || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Workflow className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Your Sequence Queue</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowScheduleDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule Task
          </Button>
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
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className={cn(stats.overdue > 0 && 'border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-500/10')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-2 rounded-full',
                  stats.overdue > 0 ? 'bg-red-100 dark:bg-red-500/20' : 'bg-muted'
                )}
              >
                <AlertCircle
                  className={cn('h-4 w-4', stats.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}
                />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(stats.due_today > 0 && 'border-blue-300 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-500/10')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-2 rounded-full',
                  stats.due_today > 0 ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-muted'
                )}
              >
                <Clock
                  className={cn(
                    'h-4 w-4',
                    stats.due_today > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                  )}
                />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.due_today}</p>
                <p className="text-xs text-muted-foreground">Due Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-muted">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.upcoming}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(stats.completed_today > 0 && 'border-green-200 dark:border-green-500/30 bg-green-50/50 dark:bg-green-500/10')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-full', stats.completed_today > 0 ? 'bg-green-100 dark:bg-green-500/20' : 'bg-muted')}>
                <CheckCircle2 className={cn('h-4 w-4', stats.completed_today > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed_today}</p>
                <p className="text-xs text-muted-foreground">Done Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
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

        {/* Calendar View Toggle */}
        <ToggleGroup
          type="single"
          value={calendarView}
          onValueChange={(value) => value && setCalendarView(value as CalendarViewType)}
          className="border rounded-md"
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="week" aria-label="Week view" className="h-8 w-8 p-0">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Week view</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="month" aria-label="Month view" className="h-8 w-8 p-0">
                  <Grid3X3 className="h-4 w-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Month view</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ToggleGroup>
      </div>

      {/* Calendar View */}
      {!isLoading && (
        calendarView === 'week' ? (
          <SevenDayOutlook
            tasks={tasksForOutlook}
            onDayClick={handleDayClick}
            selectedDate={selectedDate}
          />
        ) : (
          <MonthlyTaskCalendar
            tasks={tasksForOutlook}
            onDayClick={handleDayClick}
            selectedDate={selectedDate}
          />
        )
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
      {error && (
        <Card className="border-red-300 bg-red-50 mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <p>Failed to load tasks: {error.message}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State - when filters show no results */}
      {!isLoading && !error && (selectedDate || selectedSequence !== 'all') && filteredTasks.length === 0 && activeTasks.length > 0 && (
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

      {/* Active Tasks */}
      {!isLoading && !error && (
        <div className="space-y-6">
          {paginatedGroups.length === 0 && !selectedDate && selectedSequence === 'all' ? (
            <Card>
              <CardContent className="pt-8 pb-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">All caught up!</h3>
                <p className="text-muted-foreground">You have no pending tasks right now.</p>
              </CardContent>
            </Card>
          ) : paginatedGroups.length > 0 && (
            <>
              {/* Show count info */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {totalPages > 1
                    ? `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, groupedTasksArray.length)} of ${groupedTasksArray.length} customers`
                    : `${paginatedGroups.length} customer${paginatedGroups.length !== 1 ? 's' : ''}`
                  }
                  {allGroupedTasks.length > MAX_ITEMS && ` (limited to ${MAX_ITEMS})`}
                </p>
              </div>
              {paginatedGroups.map((group) => {
                const hasOverdue = group.tasks.some(t => t.status === 'overdue');
                return (
                <div key={group.customerName} className="space-y-3">
                  <h3 className={cn(
                    "text-sm font-medium flex items-center gap-2",
                    hasOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                  )}>
                    {group.contactId ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "cursor-pointer transition-colors",
                          hasOverdue
                            ? "hover:text-red-700 dark:hover:text-red-300 hover:underline"
                            : "hover:text-primary hover:underline"
                        )}
                        onClick={() => handleViewProfile(group.contactId!, group.customerName)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleViewProfile(group.contactId!, group.customerName);
                          }
                        }}
                      >
                        {group.customerName}
                      </span>
                    ) : (
                      group.customerName
                    )}
                    {hasOverdue ? (
                      <Badge variant="destructive" className="text-xs">
                        {group.tasks.filter(t => t.status === 'overdue').length} overdue
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </h3>
                  <div className="space-y-3">
                    {group.tasks.map((task) => (
                      <StaffTaskCard
                        key={task.id}
                        task={task}
                        onComplete={handleComplete}
                        isCompleting={completingTaskId === task.id}
                        onViewProfile={handleViewProfile}
                      />
                    ))}
                  </div>
                </div>
                );
              })}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Completed Today Section */}
          {completedTodayTasks.length > 0 && (
            <CompletedTodaySection
              tasks={completedTodayTasks}
              onComplete={handleComplete}
              onViewProfile={handleViewProfile}
            />
          )}
        </div>
      )}

      {/* Contact Profile Sidebar */}
      <ContactProfileModal
        contactId={profileViewState?.contactId || null}
        open={!!profileViewState}
        onClose={() => setProfileViewState(null)}
        agencyId={user?.agency_id || null}
        displayName={user?.display_name || user?.username || undefined}
        defaultSourceModule="manual"
        staffMemberId={user?.id}
        staffSessionToken={sessionToken}
        onActivityLogged={() => refetch()}
      />

      {/* Schedule Task Dialog */}
      <ScheduleTaskDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        agencyId={user?.agency_id || null}
        onSchedule={handleScheduleTask}
      />
    </div>
  );
}
