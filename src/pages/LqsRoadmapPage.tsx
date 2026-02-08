import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpButton } from '@/components/HelpButton';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { hasSalesAccess } from '@/lib/salesBetaAccess';
import { useAgencyProfile } from '@/hooks/useAgencyProfile';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  useLqsData,
  useLqsLeadSources,
  useAssignLeadSource,
  useBulkAssignLeadSource,
  HouseholdWithRelations
} from '@/hooks/useLqsData';
import { useLqsObjections } from '@/hooks/useLqsObjections';
import { useStaffLqsData, useStaffLqsObjections, useStaffLqsLeadSources } from '@/hooks/useStaffLqsData';
import { LqsMetricTiles } from '@/components/lqs/LqsMetricTiles';
import { LqsFilters } from '@/components/lqs/LqsFilters';
import { LqsHouseholdTable } from '@/components/lqs/LqsHouseholdTable';
import { LqsHouseholdDetailModal } from '@/components/lqs/LqsHouseholdDetailModal';
import { SaleDetailModal } from '@/components/sales/SaleDetailModal';
import { AssignLeadSourceModal } from '@/components/lqs/AssignLeadSourceModal';
import { QuoteReportUploadModal } from '@/components/lqs/QuoteReportUploadModal';
import { QuoteUploadResultsModal } from '@/components/lqs/QuoteUploadResultsModal';
import { SalesUploadResultsModal } from '@/components/lqs/SalesUploadResultsModal';
import { LqsOverviewDashboard } from '@/components/lqs/LqsOverviewDashboard';
import { LqsBucketSelector, BucketType } from '@/components/lqs/LqsBucketSelector';
import { LqsActionDropdowns } from '@/components/lqs/LqsActionDropdowns';
import { AddLeadModal } from '@/components/lqs/AddLeadModal';
import { AddQuoteModal } from '@/components/lqs/AddQuoteModal';
import { LqsGroupedSection } from '@/components/lqs/LqsGroupedSection';
import { ContactProfileModal } from '@/components/contacts/ContactProfileModal';
import { findOrCreateContact } from '@/hooks/useContacts';
import { generateHouseholdKey } from '@/lib/lqs-quote-parser';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import type { QuoteUploadResult, SalesUploadResult, PendingSaleReview } from '@/types/lqs';
import { SalesReviewModal, ReviewResult } from '@/components/lqs/SalesReviewModal';

type TabValue = 'all' | 'by-date' | 'by-product' | 'by-source' | 'by-producer' | 'by-zip' | 'self-generated' | 'needs-attention' | 'missing-zip';
type ViewMode = 'overview' | 'detail';
type DataViewMode = 'agency' | 'personal';

interface LqsRoadmapPageProps {
  isStaffPortal?: boolean;
  staffTeamMemberId?: string | null;
}

