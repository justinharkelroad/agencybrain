import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Upload,
  Search,
  Filter,
  Phone,
  Calendar,
  Star,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  X,
  CalendarDays,
  BarChart3,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { BrutalistSidebar } from '@/components/brutalist';
import { useAgencyProfile } from '@/hooks/useAgencyProfile';

// ===========================================================================
// BRUTALIST RENEWALS PAGE
// A Neo-Brutalist take on the Renewals management interface
// ===========================================================================

type WorkflowStatus = 'uncontacted' | 'pending' | 'success' | 'unsuccessful';
type RenewalStatus = 'Renewal Taken' | 'Renewal Not Taken' | 'Pending' | null;

interface RenewalRecord {
  id: string;
  firstName: string;
  lastName: string;
  policyNumber: string;
  productName: string;
  effectiveDate: string;
  premiumOld: number;
  premiumNew: number;
  premiumChangePercent: number;
  renewalStatus: RenewalStatus;
  workflowStatus: WorkflowStatus;
  amountDue: number;
  isBundled: boolean;
  isPriority: boolean;
  assignedTo: string | null;
}

// Mock data
const MOCK_RENEWALS: RenewalRecord[] = [
  { id: '1', firstName: 'JOHN', lastName: 'SMITH', policyNumber: 'POL-001234', productName: 'AUTO', effectiveDate: '2024-02-15', premiumOld: 1200, premiumNew: 1380, premiumChangePercent: 15.0, renewalStatus: null, workflowStatus: 'uncontacted', amountDue: 1380, isBundled: true, isPriority: true, assignedTo: 'Sarah J.' },
  { id: '2', firstName: 'MARY', lastName: 'JOHNSON', policyNumber: 'POL-001235', productName: 'FIRE', effectiveDate: '2024-02-15', premiumOld: 2400, premiumNew: 2520, premiumChangePercent: 5.0, renewalStatus: 'Pending', workflowStatus: 'pending', amountDue: 2520, isBundled: true, isPriority: false, assignedTo: 'Mike C.' },
  { id: '3', firstName: 'ROBERT', lastName: 'WILLIAMS', policyNumber: 'POL-001236', productName: 'AUTO', effectiveDate: '2024-02-16', premiumOld: 980, premiumNew: 1176, premiumChangePercent: 20.0, renewalStatus: 'Renewal Not Taken', workflowStatus: 'unsuccessful', amountDue: 0, isBundled: false, isPriority: true, assignedTo: null },
  { id: '4', firstName: 'PATRICIA', lastName: 'BROWN', policyNumber: 'POL-001237', productName: 'RENTERS', effectiveDate: '2024-02-16', premiumOld: 360, premiumNew: 378, premiumChangePercent: 5.0, renewalStatus: 'Renewal Taken', workflowStatus: 'success', amountDue: 378, isBundled: false, isPriority: false, assignedTo: 'Emily D.' },
  { id: '5', firstName: 'MICHAEL', lastName: 'DAVIS', policyNumber: 'POL-001238', productName: 'UMBRELLA', effectiveDate: '2024-02-17', premiumOld: 450, premiumNew: 495, premiumChangePercent: 10.0, renewalStatus: null, workflowStatus: 'uncontacted', amountDue: 495, isBundled: true, isPriority: false, assignedTo: null },
  { id: '6', firstName: 'JENNIFER', lastName: 'MILLER', policyNumber: 'POL-001239', productName: 'FIRE', effectiveDate: '2024-02-17', premiumOld: 3200, premiumNew: 2880, premiumChangePercent: -10.0, renewalStatus: 'Renewal Taken', workflowStatus: 'success', amountDue: 2880, isBundled: true, isPriority: false, assignedTo: 'Lisa M.' },
  { id: '7', firstName: 'WILLIAM', lastName: 'WILSON', policyNumber: 'POL-001240', productName: 'AUTO', effectiveDate: '2024-02-18', premiumOld: 1450, premiumNew: 1740, premiumChangePercent: 20.0, renewalStatus: 'Pending', workflowStatus: 'pending', amountDue: 1740, isBundled: false, isPriority: true, assignedTo: 'Sarah J.' },
  { id: '8', firstName: 'ELIZABETH', lastName: 'MOORE', policyNumber: 'POL-001241', productName: 'CONDO', effectiveDate: '2024-02-18', premiumOld: 890, premiumNew: 934, premiumChangePercent: 5.0, renewalStatus: null, workflowStatus: 'uncontacted', amountDue: 934, isBundled: false, isPriority: false, assignedTo: null },
  { id: '9', firstName: 'DAVID', lastName: 'TAYLOR', policyNumber: 'POL-001242', productName: 'AUTO', effectiveDate: '2024-02-19', premiumOld: 1100, premiumNew: 1045, premiumChangePercent: -5.0, renewalStatus: 'Renewal Taken', workflowStatus: 'success', amountDue: 1045, isBundled: true, isPriority: false, assignedTo: 'Mike C.' },
  { id: '10', firstName: 'SUSAN', lastName: 'ANDERSON', policyNumber: 'POL-001243', productName: 'FIRE', effectiveDate: '2024-02-19', premiumOld: 2800, premiumNew: 3360, premiumChangePercent: 20.0, renewalStatus: null, workflowStatus: 'uncontacted', amountDue: 3360, isBundled: true, isPriority: true, assignedTo: null },
];

