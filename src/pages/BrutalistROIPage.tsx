import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Users,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Download,
  Calendar,
  Filter,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { BrutalistSidebar } from '@/components/brutalist';
import { useAgencyProfile } from '@/hooks/useAgencyProfile';

// ===========================================================================
// BRUTALIST ROI ANALYTICS PAGE
// A Neo-Brutalist take on the LQS ROI Analytics dashboard
// ===========================================================================

// Mock data for the prototype
const MOCK_LEAD_SOURCES = [
  { id: '1', name: 'GOOGLE ADS', spend: 12500, leads: 245, quoted: 180, sold: 45, premium: 125000, roi: 2.2, costPerSale: 278, color: '#4CAF50' },
  { id: '2', name: 'FACEBOOK', spend: 8200, leads: 312, quoted: 156, sold: 28, premium: 72000, roi: 1.9, costPerSale: 293, color: 'var(--brutalist-yellow)' },
  { id: '3', name: 'REFERRALS', spend: 1500, leads: 89, quoted: 78, sold: 52, premium: 156000, roi: 22.9, costPerSale: 29, color: '#FFFFFF' },
  { id: '4', name: 'WEBSITE', spend: 3200, leads: 156, quoted: 98, sold: 22, premium: 58000, roi: 4.0, costPerSale: 145, color: 'var(--brutalist-cyan)' },
  { id: '5', name: 'DIRECT MAIL', spend: 5800, leads: 78, quoted: 42, sold: 12, premium: 32000, roi: 1.2, costPerSale: 483, color: '#FF5252' },
  { id: '6', name: 'COLD CALLS', spend: 2100, leads: 134, quoted: 67, sold: 18, premium: 48000, roi: 5.0, costPerSale: 117, color: 'var(--brutalist-amber)' },
];

const MOCK_SUMMARY = {
  totalLeads: 1014,
  quotedHouseholds: 621,
  soldHouseholds: 177,
  premiumSold: 491000,
  totalSpend: 33300,
  commissionEarned: 107820,
  overallRoi: 3.24,
  quoteRate: 61.2,
  closeRate: 28.5,
};

type DatePreset = 'last30' | 'last60' | 'last90' | 'quarter' | 'ytd' | 'all';

