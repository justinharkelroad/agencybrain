import { useEffect, useState, useMemo, useCallback } from "react";
import { hasOneOnOneAccess } from "@/utils/tierAccess";
import { useNavigate, useLocation } from "react-router-dom";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { supabase } from "@/integrations/supabase/client";
import { clearStaffTokenIfNotStaffRoute } from "@/lib/cancel-audit-api";
import { CancelAuditUploadModal } from "@/components/cancel-audit/CancelAuditUploadModal";
import { CancelAuditFilterBar } from "@/components/cancel-audit/CancelAuditFilterBar";
import { CancelAuditRecordCard } from "@/components/cancel-audit/CancelAuditRecordCard";
import { CancelAuditRecordSkeletonList } from "@/components/cancel-audit/CancelAuditRecordSkeleton";
import { CancelAuditEmptyState } from "@/components/cancel-audit/CancelAuditEmptyState";
import { WeeklyStatsSummary } from "@/components/cancel-audit/WeeklyStatsSummary";
import { CancelAuditHeroStats } from "@/components/cancel-audit/CancelAuditHeroStats";
import { CancelAuditActivitySummary } from "@/components/cancel-audit/CancelAuditActivitySummary";
import { UrgencyTimeline } from "@/components/cancel-audit/UrgencyTimeline";
import { ExportButton } from "@/components/cancel-audit/ExportButton";
import { BulkActions, RecordStatus } from "@/components/cancel-audit/BulkActions";
import { useCancelAuditRecords, ViewMode } from "@/hooks/useCancelAuditRecords";
import { useCancelAuditStats } from "@/hooks/useCancelAuditStats";
import { useCancelAuditCounts } from "@/hooks/useCancelAuditCounts";
import { useBulkDeleteCancelAuditRecords } from "@/hooks/useCancelAuditDelete";
import { useToast } from "@/hooks/use-toast";
import { ReportType, RecordStatus as RecordStatusType } from "@/types/cancel-audit";
import { useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { differenceInDays, startOfDay, parseISO } from 'date-fns';

const CancelAuditPage = () => {
  const { user, membershipTier, loading: authLoading } = useAuth();
  const { user: staffUser, loading: staffLoading, isAuthenticated: isStaffAuthenticated } = useStaffAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast: showToast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  
  // Agency context
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [staffMemberId, setStaffMemberId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('Unknown User');
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);

  // View mode - default to "Needs Attention"
  const [viewMode, setViewMode] = useState<ViewMode>('needs_attention');

  // Filter and UI state
  const [reportTypeFilter, setReportTypeFilter] = useState<ReportType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RecordStatusType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<'urgency' | 'name' | 'date_added' | 'cancel_status'>('urgency');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showUntouchedOnly, setShowUntouchedOnly] = useState(false);
  const [showCurrentOnly, setShowCurrentOnly] = useState(true);
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);
  
  // Selection state for bulk actions
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  
  // Bulk delete mutation
  const bulkDeleteMutation = useBulkDeleteCancelAuditRecords();
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Clear stale staff tokens when on non-staff route
  useEffect(() => {
    clearStaffTokenIfNotStaffRoute();
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch records with viewMode
  const { data: records, isLoading: recordsLoading, refetch } = useCancelAuditRecords({
    agencyId,
    viewMode,
    reportTypeFilter,
    searchQuery: debouncedSearch,
    sortBy,
    showCurrentOnly,
  });

  // Fetch stats to get week range
  const { data: stats } = useCancelAuditStats({ agencyId, weekOffset });

  // Fetch counts for view toggle badges
  const { data: viewCounts } = useCancelAuditCounts(agencyId);

  // Apply additional filters (status, untouched, and urgency)
  const filteredRecords = useMemo(() => {
    if (!records) return [];
    let filtered = records;
    
    // Status filter (only in 'all' view mode)
    if (viewMode === 'all' && statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    // Untouched filter
    if (showUntouchedOnly) {
      filtered = filtered.filter(r => r.activity_count === 0);
    }
    
    // Urgency filter
    if (urgencyFilter) {
      const today = startOfDay(new Date());
      
      filtered = filtered.filter(record => {
        const dateStr = record.pending_cancel_date || record.cancel_date;
        if (!dateStr) return false;
        
        const cancelDate = startOfDay(parseISO(dateStr));
        const daysUntil = differenceInDays(cancelDate, today);
        
        switch (urgencyFilter) {
          case 'overdue':
            return daysUntil <= 0; // Past due or due today
          case 'tomorrow':
            return daysUntil === 1;
          case '3days':
            return daysUntil >= 2 && daysUntil <= 3;
        case '7days':
          return daysUntil >= 4 && daysUntil <= 7;
        case '14days':
          return daysUntil >= 8 && daysUntil <= 14;
        case 'beyond':
          return daysUntil > 14;
        default:
          return true;
        }
      });
    }
    
    return filtered;
  }, [records, viewMode, statusFilter, showUntouchedOnly, urgencyFilter]);

  // Count untouched records
  const untouchedCount = useMemo(() => {
    return records?.filter(r => r.activity_count === 0).length || 0;
  }, [records]);

  const filterCounts = useMemo(() => {
    const all = records || [];
    return {
      all: all.length,
      pending_cancel: all.filter(r => r.report_type === 'pending_cancel').length,
      cancellation: all.filter(r => r.report_type === 'cancellation').length,
    };
  }, [records]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedRecordIds([]);
  }, [viewMode, reportTypeFilter, statusFilter, showUntouchedOnly, showCurrentOnly, debouncedSearch, urgencyFilter]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + U = Open upload modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
        e.preventDefault();
        setUploadModalOpen(true);
      }
      // Escape = Close expanded card
      if (e.key === 'Escape' && expandedRecordId) {
        setExpandedRecordId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedRecordId]);

  useEffect(() => {
    const checkAccess = async () => {
      // Wait for both auth systems to finish loading completely
      if (authLoading || staffLoading) return;
      
      // Determine if this is a staff portal context
      const isStaffRoute = location.pathname.startsWith('/staff');
      
      // Staff portal user
      if (isStaffRoute && isStaffAuthenticated && staffUser) {
        setAgencyId(staffUser.agency_id);
        setStaffMemberId(staffUser.team_member_id);
        setDisplayName(staffUser.team_member_name || staffUser.display_name || staffUser.username);
        setHasAccess(true);
        
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
      
      // Regular user (owner/admin)
      // IMPORTANT: Only redirect if auth is fully loaded AND no user exists
      // The ProtectedRoute wrapper should handle auth redirects, but as a safety net:
      if (!user) {
        // If on staff route but not staff authenticated, redirect to staff login
        if (isStaffRoute) {
          navigate("/staff/login", { replace: true });
        }
        // For non-staff routes, let ProtectedRoute handle the redirect
        // Don't redirect here - it causes race conditions with auth hydration
        setLoading(false);
        return;
      }

      // Check membership tier - must be Boardroom or 1:1 Coaching tier
      // Uses centralized tier utility to handle all format variations
      const hasTierAccess = hasOneOnOneAccess(membershipTier);

      // Get user profile and agency info
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, agency_id, full_name, email')
        .eq('id', user.id)
        .single();

      if (!hasTierAccess && profile?.role !== 'admin') {
        navigate("/dashboard");
        return;
      }

      // Set agency context
      const userAgencyId = profile?.agency_id || user.user_metadata?.staff_agency_id;
      
      if (!userAgencyId) {
        showToast({
          title: "Error",
          description: "No agency associated with your account",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setAgencyId(userAgencyId);
      
      // Check if staff portal user via regular auth (legacy support)
      const staffAgencyId = user.user_metadata?.staff_agency_id;
      if (staffAgencyId) {
        // Staff portal user - get staff member info
        const staffMemberIdFromMeta = user.user_metadata?.staff_member_id;
        if (staffMemberIdFromMeta) {
          const { data: staffMember } = await supabase
            .from('team_members')
            .select('id, name')
            .eq('id', staffMemberIdFromMeta)
            .single();
          
          if (staffMember) {
            setStaffMemberId(staffMember.id);
            setDisplayName(staffMember.name);
          }
        }
      } else {
        // Regular auth user
        setUserId(user.id);
        setDisplayName(profile?.full_name || profile?.email || user.email || 'Unknown User');
      }

      // Fetch team members for regular user
      try {
        const { data: members } = await supabase
          .from('team_members')
          .select('id, name')
          .eq('agency_id', userAgencyId)
          .eq('status', 'active')
          .order('name');
        setTeamMembers(members || []);
      } catch (err) {
        console.error('Error fetching team members:', err);
      }

      setHasAccess(true);
      setLoading(false);
    };

    checkAccess();
  }, [user, membershipTier, authLoading, staffUser, staffLoading, isStaffAuthenticated, location.pathname, navigate, showToast]);

  const handleUploadComplete = useCallback(() => {
    showToast({
      title: "Upload Complete",
      description: "Records have been processed successfully",
    });
    // Invalidate and refetch records + stats + counts
    queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
    queryClient.invalidateQueries({ queryKey: ['cancel-audit-stats'] });
    queryClient.invalidateQueries({ queryKey: ['cancel-audit-uploads'] });
    queryClient.invalidateQueries({ queryKey: ['cancel-audit-counts'] });
  }, [showToast, queryClient]);

  const handleToggleExpand = useCallback((recordId: string) => {
    setExpandedRecordId(prev => prev === recordId ? null : recordId);
  }, []);

  const handleClearFilters = useCallback(() => {
    setReportTypeFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setShowUntouchedOnly(false);
    setShowCurrentOnly(true);
    setUrgencyFilter(null);
  }, []);

  const handleSelectRecord = useCallback((recordId: string, selected: boolean) => {
    setSelectedRecordIds(prev => 
      selected 
        ? [...prev, recordId]
        : prev.filter(id => id !== recordId)
    );
  }, []);

  const handleBulkStatusUpdate = useCallback(async (status: RecordStatus) => {
    if (selectedRecordIds.length === 0) return;
    
    setIsBulkUpdating(true);
    try {
      const { error } = await supabase
        .from('cancel_audit_records')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', selectedRecordIds);
      
      if (error) throw error;
      
      toast.success(`Updated ${selectedRecordIds.length} records to ${status.replace('_', ' ')}`);
      setSelectedRecordIds([]);
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
      queryClient.invalidateQueries({ queryKey: ['cancel-audit-counts'] });
    } catch (error) {
      toast.error('Failed to update records');
    } finally {
      setIsBulkUpdating(false);
    }
  }, [selectedRecordIds, queryClient]);

  const handleBulkDelete = useCallback(() => {
    if (selectedRecordIds.length === 0) return;
    
    bulkDeleteMutation.mutate(selectedRecordIds, {
      onSuccess: () => {
        setSelectedRecordIds([]);
      },
    });
  }, [selectedRecordIds, bulkDeleteMutation]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  const hasRecords = (viewCounts?.all || 0) > 0;
  const hasFilteredRecords = filteredRecords.length > 0;
  const isFiltering = reportTypeFilter !== 'all' || statusFilter !== 'all' || debouncedSearch.length > 0 || showUntouchedOnly || !showCurrentOnly || urgencyFilter !== null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Cancel Audit</h1>
              <p className="text-muted-foreground mt-1">
                Track and manage cancellation and pending cancel reports
              </p>
            </div>
            <div className="flex items-center gap-2">
              {agencyId && stats && (
                <ExportButton
                  agencyId={agencyId}
                  viewMode={viewMode}
                  reportTypeFilter={reportTypeFilter}
                  searchQuery={debouncedSearch}
                  weekStart={stats.weekStart}
                  weekEnd={stats.weekEnd}
                  recordCount={filteredRecords.length}
                />
              )}
              <Button onClick={() => setUploadModalOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Stats */}
      {agencyId && (
        <div className="container mx-auto px-4 py-6 pb-0">
          <CancelAuditHeroStats agencyId={agencyId} />
        </div>
      )}

      {/* Weekly Stats Summary */}
      {agencyId && (
        <div className="container mx-auto px-4 py-6">
          <WeeklyStatsSummary
            agencyId={agencyId}
            weekOffset={weekOffset}
            onWeekChange={setWeekOffset}
          />
        </div>
      )}

      {/* Activity Summary */}
      {agencyId && (
        <div className="container mx-auto px-4 pb-4">
          <CancelAuditActivitySummary agencyId={agencyId} />
        </div>
      )}

      {/* Urgency Timeline */}
      {agencyId && records && (
        <div className="container mx-auto px-4 pb-4">
          <UrgencyTimeline 
            records={records}
            onFilterByUrgency={setUrgencyFilter}
            activeUrgencyFilter={urgencyFilter}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-12">
        {hasRecords ? (
          <div className="space-y-6">
            {/* Filter Bar */}
            <CancelAuditFilterBar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              needsAttentionCount={viewCounts?.needsAttention || 0}
              allRecordsCount={viewCounts?.all || 0}
              reportTypeFilter={reportTypeFilter}
              onReportTypeFilterChange={setReportTypeFilter}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              counts={filterCounts}
              isLoading={recordsLoading}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              showUntouchedOnly={showUntouchedOnly}
              onShowUntouchedOnlyChange={setShowUntouchedOnly}
              untouchedCount={untouchedCount}
              showCurrentOnly={showCurrentOnly}
              onShowCurrentOnlyChange={setShowCurrentOnly}
              supersededCount={viewCounts?.superseded || 0}
            />

            {/* Records List */}
            {recordsLoading ? (
              <CancelAuditRecordSkeletonList count={5} />
            ) : hasFilteredRecords ? (
              <div className="space-y-3">
                {/* Select All Header */}
                <div className="flex items-center gap-2 px-1 py-2 border-b border-border">
                  <Checkbox
                    checked={selectedRecordIds.length === filteredRecords.length && filteredRecords.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRecordIds(filteredRecords.map(r => r.id));
                      } else {
                        setSelectedRecordIds([]);
                      }
                    }}
                    className="flex-shrink-0"
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all ({filteredRecords.length})
                  </span>
                </div>
                {filteredRecords.map((record) => (
                  <div key={record.id} className="flex items-start gap-2">
                    <Checkbox
                      checked={selectedRecordIds.includes(record.id)}
                      onCheckedChange={(checked) => handleSelectRecord(record.id, !!checked)}
                      className="mt-4 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <CancelAuditRecordCard
                        record={record}
                        isExpanded={expandedRecordId === record.id}
                        onToggleExpand={() => handleToggleExpand(record.id)}
                        agencyId={agencyId!}
                        userId={userId || undefined}
                        staffMemberId={staffMemberId || undefined}
                        userDisplayName={displayName}
                        teamMembers={teamMembers}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <CancelAuditEmptyState
                variant="no-results"
                onClearFilters={handleClearFilters}
                statusFilter={statusFilter}
                searchQuery={debouncedSearch}
                showUntouchedOnly={showUntouchedOnly}
                viewMode={viewMode}
              />
            )}
          </div>
        ) : (
          <CancelAuditEmptyState
            variant="no-records"
            onUploadClick={() => setUploadModalOpen(true)}
          />
        )}
      </div>

      {/* Bulk Actions Bar */}
      <BulkActions
        selectedRecordIds={selectedRecordIds}
        onClearSelection={() => setSelectedRecordIds([])}
        onStatusUpdate={handleBulkStatusUpdate}
        onDelete={handleBulkDelete}
        isUpdating={isBulkUpdating}
        isDeleting={bulkDeleteMutation.isPending}
      />

      {/* Upload Modal */}
      {agencyId && (
        <CancelAuditUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          agencyId={agencyId}
          userId={userId}
          staffMemberId={staffMemberId}
          displayName={displayName}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </div>
  );
};

export default CancelAuditPage;
