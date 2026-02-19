import { useEffect, useState, useMemo, useCallback } from "react";
import { hasOneOnOneAccess } from "@/utils/tierAccess";
import { useNavigate, useLocation } from "react-router-dom";
import { Upload, Loader2, ChevronUp, ChevronDown, ChevronsUpDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStaffAuth } from "@/hooks/useStaffAuth";
import { supabase } from "@/integrations/supabase/client";
import { clearStaffTokenIfNotStaffRoute, callCancelAuditApi } from "@/lib/cancel-audit-api";
import { CancelAuditUploadModal } from "@/components/cancel-audit/CancelAuditUploadModal";
import { CancelAuditFilterBar } from "@/components/cancel-audit/CancelAuditFilterBar";
import { CancelAuditRecordCard } from "@/components/cancel-audit/CancelAuditRecordCard";
import { ContactProfileModal } from "@/components/contacts";
import { CancelAuditRecordSkeletonList } from "@/components/cancel-audit/CancelAuditRecordSkeleton";
import { CancelAuditEmptyState } from "@/components/cancel-audit/CancelAuditEmptyState";
import { WeeklyStatsSummary } from "@/components/cancel-audit/WeeklyStatsSummary";
import { CancelAuditHeroStats } from "@/components/cancel-audit/CancelAuditHeroStats";
import { CancelAuditActivitySummary } from "@/components/cancel-audit/CancelAuditActivitySummary";
import { UrgencyTimeline } from "@/components/cancel-audit/UrgencyTimeline";
import { ExportButton } from "@/components/cancel-audit/ExportButton";
import { HelpButton } from "@/components/HelpButton";
import { BulkActions, RecordStatus } from "@/components/cancel-audit/BulkActions";
import { useCancelAuditRecords, ViewMode, CancelStatusFilter } from "@/hooks/useCancelAuditRecords";
import { useCancelAuditStats } from "@/hooks/useCancelAuditStats";
import { useCancelAuditCounts } from "@/hooks/useCancelAuditCounts";
import { useBulkDeleteCancelAuditRecords } from "@/hooks/useCancelAuditDelete";
import { useBulkUpdateCancelAuditStatus } from "@/hooks/useBulkCancelAuditOperations";
import { useToast } from "@/hooks/use-toast";
import { ReportType, RecordStatus as RecordStatusType, CancelAuditUpload } from "@/types/cancel-audit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { differenceInDays, startOfDay, parseISO, formatDistanceToNow, format } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LatestCancelAuditUploads {
  cancellation: CancelAuditUpload | null;
  pending_cancel: CancelAuditUpload | null;
}

function formatUploadAge(dateString: string | null): string {
  if (!dateString) return 'Never uploaded';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return formatDistanceToNow(date, { addSuffix: true });
}

function formatUploadTooltip(upload: CancelAuditUpload | null): string {
  if (!upload?.created_at) {
    return "No upload recorded yet";
  }

  const uploadedDate = new Date(upload.created_at);
  if (Number.isNaN(uploadedDate.getTime())) {
    return "Invalid upload timestamp";
  }

  const dateLabel = format(uploadedDate, "PPpp");
  const uploadedBy = upload.uploaded_by_name || "Unknown";
  const fileLabel = upload.file_name ? ` (file: ${upload.file_name})` : "";
  return `Uploaded ${dateLabel} by ${uploadedBy}${fileLabel}`;
}

