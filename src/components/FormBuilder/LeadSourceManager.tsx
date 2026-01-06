import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarketingBuckets } from "@/hooks/useMarketingBuckets";
import { MarketingBucketList } from "@/components/lqs/MarketingBucketList";
import { EnhancedLeadSourceRow } from "@/components/lqs/EnhancedLeadSourceRow";
import { UnassignedLeadSourcesSection } from "@/components/lqs/UnassignedLeadSourcesSection";
import { LeadSourceSpendModal } from "@/components/lqs/LeadSourceSpendModal";
import { QuoteReportUploadModal } from "@/components/lqs/QuoteReportUploadModal";
import { LeadSourceExtended, CostType } from "@/types/lqs";
import { useAuth } from "@/lib/auth";

interface LeadSourceManagerProps {
  agencyId: string;
}

export function LeadSourceManager({ agencyId }: LeadSourceManagerProps) {
  const { user } = useAuth();
  const [leadSources, setLeadSources] = useState<LeadSourceExtended[]>([]);
  const [newSourceName, setNewSourceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'all' | 'by-bucket'>('all');
  const [spendModalSource, setSpendModalSource] = useState<LeadSourceExtended | null>(null);
  const [quoteUploadOpen, setQuoteUploadOpen] = useState(false);

  const {
    buckets,
    loading: bucketsLoading,
    createBucket,
    updateBucket,
    deleteBucket,
    reorderBuckets,
    refetch: refetchBuckets,
  } = useMarketingBuckets();

  // Fetch lead sources on mount
  useEffect(() => {
    const fetchLeadSources = async () => {
      if (!agencyId) return;
      
      setInitialLoading(true);
      try {
        const { data, error } = await supabase
          .from('lead_sources')
          .select('*')
          .eq('agency_id', agencyId)
          .order('order_index', { ascending: true });

        if (error) throw error;
        
        // Map to LeadSourceExtended with defaults for new fields
        const mapped: LeadSourceExtended[] = (data || []).map(source => ({
          id: source.id,
          agency_id: source.agency_id,
          name: source.name,
          is_active: source.is_active ?? true,
          order_index: source.order_index ?? 0,
          cost_per_lead_cents: source.cost_per_lead_cents ?? null,
          bucket_id: source.bucket_id ?? null,
          is_self_generated: source.is_self_generated ?? false,
          cost_type: (source.cost_type as CostType) ?? 'per_lead',
          created_at: source.created_at,
          updated_at: source.updated_at,
        }));
        
        setLeadSources(mapped);
      } catch (error: any) {
        console.error('Error fetching lead sources:', error);
        toast.error('Failed to load lead sources');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchLeadSources();
  }, [agencyId]);

  const addLeadSource = async () => {
    if (!newSourceName.trim() || !agencyId) return;

    setLoading(true);
    try {
      const maxOrder = leadSources.length > 0 
        ? Math.max(...leadSources.map(s => s.order_index)) 
        : 0;
      
      const { data, error } = await supabase
        .from('lead_sources')
        .insert({
          agency_id: agencyId,
          name: newSourceName.trim(),
          is_active: true,
          order_index: maxOrder + 1,
          cost_type: 'per_lead',
          is_self_generated: false,
        })
        .select()
        .single();

      if (error) throw error;

      const newSource: LeadSourceExtended = {
        id: data.id,
        agency_id: data.agency_id,
        name: data.name,
        is_active: data.is_active ?? true,
        order_index: data.order_index ?? 0,
        cost_per_lead_cents: data.cost_per_lead_cents ?? null,
        bucket_id: data.bucket_id ?? null,
        is_self_generated: data.is_self_generated ?? false,
        cost_type: (data.cost_type as CostType) ?? 'per_lead',
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      setLeadSources([...leadSources, newSource]);
      setNewSourceName("");
      toast.success("Lead source added");
    } catch (error: any) {
      console.error('Error adding lead source:', error);
      toast.error('Failed to add lead source');
    } finally {
      setLoading(false);
    }
  };

  const removeLeadSource = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('lead_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLeadSources(leadSources.filter(source => source.id !== id));
      toast.success("Lead source removed");
    } catch (error: any) {
      console.error('Error removing lead source:', error);
      toast.error('Failed to remove lead source');
    } finally {
      setLoading(false);
    }
  };

  const updateLeadSource = async (id: string, updates: Partial<LeadSourceExtended>) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('lead_sources')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setLeadSources(
        leadSources.map(source =>
          source.id === id ? { ...source, ...updates } : source
        )
      );
      toast.success("Lead source updated");
    } catch (error: any) {
      console.error('Error updating lead source:', error);
      toast.error('Failed to update lead source');
    } finally {
      setLoading(false);
    }
  };

  const moveLeadSource = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = leadSources.findIndex(s => s.id === id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= leadSources.length) return;

    const newSources = [...leadSources];
    [newSources[currentIndex], newSources[newIndex]] = [newSources[newIndex], newSources[currentIndex]];
    
    // Update order_index values
    newSources.forEach((source, index) => {
      source.order_index = index + 1;
    });

    // Optimistic update
    setLeadSources(newSources);

    // Update in database
    setLoading(true);
    try {
      for (const source of newSources) {
        const { error } = await supabase
          .from('lead_sources')
          .update({ order_index: source.order_index })
          .eq('id', source.id);
        
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error updating lead source order:', error);
      toast.error('Failed to update order');
      // Refetch on error
      const { data } = await supabase
        .from('lead_sources')
        .select('*')
        .eq('agency_id', agencyId)
        .order('order_index', { ascending: true });
      if (data) {
        const mapped: LeadSourceExtended[] = data.map(source => ({
          id: source.id,
          agency_id: source.agency_id,
          name: source.name,
          is_active: source.is_active ?? true,
          order_index: source.order_index ?? 0,
          cost_per_lead_cents: source.cost_per_lead_cents ?? null,
          bucket_id: source.bucket_id ?? null,
          is_self_generated: source.is_self_generated ?? false,
          cost_type: (source.cost_type as CostType) ?? 'per_lead',
          created_at: source.created_at,
          updated_at: source.updated_at,
        }));
        setLeadSources(mapped);
      }
    } finally {
      setLoading(false);
    }
  };

  // Bucket handlers
  const handleCreateBucket = async (data: { name: string; commission_rate_percent: number }) => {
    const result = await createBucket(data);
    if (result) {
      toast.success("Marketing bucket created");
      return true;
    }
    toast.error("Failed to create bucket");
    return false;
  };

  const handleUpdateBucket = async (id: string, data: { name: string; commission_rate_percent: number }) => {
    const result = await updateBucket(id, data);
    if (result) {
      toast.success("Marketing bucket updated");
      return true;
    }
    toast.error("Failed to update bucket");
    return false;
  };

  const handleDeleteBucket = async (id: string) => {
    const result = await deleteBucket(id);
    if (result) {
      toast.success("Marketing bucket deleted");
      return true;
    }
    toast.error("Failed to delete bucket");
    return false;
  };

  const handleReorderBucket = async (id: string, direction: 'up' | 'down') => {
    const result = await reorderBuckets(id, direction);
    return result;
  };

  const handleAssignBucket = async (sourceId: string, bucketId: string) => {
    await updateLeadSource(sourceId, { bucket_id: bucketId });
  };

  // Get unassigned sources
  const unassignedSources = leadSources.filter(s => !s.bucket_id);

  // Group sources by bucket for "By Bucket" view
  const getSourcesByBucket = () => {
    const grouped: Record<string, LeadSourceExtended[]> = {};
    buckets.forEach(bucket => {
      grouped[bucket.id] = leadSources.filter(s => s.bucket_id === bucket.id);
    });
    return grouped;
  };

  if (initialLoading || bucketsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Marketing Buckets Section */}
      <MarketingBucketList
        buckets={buckets}
        leadSources={leadSources}
        onCreateBucket={handleCreateBucket}
        onUpdateBucket={handleUpdateBucket}
        onDeleteBucket={handleDeleteBucket}
        onReorderBucket={handleReorderBucket}
        loading={loading}
      />

      {/* Separator */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Lead Sources</h3>
          
          {/* View Toggle - only show if buckets exist */}
          {buckets.length > 0 && (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'all' | 'by-bucket')}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs px-3">All Sources</TabsTrigger>
                <TabsTrigger value="by-bucket" className="text-xs px-3">By Bucket</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {/* Add new lead source */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Enter lead source name..."
            value={newSourceName}
            onChange={(e) => setNewSourceName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addLeadSource()}
            disabled={loading}
          />
          <Button 
            onClick={addLeadSource} 
            disabled={!newSourceName.trim() || loading}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {/* Lead sources list */}
        <div className="space-y-2">
          {leadSources.length > 0 ? (
            viewMode === 'all' ? (
              // Flat list view
              leadSources
                .sort((a, b) => a.order_index - b.order_index)
                .map((source, index) => (
                  <EnhancedLeadSourceRow
                    key={source.id}
                    source={source}
                    buckets={buckets}
                    index={index}
                    totalCount={leadSources.length}
                    onUpdate={updateLeadSource}
                    onDelete={removeLeadSource}
                    onMove={moveLeadSource}
                    onManageSpend={(s) => setSpendModalSource(s)}
                    loading={loading}
                  />
                ))
            ) : (
              // Grouped by bucket view
              <div className="space-y-4">
                {buckets.map(bucket => {
                  const sourcesInBucket = leadSources.filter(s => s.bucket_id === bucket.id);
                  if (sourcesInBucket.length === 0) return null;
                  
                  return (
                    <div key={bucket.id} className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        {bucket.name} ({sourcesInBucket.length})
                      </h4>
                      {sourcesInBucket
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((source, index) => (
                          <EnhancedLeadSourceRow
                            key={source.id}
                            source={source}
                            buckets={buckets}
                            index={index}
                            totalCount={sourcesInBucket.length}
                            onUpdate={updateLeadSource}
                            onDelete={removeLeadSource}
                            onMove={moveLeadSource}
                            onManageSpend={(s) => setSpendModalSource(s)}
                            loading={loading}
                          />
                        ))}
                    </div>
                  );
                })}
                
                {/* Show unassigned in grouped view too */}
                {unassignedSources.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Unassigned ({unassignedSources.length})
                    </h4>
                    {unassignedSources
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((source, index) => (
                        <EnhancedLeadSourceRow
                          key={source.id}
                          source={source}
                          buckets={buckets}
                          index={index}
                          totalCount={unassignedSources.length}
                          onUpdate={updateLeadSource}
                          onDelete={removeLeadSource}
                          onMove={moveLeadSource}
                          onManageSpend={(s) => setSpendModalSource(s)}
                          loading={loading}
                        />
                      ))}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No lead sources configured yet.</p>
              <p className="text-sm">Add your first lead source above.</p>
            </div>
          )}
        </div>

        {/* Unassigned Lead Sources Section - only show in "all" view */}
        {viewMode === 'all' && (
          <div className="mt-6">
            <UnassignedLeadSourcesSection
              sources={unassignedSources}
              buckets={buckets}
              onAssignBucket={handleAssignBucket}
              loading={loading}
            />
          </div>
        )}
      </div>

      {/* Quote Report Upload Section (Temporary - will move to LQS Dashboard in Phase 4) */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium">Quote Report Upload</h3>
          <span className="text-xs text-muted-foreground">(Temporary location for testing)</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Upload Allstate "Quotes Detail and Conversion Rate Report" files to import quote data.
        </p>
        <Button onClick={() => setQuoteUploadOpen(true)} variant="outline">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Upload Allstate Quote Report
        </Button>
      </div>

      {/* Spend Modal */}
      <LeadSourceSpendModal
        open={!!spendModalSource}
        onOpenChange={(open) => !open && setSpendModalSource(null)}
        leadSourceId={spendModalSource?.id ?? null}
        leadSourceName={spendModalSource?.name ?? ''}
        costType={spendModalSource?.cost_type ?? 'per_lead'}
        agencyId={agencyId}
      />

      {/* Quote Upload Modal */}
      <QuoteReportUploadModal
        open={quoteUploadOpen}
        onOpenChange={setQuoteUploadOpen}
        agencyId={agencyId}
        userId={user?.id ?? null}
        displayName={user?.email ?? 'Unknown'}
        onUploadComplete={() => toast.success('Quote report uploaded successfully')}
      />
    </div>
  );
}