// Mock chart data - 7 days
const MOCK_CHART_DATA = [
  { date: '2024-02-13', dateLabel: 'Feb 13', dayName: 'Tue', count: 18, dayIndex: 2 },
  { date: '2024-02-14', dateLabel: 'Feb 14', dayName: 'Wed', count: 24, dayIndex: 3 },
  { date: '2024-02-15', dateLabel: 'Feb 15', dayName: 'Thu', count: 31, dayIndex: 4 },
  { date: '2024-02-16', dateLabel: 'Feb 16', dayName: 'Fri', count: 22, dayIndex: 5 },
  { date: '2024-02-17', dateLabel: 'Feb 17', dayName: 'Sat', count: 8, dayIndex: 6 },
  { date: '2024-02-18', dateLabel: 'Feb 18', dayName: 'Sun', count: 5, dayIndex: 0 },
  { date: '2024-02-19', dateLabel: 'Feb 19', dayName: 'Mon', count: 28, dayIndex: 1 },
];

const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MOCK_STATS = {
  total: 156,
  uncontacted: 42,
  pending: 38,
  success: 68,
  unsuccessful: 8,
};

const STATUS_CONFIG: Record<WorkflowStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  uncontacted: { label: 'UNCONTACTED', color: '#FFFFFF', bgColor: 'rgba(255,255,255,0.1)', icon: AlertTriangle },
  pending: { label: 'PENDING', color: 'var(--brutalist-yellow)', bgColor: 'rgba(255,193,7,0.1)', icon: Clock },
  success: { label: 'SUCCESS', color: '#4CAF50', bgColor: 'rgba(76,175,80,0.1)', icon: CheckCircle2 },
  unsuccessful: { label: 'UNSUCCESSFUL', color: '#FF5252', bgColor: 'rgba(255,82,82,0.1)', icon: XCircle },
};