export default function LqsRoadmapPage({ isStaffPortal = false, staffTeamMemberId = null }: LqsRoadmapPageProps) {
  const { user: authUser, isAgencyOwner, isKeyEmployee } = useAuth();
  const { user: staffUser, loading: staffLoading, sessionToken: staffSessionToken } = useStaffAuth();
  const navigate = useNavigate();

  // For staff portal, use staff auth; for agency portal, use regular auth
  const effectiveAgencyId = isStaffPortal ? staffUser?.agency_id : null;
  const effectiveTeamMemberId = isStaffPortal ? (staffTeamMemberId || staffUser?.team_member_id) : null;

  // Check access via agency whitelist (only for agency portal users)
  const { data: profile } = useQuery({
    queryKey: ['profile-agency', authUser?.id],
    enabled: !isStaffPortal && !!authUser?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', authUser!.id)
        .maybeSingle();
      return data;
    },
  });

  // For staff portal, check access using staff user's agency_id
  const hasAccess = isStaffPortal
    ? hasSalesAccess(effectiveAgencyId ?? null)
    : hasSalesAccess(profile?.agency_id ?? null);

  // For agency portal, use useAgencyProfile hook; for staff portal, construct from staff user
  const { data: agencyProfileData, isLoading: agencyProfileLoading } = useAgencyProfile(
    isStaffPortal ? null : authUser?.id,
    'Manager'
  );

  // Construct agency profile for staff portal users
  const agencyProfile = isStaffPortal
    ? (staffUser ? { agencyId: staffUser.agency_id, agencyName: '' } : null)
    : agencyProfileData;
  const agencyLoading = isStaffPortal ? staffLoading : agencyProfileLoading;

  useEffect(() => {
    // For agency portal: redirect if no access
    if (!isStaffPortal && authUser && profile && !hasAccess) {
      toast.error('Access restricted');
      navigate('/dashboard', { replace: true });
    }
    // For staff portal: redirect if no access
    if (isStaffPortal && staffUser && !hasAccess) {
      toast.error('Access restricted');
      navigate('/staff/dashboard', { replace: true });
    }
  }, [authUser, staffUser, profile, hasAccess, isStaffPortal, navigate]);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [activeBucket, setActiveBucket] = useState<BucketType>('quoted');
  // Staff portal defaults to "My Numbers", agency portal defaults to "Agency Wide"
  const [dataViewMode, setDataViewMode] = useState<DataViewMode>(isStaffPortal ? 'personal' : 'agency');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [selectedLeadSourceId, setSelectedLeadSourceId] = useState<string>('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdWithRelations | null>(null);
  const [bulkAssignIds, setBulkAssignIds] = useState<string[]>([]);
  const [addLeadModalOpen, setAddLeadModalOpen] = useState(false);
  const [addQuoteModalOpen, setAddQuoteModalOpen] = useState(false);
  
  // Detail modals
  const [detailHousehold, setDetailHousehold] = useState<HouseholdWithRelations | null>(null);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);

  // Contact Profile modal state
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
  const [profileHousehold, setProfileHousehold] = useState<HouseholdWithRelations | null>(null);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  
  // Quote upload results modal
  const [quoteUploadResults, setQuoteUploadResults] = useState<QuoteUploadResult | null>(null);
  const [showQuoteResultsModal, setShowQuoteResultsModal] = useState(false);
  
  // Sales upload results modal
  const [salesUploadResults, setSalesUploadResults] = useState<SalesUploadResult | null>(null);
  const [showSalesResultsModal, setShowSalesResultsModal] = useState(false);
  const [showSalesReviewModal, setShowSalesReviewModal] = useState(false);

  // Permission check - staff portal users don't see revenue metrics
  const showRevenueMetrics = !isStaffPortal && (isAgencyOwner || isKeyEmployee);

  // Fetch team members for the forms (include email for matching)
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members', agencyProfile?.agencyId],
    enabled: !!agencyProfile?.agencyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, email')
        .eq('agency_id', agencyProfile!.agencyId)
        .eq('status', 'active')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Determine team member ID for "My Numbers" filter - match by email
  const currentTeamMemberId = useMemo(() => {
    // For staff portal, use effectiveTeamMemberId (from props or staffUser)
    if (isStaffPortal) {
      return effectiveTeamMemberId || null;
    }
    // For brain portal, find matching team member by email (exact match)
    if (authUser?.email && teamMembers.length > 0) {
      const currentUserMember = teamMembers.find(m =>
        m.email?.toLowerCase() === authUser.email?.toLowerCase()
      );
      return currentUserMember?.id || null;
    }
    return null;
  }, [isStaffPortal, effectiveTeamMemberId, teamMembers, authUser?.email]);

  // Data fetching - use staff hook for staff portal, regular hook for agency portal
  // Staff portal: uses edge function to bypass RLS
  const {
    data: staffData,
    isLoading: staffDataLoading,
    refetch: staffRefetch
  } = useStaffLqsData({
    sessionToken: isStaffPortal ? staffSessionToken : null,
    dateRange,
    statusFilter,
    searchTerm,
  });

  // Agency portal: uses direct Supabase queries with RLS
  const {
    data: agencyData,
    isLoading: agencyDataLoading,
    refetch: agencyRefetch
  } = useLqsData({
    agencyId: isStaffPortal ? null : (agencyProfile?.agencyId ?? null),
    dateRange,
    statusFilter,
    searchTerm,
  });

  // Use the appropriate data based on portal type
  const data = isStaffPortal ? staffData : agencyData;
  const isLoading = isStaffPortal ? staffDataLoading : agencyDataLoading;
  const refetch = isStaffPortal ? staffRefetch : agencyRefetch;

  const { data: agencyLeadSources = [] } = useLqsLeadSources(isStaffPortal ? null : (agencyProfile?.agencyId ?? null));
  const { data: staffLeadSources = [] } = useStaffLqsLeadSources(isStaffPortal ? staffSessionToken : null);
  const leadSources = isStaffPortal ? staffLeadSources : agencyLeadSources;
  // Use staff hook for objections in staff portal, regular hook otherwise
  const { data: staffObjections = [] } = useStaffLqsObjections(isStaffPortal ? staffSessionToken : null);
  const { data: agencyObjections = [] } = useLqsObjections(!isStaffPortal);
  const objections = isStaffPortal ? staffObjections : agencyObjections;
  const assignMutation = useAssignLeadSource();
  const bulkAssignMutation = useBulkAssignLeadSource();

  // Filter by bucket and personal view mode
  const bucketFilteredHouseholds = useMemo(() => {
    if (!data?.households) return [];
    
    let filtered = data.households;

    // Filter by bucket (status)
    if (viewMode === 'detail') {
      switch (activeBucket) {
        case 'leads':
          filtered = filtered.filter(h => h.status === 'lead');
          break;
        case 'quoted':
          filtered = filtered.filter(h => h.status === 'quoted');
          break;
        case 'sold':
          filtered = filtered.filter(h => h.status === 'sold');
          break;
      }
    }

    // Filter by personal data if "My Numbers" selected
    if (dataViewMode === 'personal' && currentTeamMemberId) {
      filtered = filtered.filter(h => h.team_member_id === currentTeamMemberId);
    }

    return filtered;
  }, [data?.households, viewMode, activeBucket, dataViewMode, currentTeamMemberId]);

  // Filter households based on active tab and lead source
  const filteredHouseholds = useMemo(() => {
    let result = bucketFilteredHouseholds;
    
    // Apply lead source filter
    if (selectedLeadSourceId && selectedLeadSourceId !== 'all') {
      result = result.filter(h => h.lead_source_id === selectedLeadSourceId);
    }
    
    // Apply tab filters
    switch (activeTab) {
      case 'self-generated':
        return result.filter(h => h.lead_source?.is_self_generated === true);
      case 'needs-attention':
        return result.filter(h => h.needs_attention);
      case 'missing-zip':
        return result.filter(h => !h.zip_code || h.zip_code.trim() === '');
      default:
        return result;
    }
  }, [bucketFilteredHouseholds, activeTab, selectedLeadSourceId]);

  // Paginated households
  const paginatedHouseholds = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredHouseholds.slice(startIndex, startIndex + pageSize);
  }, [filteredHouseholds, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredHouseholds.length / pageSize);
  const totalRecords = filteredHouseholds.length;
  const startRecord = totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeBucket, searchTerm, dateRange, statusFilter, selectedLeadSourceId, activeTab, dataViewMode]);

  // Group households for grouped views
  const groupedData = useMemo(() => {
    if (!filteredHouseholds) return {};

    switch (activeTab) {
      case 'by-date': {
        const groups: Record<string, HouseholdWithRelations[]> = {};
        filteredHouseholds.forEach(h => {
          h.quotes?.forEach(q => {
            const date = q.quote_date || 'Unknown';
            if (!groups[date]) groups[date] = [];
            if (!groups[date].find(existing => existing.id === h.id)) {
              groups[date].push(h);
            }
          });
        });
        return Object.fromEntries(
          Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
        );
      }
      case 'by-product': {
        const groups: Record<string, HouseholdWithRelations[]> = {};
        filteredHouseholds.forEach(h => {
          const products = [...new Set(h.quotes?.map(q => q.product_type) || [])];
          products.forEach(product => {
            if (!groups[product]) groups[product] = [];
            if (!groups[product].find(existing => existing.id === h.id)) {
              groups[product].push(h);
            }
          });
        });
        return groups;
      }
      case 'by-source': {
        const groups: Record<string, HouseholdWithRelations[]> = {};
        filteredHouseholds.forEach(h => {
          const sourceName = h.lead_source?.name || 'Unassigned';
          if (!groups[sourceName]) groups[sourceName] = [];
          groups[sourceName].push(h);
        });
        return groups;
      }
      case 'by-producer': {
        const groups: Record<string, HouseholdWithRelations[]> = {};
        filteredHouseholds.forEach(h => {
          const producerName = h.team_member?.name || 'Unassigned';
          if (!groups[producerName]) groups[producerName] = [];
          groups[producerName].push(h);
        });
        return groups;
      }
      case 'by-zip': {
        const groups: Record<string, HouseholdWithRelations[]> = {};
        filteredHouseholds.forEach(h => {
          const zip = h.zip_code || 'Unknown';
          if (!groups[zip]) groups[zip] = [];
          groups[zip].push(h);
        });
        return Object.fromEntries(
          Object.entries(groups).sort(([, a], [, b]) => b.length - a.length)
        );
      }
      default:
        return {};
    }
  }, [filteredHouseholds, activeTab]);

  const isGroupedView = ['by-date', 'by-product', 'by-source', 'by-producer', 'by-zip'].includes(activeTab);

  // Handlers
  const handleBucketClick = useCallback((bucket: BucketType) => {
    setActiveBucket(bucket);
    setViewMode('detail');
    setActiveTab('all');
  }, []);

  const handleBackToOverview = useCallback(() => {
    setViewMode('overview');
  }, []);

  const handleAssignLeadSource = useCallback((householdId: string) => {
    const household = data?.households.find(h => h.id === householdId);
    if (household) {
      setSelectedHousehold(household);
      setBulkAssignIds([]);
      setAssignModalOpen(true);
    }
  }, [data?.households]);

  const handleBulkAssign = useCallback((householdIds: string[]) => {
    setBulkAssignIds(householdIds);
    setSelectedHousehold(null);
    setAssignModalOpen(true);
  }, []);

  const handleViewHouseholdDetail = useCallback((household: HouseholdWithRelations) => {
    setDetailHousehold(household);
  }, []);

  const handleViewSaleDetail = useCallback((saleId: string) => {
    setDetailSaleId(saleId);
  }, []);

  // Handle opening contact profile sidebar
  const handleViewProfile = useCallback(async (household: HouseholdWithRelations) => {
    if (!agencyProfile?.agencyId) return;

    // If household already has a contact_id, open immediately
    if (household.contact_id) {
      setProfileContactId(household.contact_id);
      setProfileHousehold(household);
      return;
    }

    // Otherwise, find or create a contact first (don't open modal until we have a contactId)
    setIsCreatingContact(true);
    try {
      const householdKey = generateHouseholdKey(
        household.first_name,
        household.last_name,
        household.zip_code
      );

      const contactId = await findOrCreateContact(agencyProfile.agencyId, {
        firstName: household.first_name,
        lastName: household.last_name,
        phone: household.phone?.[0],
        email: household.email || undefined,
        zipCode: household.zip_code,
        householdKey,
      });

      // Update the LQS household with the new contact_id
      await supabase
        .from('lqs_households')
        .update({ contact_id: contactId })
        .eq('id', household.id);

      // Now open the modal with the contact
      setProfileContactId(contactId);
      setProfileHousehold(household);
    } catch (error) {
      console.error('Failed to find or create contact:', error);
      toast.error('Failed to open contact profile');
    } finally {
      setIsCreatingContact(false);
    }
  }, [agencyProfile?.agencyId]);

  const handleAssign = async (householdId: string, leadSourceId: string) => {
    try {
      await assignMutation.mutateAsync({ householdId, leadSourceId });
      toast.success('Lead source assigned successfully');
      setAssignModalOpen(false);
      setSelectedHousehold(null);
    } catch (error) {
      toast.error('Failed to assign lead source');
    }
  };

  const handleBulkAssignSubmit = async (leadSourceId: string) => {
    try {
      const result = await bulkAssignMutation.mutateAsync({
        householdIds: bulkAssignIds,
        leadSourceId,
      });
      toast.success(`Lead source assigned to ${result.updated} households`);
      setAssignModalOpen(false);
      setBulkAssignIds([]);
    } catch (error) {
      toast.error('Failed to assign lead source');
    }
  };

  const handleUploadComplete = () => {
    refetch();
  };

  const handleUploadResults = (result: QuoteUploadResult) => {
    setQuoteUploadResults(result);
    // Auto-show modal if there are warnings
    if (result.unmatchedProducers.length > 0 || result.householdsNeedingAttention > 0) {
      setShowQuoteResultsModal(true);
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncSales = async () => {
    if (!agencyProfile?.agencyId) return;
    
    setIsSyncing(true);
    try {
      const { data: results, error } = await supabase
        .rpc('backfill_lqs_sales_matching', { p_agency_id: agencyProfile.agencyId });
      
      if (error) throw error;
      
      const linked = results?.filter((r: { status: string }) => r.status === 'linked').length || 0;
      const noMatch = results?.filter((r: { status: string }) => r.status === 'no_match').length || 0;
      
      if (linked > 0) {
        toast.success(`Matched ${linked} sales to households`);
      } else if (noMatch > 0) {
        toast.info(`Processed ${noMatch} sales - no matching households found`);
      } else {
        toast.info('No new sales to sync');
      }
      
      refetch();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Sync failed: ' + message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Bucket counts for selector
  const bucketCounts = useMemo(() => {
    let households = data?.households || [];
    
    // Apply personal filter if needed
    if (dataViewMode === 'personal' && currentTeamMemberId) {
      households = households.filter(h => h.team_member_id === currentTeamMemberId);
    }

    return {
      leads: households.filter(h => h.status === 'lead').length,
      quoted: households.filter(h => h.status === 'quoted').length,
      sold: households.filter(h => h.status === 'sold').length,
    };
  }, [data?.households, dataViewMode, currentTeamMemberId]);

  // Needs attention count for current bucket (for tab badge)
  const needsAttentionCount = useMemo(() => {
    return bucketFilteredHouseholds.filter(h => h.needs_attention).length;
  }, [bucketFilteredHouseholds]);

  // Show nothing while checking access or if not allowed (redirect happens via useEffect)
  const effectiveUser = isStaffPortal ? staffUser : authUser;
  if (!effectiveUser || (!isStaffPortal && profile && !hasAccess) || (isStaffPortal && !hasAccess)) {
    return null;
  }

  if (agencyLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!agencyProfile) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Unable to load agency information.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">LQS Roadmap</h1>
            <HelpButton videoKey="Lqs_Roadmap" />
          </div>
          <p className="text-muted-foreground mt-1">
            Track leads from quote to sale
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LqsActionDropdowns
            onAddLead={() => setAddLeadModalOpen(true)}
            onAddQuote={() => setAddQuoteModalOpen(true)}
            onUploadQuotes={() => setUploadModalOpen(true)}
            agencyId={agencyProfile?.agencyId ?? ''}
            userId={isStaffPortal ? staffUser?.id ?? null : authUser?.id ?? null}
            displayName={isStaffPortal ? (staffUser?.display_name || staffUser?.email || 'User') : (authUser?.email ?? 'User')}
            leadSources={leadSources}
            onUploadComplete={() => refetch()}
            onSalesUploadResults={(result) => {
              setSalesUploadResults(result);
              if (result.unmatchedProducers.length > 0 || result.householdsNeedingAttention > 0) {
                setShowSalesResultsModal(true);
              }
            }}
          />
          <Button 
            variant="outline" 
            onClick={handleSyncSales}
            disabled={isSyncing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
            {isSyncing ? 'Syncing...' : 'Sync Sales'}
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <Select value={dataViewMode} onValueChange={(v) => setDataViewMode(v as DataViewMode)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            <SelectItem value="agency">Agency Wide</SelectItem>
            <SelectItem value="personal">My Numbers</SelectItem>
          </SelectContent>
        </Select>

        {viewMode === 'detail' && (
          <Button variant="ghost" onClick={handleBackToOverview}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Overview
          </Button>
        )}
      </div>

      {/* Overview Dashboard - use filtered metrics based on view mode */}
      {viewMode === 'overview' && (
        <LqsOverviewDashboard
          metrics={{
            ...data?.metrics,
            leadsCount: bucketCounts.leads,
            quotedCount: bucketCounts.quoted,
            soldCount: bucketCounts.sold,
            // Recalculate rates based on filtered data
            leadsToQuotedRate: bucketCounts.leads + bucketCounts.quoted > 0 
              ? ((bucketCounts.quoted + bucketCounts.sold) / (bucketCounts.leads + bucketCounts.quoted + bucketCounts.sold)) * 100 
              : 0,
            quotedToSoldRate: bucketCounts.quoted + bucketCounts.sold > 0 
              ? (bucketCounts.sold / (bucketCounts.quoted + bucketCounts.sold)) * 100 
              : 0,
          } as typeof data.metrics}
          loading={isLoading}
          onBucketClick={handleBucketClick}
          showRevenue={showRevenueMetrics}
        />
      )}

      {/* Detail View */}
      {viewMode === 'detail' && (
        <>
          {/* Bucket Selector */}
          <LqsBucketSelector
            activeBucket={activeBucket}
            onBucketChange={setActiveBucket}
            counts={bucketCounts}
          />

          {/* Metric Tiles for current bucket - filtered by view mode */}
          <LqsMetricTiles 
            metrics={{
              ...data?.metrics,
              totalQuotes: bucketFilteredHouseholds.reduce((sum, h) => sum + (h.quotes?.length || 0), 0),
              selfGenerated: bucketFilteredHouseholds.filter(h => h.lead_source?.is_self_generated === true).length,
              sold: bucketCounts.sold,
              needsAttention: bucketFilteredHouseholds.filter(h => h.needs_attention).length,
            } as typeof data.metrics} 
            loading={isLoading} 
            onTileClick={(tab) => setActiveTab(tab as TabValue)}
            activeBucket={activeBucket}
            bucketCount={bucketFilteredHouseholds.length}
          />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="by-date">By Date</TabsTrigger>
              <TabsTrigger value="by-product">By Product</TabsTrigger>
              <TabsTrigger value="by-source">By Source</TabsTrigger>
              <TabsTrigger value="by-producer">By Producer</TabsTrigger>
              <TabsTrigger value="by-zip">By Zip</TabsTrigger>
              <TabsTrigger value="self-generated">Self-Generated</TabsTrigger>
              <TabsTrigger value="missing-zip">Missing Zip</TabsTrigger>
              {(activeBucket === 'quoted' || activeBucket === 'sold') && (
                <TabsTrigger value="needs-attention" className="relative">
                  Needs Attention
                  {needsAttentionCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="ml-2 h-5 min-w-[20px] px-1.5"
                    >
                      {needsAttentionCount}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {/* Filters */}
            <div className="mt-4">
              <LqsFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                leadSources={leadSources}
                selectedLeadSourceId={selectedLeadSourceId}
                onLeadSourceChange={setSelectedLeadSourceId}
              />
            </div>

            {/* All Tab */}
            <TabsContent value="all" className="mt-4">
              <LqsHouseholdTable
                households={paginatedHouseholds}
                loading={isLoading}
                onAssignLeadSource={handleAssignLeadSource}
                onViewHouseholdDetail={handleViewHouseholdDetail}
                onViewSaleDetail={handleViewSaleDetail}
                onViewProfile={handleViewProfile}
                totalRecords={totalRecords}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                startRecord={startRecord}
                endRecord={endRecord}
              />
            </TabsContent>

            {/* Self-Generated Tab */}
            <TabsContent value="self-generated" className="mt-4">
              <LqsHouseholdTable
                households={paginatedHouseholds}
                loading={isLoading}
                onAssignLeadSource={handleAssignLeadSource}
                onViewHouseholdDetail={handleViewHouseholdDetail}
                onViewSaleDetail={handleViewSaleDetail}
                onViewProfile={handleViewProfile}
                totalRecords={totalRecords}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                startRecord={startRecord}
                endRecord={endRecord}
              />
            </TabsContent>

            {/* Needs Attention Tab */}
            <TabsContent value="needs-attention" className="mt-4">
              <LqsHouseholdTable
                households={paginatedHouseholds}
                loading={isLoading}
                onAssignLeadSource={handleAssignLeadSource}
                onBulkAssign={handleBulkAssign}
                showBulkSelect={true}
                onViewHouseholdDetail={handleViewHouseholdDetail}
                onViewSaleDetail={handleViewSaleDetail}
                onViewProfile={handleViewProfile}
                totalRecords={totalRecords}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                startRecord={startRecord}
                endRecord={endRecord}
              />
            </TabsContent>

            {/* Missing Zip Tab */}
            <TabsContent value="missing-zip" className="mt-4">
              <LqsHouseholdTable
                households={paginatedHouseholds}
                loading={isLoading}
                onAssignLeadSource={handleAssignLeadSource}
                onViewHouseholdDetail={handleViewHouseholdDetail}
                onViewSaleDetail={handleViewSaleDetail}
                onViewProfile={handleViewProfile}
                totalRecords={totalRecords}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                startRecord={startRecord}
                endRecord={endRecord}
              />
            </TabsContent>

            {/* Grouped Views */}
            {isGroupedView && (
              <TabsContent value={activeTab} className="mt-4 space-y-6">
                {Object.entries(groupedData).map(([groupName, households]) => (
                  <LqsGroupedSection
                    key={groupName}
                    groupName={groupName}
                    households={households}
                    activeTab={activeTab}
                    onAssignLeadSource={handleAssignLeadSource}
                    onViewHouseholdDetail={handleViewHouseholdDetail}
                    onViewSaleDetail={handleViewSaleDetail}
                    onViewProfile={handleViewProfile}
                    isLoading={isLoading}
                  />
                ))}
                {Object.keys(groupedData).length === 0 && !isLoading && (
                  <p className="text-center text-muted-foreground py-8">
                    No data to display for this view.
                  </p>
                )}
              </TabsContent>
            )}
          </Tabs>
        </>
      )}

      {/* Upload Modal */}
      <QuoteReportUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        agencyId={agencyProfile.agencyId}
        userId={isStaffPortal ? staffUser?.id ?? null : authUser?.id ?? null}
        displayName={isStaffPortal ? (staffUser?.display_name || staffUser?.email || 'Unknown') : (authUser?.email ?? 'Unknown')}
        onUploadComplete={handleUploadComplete}
        onUploadResults={handleUploadResults}
      />

      {/* Quote Upload Results Modal */}
      {quoteUploadResults && (
        <QuoteUploadResultsModal
          open={showQuoteResultsModal}
          onOpenChange={setShowQuoteResultsModal}
          results={quoteUploadResults}
        />
      )}

      {/* Assign Lead Source Modal */}
      <AssignLeadSourceModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        household={selectedHousehold}
        leadSources={leadSources}
        onAssign={handleAssign}
        isAssigning={assignMutation.isPending}
        bulkMode={bulkAssignIds.length > 0}
        bulkCount={bulkAssignIds.length}
        onBulkAssign={handleBulkAssignSubmit}
      />

      {/* Add Lead Modal */}
      <AddLeadModal
        open={addLeadModalOpen}
        onOpenChange={setAddLeadModalOpen}
        agencyId={agencyProfile.agencyId}
        leadSources={leadSources}
        teamMembers={teamMembers}
        currentTeamMemberId={currentTeamMemberId}
        onSuccess={refetch}
      />

      {/* Add Quote Modal */}
      <AddQuoteModal
        open={addQuoteModalOpen}
        onOpenChange={setAddQuoteModalOpen}
        agencyId={agencyProfile.agencyId}
        leadSources={leadSources}
        objections={objections}
        teamMembers={teamMembers}
        currentTeamMemberId={currentTeamMemberId}
        onSuccess={refetch}
        staffSessionToken={isStaffPortal ? staffSessionToken : null}
      />

      {/* Household Detail Modal */}
      <LqsHouseholdDetailModal
        household={detailHousehold}
        open={!!detailHousehold}
        onOpenChange={(open) => !open && setDetailHousehold(null)}
        onAssignLeadSource={(id) => {
          setDetailHousehold(null);
          handleAssignLeadSource(id);
        }}
        teamMembers={teamMembers}
        staffSessionToken={isStaffPortal ? staffSessionToken : null}
        currentTeamMemberId={currentTeamMemberId}
      />

      {/* Sale Detail Modal (for sold households) */}
      <SaleDetailModal
        saleId={detailSaleId}
        open={!!detailSaleId}
        onOpenChange={(open) => !open && setDetailSaleId(null)}
        canEditAllSales={true}
        onEdit={(saleId) => navigate(`/sales?tab=add&edit=${saleId}`)}
      />

      {/* Contact Profile Modal (sidebar) */}
      <ContactProfileModal
        contactId={profileContactId}
        open={!!profileHousehold}
        onClose={() => {
          setProfileHousehold(null);
          setProfileContactId(null);
        }}
        agencyId={agencyProfile?.agencyId}
        defaultSourceModule="lqs"
        sourceRecordId={profileHousehold?.id}
        userId={isStaffPortal ? staffUser?.id : authUser?.id}
        displayName={isStaffPortal ? (staffUser?.display_name || staffUser?.email || 'User') : (authUser?.email || 'User')}
        lqsHousehold={profileHousehold ? { id: profileHousehold.id } : undefined}
        teamMembers={teamMembers}
        currentUserTeamMemberId={currentTeamMemberId}
        onActivityLogged={() => refetch()}
        staffSessionToken={isStaffPortal ? staffSessionToken : null}
      />

      {/* Sales Upload Results Modal */}
      {salesUploadResults && (
        <SalesUploadResultsModal
          open={showSalesResultsModal}
          onOpenChange={setShowSalesResultsModal}
          results={salesUploadResults}
          onReviewNow={() => {
            setShowSalesResultsModal(false);
            setShowSalesReviewModal(true);
          }}
        />
      )}

      {/* Sales Review Modal */}
      {salesUploadResults && salesUploadResults.pendingReviews.length > 0 && (
        <SalesReviewModal
          open={showSalesReviewModal}
          onOpenChange={setShowSalesReviewModal}
          pendingReviews={salesUploadResults.pendingReviews}
          onReviewComplete={(results) => {
            console.log('[LQS] Review complete:', results);
            refetch();
          }}
        />
      )}
    </div>
  );
}
