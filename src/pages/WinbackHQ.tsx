import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Upload, Users, Calendar, AlertCircle, CheckCircle, Clock, Trash2, X, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DateRange } from 'react-day-picker';
import { formatDistanceToNow, format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  WinbackUploadModal,
  WinbackSettings,
  WinbackFilters,
  WinbackHouseholdTable,
  WinbackHouseholdModal,
  WinbackPagination,
  WinbackActivityStats,
  WinbackActivitySummary,
  TerminationAnalytics,
  WinbackUploadHistory,
} from '@/components/winback';
import { ContactProfileModal } from '@/components/contacts';
import type { WinbackStatus, QuickDateFilter } from '@/components/winback/WinbackFilters';
import type { Household, SortColumn, SortDirection } from '@/components/winback/WinbackHouseholdTable';
import * as winbackApi from '@/lib/winbackApi';

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

interface WinbackUploadRow {
  id: string;
  filename: string;
  created_at: string;
  records_processed: number;
  records_new_households: number;
  records_new_policies: number;
  records_updated: number;
  records_skipped: number;
  uploaded_by_staff_id: string | null;
  uploaded_by_user_id: string | null;
}

interface LatestWinbackUpload {
  upload: WinbackUploadRow;
  uploadedBy: string;
}

function formatUploadAge(dateString: string | null): string {
  if (!dateString) return 'Never uploaded';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return formatDistanceToNow(date, { addSuffix: true });
}

function formatUploadTooltip(upload: WinbackUploadRow | null, uploadedBy: string | null): string {
  if (!upload?.created_at) {
    return 'No upload recorded yet';
  }

  const uploadedDate = new Date(upload.created_at);
  if (Number.isNaN(uploadedDate.getTime())) {
    return 'Invalid upload timestamp';
  }

  const dateLabel = format(uploadedDate, 'PPpp');
  const uploadedByLabel = uploadedBy || 'Unknown';
  const fileLabel = upload.filename ? ` (file: ${upload.filename})` : '';
  return `Uploaded ${dateLabel} by ${uploadedByLabel}${fileLabel}`;
}