export default function BrutalistROIPage() {
  const { user } = useAuth();
  const [isLightMode] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('last90');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['funnel', 'sources']));
  const [sortField, setSortField] = useState<'premium' | 'roi' | 'spend' | 'leads'>('premium');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data: agencyProfile, isLoading: agencyLoading } = useAgencyProfile(user?.id, 'Manager');

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const sortedSources = useMemo(() => {
    return [...MOCK_LEAD_SOURCES].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (agencyLoading) {
    return (
      <div className="brutalist-app brutalist-app-bg min-h-screen flex items-center justify-center font-brutalist">
        <div className="flex items-center gap-3 text-white">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="uppercase tracking-wider">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="brutalist-app brutalist-app-bg flex h-screen overflow-hidden font-brutalist">
      {/* Sidebar */}
      <BrutalistSidebar agencyName={agencyProfile?.agencyName} isLightMode={isLightMode} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b-2 border-white px-6 py-4 flex items-center justify-between bg-[#1A1A2E]">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white uppercase tracking-wide flex items-center gap-3">
                <BarChart3 className="w-7 h-7 text-[var(--brutalist-yellow)]" />
                ROI ANALYTICS
              </h1>
              <p className="text-white/50 text-sm uppercase tracking-wider mt-1">
                MARKETING PERFORMANCE ANALYSIS
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Date Preset Selector */}
            <select
              value={datePreset}
              onChange={e => setDatePreset(e.target.value as DatePreset)}
              className="bg-[#1A1A2E] border-2 border-white px-4 py-2 text-white text-sm uppercase font-bold tracking-wider cursor-pointer"
            >
              <option value="last30">LAST 30 DAYS</option>
              <option value="last60">LAST 60 DAYS</option>
              <option value="last90">LAST 90 DAYS</option>
              <option value="quarter">THIS QUARTER</option>
              <option value="ytd">YEAR TO DATE</option>
              <option value="all">ALL TIME</option>
            </select>
            <button className="border-2 border-white text-white px-4 py-2 font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-white hover:text-[#0D0D0D] transition-colors">
              <Download className="w-4 h-4" />
              EXPORT
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Metrics Strip */}
          <div className="grid grid-cols-4 gap-0 border-2 border-white">
            <MetricCard
              value={`$${Math.round(MOCK_SUMMARY.premiumSold / 1000)}K`}
              label="PREMIUM SOLD"
              icon={<DollarSign className="w-5 h-5" />}
              color="#4CAF50"
              trend={12.5}
              borderRight
            />
            <MetricCard
              value={`${MOCK_SUMMARY.overallRoi.toFixed(1)}x`}
              label="OVERALL ROI"
              icon={<TrendingUp className="w-5 h-5" />}
              color="var(--brutalist-yellow)"
              trend={8.2}
              borderRight
            />
            <MetricCard
              value={`${MOCK_SUMMARY.closeRate}%`}
              label="CLOSE RATE"
              icon={<Target className="w-5 h-5" />}
              color="#FFFFFF"
              trend={-2.1}
              borderRight
            />
            <MetricCard
              value={`$${Math.round(MOCK_SUMMARY.totalSpend / 1000)}K`}
              label="TOTAL SPEND"
              icon={<Percent className="w-5 h-5" />}
              color="var(--brutalist-cyan)"
            />
          </div>

          {/* Conversion Funnel */}
          <CollapsibleSection
            title="CONVERSION FUNNEL"
            isOpen={expandedSections.has('funnel')}
            onToggle={() => toggleSection('funnel')}
            accentColor="#4CAF50"
          >
            <div className="p-6">
              <div className="flex items-end justify-center gap-8">
                {/* Leads */}
                <FunnelBar
                  value={MOCK_SUMMARY.totalLeads}
                  label="LEADS"
                  percentage={100}
                  color="#FFFFFF"
                />

                {/* Arrow with rate */}
                <div className="flex flex-col items-center justify-center pb-24">
                  <ChevronRight className="w-8 h-8 text-white/30" />
                  <span className="text-white/50 text-xs font-bold mt-1">{MOCK_SUMMARY.quoteRate}%</span>
                </div>

                {/* Quoted */}
                <FunnelBar
                  value={MOCK_SUMMARY.quotedHouseholds}
                  label="QUOTED"
                  percentage={(MOCK_SUMMARY.quotedHouseholds / MOCK_SUMMARY.totalLeads) * 100}
                  color="var(--brutalist-yellow)"
                />

                {/* Arrow with rate */}
                <div className="flex flex-col items-center justify-center pb-24">
                  <ChevronRight className="w-8 h-8 text-white/30" />
                  <span className="text-white/50 text-xs font-bold mt-1">{MOCK_SUMMARY.closeRate}%</span>
                </div>

                {/* Sold */}
                <FunnelBar
                  value={MOCK_SUMMARY.soldHouseholds}
                  label="SOLD"
                  percentage={(MOCK_SUMMARY.soldHouseholds / MOCK_SUMMARY.totalLeads) * 100}
                  color="#4CAF50"
                />
              </div>

              {/* Insights Row */}
              <div className="mt-8 pt-6 border-t border-white/20 grid grid-cols-4 gap-6">
                <InsightCard
                  label="AVG PREMIUM/SALE"
                  value={`$${Math.round(MOCK_SUMMARY.premiumSold / MOCK_SUMMARY.soldHouseholds).toLocaleString()}`}
                />
                <InsightCard
                  label="COMMISSION EARNED"
                  value={`$${MOCK_SUMMARY.commissionEarned.toLocaleString()}`}
                  highlight
                />
                <InsightCard
                  label="AVG COST/LEAD"
                  value={`$${Math.round(MOCK_SUMMARY.totalSpend / MOCK_SUMMARY.totalLeads)}`}
                />
                <InsightCard
                  label="AVG COST/SALE"
                  value={`$${Math.round(MOCK_SUMMARY.totalSpend / MOCK_SUMMARY.soldHouseholds)}`}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* ROI Bubble Chart Visualization */}
          <div className="border-2 border-white bg-[#1A1A2E]">
            <div className="p-4 border-b border-white/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-[var(--brutalist-cyan)]" />
                <span className="text-white font-bold uppercase tracking-wider">ROI VS SPEND</span>
              </div>
              <div className="flex items-center gap-2 text-white/40 text-xs">
                <Info className="w-4 h-4" />
                <span>BUBBLE SIZE = PREMIUM SOLD</span>
              </div>
            </div>
            <div className="p-6">
              {/* Visual ROI Chart Representation */}
              <div className="relative h-64 border border-white/20">
                {/* Y-axis label */}
                <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-white/40 text-xs uppercase tracking-wider whitespace-nowrap">
                  ROI (X)
                </div>
                {/* X-axis label */}
                <div className="absolute bottom-[-28px] left-1/2 -translate-x-1/2 text-white/40 text-xs uppercase tracking-wider">
                  MONTHLY SPEND ($)
                </div>

                {/* Quadrant Labels */}
                <div className="absolute top-2 left-2 text-white/20 text-xs">HIGH ROI / LOW SPEND</div>
                <div className="absolute top-2 right-2 text-white/20 text-xs">HIGH ROI / HIGH SPEND</div>
                <div className="absolute bottom-2 left-2 text-white/20 text-xs">LOW ROI / LOW SPEND</div>
                <div className="absolute bottom-2 right-2 text-white/20 text-xs">LOW ROI / HIGH SPEND</div>

                {/* Quadrant Lines */}
                <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-white/20" />
                <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-white/20" />

                {/* Bubbles */}
                {MOCK_LEAD_SOURCES.map(source => {
                  // Position calculation (simplified for prototype)
                  const xPercent = Math.min((source.spend / 15000) * 100, 95);
                  const yPercent = 100 - Math.min((source.roi / 25) * 100, 95);
                  const size = Math.max(20, Math.min(80, (source.premium / 2000)));

                  return (
                    <div
                      key={source.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-transform hover:scale-110"
                      style={{
                        left: `${xPercent}%`,
                        top: `${yPercent}%`,
                      }}
                    >
                      <div
                        className="rounded-full border-2 flex items-center justify-center"
                        style={{
                          width: size,
                          height: size,
                          borderColor: source.color,
                          backgroundColor: `${source.color}20`,
                        }}
                      />
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-[#1A1A2E] border-2 border-white px-3 py-2 whitespace-nowrap">
                          <div className="text-white font-bold text-sm">{source.name}</div>
                          <div className="text-white/60 text-xs">ROI: {source.roi.toFixed(1)}x</div>
                          <div className="text-white/60 text-xs">Spend: ${source.spend.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Lead Sources Table */}
          <CollapsibleSection
            title="LEAD SOURCE BREAKDOWN"
            isOpen={expandedSections.has('sources')}
            onToggle={() => toggleSection('sources')}
            accentColor="var(--brutalist-yellow)"
            rightContent={<span className="text-white/40 text-xs">{MOCK_LEAD_SOURCES.length} SOURCES</span>}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-white/30">
                    <TableHeader label="SOURCE" />
                    <TableHeader
                      label="SPEND"
                      sortable
                      sorted={sortField === 'spend' ? sortDir : undefined}
                      onClick={() => handleSort('spend')}
                    />
                    <TableHeader
                      label="LEADS"
                      sortable
                      sorted={sortField === 'leads' ? sortDir : undefined}
                      onClick={() => handleSort('leads')}
                    />
                    <TableHeader label="QUOTED" />
                    <TableHeader label="SOLD" />
                    <TableHeader
                      label="PREMIUM"
                      sortable
                      sorted={sortField === 'premium' ? sortDir : undefined}
                      onClick={() => handleSort('premium')}
                    />
                    <TableHeader
                      label="ROI"
                      sortable
                      sorted={sortField === 'roi' ? sortDir : undefined}
                      onClick={() => handleSort('roi')}
                    />
                    <TableHeader label="COST/SALE" />
                  </tr>
                </thead>
                <tbody>
                  {sortedSources.map(source => (
                    <tr
                      key={source.id}
                      className="border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3"
                            style={{ backgroundColor: source.color }}
                          />
                          <span className="text-white font-bold uppercase tracking-wider text-sm">
                            {source.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-white/80 text-right font-mono">
                        ${source.spend.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-white/80 text-right font-mono">
                        {source.leads}
                      </td>
                      <td className="py-4 px-4 text-white/80 text-right font-mono">
                        {source.quoted}
                      </td>
                      <td className="py-4 px-4 text-right font-mono">
                        <span className="text-[#4CAF50] font-bold">{source.sold}</span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono">
                        <span className="text-[var(--brutalist-yellow)] font-bold">
                          ${source.premium.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span
                          className={cn(
                            'font-bold text-sm px-2 py-1',
                            source.roi >= 3 ? 'bg-[#4CAF50] text-white' :
                            source.roi >= 1.5 ? 'bg-[var(--brutalist-yellow)] text-[#0D0D0D]' :
                            'bg-[#FF5252] text-white'
                          )}
                        >
                          {source.roi.toFixed(1)}x
                        </span>
                      </td>
                      <td className="py-4 px-4 text-white/60 text-right font-mono">
                        ${source.costPerSale}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals Row */}
                <tfoot>
                  <tr className="border-t-2 border-white bg-white/5">
                    <td className="py-4 px-4 text-white font-bold uppercase">TOTAL</td>
                    <td className="py-4 px-4 text-white font-bold text-right font-mono">
                      ${MOCK_SUMMARY.totalSpend.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-white font-bold text-right font-mono">
                      {MOCK_SUMMARY.totalLeads}
                    </td>
                    <td className="py-4 px-4 text-white font-bold text-right font-mono">
                      {MOCK_SUMMARY.quotedHouseholds}
                    </td>
                    <td className="py-4 px-4 text-white font-bold text-right font-mono">
                      {MOCK_SUMMARY.soldHouseholds}
                    </td>
                    <td className="py-4 px-4 text-right font-mono">
                      <span className="text-[var(--brutalist-yellow)] font-bold">
                        ${MOCK_SUMMARY.premiumSold.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="bg-[#4CAF50] text-white font-bold text-sm px-2 py-1">
                        {MOCK_SUMMARY.overallRoi.toFixed(1)}x
                      </span>
                    </td>
                    <td className="py-4 px-4 text-white/60 text-right font-mono">
                      ${Math.round(MOCK_SUMMARY.totalSpend / MOCK_SUMMARY.soldHouseholds)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CollapsibleSection>

          {/* Performance Insights */}
          <div className="grid grid-cols-2 gap-6">
            {/* Best Performers */}
            <div className="border-2 border-[#4CAF50] bg-[#1A1A2E]">
              <div className="p-4 border-b border-[#4CAF50]/30 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#4CAF50]" />
                <span className="text-[#4CAF50] font-bold uppercase tracking-wider">TOP PERFORMERS</span>
              </div>
              <div className="p-4 space-y-3">
                {sortedSources
                  .filter(s => s.roi >= 2)
                  .slice(0, 3)
                  .map((source, idx) => (
                    <div key={source.id} className="flex items-center justify-between p-3 border border-[#4CAF50]/30">
                      <div className="flex items-center gap-3">
                        <span className="text-[#4CAF50] font-bold text-xl">#{idx + 1}</span>
                        <span className="text-white font-bold uppercase">{source.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[#4CAF50] font-bold">{source.roi.toFixed(1)}x ROI</div>
                        <div className="text-white/40 text-xs">${source.premium.toLocaleString()} PREMIUM</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Needs Attention */}
            <div className="border-2 border-[#FF5252] bg-[#1A1A2E]">
              <div className="p-4 border-b border-[#FF5252]/30 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-[#FF5252]" />
                <span className="text-[#FF5252] font-bold uppercase tracking-wider">NEEDS ATTENTION</span>
              </div>
              <div className="p-4 space-y-3">
                {sortedSources
                  .filter(s => s.roi < 2)
                  .sort((a, b) => a.roi - b.roi)
                  .slice(0, 3)
                  .map(source => (
                    <div key={source.id} className="flex items-center justify-between p-3 border border-[#FF5252]/30">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-bold uppercase">{source.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[#FF5252] font-bold">{source.roi.toFixed(1)}x ROI</div>
                        <div className="text-white/40 text-xs">${source.costPerSale}/SALE</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ===========================================================================
// SUPPORTING COMPONENTS
// ===========================================================================

function MetricCard({
  value,
  label,
  icon,
  color,
  trend,
  borderRight = false,
}: {
  value: string | number;
  label: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  borderRight?: boolean;
}) {
  return (
    <div
      className={cn('p-6 bg-[#1A1A2E]', borderRight && 'border-r-2 border-white')}
      style={{ borderTop: `4px solid ${color}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div style={{ color }}>{icon}</div>
        {trend !== undefined && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-bold px-2 py-0.5',
              trend >= 0 ? 'bg-[#4CAF50] text-white' : 'bg-[#FF5252] text-white'
            )}
          >
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-4xl lg:text-5xl font-black text-white leading-none">{value}</div>
      <div className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2">{label}</div>
    </div>
  );
}

function FunnelBar({
  value,
  label,
  percentage,
  color,
}: {
  value: number;
  label: string;
  percentage: number;
  color: string;
}) {
  const maxHeight = 200;
  const height = Math.max(40, (percentage / 100) * maxHeight);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-3xl font-black" style={{ color }}>
        {value.toLocaleString()}
      </div>
      <div
        className="w-24 border-2 transition-all duration-500"
        style={{
          height,
          borderColor: color,
          backgroundColor: `${color}20`,
        }}
      />
      <div className="text-white/50 text-xs font-bold uppercase tracking-widest">{label}</div>
    </div>
  );
}

function InsightCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'border p-4',
        highlight ? 'border-[#4CAF50] bg-[#4CAF50]/10' : 'border-white/20'
      )}
    >
      <div className="text-white/50 text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className={cn('text-2xl font-bold', highlight ? 'text-[#4CAF50]' : 'text-white')}>
        {value}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  accentColor,
  rightContent,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  accentColor: string;
  rightContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-2 border-white bg-[#1A1A2E]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-1 h-6" style={{ backgroundColor: accentColor }} />
          <span className="text-white font-bold uppercase tracking-wider">{title}</span>
          {rightContent}
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-white/50" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/20">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TableHeader({
  label,
  sortable = false,
  sorted,
  onClick,
}: {
  label: string;
  sortable?: boolean;
  sorted?: 'asc' | 'desc';
  onClick?: () => void;
}) {
  return (
    <th
      className={cn(
        'py-3 px-4 text-left text-white/60 text-xs uppercase tracking-wider font-bold',
        sortable && 'cursor-pointer hover:text-white transition-colors'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1">
        {label}
        {sorted && (
          <span className="text-[var(--brutalist-yellow)]">
            {sorted === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );
}