const CancelAuditPage = () => {
  const { user, membershipTier, loading: authLoading } = useAuth();
  const { user: staffUser, loading: staffLoading, isAuthenticated: isStaffAuthenticated, sessionToken: staffSessionToken } = useStaffAuth();
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
  const [viewMode, setViewModeRaw] = useState<ViewMode>('needs_attention');
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeRaw(mode);
    // needs_attention: show dropped records by default; all: hide old resolved/lost by default
    setShowCurrentOnly(mode === 'all');
    setShowDroppedOnly(false);
  }, []);

  // Filter and UI state
  const [reportTypeFilter, setReportTypeFilter] = useState<ReportType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RecordStatusType | 'all'>('all');
  const [cancelStatusFilter, setCancelStatusFilter] = useState<CancelStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<'urgency' | 'name' | 'date_added' | 'cancel_status' | 'original_year' | 'policy_number' | 'premium'>('urgency');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showUntouchedOnly, setShowUntouchedOnly] = useState(false);
  const [showCurrentOnly, setShowCurrentOnly] = useState(false);
  const [showDroppedOnly, setShowDroppedOnly] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);
  
  // Selection state for bulk actions
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // Contact profile modal state
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
  const [profileRecord, setProfileRecord] = useState<{ id: string; household_key: string } | null>(null);

  // Handler for viewing contact profile - captures the record data
  const handleViewProfile = (contactId: string, record: { id: string; household_key: string }) => {
    setProfileContactId(contactId);
    setProfileRecord(record);
  };

  // Bulk actions mutations
  const bulkDeleteMutation = useBulkDeleteCancelAuditRecords();
  const bulkUpdateStatusMutation = useBulkUpdateCancelAuditStatus();
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

  // Mutual exclusion: "Current Only" and "Dropped" are opposites
  const handleShowCurrentOnlyChange = useCallback((value: boolean) => {
    setShowCurrentOnly(value);
    if (value) setShowDroppedOnly(false);
  }, []);

  const handleShowDroppedOnlyChange = useCallback((value: boolean) => {
    setShowDroppedOnly(value);
    if (value) setShowCurrentOnly(false);
  }, []);

  // Fetch records with viewMode
  const { data: records, isLoading: recordsLoading, refetch } = useCancelAuditRecords({
    agencyId,
    viewMode,
    reportTypeFilter,
    searchQuery: debouncedSearch,
    sortBy,
    showCurrentOnly,
    cancelStatusFilter,
  });

  // Fetch stats to get week range
  const { data: stats } = useCancelAuditStats({ agencyId, weekOffset });

  // Fetch counts for view toggle badges
  const { data: viewCounts } = useCancelAuditCounts(agencyId);

  const { data: latestUploads, isLoading: latestUploadsLoading } = useQuery({
    queryKey: ['cancel-audit-latest-uploads', agencyId, staffSessionToken || 'user-route'],
    queryFn: async (): Promise<LatestCancelAuditUploads> => {
      if (!agencyId) {
        return { cancellation: null, pending_cancel: null };
      }

      if (staffSessionToken) {
        return callCancelAuditApi({
          operation: "get_uploads",
          params: {},
          sessionToken: staffSessionToken,
        });
      }

      const { data: cancellationRows, error: cancellationError } = await supabase
        .from('cancel_audit_uploads')
        .select('id, uploaded_by_name, agency_id, report_type, file_name, records_processed, records_created, records_updated, created_at')
        .eq('agency_id', agencyId)
        .eq('report_type', 'cancellation')
        .order('created_at', { ascending: false })
        .limit(1);

      if (cancellationError) throw cancellationError;

      const { data: pendingRows, error: pendingError } = await supabase
        .from('cancel_audit_uploads')
        .select('id, uploaded_by_name, agency_id, report_type, file_name, records_processed, records_created, records_updated, created_at')
        .eq('agency_id', agencyId)
        .eq('report_type', 'pending_cancel')
        .order('created_at', { ascending: false })
        .limit(1);

      if (pendingError) throw pendingError;

      return {
        cancellation: (cancellationRows?.[0] as CancelAuditUpload | undefined) || null,
        pending_cancel: (pendingRows?.[0] as CancelAuditUpload | undefined) || null,
      };
    },
    enabled: !!agencyId,
  });

  // Apply additional filters (status, untouched, and urgency)
  const filteredRecords = useMemo(() => {
    if (!records) return [];
    let filtered = records;
    
    // Status filter (only in 'all' view mode)
    if (viewMode === 'all' && statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    // Dropped-only filter (records no longer in latest report)
    if (showDroppedOnly) {
      filtered = filtered.filter(r => !r.is_active);
    }

    // Untouched filter
    if (showUntouchedOnly) {
      filtered = filtered.filter(r => r.activity_count === 0);
    }

    // Cancel status filter (uses cancel_status + report type fallback)
    if (cancelStatusFilter !== 'all') {
      filtered = filtered.filter((record) => {
        if (!record.cancel_status?.trim()) {
          if (cancelStatusFilter === 'unmatched') return true;
          if (cancelStatusFilter === 'cancel') return record.report_type === 'pending_cancel';
          if (cancelStatusFilter === 'cancelled') return record.report_type === 'cancellation';
          return false;
        }

        return record.cancel_status.trim().toLowerCase() === cancelStatusFilter;
      });
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
  }, [records, viewMode, statusFilter, cancelStatusFilter, showUntouchedOnly, showDroppedOnly, urgencyFilter]);

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

  // Client-side sorting
  const sortedRecords = useMemo(() => {
    const data = filteredRecords || [];
    if (!data.length) return [];

    return [...data].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case 'urgency': {
          const aDate = a.cancel_date || a.pending_cancel_date;
          const bDate = b.cancel_date || b.pending_cancel_date;
          aVal = aDate ? Math.max(0, Math.floor((Date.now() - new Date(aDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;
          bVal = bDate ? Math.max(0, Math.floor((Date.now() - new Date(bDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;
          break;
        }
        case 'name':
          aVal = `${a.insured_last_name || ''} ${a.insured_first_name || ''}`.toLowerCase().trim();
          bVal = `${b.insured_last_name || ''} ${b.insured_first_name || ''}`.toLowerCase().trim();
          break;
        case 'policy_number':
          aVal = a.policy_number || '';
          bVal = b.policy_number || '';
          break;
        case 'original_year':
          aVal = parseInt(a.original_year || '0') || 0;
          bVal = parseInt(b.original_year || '0') || 0;
          break;
        case 'date_added':
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
        case 'cancel_status':
          aVal = (a.cancel_status || a.status || '').toLowerCase();
          bVal = (b.cancel_status || b.status || '').toLowerCase();
          break;
        case 'premium':
          aVal = a.premium_cents || a.amount_due_cents || 0;
          bVal = b.premium_cents || b.amount_due_cents || 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRecords, sortBy, sortDirection]);

  // Sortable header row component
  const SortableHeaderRow = () => {
    const handleHeaderClick = (column: typeof sortBy) => {
      if (sortBy === column) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(column);
        setSortDirection('desc');
      }
    };

    const SortIndicator = ({ column }: { column: typeof sortBy }) => {
      if (sortBy !== column) return <ChevronsUpDown className="h-4 w-4 opacity-40" />;
      return sortDirection === 'asc'
        ? <ChevronUp className="h-4 w-4" />
        : <ChevronDown className="h-4 w-4" />;
    };

    return (
      <div className="flex items-start gap-2 mb-2">
        {/* Spacer for checkbox column */}
        <div className="w-4 flex-shrink-0" />
        {/* Header row matching card layout */}
        <div className="flex-1 flex items-center gap-4 px-4 py-2 bg-muted/50 rounded-lg border text-sm font-medium text-muted-foreground">
          {/* Status/Overdue column */}
          <div
            className="flex-shrink-0 w-20 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => handleHeaderClick('urgency')}
          >
            Overdue <SortIndicator column="urgency" />
          </div>

          {/* Customer name */}
          <div
            className="min-w-0 flex-1 sm:flex-none sm:w-48 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => handleHeaderClick('name')}
          >
            Customer <SortIndicator column="name" />
          </div>

          {/* Policy Number */}
          <div
            className="hidden sm:flex w-28 items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => handleHeaderClick('policy_number')}
          >
            Policy # <SortIndicator column="policy_number" />
          </div>

          {/* Original Year */}
          <div
            className="hidden md:flex w-16 items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => handleHeaderClick('original_year')}
          >
            Orig Yr <SortIndicator column="original_year" />
          </div>

          {/* Product */}
          <div className="hidden md:block w-24">Product</div>

          {/* Date */}
          <div
            className="hidden sm:flex w-28 items-center justify-end gap-1 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => handleHeaderClick('date_added')}
          >
            Date <SortIndicator column="date_added" />
          </div>

          {/* Premium */}
          <div
            className="hidden md:flex w-24 items-center justify-end gap-1 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => handleHeaderClick('premium')}
          >
            Premium <SortIndicator column="premium" />
          </div>

          {/* Status */}
          <div
            className="flex-shrink-0 flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => handleHeaderClick('cancel_status')}
          >
            Status <SortIndicator column="cancel_status" />
          </div>

          {/* Spacer for chevron */}
          <div className="flex-shrink-0 w-5 ml-auto" />
        </div>
      </div>
    );
  };

  // Clear selection when filters change
  useEffect(() => {
    setSelectedRecordIds([]);
  }, [viewMode, reportTypeFilter, statusFilter, showUntouchedOnly, showCurrentOnly, showDroppedOnly, debouncedSearch, urgencyFilter]);

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
    // Toast and query invalidation removed to fix race condition.
    // The useCancelAuditBackgroundUpload hook already shows a toast and 
    // invalidates queries when background processing is actually complete.
    // Previously, this callback fired immediately before data was saved,
    // causing the UI to refetch while the table was still empty.
  }, []);

  const handleToggleExpand = useCallback((recordId: string) => {
    setExpandedRecordId(prev => prev === recordId ? null : recordId);
  }, []);

  const handleClearFilters = useCallback(() => {
    setReportTypeFilter('all');
    setStatusFilter('all');
    setCancelStatusFilter('all');
    setSearchQuery('');
    setDebouncedSearch('');
    setShowUntouchedOnly(false);
    setShowCurrentOnly(viewMode === 'all');
    setShowDroppedOnly(false);
    setUrgencyFilter(null);
  }, [viewMode]);

  const handleSelectRecord = useCallback((recordId: string, selected: boolean) => {
    setSelectedRecordIds(prev => 
      selected 
        ? [...prev, recordId]
        : prev.filter(id => id !== recordId)
    );
  }, []);

  const handleBulkStatusUpdate = useCallback((status: RecordStatus) => {
    if (selectedRecordIds.length === 0) return;
    
    setIsBulkUpdating(true);
    bulkUpdateStatusMutation.mutate(
      { recordIds: selectedRecordIds, status: status as RecordStatusType },
      {
        onSuccess: () => {
          setSelectedRecordIds([]);
          setIsBulkUpdating(false);
        },
        onError: () => {
          setIsBulkUpdating(false);
        },
      }
    );
  }, [selectedRecordIds, bulkUpdateStatusMutation]);

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
  const defaultShowCurrentOnly = viewMode === 'all';
  const isFiltering = reportTypeFilter !== 'all' || statusFilter !== 'all' || cancelStatusFilter !== 'all' || debouncedSearch.length > 0 || showUntouchedOnly || showDroppedOnly || showCurrentOnly !== defaultShowCurrentOnly || urgencyFilter !== null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">Cancel Audit</h1>
                <HelpButton videoKey="cancel_audit" size="sm" />
              </div>
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

      {/* Latest Upload Times */}
      {agencyId && (
        <div className="container mx-auto px-4 pb-4">
          <div className="rounded-md border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4" />
              <span className="font-medium text-foreground">Latest uploads</span>
            </div>
            {latestUploadsLoading ? (
              <div>Checking latest upload times...</div>
            ) : (
              <div className="grid gap-1 sm:grid-cols-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        Cancellation Audit: <span className="text-foreground">{formatUploadAge(latestUploads?.cancellation?.created_at || null)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{formatUploadTooltip(latestUploads?.cancellation || null)}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        Pending Cancel: <span className="text-foreground">{formatUploadAge(latestUploads?.pending_cancel?.created_at || null)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{formatUploadTooltip(latestUploads?.pending_cancel || null)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
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
              cancelStatusFilter={cancelStatusFilter}
              onCancelStatusFilterChange={setCancelStatusFilter}
              showUntouchedOnly={showUntouchedOnly}
              onShowUntouchedOnlyChange={setShowUntouchedOnly}
              untouchedCount={untouchedCount}
              showCurrentOnly={showCurrentOnly}
              onShowCurrentOnlyChange={handleShowCurrentOnlyChange}
              showDroppedOnly={showDroppedOnly}
              onShowDroppedOnlyChange={handleShowDroppedOnlyChange}
              supersededCount={viewCounts?.superseded || 0}
              droppedUnresolvedCount={viewCounts?.droppedUnresolved || 0}
            />

            {/* Records List */}
            {recordsLoading ? (
              <CancelAuditRecordSkeletonList count={5} />
            ) : hasFilteredRecords ? (
              <div className="space-y-3">
                {/* Sortable Header Row */}
                <SortableHeaderRow />
                {/* Select All Header */}
                <div className="flex items-center gap-2 px-1 py-2 border-b border-border">
                  <Checkbox
                    checked={selectedRecordIds.length === sortedRecords.length && sortedRecords.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRecordIds(sortedRecords.map(r => r.id));
                      } else {
                        setSelectedRecordIds([]);
                      }
                    }}
                    className="flex-shrink-0"
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all ({sortedRecords.length})
                  </span>
                </div>
                {sortedRecords.map((record) => (
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
                        onViewProfile={record.contact_id ? () => handleViewProfile(record.contact_id!, { id: record.id, household_key: record.household_key }) : undefined}
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

      {/* Contact Profile Modal */}
      {agencyId && (
        <ContactProfileModal
          contactId={profileContactId}
          agencyId={agencyId}
          open={!!profileContactId}
          onClose={() => {
            setProfileContactId(null);
            setProfileRecord(null);
          }}
          defaultSourceModule="cancel_audit"
          currentStage="cancel_audit"
          cancelAuditRecord={profileRecord || undefined}
          userId={userId || undefined}
          staffMemberId={
            location.pathname.startsWith('/staff')
              ? (staffUser?.id || undefined) // contact_activities.created_by_staff_id references staff_users.id
              : (staffMemberId || undefined)
          }
          displayName={displayName}
          staffSessionToken={staffSessionToken || null}
          onActivityLogged={() => {
            // Refresh the records when activity is logged
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default CancelAuditPage;
