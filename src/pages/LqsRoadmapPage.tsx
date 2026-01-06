import { useState, useMemo, useCallback } from 'react';
import { FileSpreadsheet, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useAgencyProfile } from '@/hooks/useAgencyProfile';
import { 
  useLqsData, 
  useLqsLeadSources, 
  useAssignLeadSource,
  useBulkAssignLeadSource,
  HouseholdWithRelations 
} from '@/hooks/useLqsData';
import { LqsMetricTiles } from '@/components/lqs/LqsMetricTiles';
import { LqsFilters } from '@/components/lqs/LqsFilters';
import { LqsHouseholdTable } from '@/components/lqs/LqsHouseholdTable';
import { AssignLeadSourceModal } from '@/components/lqs/AssignLeadSourceModal';
import { QuoteReportUploadModal } from '@/components/lqs/QuoteReportUploadModal';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';

type TabValue = 'all' | 'by-date' | 'by-product' | 'by-source' | 'by-producer' | 'by-zip' | 'self-generated' | 'needs-attention';

export default function LqsRoadmapPage() {
  const { user } = useAuth();
  const { data: agencyProfile, isLoading: agencyLoading } = useAgencyProfile(user?.id, 'Manager');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>('all');

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdWithRelations | null>(null);
  const [bulkAssignIds, setBulkAssignIds] = useState<string[]>([]);

  // Data fetching
  const { data, isLoading, refetch } = useLqsData({
    agencyId: agencyProfile?.agencyId ?? null,
    dateRange,
    statusFilter,
    searchTerm,
  });

  const { data: leadSources = [] } = useLqsLeadSources(agencyProfile?.agencyId ?? null);
  const assignMutation = useAssignLeadSource();
  const bulkAssignMutation = useBulkAssignLeadSource();

  // Filter households based on active tab
  const filteredHouseholds = useMemo(() => {
    if (!data?.households) return [];
    
    switch (activeTab) {
      case 'self-generated':
        return data.households.filter(h => h.lead_source?.is_self_generated === true);
      case 'needs-attention':
        return data.households.filter(h => h.needs_attention);
      default:
        return data.households;
    }
  }, [data?.households, activeTab]);

  // Group households for grouped views
  const groupedData = useMemo(() => {
    if (!data?.households) return {};

    switch (activeTab) {
      case 'by-date': {
        const groups: Record<string, HouseholdWithRelations[]> = {};
        data.households.forEach(h => {
          h.quotes?.forEach(q => {
            const date = q.quote_date || 'Unknown';
            if (!groups[date]) groups[date] = [];
            // Avoid duplicates
            if (!groups[date].find(existing => existing.id === h.id)) {
              groups[date].push(h);
            }
          });
        });
        // Sort by date descending
        return Object.fromEntries(
          Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
        );
      }
      case 'by-product': {
        const groups: Record<string, HouseholdWithRelations[]> = {};
        data.households.forEach(h => {
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
        data.households.forEach(h => {
          const sourceName = h.lead_source?.name || 'Unassigned';
          if (!groups[sourceName]) groups[sourceName] = [];
          groups[sourceName].push(h);
        });
        return groups;
      }
      case 'by-producer': {
        const groups: Record<string, HouseholdWithRelations[]> = {};
        data.households.forEach(h => {
          const producerName = h.team_member?.name || 'Unassigned';
          if (!groups[producerName]) groups[producerName] = [];
          groups[producerName].push(h);
        });
        return groups;
      }
      case 'by-zip': {
        const groups: Record<string, HouseholdWithRelations[]> = {};
        data.households.forEach(h => {
          const zip = h.zip_code || 'Unknown';
          if (!groups[zip]) groups[zip] = [];
          groups[zip].push(h);
        });
        // Sort by count descending
        return Object.fromEntries(
          Object.entries(groups).sort(([, a], [, b]) => b.length - a.length)
        );
      }
      default:
        return {};
    }
  }, [data?.households, activeTab]);

  const isGroupedView = ['by-date', 'by-product', 'by-source', 'by-producer', 'by-zip'].includes(activeTab);

  // Handlers
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
    toast.success('Quote report uploaded successfully');
    refetch();
  };

  if (agencyLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
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
          </div>
          <p className="text-muted-foreground mt-1">
            Track leads from quote to sale
          </p>
        </div>
        <Button onClick={() => setUploadModalOpen(true)}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Upload Report
        </Button>
      </div>

      {/* Metric Tiles */}
      <LqsMetricTiles metrics={data?.metrics} loading={isLoading} />

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
          <TabsTrigger value="needs-attention" className="relative">
            Needs Attention
            {(data?.metrics?.needsAttention ?? 0) > 0 && (
              <Badge 
                variant="destructive" 
                className="ml-2 h-5 min-w-[20px] px-1.5"
              >
                {data?.metrics?.needsAttention}
              </Badge>
            )}
          </TabsTrigger>
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
          />
        </div>

        {/* All Tab */}
        <TabsContent value="all" className="mt-4">
          <LqsHouseholdTable
            households={filteredHouseholds}
            loading={isLoading}
            onAssignLeadSource={handleAssignLeadSource}
          />
        </TabsContent>

        {/* Self-Generated Tab */}
        <TabsContent value="self-generated" className="mt-4">
          <LqsHouseholdTable
            households={filteredHouseholds}
            loading={isLoading}
            onAssignLeadSource={handleAssignLeadSource}
          />
        </TabsContent>

        {/* Needs Attention Tab - with bulk select */}
        <TabsContent value="needs-attention" className="mt-4">
          <LqsHouseholdTable
            households={filteredHouseholds}
            loading={isLoading}
            onAssignLeadSource={handleAssignLeadSource}
            onBulkAssign={handleBulkAssign}
            showBulkSelect={true}
          />
        </TabsContent>

        {/* Grouped Views */}
        {isGroupedView && (
          <TabsContent value={activeTab} className="mt-4 space-y-6">
            {Object.entries(groupedData).map(([groupName, households]) => (
              <div key={groupName}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">
                    {activeTab === 'by-date' && groupName !== 'Unknown'
                      ? format(parseISO(groupName), 'MMMM d, yyyy')
                      : groupName}
                  </h3>
                  <Badge variant="secondary">{households.length}</Badge>
                </div>
                <LqsHouseholdTable
                  households={households}
                  loading={isLoading}
                  onAssignLeadSource={handleAssignLeadSource}
                />
              </div>
            ))}
            {Object.keys(groupedData).length === 0 && !isLoading && (
              <p className="text-center text-muted-foreground py-8">
                No data to display for this view.
              </p>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Upload Modal */}
      <QuoteReportUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        agencyId={agencyProfile.agencyId}
        userId={user?.id ?? null}
        displayName={user?.email ?? 'Unknown'}
        onUploadComplete={handleUploadComplete}
      />

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
    </div>
  );
}
