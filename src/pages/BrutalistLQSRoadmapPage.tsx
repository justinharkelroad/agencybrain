import { useState, useMemo, useCallback, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Users,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Phone,
  Mail,
  User,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Upload,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { BrutalistSidebar } from '@/components/brutalist';
import { useLqsData, useLqsLeadSources, HouseholdWithRelations } from '@/hooks/useLqsData';
import { useAgencyProfile } from '@/hooks/useAgencyProfile';
import { hasSalesAccess } from '@/lib/salesBetaAccess';
import { format } from 'date-fns';
import { toast } from 'sonner';

// ===========================================================================
// BRUTALIST LQS ROADMAP PAGE
// A Neo-Brutalist take on the LQS (Lead → Quote → Sale) tracking
// ===========================================================================

type BucketType = 'leads' | 'quoted' | 'sold';
type ViewMode = 'overview' | 'detail';

export default function BrutalistLQSRoadmapPage() {
  const { user } = useAuth();
  const [isLightMode] = useState(false);

  // Fetch agency profile
  const { data: agencyProfile, isLoading: agencyLoading } = useAgencyProfile(user?.id, 'Manager');

  // Access check
  const hasAccess = hasSalesAccess(agencyProfile?.agencyId ?? null);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [activeBucket, setActiveBucket] = useState<BucketType>('quoted');
  const [expandedHouseholds, setExpandedHouseholds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch LQS data
  const {
    data,
    isLoading: dataLoading,
    refetch,
  } = useLqsData({
    agencyId: agencyProfile?.agencyId ?? null,
    dateRange: null,
    statusFilter: 'all',
    searchTerm: '',
  });

  const { data: leadSources = [] } = useLqsLeadSources(agencyProfile?.agencyId ?? null);

  // Filter households by bucket
  const bucketFilteredHouseholds = useMemo(() => {
    if (!data?.households) return [];

    let filtered = data.households;

    // Filter by bucket (status)
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

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(h =>
        `${h.first_name} ${h.last_name}`.toLowerCase().includes(term) ||
        h.zip_code?.includes(term) ||
        h.lead_source?.name?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [data?.households, activeBucket, searchTerm]);

  // Bucket counts
  const bucketCounts = useMemo(() => {
    const households = data?.households || [];
    return {
      leads: households.filter(h => h.status === 'lead').length,
      quoted: households.filter(h => h.status === 'quoted').length,
      sold: households.filter(h => h.status === 'sold').length,
    };
  }, [data?.households]);

  // Conversion rates
  const conversionRates = useMemo(() => {
    const total = bucketCounts.leads + bucketCounts.quoted + bucketCounts.sold;
    const quoted = bucketCounts.quoted + bucketCounts.sold;
    const sold = bucketCounts.sold;

    return {
      leadToQuote: total > 0 ? ((quoted / total) * 100).toFixed(1) : '0',
      quoteToSale: quoted > 0 ? ((sold / quoted) * 100).toFixed(1) : '0',
      overall: total > 0 ? ((sold / total) * 100).toFixed(1) : '0',
    };
  }, [bucketCounts]);

  // Handlers
  const handleBucketClick = useCallback((bucket: BucketType) => {
    setActiveBucket(bucket);
    setViewMode('detail');
    setExpandedHouseholds(new Set());
  }, []);

  const handleBackToOverview = useCallback(() => {
    setViewMode('overview');
  }, []);

  const toggleHousehold = (id: string) => {
    setExpandedHouseholds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Sync sales handler
  const [isSyncing, setIsSyncing] = useState(false);
  const handleSyncSales = async () => {
    if (!agencyProfile?.agencyId) return;

    setIsSyncing(true);
    try {
      const { data: results, error } = await supabase.rpc('backfill_lqs_sales_matching', {
        p_agency_id: agencyProfile.agencyId,
      });

      if (error) throw error;

      const linked = results?.filter((r: { status: string }) => r.status === 'linked').length || 0;
      if (linked > 0) {
        toast.success(`Matched ${linked} sales to households`);
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

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isLoading = agencyLoading || dataLoading;

  return (
    <div className="brutalist-app brutalist-app-bg flex h-screen overflow-hidden font-brutalist">
      {/* Sidebar */}
      <BrutalistSidebar agencyName={agencyProfile?.agencyName} isLightMode={isLightMode} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b-2 border-white px-6 py-4 flex items-center justify-between bg-[#1A1A2E]">
          <div className="flex items-center gap-4">
            {viewMode === 'detail' && (
              <button
                onClick={handleBackToOverview}
                className="border-2 border-white/30 p-2 text-white/60 hover:border-white hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white uppercase tracking-wide flex items-center gap-3">
                <Target className="w-7 h-7 text-[var(--brutalist-yellow)]" />
                LQS ROADMAP
              </h1>
              <p className="text-white/50 text-sm uppercase tracking-wider mt-1">
                LEAD → QUOTE → SALE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="border-2 border-white text-white px-4 py-2 font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-white hover:text-[#0D0D0D] transition-colors">
              <Plus className="w-4 h-4" />
              ADD LEAD
            </button>
            <button className="border-2 border-white text-white px-4 py-2 font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-white hover:text-[#0D0D0D] transition-colors">
              <Upload className="w-4 h-4" />
              UPLOAD
            </button>
            <button
              onClick={handleSyncSales}
              disabled={isSyncing}
              className="bg-[#4CAF50] text-[#0D0D0D] px-5 py-2.5 font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-[#66BB6A] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
              {isSyncing ? 'SYNCING...' : 'SYNC SALES'}
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview Mode */}
          {viewMode === 'overview' && (
            <>
              {/* Funnel Visualization */}
              <div className="border-2 border-white bg-[#1A1A2E] p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-1 h-6 bg-[var(--brutalist-yellow)]" />
                  <span className="text-white font-bold uppercase tracking-wider">
                    SALES FUNNEL
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-0">
                  {/* Leads Bucket */}
                  <BucketCard
                    type="leads"
                    count={bucketCounts.leads}
                    label="LEADS"
                    color="#FFFFFF"
                    onClick={() => handleBucketClick('leads')}
                    isFirst
                  />

                  {/* Quoted Bucket */}
                  <BucketCard
                    type="quoted"
                    count={bucketCounts.quoted}
                    label="QUOTED"
                    color="var(--brutalist-yellow)"
                    onClick={() => handleBucketClick('quoted')}
                    conversionRate={conversionRates.leadToQuote}
                  />

                  {/* Sold Bucket */}
                  <BucketCard
                    type="sold"
                    count={bucketCounts.sold}
                    label="SOLD"
                    color="#4CAF50"
                    onClick={() => handleBucketClick('sold')}
                    conversionRate={conversionRates.quoteToSale}
                    isLast
                  />
                </div>

                {/* Conversion Summary */}
                <div className="mt-6 pt-6 border-t border-white/20 flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="text-3xl font-black text-[var(--brutalist-yellow)]">
                      {conversionRates.overall}%
                    </div>
                    <div className="text-white/50 text-xs uppercase tracking-widest mt-1">
                      OVERALL CONVERSION
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-0 border-2 border-white">
                <StatCard
                  value={data?.metrics?.totalQuotes || 0}
                  label="TOTAL QUOTES"
                  icon={<TrendingUp className="w-5 h-5" />}
                  color="#FFFFFF"
                  borderRight
                />
                <StatCard
                  value={data?.metrics?.selfGenerated || 0}
                  label="SELF-GENERATED"
                  icon={<Users className="w-5 h-5" />}
                  color="var(--brutalist-yellow)"
                  borderRight
                />
                <StatCard
                  value={data?.metrics?.needsAttention || 0}
                  label="NEEDS ATTENTION"
                  icon={<AlertTriangle className="w-5 h-5" />}
                  color="#FF5252"
                  borderRight
                />
                <StatCard
                  value={`$${((data?.metrics?.totalPremium || 0) / 100).toLocaleString()}`}
                  label="TOTAL PREMIUM"
                  icon={<DollarSign className="w-5 h-5" />}
                  color="#4CAF50"
                />
              </div>

              {/* Lead Sources Overview */}
              <div className="border-2 border-white bg-[#1A1A2E]">
                <div className="p-4 border-b border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-[var(--brutalist-cyan)]" />
                    <span className="text-white font-bold uppercase tracking-wider">
                      LEAD SOURCES
                    </span>
                  </div>
                  <span className="text-white/50 text-sm">{leadSources.length} SOURCES</span>
                </div>
                <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {leadSources.slice(0, 8).map(source => {
                    const count =
                      data?.households?.filter(h => h.lead_source_id === source.id).length || 0;
                    return (
                      <div
                        key={source.id}
                        className="border border-white/20 p-3 hover:border-white/40 transition-colors cursor-pointer"
                      >
                        <div className="text-2xl font-black text-white">{count}</div>
                        <div className="text-white/50 text-xs uppercase tracking-wider truncate">
                          {source.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Detail Mode */}
          {viewMode === 'detail' && (
            <>
              {/* Bucket Tabs */}
              <div className="flex items-center gap-0 border-2 border-white">
                <BucketTab
                  type="leads"
                  count={bucketCounts.leads}
                  label="LEADS"
                  isActive={activeBucket === 'leads'}
                  onClick={() => setActiveBucket('leads')}
                />
                <BucketTab
                  type="quoted"
                  count={bucketCounts.quoted}
                  label="QUOTED"
                  isActive={activeBucket === 'quoted'}
                  onClick={() => setActiveBucket('quoted')}
                />
                <BucketTab
                  type="sold"
                  count={bucketCounts.sold}
                  label="SOLD"
                  isActive={activeBucket === 'sold'}
                  onClick={() => setActiveBucket('sold')}
                />
              </div>

              {/* Search & Filters */}
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <input
                    type="text"
                    placeholder="SEARCH BY NAME, ZIP, OR SOURCE..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-[#1A1A2E] border-2 border-white/30 text-white pl-11 pr-4 py-3 text-sm uppercase tracking-wider placeholder:text-white/30 focus:border-white focus:outline-none"
                  />
                </div>
                <button className="border-2 border-white/30 text-white/60 px-4 py-3 flex items-center gap-2 hover:border-white hover:text-white transition-colors">
                  <Filter className="w-4 h-4" />
                  <span className="text-sm uppercase tracking-wider">FILTERS</span>
                </button>
              </div>

              {/* Results Count */}
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-xs uppercase tracking-widest font-bold">
                  {bucketFilteredHouseholds.length} HOUSEHOLD
                  {bucketFilteredHouseholds.length !== 1 ? 'S' : ''}
                </span>
              </div>

              {/* Households List */}
              <div className="space-y-0">
                {bucketFilteredHouseholds.map(household => (
                  <HouseholdRow
                    key={household.id}
                    household={household}
                    isExpanded={expandedHouseholds.has(household.id)}
                    onToggle={() => toggleHousehold(household.id)}
                    activeBucket={activeBucket}
                  />
                ))}

                {bucketFilteredHouseholds.length === 0 && !isLoading && (
                  <div className="border-2 border-white/30 p-12 text-center">
                    <div className="w-16 h-16 border-2 border-white/20 flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-white/20" />
                    </div>
                    <h3 className="text-white text-lg font-bold uppercase mb-2">No Households</h3>
                    <p className="text-white/50 text-sm">
                      {searchTerm ? 'No results match your search.' : 'No households in this bucket yet.'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-white">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="uppercase tracking-wider">Loading...</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ===========================================================================
// BUCKET CARD COMPONENT
// ===========================================================================
function BucketCard({
  type,
  count,
  label,
  color,
  onClick,
  conversionRate,
  isFirst,
  isLast,
}: {
  type: BucketType;
  count: number;
  label: string;
  color: string;
  onClick: () => void;
  conversionRate?: string;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative p-6 bg-[#1A1A2E] border-2 border-white transition-all group',
        'hover:bg-white/5',
        !isFirst && '-ml-[2px]'
      )}
    >
      {/* Conversion Arrow */}
      {conversionRate && (
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 z-10">
          <div className="flex items-center gap-1">
            <ChevronRight className="w-5 h-5 text-white/30" />
            <span className="text-white/50 text-xs font-bold">{conversionRate}%</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="text-center">
        <div className="text-6xl lg:text-7xl font-black leading-none" style={{ color }}>
          {count}
        </div>
        <div className="text-white/50 text-sm font-bold uppercase tracking-widest mt-3">
          {label}
        </div>
      </div>

      {/* Hover indicator */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: color }}
      />
    </button>
  );
}

// ===========================================================================
// STAT CARD COMPONENT
// ===========================================================================
function StatCard({
  value,
  label,
  icon,
  color,
  borderRight = false,
}: {
  value: number | string;
  label: string;
  icon: React.ReactNode;
  color: string;
  borderRight?: boolean;
}) {
  return (
    <div
      className={cn('p-6 bg-[#1A1A2E]', borderRight && 'border-r-2 border-white')}
      style={{ borderTop: `4px solid ${color}` }}
    >
      <div className="flex items-center gap-3 mb-3" style={{ color }}>
        {icon}
      </div>
      <div className="text-4xl lg:text-5xl font-black text-white leading-none">{value}</div>
      <div className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2">{label}</div>
    </div>
  );
}

// ===========================================================================
// BUCKET TAB COMPONENT
// ===========================================================================
function BucketTab({
  type,
  count,
  label,
  isActive,
  onClick,
}: {
  type: BucketType;
  count: number;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const colors: Record<BucketType, string> = {
    leads: '#FFFFFF',
    quoted: 'var(--brutalist-yellow)',
    sold: '#4CAF50',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 p-4 text-center transition-colors border-r-2 border-white last:border-r-0',
        isActive ? 'bg-white/10' : 'bg-[#1A1A2E] hover:bg-white/5'
      )}
      style={{ borderBottom: isActive ? `4px solid ${colors[type]}` : '4px solid transparent' }}
    >
      <div className="text-3xl font-black" style={{ color: colors[type] }}>
        {count}
      </div>
      <div className="text-white/50 text-xs font-bold uppercase tracking-widest mt-1">{label}</div>
    </button>
  );
}

// ===========================================================================
// HOUSEHOLD ROW COMPONENT
// ===========================================================================
function HouseholdRow({
  household,
  isExpanded,
  onToggle,
  activeBucket,
}: {
  household: HouseholdWithRelations;
  isExpanded: boolean;
  onToggle: () => void;
  activeBucket: BucketType;
}) {
  const statusColors: Record<string, string> = {
    lead: '#FFFFFF',
    quoted: 'var(--brutalist-yellow)',
    sold: '#4CAF50',
  };

  const quotesCount = household.quotes?.length || 0;
  const salesCount = household.sales?.length || 0;

  return (
    <div
      className={cn(
        'border-2 mb-0 -mt-[2px] first:mt-0',
        household.needs_attention
          ? 'border-[#FF5252]/50 bg-[#FF5252]/5'
          : 'border-white/20 bg-[#1A1A2E]'
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors',
          household.needs_attention && 'border-l-4 border-l-[#FF5252]'
        )}
      >
        <div className="flex items-center gap-4">
          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight className="w-5 h-5 text-white/50" />
          </motion.div>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 border-2 flex items-center justify-center"
              style={{ borderColor: statusColors[household.status] }}
            >
              <User className="w-5 h-5" style={{ color: statusColors[household.status] }} />
            </div>
            <div className="text-left">
              <span className="text-white font-bold uppercase tracking-wider text-base">
                {household.first_name} {household.last_name}
              </span>
              <div className="flex items-center gap-3 text-white/50 text-xs mt-0.5">
                {household.zip_code && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {household.zip_code}
                  </span>
                )}
                {household.lead_source?.name && (
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {household.lead_source.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {quotesCount > 0 && (
            <span className="px-2 py-1 border border-[var(--brutalist-yellow)] text-[var(--brutalist-yellow)] text-xs font-bold uppercase">
              {quotesCount} QUOTE{quotesCount !== 1 ? 'S' : ''}
            </span>
          )}
          {salesCount > 0 && (
            <span className="px-2 py-1 bg-[#4CAF50] text-[#0D0D0D] text-xs font-bold uppercase">
              {salesCount} SALE{salesCount !== 1 ? 'S' : ''}
            </span>
          )}
          {household.needs_attention && (
            <span className="px-2 py-1 bg-[#FF5252] text-white text-xs font-bold uppercase">
              ATTENTION
            </span>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 p-4 space-y-4">
              {/* Contact Info */}
              <div className="grid grid-cols-3 gap-4">
                {household.phone?.[0] && (
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Phone className="w-4 h-4" />
                    {household.phone[0]}
                  </div>
                )}
                {household.email && (
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Mail className="w-4 h-4" />
                    {household.email}
                  </div>
                )}
                {household.lead_received_date && (
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Calendar className="w-4 h-4" />
                    Lead: {format(new Date(household.lead_received_date), 'MMM d, yyyy')}
                  </div>
                )}
              </div>

              {/* Quotes */}
              {household.quotes && household.quotes.length > 0 && (
                <div className="border border-white/10 p-3">
                  <div className="text-white/50 text-xs uppercase tracking-wider font-bold mb-2">
                    QUOTES
                  </div>
                  <div className="space-y-2">
                    {household.quotes.map(quote => (
                      <div
                        key={quote.id}
                        className="flex items-center justify-between text-sm border-b border-white/5 pb-2 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[var(--brutalist-yellow)] font-bold uppercase">
                            {quote.product_type}
                          </span>
                          <span className="text-white/40">
                            {format(new Date(quote.quote_date), 'MMM d')}
                          </span>
                        </div>
                        <div className="text-white font-bold">
                          ${(quote.premium_cents / 100).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sales */}
              {household.sales && household.sales.length > 0 && (
                <div className="border border-[#4CAF50]/30 bg-[#4CAF50]/5 p-3">
                  <div className="text-[#4CAF50] text-xs uppercase tracking-wider font-bold mb-2">
                    SALES
                  </div>
                  <div className="space-y-2">
                    {household.sales.map(sale => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between text-sm border-b border-[#4CAF50]/10 pb-2 last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 text-[#4CAF50]" />
                          <span className="text-[#4CAF50] font-bold uppercase">
                            {sale.product_type}
                          </span>
                          <span className="text-white/40">
                            {format(new Date(sale.sale_date), 'MMM d')}
                          </span>
                        </div>
                        <div className="text-white font-bold">
                          ${(sale.premium_cents / 100).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button className="border border-white/30 text-white/60 px-3 py-1.5 text-xs uppercase font-bold hover:border-white hover:text-white transition-colors flex items-center gap-2">
                  <Eye className="w-3 h-3" />
                  VIEW PROFILE
                </button>
                <button className="border border-white/30 text-white/60 px-3 py-1.5 text-xs uppercase font-bold hover:border-white hover:text-white transition-colors flex items-center gap-2">
                  <Tag className="w-3 h-3" />
                  ASSIGN SOURCE
                </button>
                <button className="border border-white/30 text-white/60 px-3 py-1.5 text-xs uppercase font-bold hover:border-white hover:text-white transition-colors flex items-center gap-2">
                  <MoreHorizontal className="w-3 h-3" />
                  MORE
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
