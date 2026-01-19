import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Upload, Search, Trash2, ChevronDown, ChevronUp, MoreHorizontal, Eye, Phone, Calendar, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { clearStaffTokenIfNotStaffRoute } from '@/lib/cancel-audit-api';
import { useAuth } from '@/lib/auth';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useRenewalRecords, useRenewalStats, useRenewalProductNames, useBulkUpdateRenewals, useBulkDeleteRenewals, useUpdateRenewalRecord, type RenewalFilters } from '@/hooks/useRenewalRecords';
import { RenewalUploadModal } from '@/components/renewals/RenewalUploadModal';
import { RenewalDetailDrawer } from '@/components/renewals/RenewalDetailDrawer';
import { ScheduleActivityModal } from '@/components/renewals/ScheduleActivityModal';
import { RenewalsDashboard } from '@/components/renewals/RenewalsDashboard';
import { ActivitySummaryBar } from '@/components/renewals/ActivitySummaryBar';
import { ContactProfileModal } from '@/components/contacts';
import type { RenewalRecord, RenewalUploadContext, WorkflowStatus } from '@/types/renewal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, parseISO, getDay } from 'date-fns';

const STATUS_COLORS: Record<WorkflowStatus, string> = { uncontacted: 'bg-slate-100 text-slate-700', pending: 'bg-amber-100 text-amber-700', success: 'bg-green-100 text-green-700', unsuccessful: 'bg-red-100 text-red-700' };
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Renewals() {
  const { user } = useAuth();
  const { user: staffUser, loading: staffLoading } = useStaffAuth();
  const queryClient = useQueryClient();
  const [context, setContext] = useState<RenewalUploadContext | null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RenewalRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState<RenewalFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  // Multi-column sorting
  interface SortCriteria {
    column: string;
    direction: 'asc' | 'desc';
  }
  const [sortCriteria, setSortCriteria] = useState<SortCriteria[]>([]);
  
  // Phase 3: New state variables
  const [quickActivityRecord, setQuickActivityRecord] = useState<RenewalRecord | null>(null);
  const [quickActivityType, setQuickActivityType] = useState<'phone_call' | 'appointment' | null>(null);
  const [showPriorityOnly, setShowPriorityOnly] = useState(false);
  
  // Chart filter state
  const [chartDateFilter, setChartDateFilter] = useState<string | null>(null);
  const [chartDayFilter, setChartDayFilter] = useState<number | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Contact profile modal state
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
  const [profileRenewalRecord, setProfileRenewalRecord] = useState<{ id: string; winback_household_id?: string | null } | null>(null);

  const handleSort = (column: string, event?: React.MouseEvent) => {
    const isShiftClick = event?.shiftKey;
    
    setSortCriteria(prev => {
      const existingIndex = prev.findIndex(s => s.column === column);
      
      if (existingIndex !== -1) {
        // Column already in sort - toggle direction or remove
        const existing = prev[existingIndex];
        if (existing.direction === 'asc') {
          // Toggle to desc
          const updated = [...prev];
          updated[existingIndex] = { column, direction: 'desc' };
          return updated;
        } else {
          // Remove from sort
          return prev.filter((_, i) => i !== existingIndex);
        }
      } else if (isShiftClick && prev.length > 0) {
        // Add as secondary sort (shift+click)
        return [...prev, { column, direction: 'asc' }];
      } else {
        // Replace all sorts with this column
        return [{ column, direction: 'asc' }];
      }
    });
  };

  const SortableHeader = ({ column, label }: { column: string; label: string }) => {
    const sortIndex = sortCriteria.findIndex(s => s.column === column);
    const sortInfo = sortIndex !== -1 ? sortCriteria[sortIndex] : null;
    
    return (
      <TableHead 
        className="cursor-pointer hover:bg-muted/50 select-none"
        onClick={(e) => handleSort(column, e)}
      >
        <div className="flex items-center gap-1">
          {label}
          {sortInfo && (
            <div className="flex items-center">
              {sortInfo.direction === 'asc' 
                ? <ChevronUp className="h-4 w-4" /> 
                : <ChevronDown className="h-4 w-4" />
              }
              {sortCriteria.length > 1 && (
                <span className="text-xs text-muted-foreground ml-0.5">
                  {sortIndex + 1}
                </span>
              )}
            </div>
          )}
        </div>
      </TableHead>
    );
  };

  // Clear any stale staff tokens when on non-staff route
  useEffect(() => {
    clearStaffTokenIfNotStaffRoute();
  }, []);

  useEffect(() => {
    async function load() {
      // Check for staff user first
      if (staffUser?.agency_id) {
        console.log('Staff user detected for Renewals:', staffUser);
        setContext({
          agencyId: staffUser.agency_id,
          userId: staffUser.id,
          staffMemberId: staffUser.team_member_id,
          displayName: staffUser.display_name || staffUser.username || 'Staff User'
        });
        
        // Fetch team members for staff user
        try {
          const { data: members } = await supabase
            .from('team_members')
            .select('id, name')
            .eq('agency_id', staffUser.agency_id)
            .eq('status', 'active')
            .order('name');
          setTeamMembers(members || []);
        } catch (err) {
          console.error('Error fetching team members for staff:', err);
        }
        setLoading(false);
        return;
      }
      
      // Fall back to regular auth user
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      try {
        const { data: p } = await supabase
          .from('profiles')
          .select('agency_id, full_name')
          .eq('id', user.id)
          .single();

        if (p?.agency_id) {
          // Try to get display name from team_members if profile full_name is missing
          let displayName = p.full_name;
          if (!displayName && user.email) {
            const { data: teamMember } = await supabase
              .from('team_members')
              .select('name')
              .eq('agency_id', p.agency_id)
              .eq('email', user.email)
              .single();
            if (teamMember?.name) {
              displayName = teamMember.name;
            }
          }

          setContext({
            agencyId: p.agency_id,
            userId: user.id,
            staffMemberId: null,
            displayName: displayName || user.email || 'Unknown'
          });

          const { data: members } = await supabase
            .from('team_members')
            .select('id, name')
            .eq('agency_id', p.agency_id)
            .eq('status', 'active')
            .order('name');
          setTeamMembers(members || []);
        }
      } catch (err) {
        console.error('Error loading renewals context:', err);
      } finally {
        setLoading(false);
      }
    }
    
    // Wait for staff auth check to complete
    if (!staffLoading) {
      load();
    }
  }, [user, staffUser, staffLoading]);

  const effectiveFilters = useMemo(() => {
    const f = { ...filters };
    if (activeTab !== 'all') f.currentStatus = [activeTab as WorkflowStatus];
    if (searchQuery) f.search = searchQuery;
    return f;
  }, [filters, activeTab, searchQuery]);

  const { data: records = [], isLoading: recordsLoading } = useRenewalRecords(context?.agencyId || null, effectiveFilters);
  const { data: stats } = useRenewalStats(context?.agencyId || null);
  const { data: productNames = [] } = useRenewalProductNames(context?.agencyId || null);
  const bulkUpdate = useBulkUpdateRenewals();
  const bulkDelete = useBulkDeleteRenewals();
  const updateRecord = useUpdateRenewalRecord();

  // Phase 3: Priority toggle handler with optimistic update
  const handleTogglePriority = async (recordId: string, isPriority: boolean) => {
    if (!context) return;
    
    // Optimistic update: Update local cache immediately before DB call
    queryClient.setQueriesData<RenewalRecord[]>(
      { queryKey: ['renewal-records'] },
      (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(r => 
          r.id === recordId ? { ...r, is_priority: isPriority } : r
        );
      }
    );
    
    try {
      await updateRecord.mutateAsync({
        id: recordId,
        updates: { is_priority: isPriority },
        displayName: context.displayName,
        userId: context.userId,
        silent: true,
        invalidate: false,
        invalidateStats: false,
      });
      // No toast on success - the star itself is the feedback
    } catch (error) {
      // Revert optimistic update on error
      queryClient.setQueriesData<RenewalRecord[]>(
        { queryKey: ['renewal-records'] },
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map(r => 
            r.id === recordId ? { ...r, is_priority: !isPriority } : r
          );
        }
      );
      toast.error("Failed to update priority");
    }
  };

  // Phase 3: Updated filtering with priority support
  const filteredAndSortedRecords = useMemo(() => {
    let result = records || [];

    // Chart date filter (specific date clicked)
    if (chartDateFilter) {
      result = result.filter(r => {
        if (!r.renewal_effective_date) return false;
        const recordDate = format(parseISO(r.renewal_effective_date), 'yyyy-MM-dd');
        return recordDate === chartDateFilter;
      });
    }

    // Chart day-of-week filter (day bar clicked)
    if (chartDayFilter !== null) {
      result = result.filter(r => {
        if (!r.renewal_effective_date) return false;
        const dayOfWeek = getDay(parseISO(r.renewal_effective_date));
        return dayOfWeek === chartDayFilter;
      });
    }

    // Priority filter (if toggle is on)
    if (showPriorityOnly) {
      result = result.filter(r =>
        r.is_priority === true ||
        (r.premium_change_percent !== null && r.premium_change_percent > 10) ||
        r.renewal_status === 'Renewal Not Taken' ||
        r.current_status === 'uncontacted'
      );
    }

    // Comparator used for both default and column sorting
    const compare = (a: RenewalRecord, b: RenewalRecord) => {
      // When Priority Only is active, always group starred items first
      if (showPriorityOnly) {
        const aP = a.is_priority ? 1 : 0;
        const bP = b.is_priority ? 1 : 0;
        if (aP !== bP) return bP - aP;
      }

      // Multi-column sorting - iterate through each criteria
      for (const { column, direction } of sortCriteria) {
        let aVal: any;
        let bVal: any;

        switch (column) {
          case 'renewal_effective_date':
            aVal = a.renewal_effective_date ? new Date(a.renewal_effective_date).getTime() : 0;
            bVal = b.renewal_effective_date ? new Date(b.renewal_effective_date).getTime() : 0;
            break;
          case 'premium_change_percent':
            aVal = a.premium_change_percent ?? 0;
            bVal = b.premium_change_percent ?? 0;
            break;
          case 'first_name':
            aVal = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
            bVal = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
            break;
          case 'premium_new':
            aVal = a.premium_new ?? 0;
            bVal = b.premium_new ?? 0;
            break;
          case 'product_name':
            aVal = (a.product_name || '').toLowerCase();
            bVal = (b.product_name || '').toLowerCase();
            break;
          case 'current_status':
            aVal = (a.current_status || '').toLowerCase();
            bVal = (b.current_status || '').toLowerCase();
            break;
          case 'renewal_status':
            aVal = (a.renewal_status || '').toLowerCase();
            bVal = (b.renewal_status || '').toLowerCase();
            break;
          case 'amount_due':
            aVal = a.amount_due ?? 0;
            bVal = b.amount_due ?? 0;
            break;
          case 'multi_line_indicator':
            aVal = a.multi_line_indicator ? 1 : 0;
            bVal = b.multi_line_indicator ? 1 : 0;
            break;
          default:
            aVal = 0;
            bVal = 0;
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        // If equal, continue to next sort criteria
      }

      // Default stable ordering when no sortCriteria (or when values tie)
      const aDate = a.renewal_effective_date ? new Date(a.renewal_effective_date).getTime() : 0;
      const bDate = b.renewal_effective_date ? new Date(b.renewal_effective_date).getTime() : 0;
      if (aDate !== bDate) return aDate - bDate;

      return a.id.localeCompare(b.id);
    };

    // If Priority Only is on, we still sort to group starred items first.
    if (showPriorityOnly) return [...result].sort(compare);

    // Otherwise only sort when the user selected a column.
    if (sortCriteria.length === 0) return result;

    return [...result].sort(compare);
  }, [records, sortCriteria, showPriorityOnly, chartDateFilter, chartDayFilter]);

  const toggleSelectAll = () => { selectedIds.size === records.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(records.map(r => r.id))); };
  const toggleSelect = (id: string) => { const s = new Set(selectedIds); s.has(id) ? s.delete(id) : s.add(id); setSelectedIds(s); };
  const handleBulkDelete = () => { bulkDelete.mutate(Array.from(selectedIds), { onSuccess: () => { setSelectedIds(new Set()); setShowDeleteDialog(false); } }); };
  const handleBulkStatus = (status: WorkflowStatus) => { if (!context) return; bulkUpdate.mutate({ ids: Array.from(selectedIds), updates: { current_status: status }, displayName: context.displayName, userId: context.userId }, { onSuccess: () => setSelectedIds(new Set()) }); };

  if (loading || staffLoading) return <div className="container mx-auto p-6 flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  if (!context) return <div className="container mx-auto p-6"><Card className="p-6 text-center text-muted-foreground">Unable to load context.</Card></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><RefreshCw className="h-8 w-8" /><h1 className="text-3xl font-bold">Renewals</h1></div>
        <Button onClick={() => setShowUploadModal(true)}><Upload className="h-4 w-4 mr-2" />Upload Report</Button>
      </div>
      
      {/* Dashboard Charts */}
      <RenewalsDashboard
        records={records}
        onDateFilter={setChartDateFilter}
        onDayOfWeekFilter={setChartDayFilter}
        activeDateFilter={chartDateFilter}
        activeDayFilter={chartDayFilter}
      />
      
      {/* Activity Summary - Previous Business Day */}
      <ActivitySummaryBar agencyId={context.agencyId} />
      
      {/* Active Chart Filter Indicator */}
      {(chartDateFilter || chartDayFilter !== null) && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <span className="text-sm text-blue-400">
            Filtered by: {chartDateFilter 
              ? format(parseISO(chartDateFilter), 'EEEE, MMM d, yyyy') 
              : `${DAY_NAMES_FULL[chartDayFilter!]}s`}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-xs text-blue-400 hover:text-white hover:bg-blue-500/20"
            onClick={() => { setChartDateFilter(null); setChartDayFilter(null); }}
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{stats?.total || 0}</Badge></TabsTrigger>
          <TabsTrigger value="uncontacted">Uncontacted <Badge variant="secondary" className="ml-2">{stats?.uncontacted || 0}</Badge></TabsTrigger>
          <TabsTrigger value="pending">Pending <Badge variant="secondary" className="ml-2">{stats?.pending || 0}</Badge></TabsTrigger>
          <TabsTrigger value="success">Success <Badge variant="secondary" className="ml-2">{stats?.success || 0}</Badge></TabsTrigger>
          <TabsTrigger value="unsuccessful">Unsuccessful <Badge variant="secondary" className="ml-2">{stats?.unsuccessful || 0}</Badge></TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Mobile filter toggle */}
      <div className="md:hidden">
        <Button
          variant="outline"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="w-full justify-between"
        >
          Filters
          <ChevronDown className={cn("h-4 w-4 transition-transform", filtersExpanded && "rotate-180")} />
        </Button>
      </div>
      
      {/* Filter controls */}
      <div className={cn(
        "flex flex-wrap gap-4 items-center",
        !filtersExpanded && "hidden md:flex"
      )}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={filters.bundledStatus || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, bundledStatus: v as any }))}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Bundled" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="bundled">Bundled</SelectItem><SelectItem value="monoline">Monoline</SelectItem></SelectContent>
        </Select>
        <Select value={filters.productName?.[0] || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, productName: v === 'all' ? undefined : [v] }))}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Product" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Products</SelectItem>{productNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
        </Select>
        
        {/* Priority filter button */}
        <Button
          variant={showPriorityOnly ? "default" : "outline"}
          onClick={() => setShowPriorityOnly(!showPriorityOnly)}
          className={cn(
            "gap-2",
            showPriorityOnly && "bg-yellow-500 hover:bg-yellow-600 text-black"
          )}
        >
          <Star className={cn("h-4 w-4", showPriorityOnly && "fill-current")} />
          Priority Only
        </Button>
      </div>
      
      {/* Premium Change Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="text-muted-foreground">Premium Change:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500/30" />
          <span>High (&gt;15%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-orange-500/20" />
          <span>Moderate (5-15%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-muted" />
          <span>Minimal (±5%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-500/30" />
          <span>Decrease (&lt;-5%)</span>
        </div>
      </div>
      
      {/* Multi-sort indicator */}
      {sortCriteria.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs px-1">
          <span className="text-muted-foreground">Sorted by:</span>
          {sortCriteria.map((s, i) => (
            <span key={s.column} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">→</span>}
              <Badge variant="secondary" className="font-normal">
                {s.column.replace(/_/g, ' ')} ({s.direction})
              </Badge>
            </span>
          ))}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 px-2 text-xs"
            onClick={() => setSortCriteria([])}
          >
            Clear
          </Button>
          <span className="text-muted-foreground ml-2">(Shift+click to add secondary sort)</span>
        </div>
      )}
      
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm">Status <ChevronDown className="h-4 w-4 ml-2" /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => handleBulkStatus('uncontacted')}>Uncontacted</DropdownMenuItem><DropdownMenuItem onClick={() => handleBulkStatus('pending')}>Pending</DropdownMenuItem><DropdownMenuItem onClick={() => handleBulkStatus('success')}>Success</DropdownMenuItem><DropdownMenuItem onClick={() => handleBulkStatus('unsuccessful')}>Unsuccessful</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
        </div>
      )}
      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"><Checkbox checked={selectedIds.size === records.length && records.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Policy</TableHead>
                <SortableHeader column="product_name" label="Product" />
                <SortableHeader column="premium_new" label="Premium" />
                <SortableHeader column="premium_change_percent" label="Change" />
                <SortableHeader column="renewal_status" label="Renewal Status" />
                <SortableHeader column="amount_due" label="Amount Due" />
                <SortableHeader column="multi_line_indicator" label="Bundled" />
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className="w-[140px] sticky right-0 bg-background">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsLoading ? <TableRow><TableCell colSpan={13} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              : filteredAndSortedRecords.length === 0 ? <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">No records. Upload a report to start.</TableCell></TableRow>
              : filteredAndSortedRecords.map((r) => (
                <TableRow 
                  key={r.id} 
                  className={cn(
                    "cursor-pointer hover:bg-muted/50",
                    r.premium_change_percent !== null && r.premium_change_percent > 15 && "bg-red-500/10",
                    r.premium_change_percent !== null && r.premium_change_percent > 5 && r.premium_change_percent <= 15 && "bg-orange-500/5",
                    r.premium_change_percent !== null && r.premium_change_percent < -5 && "bg-green-500/10",
                    r.is_priority && "ring-2 ring-yellow-500/50 ring-inset"
                  )}
                  onClick={() => setSelectedRecord(r)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} /></TableCell>
                  <TableCell>{r.renewal_effective_date}</TableCell>
                  <TableCell className="font-medium">
                    {r.contact_id ? (
                      <button
                        className="text-left hover:text-primary hover:underline focus:outline-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProfileContactId(r.contact_id!);
                          setProfileRenewalRecord({ id: r.id, winback_household_id: r.winback_household_id });
                        }}
                      >
                        {r.first_name} {r.last_name}
                      </button>
                    ) : (
                      <span>{r.first_name} {r.last_name}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{r.policy_number}</TableCell>
                  <TableCell>{r.product_name}</TableCell>
                  <TableCell className="text-right">${r.premium_new?.toLocaleString() ?? '-'}</TableCell>
                  <TableCell className={cn(
                    "text-right",
                    r.premium_change_percent !== null && r.premium_change_percent > 15 && "text-red-600",
                    r.premium_change_percent !== null && r.premium_change_percent > 5 && r.premium_change_percent <= 15 && "text-orange-500",
                    r.premium_change_percent !== null && r.premium_change_percent >= -5 && r.premium_change_percent <= 5 && "text-muted-foreground",
                    r.premium_change_percent !== null && r.premium_change_percent < -5 && "text-green-600"
                  )}>
                    {r.premium_change_percent != null ? `${r.premium_change_percent > 0 ? '+' : ''}${r.premium_change_percent.toFixed(1)}%` : '-'}
                  </TableCell>
                  <TableCell>
                    {r.renewal_status ? (
                      <Badge 
                        variant="outline"
                        className={cn(
                          r.renewal_status === 'Renewal Taken' && 'bg-green-100 text-green-700 border-green-200',
                          r.renewal_status === 'Renewal Not Taken' && 'bg-red-100 text-red-700 border-red-200',
                          r.renewal_status === 'Pending' && 'bg-amber-100 text-amber-700 border-amber-200'
                        )}
                      >
                        {r.renewal_status}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.amount_due != null ? `$${r.amount_due.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell><Badge variant={r.multi_line_indicator ? 'default' : 'secondary'}>{r.multi_line_indicator ? 'Yes' : 'No'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge className={STATUS_COLORS[r.current_status]}>{r.current_status}</Badge>
                      {r.winback_household_id && (
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200">WB</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{r.assigned_team_member?.name || '—'}</TableCell>
                  <TableCell className="sticky right-0 bg-background" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(r);
                        }}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickActivityRecord(r);
                          setQuickActivityType('phone_call');
                        }}
                        title="Log phone call"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickActivityRecord(r);
                          setQuickActivityType('appointment');
                        }}
                        title="Schedule appointment"
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8", r.is_priority && "text-yellow-500")}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePriority(r.id, !r.is_priority);
                        }}
                        title={r.is_priority ? "Remove priority" : "Mark as priority"}
                      >
                        <Star className={cn("h-4 w-4", r.is_priority && "fill-current")} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      <RenewalUploadModal open={showUploadModal} onClose={() => setShowUploadModal(false)} context={context} />
      <RenewalDetailDrawer record={selectedRecord} open={!!selectedRecord} onClose={() => setSelectedRecord(null)} context={context} teamMembers={teamMembers} />
      
      {/* Quick Activity Modal */}
      {quickActivityRecord && quickActivityType && (
        <ScheduleActivityModal
          open={!!quickActivityRecord}
          onClose={() => {
            setQuickActivityRecord(null);
            setQuickActivityType(null);
          }}
          record={quickActivityRecord}
          context={context}
          teamMembers={teamMembers}
          initialActivityType={quickActivityType}
        />
      )}
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Records</AlertDialogTitle><AlertDialogDescription>Delete {selectedIds.size} record(s)?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      {/* Contact Profile Modal */}
      {context && (
        <ContactProfileModal
          contactId={profileContactId}
          agencyId={context.agencyId}
          open={!!profileContactId}
          onClose={() => {
            setProfileContactId(null);
            setProfileRenewalRecord(null);
          }}
          defaultSourceModule="renewal"
          currentStage="renewal"
          renewalRecord={profileRenewalRecord || undefined}
          userId={context.userId || undefined}
          staffMemberId={context.staffMemberId || undefined}
          displayName={context.displayName}
        />
      )}
    </div>
  );
}
