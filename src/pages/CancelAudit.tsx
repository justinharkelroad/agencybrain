import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CancelAuditUploadModal } from "@/components/cancel-audit/CancelAuditUploadModal";
import { CancelAuditFilterBar } from "@/components/cancel-audit/CancelAuditFilterBar";
import { CancelAuditRecordCard } from "@/components/cancel-audit/CancelAuditRecordCard";
import { CancelAuditRecordSkeletonList } from "@/components/cancel-audit/CancelAuditRecordSkeleton";
import { CancelAuditEmptyState } from "@/components/cancel-audit/CancelAuditEmptyState";
import { WeeklyStatsSummary } from "@/components/cancel-audit/WeeklyStatsSummary";
import { useCancelAuditRecords } from "@/hooks/useCancelAuditRecords";
import { useToast } from "@/hooks/use-toast";
import { ReportType } from "@/types/cancel-audit";
import { useQueryClient } from "@tanstack/react-query";

const CancelAuditPage = () => {
  const { user, membershipTier, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  
  // Agency context
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [staffMemberId, setStaffMemberId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('Unknown User');

  // Filter and UI state
  const [reportTypeFilter, setReportTypeFilter] = useState<ReportType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<'urgency' | 'name' | 'date_added'>('urgency');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch records
  const { data: records, isLoading: recordsLoading, refetch } = useCancelAuditRecords({
    agencyId,
    reportTypeFilter,
    searchQuery: debouncedSearch,
    sortBy,
  });

  // Calculate counts for filter tabs (based on all records, ignoring current filter)
  const { data: allRecords } = useCancelAuditRecords({
    agencyId,
    reportTypeFilter: 'all',
    searchQuery: debouncedSearch,
    sortBy: 'urgency',
  });

  const filterCounts = useMemo(() => {
    const all = allRecords || [];
    return {
      all: all.length,
      pending_cancel: all.filter(r => r.report_type === 'pending_cancel').length,
      cancellation: all.filter(r => r.report_type === 'cancellation').length,
    };
  }, [allRecords]);

  useEffect(() => {
    const checkAccess = async () => {
      if (authLoading) return;
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check membership tier - must be boardroom or one_on_one_coaching
      const validTiers = ['boardroom', 'one_on_one_coaching', 'one_on_one'];
      const tierLower = membershipTier?.toLowerCase() || '';
      const hasTierAccess = validTiers.some(t => tierLower.includes(t));

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
        toast({
          title: "Error",
          description: "No agency associated with your account",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setAgencyId(userAgencyId);
      
      // Check if staff portal user
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

      setHasAccess(true);
      setLoading(false);
    };

    checkAccess();
  }, [user, membershipTier, authLoading, navigate, toast]);

  const handleUploadComplete = useCallback(() => {
    toast({
      title: "Upload Complete",
      description: "Records have been processed successfully",
    });
    // Invalidate and refetch records + stats
    queryClient.invalidateQueries({ queryKey: ['cancel-audit-records'] });
    queryClient.invalidateQueries({ queryKey: ['cancel-audit-stats'] });
  }, [toast, queryClient]);

  const handleToggleExpand = useCallback((recordId: string) => {
    setExpandedRecordId(prev => prev === recordId ? null : recordId);
  }, []);

  const handleClearFilters = useCallback(() => {
    setReportTypeFilter('all');
    setSearchQuery('');
    setDebouncedSearch('');
  }, []);

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

  const hasRecords = (allRecords?.length || 0) > 0;
  const hasFilteredRecords = (records?.length || 0) > 0;
  const isFiltering = reportTypeFilter !== 'all' || debouncedSearch.length > 0;

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
            <Button onClick={() => setUploadModalOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Report
            </Button>
          </div>
        </div>
      </div>

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

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-12">
        {hasRecords ? (
          <div className="space-y-6">
            {/* Filter Bar */}
            <CancelAuditFilterBar
              reportTypeFilter={reportTypeFilter}
              onReportTypeFilterChange={setReportTypeFilter}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              counts={filterCounts}
              isLoading={recordsLoading}
            />

            {/* Records List */}
            {recordsLoading ? (
              <CancelAuditRecordSkeletonList count={5} />
            ) : hasFilteredRecords ? (
              <div className="space-y-3">
                {records?.map((record) => (
                  <CancelAuditRecordCard
                    key={record.id}
                    record={record}
                    isExpanded={expandedRecordId === record.id}
                    onToggleExpand={() => handleToggleExpand(record.id)}
                    agencyId={agencyId!}
                    userId={userId || undefined}
                    staffMemberId={staffMemberId || undefined}
                    userDisplayName={displayName}
                  />
                ))}
              </div>
            ) : (
              <CancelAuditEmptyState
                variant="no-results"
                onClearFilters={handleClearFilters}
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
