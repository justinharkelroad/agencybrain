import { useState, useMemo, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfDay, startOfWeek, addDays, addWeeks, isToday, isBefore, isWeekend } from 'date-fns';
import {
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Phone,
  MessageSquare,
  Mail,
  MoreHorizontal,
  CheckSquare,
  Check,
  List,
  LayoutGrid,
  Settings,
  MessageCircle,
  User,
  Users,
  Calendar,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { BrutalistSidebar } from '@/components/brutalist';
import {
  useOnboardingTasksToday,
  useCompleteOnboardingTask,
  useStaffUsersForFilter,
  useProfileUsersForFilter,
} from '@/hooks/useOnboardingTasks';
import { ScheduleTaskDialog } from '@/components/onboarding/ScheduleTaskDialog';
import { ContactProfileModal } from '@/components/contacts/ContactProfileModal';
import { ReassignSequenceModal } from '@/components/onboarding/ReassignSequenceModal';
import { TaskCompleteDialog } from '@/components/onboarding/TaskCompleteDialog';
import { toast } from 'sonner';
import type { OnboardingTask } from '@/hooks/useOnboardingTasks';

// ===========================================================================
// BRUTALIST SEQUENCE QUEUE PAGE
// A Neo-Brutalist take on the sequence queue with thick borders, bold numbers,
// and a calendar widget. Designed to match the brand colors (green primary).
// ===========================================================================

// Brand-consistent color adjustments:
// - Primary green: #4CAF50 (actions, success, done)
// - Red: #FF5252 (overdue, danger)
// - Yellow: var(--brutalist-yellow) (today, due today - using brand yellow)
// - White: upcoming tasks, neutral states
// - White/Gray text hierarchy on dark background

export default function BrutalistSequenceQueuePage() {
  const { user, isAdmin, isAgencyOwner, isKeyEmployee } = useAuth();
  const [viewFilter, setViewFilter] = useState<string>('my');
  const [selectedSequence, setSelectedSequence] = useState<string>('all');
  const [calendarView, setCalendarView] = useState<'list' | 'grid'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [taskToComplete, setTaskToComplete] = useState<OnboardingTask | null>(null);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [profileViewState, setProfileViewState] = useState<{ contactId: string; customerName: string } | null>(null);
  const [reassignState, setReassignState] = useState<{ instanceId: string; customerName: string; pendingCount: number } | null>(null);

  // Fetch user profile
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

  // Get staff and profile users for filter
  const { data: staffUsers = [] } = useStaffUsersForFilter(profile?.agency_id || null);
  const { data: profileUsers = [] } = useProfileUsersForFilter(profile?.agency_id || null);

  // Determine assignee filters
  const { assigneeId, assigneeUserId, showAssigneeColumn } = useMemo(() => {
    if (viewFilter === 'my') {
      return { assigneeId: undefined, assigneeUserId: user?.id, showAssigneeColumn: false };
    }
    if (viewFilter === 'all') {
      return { assigneeId: undefined, assigneeUserId: undefined, showAssigneeColumn: true };
    }
    const [type, id] = viewFilter.split(':') as ['staff' | 'user', string];
    if (type === 'staff') {
      return { assigneeId: id, assigneeUserId: undefined, showAssigneeColumn: false };
    }
    return { assigneeId: undefined, assigneeUserId: id, showAssigneeColumn: false };
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
      setTaskToComplete(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete task');
    } finally {
      setCompletingTaskId(null);
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

  // Filter tasks by selected date and sequence
  const filteredTasks = useMemo(() => {
    let filtered = activeTasks;
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      filtered = filtered.filter(task => task.due_date.split('T')[0] === dateStr);
    }
    if (selectedSequence !== 'all') {
      filtered = filtered.filter(task => task.instance?.sequence?.id === selectedSequence);
    }
    return filtered;
  }, [activeTasks, selectedDate, selectedSequence]);

  // Group tasks by customer
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, OnboardingTask[]>();
    for (const task of filteredTasks) {
      const customerName = task.instance?.customer_name || 'Unknown Customer';
      const existing = groups.get(customerName) || [];
      existing.push(task);
      groups.set(customerName, existing);
    }
    // Sort by priority (overdue first)
    return new Map(
      [...groups.entries()].sort((a, b) => {
        const aOverdue = a[1].some(t => t.status === 'overdue');
        const bOverdue = b[1].some(t => t.status === 'overdue');
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        const aDue = a[1].some(t => t.status === 'due');
        const bDue = b[1].some(t => t.status === 'due');
        if (aDue && !bDue) return -1;
        if (!aDue && bDue) return 1;
        return a[0].localeCompare(b[0]);
      })
    );
  }, [filteredTasks]);

  // Available sequences for filter
  const availableSequences = useMemo(() => {
    const seqMap = new Map<string, { id: string; name: string }>();
    for (const task of activeTasks) {
      const seq = task.instance?.sequence;
      if (seq && !seqMap.has(seq.id)) {
        seqMap.set(seq.id, { id: seq.id, name: seq.name });
      }
    }
    return Array.from(seqMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeTasks]);

  // Auto-expand first customer
  useEffect(() => {
    if (groupedTasks.size > 0 && expandedCustomers.size === 0) {
      const firstCustomer = groupedTasks.keys().next().value;
      if (firstCustomer) {
        setExpandedCustomers(new Set([firstCustomer]));
      }
    }
  }, [groupedTasks]);

  const toggleCustomer = (customerName: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customerName)) {
        next.delete(customerName);
      } else {
        next.add(customerName);
      }
      return next;
    });
  };

  const canViewAllAgency = isAdmin || isAgencyOwner || isKeyEmployee;
  const canReassign = isAdmin || isAgencyOwner;
  const isLoading = profileLoading || tasksLoading;

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="brutalist-app brutalist-app-bg flex h-screen overflow-hidden font-brutalist">
      {/* Sidebar */}
      <BrutalistSidebar agencyName={null} isLightMode={false} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b-2 border-white px-6 py-4 flex items-center justify-between bg-[#1A1A2E]">
          <h1 className="text-2xl lg:text-3xl font-bold text-white uppercase tracking-wide">
            YOUR SEQUENCE QUEUE
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowScheduleDialog(true)}
              className="bg-[#4CAF50] text-[#0D0D0D] px-5 py-2.5 font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-[#66BB6A] transition-colors"
            >
              <Plus className="w-4 h-4" />
              SCHEDULE TASK
            </button>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="border-2 border-white text-white px-4 py-2 font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-white hover:text-[#0D0D0D] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              REFRESH
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-0 border-2 border-white">
            <StatCard
              value={stats.overdue}
              label="OVERDUE"
              color="#FF5252"
              borderRight
            />
            <StatCard
              value={stats.dueToday}
              label="DUE TODAY"
              color="#FFFFFF"
              borderRight
            />
            <StatCard
              value={stats.upcoming}
              label="UPCOMING"
              color="#FFFFFF"
              borderRight
            />
            <StatCard
              value={stats.completedToday}
              label="DONE TODAY"
              color="#4CAF50"
            />
          </div>

          {/* Filters Bar */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {/* View Filter */}
              {canViewAllAgency && (
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm uppercase tracking-wider">VIEWING:</span>
                  <select
                    value={viewFilter}
                    onChange={(e) => setViewFilter(e.target.value)}
                    className="bg-[#1A1A2E] border-2 border-white text-white px-3 py-2 text-sm font-bold uppercase cursor-pointer min-w-[160px]"
                  >
                    <option value="my">My Tasks</option>
                    <option value="all">All Agency</option>
                    {profileUsers.filter(p => p.id !== user?.id).map(p => (
                      <option key={p.id} value={`user:${p.id}`}>{p.full_name || p.email}</option>
                    ))}
                    {staffUsers.map(s => (
                      <option key={s.id} value={`staff:${s.id}`}>{s.display_name || s.username}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sequence Filter */}
              {availableSequences.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm uppercase tracking-wider">SEQUENCE:</span>
                  <select
                    value={selectedSequence}
                    onChange={(e) => setSelectedSequence(e.target.value)}
                    className="bg-[#1A1A2E] border-2 border-white text-white px-3 py-2 text-sm font-bold uppercase cursor-pointer min-w-[180px]"
                  >
                    <option value="all">All Sequences</option>
                    {availableSequences.map(seq => (
                      <option key={seq.id} value={seq.id}>{seq.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center border-2 border-white">
              <button
                onClick={() => setCalendarView('list')}
                className={cn(
                  'p-2.5 transition-colors',
                  calendarView === 'list'
                    ? 'bg-white text-[#0D0D0D]'
                    : 'text-white hover:bg-white/10'
                )}
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCalendarView('grid')}
                className={cn(
                  'p-2.5 border-l-2 border-white transition-colors',
                  calendarView === 'grid'
                    ? 'bg-white text-[#0D0D0D]'
                    : 'text-white hover:bg-white/10'
                )}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Calendar Widget */}
          <CalendarWidget
            tasks={activeTasks}
            onDayClick={(date) => {
              if (selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
                setSelectedDate(null);
              } else {
                setSelectedDate(date);
              }
            }}
            selectedDate={selectedDate}
          />

          {/* Date Filter Indicator */}
          {selectedDate && (
            <div className="flex items-center gap-3 p-3 border-2 border-[var(--brutalist-yellow)] bg-[var(--brutalist-yellow)]/10">
              <Calendar className="w-4 h-4 text-[var(--brutalist-yellow)]" />
              <span className="text-white text-sm">
                Showing tasks for <strong>{format(selectedDate, 'EEEE, MMM d')}</strong>
              </span>
              <button
                onClick={() => setSelectedDate(null)}
                className="ml-auto text-[var(--brutalist-yellow)] text-sm uppercase font-bold hover:text-white transition-colors"
              >
                Clear Filter
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}

          {/* Error State */}
          {tasksError && (
            <div className="border-2 border-[#FF5252] bg-[#FF5252]/10 p-4">
              <div className="flex items-center gap-3 text-white">
                <AlertTriangle className="w-5 h-5 text-[#FF5252]" />
                <span>Failed to load tasks: {tasksError.message}</span>
                <button
                  onClick={() => refetch()}
                  className="ml-auto border border-white px-3 py-1 text-sm uppercase font-bold hover:bg-white hover:text-[#0D0D0D] transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !tasksError && filteredTasks.length === 0 && (
            <div className="border-2 border-white/30 p-12 text-center">
              <div className="w-16 h-16 border-2 border-white/20 flex items-center justify-center mx-auto mb-4">
                <CheckSquare className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="text-white text-lg font-bold uppercase mb-2">No Tasks</h3>
              <p className="text-white/50 text-sm">
                {selectedDate || selectedSequence !== 'all'
                  ? 'No tasks match your filters.'
                  : viewFilter === 'my'
                    ? 'You have no assigned onboarding tasks.'
                    : 'No onboarding tasks in your agency.'}
              </p>
            </div>
          )}

          {/* Customer Task Groups */}
          {!isLoading && filteredTasks.length > 0 && (
            <div className="space-y-0">
              {/* Count Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/50 text-xs uppercase tracking-widest font-bold">
                  {groupedTasks.size} CUSTOMER{groupedTasks.size !== 1 ? 'S' : ''}
                </span>
                {stats.overdue > 0 && (
                  <span className="text-[#FF5252] text-xs uppercase tracking-wider font-bold">
                    {stats.overdue} MISSED · {filteredTasks.length} TOTAL
                  </span>
                )}
              </div>

              {/* Customer Groups */}
              {Array.from(groupedTasks.entries()).map(([customerName, tasks]) => (
                <CustomerGroup
                  key={customerName}
                  customerName={customerName}
                  tasks={tasks}
                  isExpanded={expandedCustomers.has(customerName)}
                  onToggle={() => toggleCustomer(customerName)}
                  onCompleteTask={(task) => setTaskToComplete(task)}
                  completingTaskId={completingTaskId}
                  showAssignee={showAssigneeColumn}
                  canReassign={canReassign}
                  onReassign={(instanceId, name, count) => setReassignState({ instanceId, customerName: name, pendingCount: count })}
                  onViewProfile={(contactId) => setProfileViewState({ contactId, customerName })}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3">
        <button className="w-12 h-12 border-2 border-white/30 bg-[#1A1A2E] flex items-center justify-center text-white/60 hover:border-white hover:text-white transition-colors">
          <Settings className="w-5 h-5" />
        </button>
        <button className="w-12 h-12 bg-[#4CAF50] flex items-center justify-center text-[#0D0D0D] hover:bg-[#66BB6A] transition-colors">
          <MessageCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Modals */}
      <ScheduleTaskDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        agencyId={profile?.agency_id || null}
        onSchedule={async (data) => {
          toast.success(`Task scheduled: ${data.title}`);
          refetch();
        }}
      />

      {taskToComplete && (
        <TaskCompleteDialog
          open={!!taskToComplete}
          onOpenChange={(open) => !open && setTaskToComplete(null)}
          task={taskToComplete}
          onComplete={(notes) => handleCompleteTask(taskToComplete.id, notes)}
          isCompleting={completingTaskId === taskToComplete.id}
        />
      )}

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

      {reassignState && (
        <ReassignSequenceModal
          open={!!reassignState}
          onOpenChange={(open) => !open && setReassignState(null)}
          instance={{
            id: reassignState.instanceId,
            customer_name: reassignState.customerName,
            assigned_to_staff_user_id: activeTasks.find(t => t.instance_id === reassignState.instanceId)?.assigned_to_staff_user_id || null,
            sequence: activeTasks.find(t => t.instance_id === reassignState.instanceId)?.instance?.sequence || null,
          }}
          agencyId={profile?.agency_id || ''}
          pendingTaskCount={reassignState.pendingCount}
          onSuccess={() => {
            setReassignState(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// STAT CARD COMPONENT
// ===========================================================================
function StatCard({
  value,
  label,
  color,
  borderRight = false,
}: {
  value: number;
  label: string;
  color: string;
  borderRight?: boolean;
}) {
  return (
    <div
      className={cn(
        'p-6 bg-[#1A1A2E]',
        borderRight && 'border-r-2 border-white'
      )}
      style={{ borderTop: `4px solid ${color}` }}
    >
      <div
        className="text-5xl lg:text-6xl font-black leading-none"
        style={{ color }}
      >
        {value}
      </div>
      <div className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2">
        {label}
      </div>
    </div>
  );
}

// ===========================================================================
// CALENDAR WIDGET COMPONENT
// ===========================================================================
function CalendarWidget({
  tasks,
  onDayClick,
  selectedDate,
}: {
  tasks: OnboardingTask[];
  onDayClick: (date: Date) => void;
  selectedDate: Date | null;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const defaultOffset = useMemo(() => (isWeekend(today) ? 1 : 0), [today]);
  const [weekOffset, setWeekOffset] = useState(defaultOffset);

  const baseDate = useMemo(() => addWeeks(today, weekOffset), [today, weekOffset]);

  // Get Mon-Fri of selected week
  const businessDays = useMemo(() => {
    const monday = startOfWeek(baseDate, { weekStartsOn: 1 });
    return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  }, [baseDate]);

  const weekStart = businessDays[0];
  const weekEnd = businessDays[4];
  const weekLabel = `${format(weekStart, 'MMM d')} — ${format(weekEnd, 'MMM d')}`;

  const getWeekTitle = () => {
    if (weekOffset === 0) return 'THIS WEEK';
    if (weekOffset === 1) return isWeekend(today) ? 'THIS WEEK' : 'NEXT WEEK';
    if (weekOffset === -1) return 'LAST WEEK';
    return weekOffset > 1 ? `${weekOffset} WEEKS AHEAD` : `${Math.abs(weekOffset)} WEEKS AGO`;
  };

  // Calculate day stats
  const dayStats = useMemo(() => {
    return businessDays.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayTasks = tasks.filter(t => t.due_date.split('T')[0] === dateStr && t.status !== 'completed');
      const isPast = isBefore(startOfDay(date), today);
      const isMissed = isPast && dayTasks.length > 0;
      return { date, count: dayTasks.length, isPast, isMissed, isToday: isToday(date) };
    });
  }, [businessDays, tasks, today]);

  const missedCount = dayStats.filter(d => d.isMissed).reduce((sum, d) => sum + d.count, 0);
  const weekTotal = dayStats.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="border-2 border-white bg-[#1A1A2E]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="w-8 h-8 border border-white/30 flex items-center justify-center text-white/60 hover:border-white hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-white font-bold uppercase tracking-wider text-sm">{getWeekTitle()}</span>
            <span className="text-white/50 text-sm ml-2">{weekLabel}</span>
          </div>
          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="w-8 h-8 border border-white/30 flex items-center justify-center text-white/60 hover:border-white hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {weekOffset !== defaultOffset && (
            <button
              onClick={() => setWeekOffset(defaultOffset)}
              className="text-[var(--brutalist-yellow)] text-xs uppercase font-bold ml-2 hover:text-white transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {missedCount > 0 && (
            <span className="text-[#FF5252] text-xs uppercase font-bold">{missedCount} MISSED</span>
          )}
          <span className="text-white/50 text-xs uppercase font-bold">{weekTotal} TOTAL</span>
        </div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-5 gap-0">
        {dayStats.map(({ date, count, isPast, isMissed, isToday: isTodayDate }) => {
          const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
          const hasDueToday = isTodayDate && count > 0;

          return (
            <button
              key={date.toISOString()}
              onClick={() => onDayClick(date)}
              className={cn(
                'p-4 border-r border-white/10 last:border-r-0 transition-all text-center',
                'hover:bg-white/5',
                isSelected && 'ring-2 ring-[var(--brutalist-yellow)] ring-inset',
                isTodayDate && 'bg-[var(--brutalist-yellow)] text-[#0D0D0D]',
                isMissed && !isTodayDate && 'bg-[#FF5252]/10',
              )}
            >
              <div className={cn(
                'text-xs font-bold uppercase tracking-wider mb-1',
                isTodayDate ? 'text-[#0D0D0D]/70' : isMissed ? 'text-[#FF5252]' : isPast ? 'text-white/30' : 'text-white/50'
              )}>
                {format(date, 'EEE')}
              </div>
              <div className={cn(
                'text-2xl font-black',
                isTodayDate ? 'text-[#0D0D0D]' : isMissed ? 'text-[#FF5252]' : isPast ? 'text-white/30' : 'text-white'
              )}>
                {format(date, 'd')}
              </div>
              <div className={cn(
                'text-[10px] uppercase tracking-wider',
                isTodayDate ? 'text-[#0D0D0D]/50' : 'text-white/30'
              )}>
                {format(date, 'MMM')}
              </div>

              {/* Status Indicator */}
              <div className="mt-2 h-6 flex items-center justify-center">
                {isTodayDate ? (
                  <span className="px-2 py-0.5 bg-[#0D0D0D]/20 text-[#0D0D0D] text-[10px] font-bold uppercase">
                    TODAY
                  </span>
                ) : count > 0 ? (
                  <span className={cn(
                    'px-2 py-0.5 text-[10px] font-bold',
                    isMissed
                      ? 'bg-[#FF5252] text-white'
                      : 'border border-[#4CAF50] text-[#4CAF50]'
                  )}>
                    {isMissed ? `MISSED ${count}` : `UPCOMING ${count}`}
                  </span>
                ) : isPast ? (
                  <span className="text-[#4CAF50]">
                    <Check className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="text-white/20">—</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 p-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#4CAF50]" />
          <span className="text-white/50 text-[10px] uppercase tracking-wider">DONE</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#FF5252]" />
          <span className="text-white/50 text-[10px] uppercase tracking-wider">MISSED</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[var(--brutalist-yellow)]" />
          <span className="text-white/50 text-[10px] uppercase tracking-wider">TODAY</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-white/30" />
          <span className="text-white/50 text-[10px] uppercase tracking-wider">UPCOMING</span>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// CUSTOMER GROUP COMPONENT
// ===========================================================================
function CustomerGroup({
  customerName,
  tasks,
  isExpanded,
  onToggle,
  onCompleteTask,
  completingTaskId,
  showAssignee,
  canReassign,
  onReassign,
  onViewProfile,
}: {
  customerName: string;
  tasks: OnboardingTask[];
  isExpanded: boolean;
  onToggle: () => void;
  onCompleteTask: (task: OnboardingTask) => void;
  completingTaskId: string | null;
  showAssignee: boolean;
  canReassign: boolean;
  onReassign: (instanceId: string, name: string, count: number) => void;
  onViewProfile: (contactId: string) => void;
}) {
  const overdueCount = tasks.filter(t => t.status === 'overdue').length;
  const dueCount = tasks.filter(t => t.status === 'due').length;
  const upcomingCount = tasks.filter(t => t.status === 'pending').length;
  const activeCount = overdueCount + dueCount + upcomingCount;

  const hasOverdue = overdueCount > 0;
  const instanceId = tasks[0]?.instance_id;
  const contactId = tasks[0]?.instance?.contact_id;

  // Badge styling based on status
  const getBadgeStyle = () => {
    if (overdueCount > 0) return 'bg-[#FF5252] text-white';
    if (dueCount > 0) return 'bg-[var(--brutalist-yellow)] text-[#0D0D0D]';
    return 'bg-[#4CAF50] text-[#0D0D0D]';
  };

  const getBadgeText = () => {
    if (overdueCount > 0) return `${overdueCount} OVERDUE`;
    if (dueCount > 0) return `${dueCount} DUE TODAY`;
    return `${upcomingCount} UPCOMING`;
  };

  return (
    <div className={cn(
      'border-2 mb-0 -mt-[2px] first:mt-0',
      hasOverdue
        ? 'border-[#FF5252]/50 bg-[#FF5252]/5'
        : 'border-white/20 bg-[#1A1A2E]'
    )}>
      {/* Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors',
          hasOverdue && 'border-l-4 border-l-[#FF5252]'
        )}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-5 h-5 text-white/50" />
          </motion.div>
          <span
            className="text-white font-bold uppercase tracking-wider text-base cursor-pointer hover:text-[#4CAF50] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (contactId) onViewProfile(contactId);
            }}
          >
            {customerName}
          </span>
          <span className={cn('px-2 py-0.5 text-xs font-bold uppercase', getBadgeStyle())}>
            {getBadgeText()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canReassign && instanceId && activeCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReassign(instanceId, customerName, activeCount);
              }}
              className="text-white/40 hover:text-white transition-colors p-1"
            >
              <Users className="w-4 h-4" />
            </button>
          )}
        </div>
      </button>

      {/* Tasks */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10">
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={() => onCompleteTask(task)}
                  isCompleting={completingTaskId === task.id}
                  showAssignee={showAssignee}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================================================================
// TASK ROW COMPONENT
// ===========================================================================
function TaskRow({
  task,
  onComplete,
  isCompleting,
  showAssignee,
}: {
  task: OnboardingTask;
  onComplete: () => void;
  isCompleting: boolean;
  showAssignee: boolean;
}) {
  const isOverdue = task.status === 'overdue';
  const isDue = task.status === 'due';

  const getTypeIcon = () => {
    switch (task.action_type) {
      case 'call': return <Phone className="w-4 h-4" />;
      case 'text': return <MessageSquare className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      default: return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  const getStatusBadge = () => {
    if (isOverdue) return <span className="px-2 py-0.5 bg-[#FF5252] text-white text-[10px] font-bold uppercase">OVERDUE</span>;
    if (isDue) return <span className="px-2 py-0.5 bg-[var(--brutalist-yellow)] text-[#0D0D0D] text-[10px] font-bold uppercase">DUE TODAY</span>;
    return <span className="px-2 py-0.5 border border-[#4CAF50] text-[#4CAF50] text-[10px] font-bold uppercase">UPCOMING</span>;
  };

  const formatDueDate = () => {
    const date = new Date(task.due_date);
    const today = startOfDay(new Date());
    const taskDate = startOfDay(date);
    const diffDays = Math.round((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'TODAY';
    if (diffDays === 1) return `${format(date, 'MMM d')} (TOMORROW)`;
    if (diffDays === -1) return `${format(date, 'MMM d')} (YESTERDAY)`;
    if (diffDays < 0) return `${format(date, 'MMM d')} (${Math.abs(diffDays)} DAYS AGO)`;
    if (diffDays <= 7) return `${format(date, 'MMM d')} (IN ${diffDays} DAYS)`;
    return format(date, 'MMM d');
  };

  return (
    <div className="flex items-start gap-4 p-4 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors">
      {/* Checkbox */}
      <button
        onClick={onComplete}
        disabled={isCompleting}
        className={cn(
          'w-6 h-6 border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
          isCompleting
            ? 'border-[#4CAF50] bg-[#4CAF50]/20'
            : 'border-white/50 hover:border-[#4CAF50] hover:bg-[#4CAF50]/10'
        )}
      >
        {isCompleting && <Loader2 className="w-3 h-3 text-[#4CAF50] animate-spin" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-white font-bold uppercase tracking-wider text-sm">
            {task.title}
          </span>
          {getStatusBadge()}
        </div>

        {task.description && (
          <p className="text-white/50 text-sm leading-relaxed mb-3 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs">
          <span className="text-white font-bold uppercase tracking-wider">
            {formatDueDate()}
          </span>
          <span className="flex items-center gap-1.5 text-white/60 uppercase">
            {getTypeIcon()}
            {task.action_type?.toUpperCase() || 'TASK'}
          </span>
          {task.instance?.sequence?.name && (
            <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-white/50 uppercase tracking-wider">
              {task.instance.sequence.name}
            </span>
          )}
          {showAssignee && task.assigned_to_staff_user_id && (
            <span className="text-white/40">
              <User className="w-3 h-3 inline mr-1" />
              Assigned
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
