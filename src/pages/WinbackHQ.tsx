import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Upload, Users, Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { startOfWeek, endOfWeek } from 'date-fns';
import { DateRange } from 'react-day-picker';
import {
  WinbackUploadModal,
  WinbackSettings,
  WinbackFilters,
  WinbackHouseholdTable,
  WinbackHouseholdModal,
  WinbackPagination,
} from '@/components/winback';
import type { WinbackStatus, QuickDateFilter } from '@/components/winback/WinbackFilters';
import type { Household, SortColumn, SortDirection } from '@/components/winback/WinbackHouseholdTable';

interface Stats {
  totalHouseholds: number;
  untouched: number;
  inProgress: number;
  wonBack: number;
  dismissed: number;
  teedUpThisWeek: number;
}

interface TeamMember {
  id: string;
  name: string;
}

export default function WinbackHQ() {
  const { user } = useAuth();

  // Core state
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [contactDaysBefore, setContactDaysBefore] = useState(45);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'dismissed'>('active');

  // Data
  const [households, setHouseholds] = useState<Household[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalHouseholds: 0,
    untouched: 0,
    inProgress: 0,
    wonBack: 0,
    dismissed: 0,
    teedUpThisWeek: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WinbackStatus>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [quickDateFilter, setQuickDateFilter] = useState<QuickDateFilter>('all');

  // Sorting & Pagination
  const [sortColumn, setSortColumn] = useState<SortColumn>('earliest_winback_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Modal
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentUserTeamMemberId, setCurrentUserTeamMemberId] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    if (user?.id) {
      fetchInitialData();
    }
  }, [user?.id]);

  // Refetch households when filters/sorting/pagination change
  useEffect(() => {
    if (agencyId) {
      fetchHouseholds(agencyId);
    }
  }, [agencyId, activeTab, search, statusFilter, dateRange, sortColumn, sortDirection, currentPage, pageSize]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Get agency ID from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user!.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.agency_id) {
        toast.error('No agency found for your account');
        setLoading(false);
        return;
      }

      setAgencyId(profile.agency_id);

      // Get winback settings
      const { data: settings } = await supabase
        .from('winback_settings')
        .select('contact_days_before')
        .eq('agency_id', profile.agency_id)
        .single();

      if (settings) {
        setContactDaysBefore(settings.contact_days_before);
      }

      // Get team members
      const { data: members } = await supabase
        .from('team_members')
        .select('id, name, email')
        .eq('agency_id', profile.agency_id)
        .eq('status', 'active')
        .order('name');

      setTeamMembers(members || []);

      // Find if current user has a matching team member record
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user!.id)
        .single();

      if (userProfile?.email && members) {
        const matchingMember = members.find(m => 
          m.email?.toLowerCase() === userProfile.email.toLowerCase()
        );
        if (matchingMember) {
          setCurrentUserTeamMemberId(matchingMember.id);
        }
      }

      // Fetch stats and households
      await fetchStats(profile.agency_id);
      await fetchHouseholds(profile.agency_id);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (agency: string) => {
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      // Get all counts in parallel
      const [totalRes, untouchedRes, inProgressRes, wonBackRes, dismissedRes, teedUpRes] =
        await Promise.all([
          supabase
            .from('winback_households')
            .select('id', { count: 'exact', head: true })
            .eq('agency_id', agency)
            .neq('status', 'dismissed'),
          supabase
            .from('winback_households')
            .select('id', { count: 'exact', head: true })
            .eq('agency_id', agency)
            .eq('status', 'untouched'),
          supabase
            .from('winback_households')
            .select('id', { count: 'exact', head: true })
            .eq('agency_id', agency)
            .eq('status', 'in_progress'),
          supabase
            .from('winback_households')
            .select('id', { count: 'exact', head: true })
            .eq('agency_id', agency)
            .eq('status', 'won_back'),
          supabase
            .from('winback_households')
            .select('id', { count: 'exact', head: true })
            .eq('agency_id', agency)
            .eq('status', 'dismissed'),
          supabase
            .from('winback_households')
            .select('id', { count: 'exact', head: true })
            .eq('agency_id', agency)
            .neq('status', 'dismissed')
            .gte('earliest_winback_date', weekStart.toISOString())
            .lte('earliest_winback_date', weekEnd.toISOString()),
        ]);

      setStats({
        totalHouseholds: totalRes.count || 0,
        untouched: untouchedRes.count || 0,
        inProgress: inProgressRes.count || 0,
        wonBack: wonBackRes.count || 0,
        dismissed: dismissedRes.count || 0,
        teedUpThisWeek: teedUpRes.count || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchHouseholds = async (agency: string, members?: typeof teamMembers) => {
    const membersToUse = members || teamMembers;
    try {
      let query = supabase
        .from('winback_households')
        .select('*', { count: 'exact' })
        .eq('agency_id', agency);

      // Tab filter
      if (activeTab === 'dismissed') {
        query = query.eq('status', 'dismissed');
      } else {
        query = query.neq('status', 'dismissed');
      }

      // Status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Date range filter
      if (dateRange?.from) {
        query = query.gte('earliest_winback_date', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte('earliest_winback_date', dateRange.to.toISOString());
      }

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        query = query.or(
          `first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%,phone.ilike.%${searchLower}%,email.ilike.%${searchLower}%`
        );
      }

      // Sorting
      const sortColumnMap: Record<SortColumn, string> = {
        name: 'last_name',
        policy_count: 'policy_count',
        total_premium_cents: 'total_premium_cents',
        earliest_winback_date: 'earliest_winback_date',
        status: 'status',
        assigned_name: 'assigned_to',
      };
      query = query.order(sortColumnMap[sortColumn], { ascending: sortDirection === 'asc' });

      // Pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Map assigned_to to assigned_name
      const householdsWithNames = (data || []).map((h) => ({
        ...h,
        assigned_name: membersToUse.find((m) => m.id === h.assigned_to)?.name || null,
      }));

      setHouseholds(householdsWithNames as Household[]);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching households:', err);
      toast.error('Failed to load households');
    }
  };

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDateRange(undefined);
    setQuickDateFilter('all');
    setCurrentPage(1);
  };

  const handleRowClick = (household: Household) => {
    setSelectedHousehold(household);
    setDetailModalOpen(true);
  };

  const handleModalUpdate = async () => {
    if (agencyId) {
      await fetchStats(agencyId);
      await fetchHouseholds(agencyId, teamMembers);
    }
  };

  const handleUploadComplete = async () => {
    if (agencyId) {
      await fetchStats(agencyId);
      await fetchHouseholds(agencyId, teamMembers);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Win-Back HQ</h1>
            <p className="text-muted-foreground">Track and manage terminated policy opportunities</p>
          </div>
        </div>
        <Button onClick={() => setUploadModalOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Terminations
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Households</CardDescription>
            <CardTitle className="text-3xl">{stats.totalHouseholds}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Users className="h-4 w-4 mr-1" />
              Active opportunities
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Teed Up This Week</CardDescription>
            <CardTitle className="text-3xl">{stats.teedUpThisWeek}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 mr-1" />
              Ready to contact
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Untouched</CardDescription>
            <CardTitle className="text-3xl">{stats.untouched}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 mr-1" />
              Need attention
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Progress</CardDescription>
            <CardTitle className="text-3xl">{stats.inProgress}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              Being worked
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Won Back</CardDescription>
            <CardTitle className="text-3xl">{stats.wonBack}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 mr-1" />
              Successfully retained
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings (collapsible) */}
      {agencyId && (
        <WinbackSettings
          agencyId={agencyId}
          contactDaysBefore={contactDaysBefore}
          onSettingsChange={(days) => setContactDaysBefore(days)}
        />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'dismissed')}>
        <TabsList>
          <TabsTrigger value="active">Active ({stats.totalHouseholds})</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed ({stats.dismissed})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-4">
          <WinbackFilters
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setCurrentPage(1);
            }}
            statusFilter={statusFilter}
            onStatusChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            quickDateFilter={quickDateFilter}
            onQuickDateChange={(v) => {
              setQuickDateFilter(v);
              setCurrentPage(1);
            }}
            dateRange={dateRange}
            onDateRangeChange={(v) => {
              setDateRange(v);
              setCurrentPage(1);
            }}
            onClearFilters={handleClearFilters}
          />

          <WinbackHouseholdTable
            households={households}
            loading={false}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRowClick={handleRowClick}
          />

          <WinbackPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </TabsContent>

        <TabsContent value="dismissed" className="space-y-4 mt-4">
          <WinbackHouseholdTable
            households={households}
            loading={false}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRowClick={handleRowClick}
          />

          <WinbackPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {agencyId && (
        <WinbackUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          agencyId={agencyId}
          contactDaysBefore={contactDaysBefore}
          onUploadComplete={handleUploadComplete}
        />
      )}

      <WinbackHouseholdModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        household={selectedHousehold}
        teamMembers={teamMembers}
        currentUserTeamMemberId={currentUserTeamMemberId}
        onUpdate={handleModalUpdate}
      />
    </div>
  );
}