async function resolveWinbackUploadUploader(upload: WinbackUploadRow): Promise<string> {
  if (upload.uploaded_by_staff_id) {
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('name')
      .eq('id', upload.uploaded_by_staff_id)
      .maybeSingle();

    if (teamMember?.name) {
      return teamMember.name;
    }
  }

  if (upload.uploaded_by_user_id) {
    const { data: uploaderProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', upload.uploaded_by_user_id)
      .maybeSingle();

    if (uploaderProfile?.full_name) {
      return uploaderProfile.full_name;
    }

    if (uploaderProfile?.email) {
      return uploaderProfile.email;
    }
  }

  return 'Unknown';
}

export default function WinbackHQ() {
  const { user, loading: authLoading } = useAuth();
  const { user: staffUser, loading: staffLoading, isAuthenticated: isStaffAuthenticated, sessionToken: staffSessionToken } = useStaffAuth();
  const location = useLocation();

  // Core state
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [contactDaysBefore, setContactDaysBefore] = useState(45);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [mainTab, setMainTab] = useState<'opportunities' | 'analysis'>('opportunities');
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

  // Contact profile modal
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
  const [profileHouseholdId, setProfileHouseholdId] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Handler for viewing profile - finds the household to pass to modal
  const handleViewProfile = (contactId: string) => {
    const household = households.find(h => h.contact_id === contactId);
    setProfileContactId(contactId);
    setProfileHouseholdId(household?.id || null);
  };

  // Unified function to load households via winbackApi (works for both staff and non-staff)
  const loadHouseholds = async (agency: string, members: TeamMember[]) => {
    try {
      const { households: householdsData, count } = await winbackApi.listHouseholds({
        agencyId: agency,
        activeTab,
        search,
        statusFilter,
        dateRange,
        sortColumn,
        sortDirection,
        currentPage,
        pageSize,
      });

      // Map assigned_to to assigned_name
      const householdsWithNames = householdsData.map((h) => ({
        ...h,
        assigned_name: members.find((m) => m.id === h.assigned_to)?.name || null,
      }));

      setHouseholds(householdsWithNames as Household[]);
      setTotalCount(count);
    } catch (err) {
      console.error('Error fetching households:', err);
      toast.error('Failed to load households');
    }
  };

  // Unified function to load stats via winbackApi
  const loadStats = async (agency: string) => {
    try {
      const statsData = await winbackApi.getStats(agency);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Fetch initial data - supports both auth systems
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading || staffLoading) return;

    const isStaffRoute = location.pathname.startsWith('/staff');

    // Staff portal user
    if (isStaffRoute && isStaffAuthenticated && staffUser) {
      const staffAgencyId = staffUser.agency_id;
      setAgencyId(staffAgencyId);
      fetchInitialData(staffAgencyId, staffUser.team_member_id || null);
      return;
    }

    // Regular agency user
    if (user?.id) {
      fetchInitialDataForRegularUser();
    }
  }, [user?.id, staffUser, authLoading, staffLoading, isStaffAuthenticated, location.pathname]);

  // Refetch households when filters/sorting/pagination change (using winbackApi)
  useEffect(() => {
    // Skip on initial load when we don't have teamMembers yet
    if (agencyId && teamMembers.length > 0) {
      loadHouseholds(agencyId, teamMembers);
    }
  }, [agencyId, activeTab, search, statusFilter, dateRange, sortColumn, sortDirection, currentPage, pageSize]);

  // Unified initial data fetch (uses winbackApi for both staff and non-staff)
  const fetchInitialData = async (agency: string, staffTeamMemberId: string | null) => {
    setLoading(true);
    try {
      // Get winback settings via API
      const settings = await winbackApi.getSettings(agency);
      setContactDaysBefore(settings.contact_days_before);

      // Get team members via API
      const members = await winbackApi.listTeamMembers(agency);
      setTeamMembers(members);

      // Set current user's team member ID
      if (staffTeamMemberId) {
        setCurrentUserTeamMemberId(staffTeamMemberId);
      }

      // Fetch stats and households via API
      await loadStats(agency);
      await loadHouseholds(agency, members);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data for regular agency users
  const fetchInitialDataForRegularUser = async () => {
    setLoading(true);
    try {
      // Get agency ID from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('agency_id, email')
        .eq('id', user!.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.agency_id) {
        toast.error('No agency found for your account');
        setLoading(false);
        return;
      }

      setAgencyId(profile.agency_id);

      // Get winback settings via API
      const settings = await winbackApi.getSettings(profile.agency_id);
      setContactDaysBefore(settings.contact_days_before);

      // Get team members via API
      const members = await winbackApi.listTeamMembers(profile.agency_id);
      setTeamMembers(members);

      // Find if current user has a matching team member record
      if (profile.email && members) {
        const matchingMember = members.find(m => 
          m.email?.toLowerCase() === profile.email.toLowerCase()
        );
        if (matchingMember) {
          setCurrentUserTeamMemberId(matchingMember.id);
        }
      }

      // Fetch stats and households via API
      await loadStats(profile.agency_id);
      await loadHouseholds(profile.agency_id, members);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Remove duplicate fetchStats - now using loadStats with winbackApi above

  // Remove duplicate fetchHouseholds - now using loadHouseholds with winbackApi above

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
      setSelectedIds(new Set());
      await loadStats(agencyId);
      await loadHouseholds(agencyId, teamMembers);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      await winbackApi.bulkDeleteHouseholds(Array.from(selectedIds));
      setSelectedIds(new Set());
      if (agencyId) {
        await loadStats(agencyId);
        await loadHouseholds(agencyId, teamMembers);
      }
      toast.success(`${selectedIds.size} household(s) deleted`);
    } catch (err: any) {
      toast.error('Failed to delete households', { description: err?.message });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleUploadComplete = async () => {
    if (agencyId) {
      await loadStats(agencyId);
      await loadHouseholds(agencyId, teamMembers);
    }
  };

  const handleRefresh = async () => {
    if (agencyId) {
      setRefreshing(true);
      try {
        await loadStats(agencyId);
        await loadHouseholds(agencyId, teamMembers);
        toast.success('Data refreshed');
      } catch (err) {
        console.error('Error refreshing:', err);
        toast.error('Failed to refresh data');
      } finally {
        setRefreshing(false);
      }
    }
  };

  const { data: latestUpload, isLoading: latestUploadLoading } = useQuery({
    queryKey: ['winback-uploads', agencyId, 'latest'],
    queryFn: async (): Promise<LatestWinbackUpload | null> => {
      if (!agencyId) return null;

      if (winbackApi.isStaffUser()) {
        const uploads = await winbackApi.listUploads(agencyId);
        const latest = uploads?.[0] as WinbackUploadRow | undefined;
        if (!latest) return null;

        return {
          upload: latest,
          uploadedBy: await resolveWinbackUploadUploader(latest),
        };
      }

      const { data, error } = await supabase
        .from('winback_uploads')
        .select('id, filename, created_at, records_processed, records_new_households, records_new_policies, records_updated, records_skipped, uploaded_by_staff_id, uploaded_by_user_id')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const upload = (data?.[0] as WinbackUploadRow | undefined) || null;
      if (!upload) return null;

      return {
        upload,
        uploadedBy: await resolveWinbackUploadUploader(upload),
      };
    },
    enabled: !!agencyId,
  });

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
            <h1 className="text-2xl font-bold">Winback HQ</h1>
            <p className="text-muted-foreground">Track and manage terminated policy opportunities</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setUploadModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Terminations
          </Button>
        </div>
      </div>

      {agencyId && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Latest termination upload
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latestUploadLoading ? (
              <div className="text-sm text-muted-foreground">Checking latest upload...</div>
            ) : latestUpload ? (
              <div className="space-y-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-sm">
                        Last uploaded <span className="text-foreground">{formatUploadAge(latestUpload.upload.created_at)}</span> by{' '}
                        <span className="text-foreground font-medium">{latestUpload.uploadedBy}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{formatUploadTooltip(latestUpload.upload, latestUpload.uploadedBy)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="text-xs text-muted-foreground">
                  {latestUpload.upload.filename} • {latestUpload.upload.records_processed} records processed
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No uploads yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'opportunities' | 'analysis')}>
        <TabsList className="mb-6">
          <TabsTrigger value="opportunities">Win-Back Opportunities</TabsTrigger>
          <TabsTrigger value="analysis">Termination Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-6 mt-0">
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

          {/* Activity Stats - Real-time */}
          {agencyId && (
            <WinbackActivityStats
              agencyId={agencyId}
              wonBackCount={stats.wonBack}
            />
          )}

          {/* Daily Activity Summary by Team Member */}
          {agencyId && (
            <WinbackActivitySummary agencyId={agencyId} />
          )}

          {/* Settings & Upload History (collapsible) */}
          {agencyId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <WinbackSettings
                agencyId={agencyId}
                contactDaysBefore={contactDaysBefore}
                onSettingsChange={(days) => setContactDaysBefore(days)}
              />
              <WinbackUploadHistory agencyId={agencyId} onDeleteComplete={handleUploadComplete} />
            </div>
          )}

          {/* Household Tabs */}
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
                onViewProfile={handleViewProfile}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
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
                onViewProfile={handleViewProfile}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
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
        </TabsContent>

        <TabsContent value="analysis" className="mt-0">
          {agencyId && <TerminationAnalytics agencyId={agencyId} />}
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
        agencyId={agencyId}
        onUpdate={handleModalUpdate}
      />

      {/* Contact Profile Modal */}
      {agencyId && (
        <ContactProfileModal
          contactId={profileContactId}
          agencyId={agencyId}
          open={!!profileContactId}
          onClose={() => {
            setProfileContactId(null);
            setProfileHouseholdId(null);
          }}
          defaultSourceModule="winback"
          currentStage="winback"
          winbackHousehold={profileHouseholdId ? { id: profileHouseholdId } : undefined}
          teamMembers={teamMembers}
          currentUserTeamMemberId={currentUserTeamMemberId}
          staffSessionToken={staffSessionToken || null}
          onActivityLogged={() => {
            // Refresh data when activity is logged
            if (agencyId) loadHouseholds(agencyId, teamMembers);
          }}
        />
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border shadow-lg rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={bulkDeleting}>
                {bulkDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-3 w-3 mr-1" />
                )}
                Delete Selected
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedIds.size} household{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the selected households and all associated policies and activities. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