export default function BrutalistRenewalsPage() {
  const { user } = useAuth();
  const [isLightMode] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkflowStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPriorityOnly, setShowPriorityOnly] = useState(false);
  const [hideRenewalTaken, setHideRenewalTaken] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [chartDateFilter, setChartDateFilter] = useState<string | null>(null);
  const [chartDayFilter, setChartDayFilter] = useState<number | null>(null);

  const { data: agencyProfile, isLoading: agencyLoading } = useAgencyProfile(user?.id, 'Manager');

  // Chart data calculations
  const averageCount = useMemo(() => {
    const total = MOCK_CHART_DATA.reduce((sum, d) => sum + d.count, 0);
    return total / MOCK_CHART_DATA.length;
  }, []);

  // Day of week data for bar chart
  const dayOfWeekData = useMemo(() => {
    const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
    return [...MOCK_CHART_DATA].sort((a, b) => dayOrder.indexOf(a.dayIndex) - dayOrder.indexOf(b.dayIndex));
  }, []);

  // Filter renewals
  const filteredRenewals = useMemo(() => {
    let result = [...MOCK_RENEWALS];

    // Tab filter
    if (activeTab !== 'all') {
      result = result.filter(r => r.workflowStatus === activeTab);
    }

    // Search filter
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      result = result.filter(r =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(term) ||
        r.policyNumber.toLowerCase().includes(term)
      );
    }

    // Priority filter
    if (showPriorityOnly) {
      result = result.filter(r =>
        r.isPriority ||
        r.premiumChangePercent > 10 ||
        r.workflowStatus === 'uncontacted'
      );
    }

    // Hide Renewal Taken filter
    if (hideRenewalTaken) {
      result = result.filter(r => r.renewalStatus !== 'Renewal Taken');
    }

    // Chart date filter
    if (chartDateFilter) {
      result = result.filter(r => r.effectiveDate === chartDateFilter);
    }

    // Sort by effective date, then by premium change (highest increase first)
    result.sort((a, b) => {
      const dateCompare = a.effectiveDate.localeCompare(b.effectiveDate);
      if (dateCompare !== 0) return dateCompare;
      return b.premiumChangePercent - a.premiumChangePercent;
    });

    return result;
  }, [activeTab, searchQuery, showPriorityOnly, hideRenewalTaken, chartDateFilter]);

  const togglePriority = (id: string) => {
    console.log('Toggle priority for:', id);
  };

  const hasActiveChartFilter = chartDateFilter !== null || chartDayFilter !== null;

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

  // Custom tooltip for area chart - brutalist style
  const BrutalistAreaTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A1A2E] border-2 border-white px-4 py-2">
          <p className="text-white font-bold uppercase text-sm">{payload[0].payload.dateLabel}</p>
          <p className="text-[var(--brutalist-yellow)] font-bold">{payload[0].value} RENEWALS</p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for bar chart - brutalist style
  const BrutalistBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A1A2E] border-2 border-white px-4 py-2">
          <p className="text-white font-bold uppercase text-sm">{DAY_NAMES_FULL[payload[0].payload.dayIndex]}</p>
          <p className="text-[var(--brutalist-yellow)] font-bold">{payload[0].value} RENEWALS</p>
        </div>
      );
    }
    return null;
  };

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
                <RefreshCw className="w-7 h-7 text-[var(--brutalist-yellow)]" />
                RENEWALS
              </h1>
              <p className="text-white/50 text-sm uppercase tracking-wider mt-1">
                POLICY RENEWAL MANAGEMENT
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="border-2 border-white text-white px-4 py-2 font-bold uppercase text-sm tracking-wider flex items-center gap-2 hover:bg-white hover:text-[#0D0D0D] transition-colors">
              <Upload className="w-4 h-4" />
              UPLOAD REPORT
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 border-2 border-white">
            {/* Area Chart - Upcoming Renewals */}
            <div className="lg:col-span-3 bg-[#1A1A2E] border-r-2 border-white">
              <div className="p-4 border-b border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-[var(--brutalist-yellow)]" />
                  <span className="text-white font-bold uppercase tracking-wider">UPCOMING RENEWALS</span>
                </div>
                <span className="text-white/40 text-xs uppercase">LAST 7 DAYS</span>
              </div>
              <div className="p-4">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={MOCK_CHART_DATA}
                      margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                      onClick={(data) => {
                        if (data && data.activePayload) {
                          const clickedDate = data.activePayload[0].payload.date;
                          setChartDateFilter(chartDateFilter === clickedDate ? null : clickedDate);
                          setChartDayFilter(null);
                        }
                      }}
                    >
                      <defs>
                        <linearGradient id="brutalistGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--brutalist-yellow)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--brutalist-yellow)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis
                        dataKey="dateLabel"
                        stroke="rgba(255,255,255,0.5)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        fontFamily="Space Grotesk"
                      />
                      <YAxis
                        stroke="rgba(255,255,255,0.5)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        fontFamily="Space Grotesk"
                      />
                      <Tooltip content={<BrutalistAreaTooltip />} />
                      <ReferenceLine
                        y={averageCount}
                        stroke="#4CAF50"
                        strokeDasharray="5 5"
                        label={{
                          value: `AVG: ${averageCount.toFixed(1)}/DAY`,
                          position: 'right',
                          fill: '#4CAF50',
                          fontSize: 10,
                          fontFamily: 'Space Grotesk',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="var(--brutalist-yellow)"
                        strokeWidth={3}
                        fill="url(#brutalistGradient)"
                        dot={({ cx, cy, payload }) => {
                          const isActive = chartDateFilter === payload.date;
                          const isBelowAvg = payload.count < averageCount;
                          return (
                            <rect
                              key={payload.date}
                              x={cx - (isActive ? 8 : 6)}
                              y={cy - (isActive ? 8 : 6)}
                              width={isActive ? 16 : 12}
                              height={isActive ? 16 : 12}
                              fill={isActive ? '#FFFFFF' : isBelowAvg ? '#FF5252' : 'var(--brutalist-yellow)'}
                              stroke={isActive ? 'var(--brutalist-yellow)' : 'none'}
                              strokeWidth={2}
                              style={{ cursor: 'pointer' }}
                            />
                          );
                        }}
                        activeDot={{
                          r: 8,
                          stroke: 'var(--brutalist-yellow)',
                          strokeWidth: 2,
                          fill: '#1A1A2E',
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-white/40 text-xs mt-3 text-center uppercase tracking-wider">
                  CLICK A POINT TO FILTER • <span className="text-[#FF5252]">RED</span> = BELOW AVERAGE
                </p>
              </div>
            </div>

            {/* Bar Chart - By Day of Week */}
            <div className="lg:col-span-1 bg-[#1A1A2E]">
              <div className="p-4 border-b border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[var(--brutalist-yellow)]" />
                  <span className="text-white font-bold uppercase tracking-wider text-sm">BY DAY</span>
                </div>
                {hasActiveChartFilter && (
                  <button
                    onClick={() => {
                      setChartDateFilter(null);
                      setChartDayFilter(null);
                    }}
                    className="text-white/40 hover:text-white text-xs uppercase flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    RESET
                  </button>
                )}
              </div>
              <div className="p-4">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dayOfWeekData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                      onClick={(data) => {
                        if (data && data.activePayload) {
                          const clickedDayIndex = data.activePayload[0].payload.dayIndex;
                          setChartDayFilter(chartDayFilter === clickedDayIndex ? null : clickedDayIndex);
                          setChartDateFilter(null);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="rgba(255,255,255,0.5)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        fontFamily="Space Grotesk"
                      />
                      <YAxis
                        type="category"
                        dataKey="dayName"
                        stroke="rgba(255,255,255,0.5)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                        fontFamily="Space Grotesk"
                      />
                      <Tooltip content={<BrutalistBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                      <Bar dataKey="count" style={{ cursor: 'pointer' }}>
                        {dayOfWeekData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={chartDayFilter === entry.dayIndex ? '#FFFFFF' : 'var(--brutalist-yellow)'}
                            fillOpacity={chartDayFilter === null || chartDayFilter === entry.dayIndex ? 1 : 0.3}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-white/40 text-xs mt-3 uppercase tracking-wider">
                  CLICK BAR TO FILTER
                </p>
              </div>
            </div>
          </div>

          {/* Active Chart Filter Indicator */}
          {hasActiveChartFilter && (
            <div className="flex items-center gap-3 px-4 py-3 border-2 border-[var(--brutalist-yellow)] bg-[var(--brutalist-yellow)]/10">
              <span className="text-[var(--brutalist-yellow)] text-sm uppercase tracking-wider font-bold">
                FILTERED BY: {chartDateFilter || (chartDayFilter !== null ? DAY_NAMES_FULL[chartDayFilter] + 'S' : '')}
              </span>
              <button
                onClick={() => {
                  setChartDateFilter(null);
                  setChartDayFilter(null);
                }}
                className="text-[var(--brutalist-yellow)]/60 hover:text-[var(--brutalist-yellow)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Stats Summary */}
          <div className="grid grid-cols-5 gap-0 border-2 border-white">
            <StatCard
              value={MOCK_STATS.total}
              label="TOTAL"
              color="#FFFFFF"
              isActive={activeTab === 'all'}
              onClick={() => setActiveTab('all')}
              borderRight
            />
            <StatCard
              value={MOCK_STATS.uncontacted}
              label="UNCONTACTED"
              color="#FFFFFF"
              icon={<AlertTriangle className="w-4 h-4" />}
              isActive={activeTab === 'uncontacted'}
              onClick={() => setActiveTab('uncontacted')}
              borderRight
            />
            <StatCard
              value={MOCK_STATS.pending}
              label="PENDING"
              color="var(--brutalist-yellow)"
              icon={<Clock className="w-4 h-4" />}
              isActive={activeTab === 'pending'}
              onClick={() => setActiveTab('pending')}
              borderRight
            />
            <StatCard
              value={MOCK_STATS.success}
              label="SUCCESS"
              color="#4CAF50"
              icon={<CheckCircle2 className="w-4 h-4" />}
              isActive={activeTab === 'success'}
              onClick={() => setActiveTab('success')}
              borderRight
            />
            <StatCard
              value={MOCK_STATS.unsuccessful}
              label="UNSUCCESSFUL"
              color="#FF5252"
              icon={<XCircle className="w-4 h-4" />}
              isActive={activeTab === 'unsuccessful'}
              onClick={() => setActiveTab('unsuccessful')}
            />
          </div>

          {/* Premium Change Legend */}
          <div className="flex items-center gap-6 text-xs">
            <span className="text-white/50 uppercase tracking-wider">PREMIUM CHANGE:</span>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-[#FF5252]/30" />
              <span className="text-white/60">HIGH (&gt;15%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-[var(--brutalist-amber)]/20" />
              <span className="text-white/60">MODERATE (5-15%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-white/5" />
              <span className="text-white/60">MINIMAL (±5%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 bg-[#4CAF50]/30" />
              <span className="text-white/60">DECREASE (&lt;-5%)</span>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                placeholder="SEARCH BY NAME OR POLICY..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#1A1A2E] border-2 border-white/30 text-white pl-11 pr-4 py-3 text-sm uppercase tracking-wider placeholder:text-white/30 focus:border-white focus:outline-none"
              />
            </div>

            {/* Priority Filter */}
            <button
              onClick={() => setShowPriorityOnly(!showPriorityOnly)}
              className={cn(
                'border-2 px-4 py-3 font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors',
                showPriorityOnly
                  ? 'border-[var(--brutalist-yellow)] bg-[var(--brutalist-yellow)] text-[#0D0D0D]'
                  : 'border-white/30 text-white/60 hover:border-white hover:text-white'
              )}
            >
              <Star className={cn('w-4 h-4', showPriorityOnly && 'fill-current')} />
              PRIORITY ONLY
            </button>

            {/* Hide Renewal Taken */}
            <button
              onClick={() => setHideRenewalTaken(!hideRenewalTaken)}
              className={cn(
                'border-2 px-4 py-3 font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors',
                hideRenewalTaken
                  ? 'border-[#4CAF50] bg-[#4CAF50] text-white'
                  : 'border-white/30 text-white/60 hover:border-white hover:text-white'
              )}
            >
              <Eye className="w-4 h-4" />
              HIDE TAKEN
            </button>

            <button className="border-2 border-white/30 text-white/60 px-4 py-3 flex items-center gap-2 hover:border-white hover:text-white transition-colors">
              <Filter className="w-4 h-4" />
              <span className="text-sm uppercase tracking-wider">MORE FILTERS</span>
            </button>
          </div>

          {/* Active Filters Indicator */}
          {(showPriorityOnly || hideRenewalTaken) && (
            <div className="flex items-center gap-3">
              {showPriorityOnly && (
                <div className="flex items-center gap-2 px-3 py-1.5 border border-[var(--brutalist-yellow)]/50 bg-[var(--brutalist-yellow)]/10">
                  <Star className="w-3 h-3 text-[var(--brutalist-yellow)] fill-current" />
                  <span className="text-[var(--brutalist-yellow)] text-xs uppercase">PRIORITY ONLY</span>
                  <button
                    onClick={() => setShowPriorityOnly(false)}
                    className="ml-1 text-[var(--brutalist-yellow)]/60 hover:text-[var(--brutalist-yellow)]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {hideRenewalTaken && (
                <div className="flex items-center gap-2 px-3 py-1.5 border border-[#4CAF50]/50 bg-[#4CAF50]/10">
                  <Eye className="w-3 h-3 text-[#4CAF50]" />
                  <span className="text-[#4CAF50] text-xs uppercase">HIDING {MOCK_RENEWALS.filter(r => r.renewalStatus === 'Renewal Taken').length} TAKEN</span>
                  <button
                    onClick={() => setHideRenewalTaken(false)}
                    className="ml-1 text-[#4CAF50]/60 hover:text-[#4CAF50]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Results Count */}
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-xs uppercase tracking-widest font-bold">
              {filteredRenewals.length} RENEWAL{filteredRenewals.length !== 1 ? 'S' : ''}
            </span>
          </div>

          {/* Renewals Table */}
          <div className="border-2 border-white bg-[#1A1A2E]">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b-2 border-white/30 text-white/60 text-xs uppercase tracking-wider font-bold">
              <div className="col-span-1">DATE</div>
              <div className="col-span-2">CUSTOMER</div>
              <div className="col-span-1">POLICY</div>
              <div className="col-span-1">PRODUCT</div>
              <div className="col-span-1 text-right">PREMIUM</div>
              <div className="col-span-1 text-right">CHANGE</div>
              <div className="col-span-1">RENEWAL</div>
              <div className="col-span-1">STATUS</div>
              <div className="col-span-1">ASSIGNED</div>
              <div className="col-span-2 text-right">ACTIONS</div>
            </div>

            {/* Table Rows */}
            <div>
              {filteredRenewals.map(renewal => (
                <RenewalRow
                  key={renewal.id}
                  renewal={renewal}
                  isExpanded={expandedRow === renewal.id}
                  onToggleExpand={() => setExpandedRow(expandedRow === renewal.id ? null : renewal.id)}
                  onTogglePriority={() => togglePriority(renewal.id)}
                />
              ))}

              {filteredRenewals.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 border-2 border-white/20 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-white/20" />
                  </div>
                  <h3 className="text-white text-lg font-bold uppercase mb-2">No Renewals</h3>
                  <p className="text-white/50 text-sm">
                    {searchQuery ? 'No results match your search.' : 'No renewals in this category.'}
                  </p>
                </div>
              )}
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

function StatCard({
  value,
  label,
  color,
  icon,
  isActive,
  onClick,
  borderRight = false,
}: {
  value: number;
  label: string;
  color: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  borderRight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-4 bg-[#1A1A2E] transition-colors text-left',
        borderRight && 'border-r-2 border-white',
        isActive ? 'bg-white/10' : 'hover:bg-white/5'
      )}
      style={{ borderTop: isActive ? `4px solid ${color}` : '4px solid transparent' }}
    >
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
      </div>
      <div className="text-3xl font-black text-white leading-none">{value}</div>
      <div className="text-white/50 text-xs font-bold uppercase tracking-widest mt-1">{label}</div>
    </button>
  );
}

function RenewalRow({
  renewal,
  isExpanded,
  onToggleExpand,
  onTogglePriority,
}: {
  renewal: RenewalRecord;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTogglePriority: () => void;
}) {
  const statusConfig = STATUS_CONFIG[renewal.workflowStatus];
  const StatusIcon = statusConfig.icon;

  // Premium change color
  const changeColor =
    renewal.premiumChangePercent > 15 ? '#FF5252' :
    renewal.premiumChangePercent > 5 ? 'var(--brutalist-amber)' :
    renewal.premiumChangePercent < -5 ? '#4CAF50' :
    'white';

  const rowBgColor =
    renewal.premiumChangePercent > 15 ? 'bg-[#FF5252]/10' :
    renewal.premiumChangePercent > 5 ? 'bg-[var(--brutalist-amber)]/5' :
    renewal.premiumChangePercent < -5 ? 'bg-[#4CAF50]/10' :
    '';

  return (
    <div
      className={cn(
        'border-b border-white/10',
        rowBgColor,
        renewal.isPriority && 'ring-2 ring-inset ring-[var(--brutalist-yellow)]/50'
      )}
    >
      {/* Main Row */}
      <div
        className="grid grid-cols-12 gap-4 p-4 items-center cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="col-span-1 text-white/80 text-sm">{renewal.effectiveDate}</div>
        <div className="col-span-2">
          <div className="text-white font-bold uppercase text-sm">
            {renewal.firstName} {renewal.lastName}
          </div>
        </div>
        <div className="col-span-1 text-white/60 font-mono text-xs">{renewal.policyNumber}</div>
        <div className="col-span-1">
          <span className="text-white/80 text-sm uppercase">{renewal.productName}</span>
        </div>
        <div className="col-span-1 text-right text-white font-mono">
          ${renewal.premiumNew.toLocaleString()}
        </div>
        <div className="col-span-1 text-right">
          <span className="font-bold" style={{ color: changeColor }}>
            {renewal.premiumChangePercent > 0 ? '+' : ''}{renewal.premiumChangePercent.toFixed(1)}%
          </span>
        </div>
        <div className="col-span-1">
          {renewal.renewalStatus ? (
            <span
              className={cn(
                'px-2 py-1 text-xs font-bold uppercase',
                renewal.renewalStatus === 'Renewal Taken' && 'bg-[#4CAF50] text-white',
                renewal.renewalStatus === 'Renewal Not Taken' && 'bg-[#FF5252] text-white',
                renewal.renewalStatus === 'Pending' && 'bg-[var(--brutalist-yellow)] text-[#0D0D0D]'
              )}
            >
              {renewal.renewalStatus === 'Renewal Taken' ? 'TAKEN' :
               renewal.renewalStatus === 'Renewal Not Taken' ? 'NOT TAKEN' : 'PENDING'}
            </span>
          ) : (
            <span className="text-white/30 text-xs">-</span>
          )}
        </div>
        <div className="col-span-1">
          <div
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold uppercase"
            style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
          >
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </div>
        </div>
        <div className="col-span-1 text-white/60 text-sm">
          {renewal.assignedTo || <span className="text-white/30">-</span>}
        </div>
        <div className="col-span-2 flex items-center justify-end gap-1">
          <button
            onClick={e => { e.stopPropagation(); onToggleExpand(); }}
            className="w-8 h-8 border border-white/30 flex items-center justify-center text-white/60 hover:border-white hover:text-white transition-colors"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); }}
            className="w-8 h-8 border border-white/30 flex items-center justify-center text-white/60 hover:border-white hover:text-white transition-colors"
            title="Log phone call"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); }}
            className="w-8 h-8 border border-white/30 flex items-center justify-center text-white/60 hover:border-white hover:text-white transition-colors"
            title="Schedule appointment"
          >
            <Calendar className="w-4 h-4" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onTogglePriority(); }}
            className={cn(
              'w-8 h-8 border flex items-center justify-center transition-colors',
              renewal.isPriority
                ? 'border-[var(--brutalist-yellow)] text-[var(--brutalist-yellow)]'
                : 'border-white/30 text-white/60 hover:border-white hover:text-white'
            )}
            title={renewal.isPriority ? 'Remove priority' : 'Mark as priority'}
          >
            <Star className={cn('w-4 h-4', renewal.isPriority && 'fill-current')} />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 p-4 bg-white/5 grid grid-cols-4 gap-6">
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider mb-1">PREVIOUS PREMIUM</div>
                <div className="text-white font-bold">${renewal.premiumOld.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider mb-1">NEW PREMIUM</div>
                <div className="text-white font-bold">${renewal.premiumNew.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider mb-1">AMOUNT DUE</div>
                <div className="text-[var(--brutalist-yellow)] font-bold">${renewal.amountDue.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider mb-1">BUNDLED</div>
                <div className="text-white font-bold">{renewal.isBundled ? 'YES' : 'NO'}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
