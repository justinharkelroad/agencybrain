import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  Users,
  Award,
  Flame,
  BarChart3,
  Phone,
  FileText,
  DollarSign,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { BrutalistSidebar } from '@/components/brutalist';
import { useAgencyProfile } from '@/hooks/useAgencyProfile';

// ===========================================================================
// BRUTALIST SCORECARDS PAGE
// Performance rings with historical views and team leaderboards
// ===========================================================================

// Mock data for team members
const MOCK_TEAM = [
  {
    id: '1',
    name: 'SARAH JOHNSON',
    role: 'Sales',
    avatar: 'SJ',
    currentPeriod: { calls: 45, quotes: 12, premium: 28000, policies: 8, target: 35000 },
    history: [
      { week: 'W1', calls: 42, quotes: 10, premium: 24000, target: 35000 },
      { week: 'W2', calls: 38, quotes: 8, premium: 18000, target: 35000 },
      { week: 'W3', calls: 50, quotes: 15, premium: 42000, target: 35000 },
      { week: 'W4', calls: 45, quotes: 12, premium: 28000, target: 35000 },
    ],
    streak: 12,
    trend: 'up',
  },
  {
    id: '2',
    name: 'MIKE CHEN',
    role: 'Sales',
    avatar: 'MC',
    currentPeriod: { calls: 52, quotes: 14, premium: 38000, policies: 11, target: 35000 },
    history: [
      { week: 'W1', calls: 55, quotes: 16, premium: 45000, target: 35000 },
      { week: 'W2', calls: 48, quotes: 12, premium: 32000, target: 35000 },
      { week: 'W3', calls: 44, quotes: 10, premium: 28000, target: 35000 },
      { week: 'W4', calls: 52, quotes: 14, premium: 38000, target: 35000 },
    ],
    streak: 8,
    trend: 'up',
  },
  {
    id: '3',
    name: 'EMILY DAVIS',
    role: 'Hybrid',
    avatar: 'ED',
    currentPeriod: { calls: 38, quotes: 9, premium: 22000, policies: 6, target: 30000 },
    history: [
      { week: 'W1', calls: 35, quotes: 8, premium: 20000, target: 30000 },
      { week: 'W2', calls: 40, quotes: 11, premium: 28000, target: 30000 },
      { week: 'W3', calls: 32, quotes: 7, premium: 18000, target: 30000 },
      { week: 'W4', calls: 38, quotes: 9, premium: 22000, target: 30000 },
    ],
    streak: 3,
    trend: 'down',
  },
  {
    id: '4',
    name: 'JAMES WILSON',
    role: 'Service',
    avatar: 'JW',
    currentPeriod: { calls: 65, quotes: 4, premium: 12000, policies: 3, target: 15000 },
    history: [
      { week: 'W1', calls: 70, quotes: 5, premium: 15000, target: 15000 },
      { week: 'W2', calls: 62, quotes: 3, premium: 9000, target: 15000 },
      { week: 'W3', calls: 58, quotes: 4, premium: 11000, target: 15000 },
      { week: 'W4', calls: 65, quotes: 4, premium: 12000, target: 15000 },
    ],
    streak: 0,
    trend: 'stable',
  },
  {
    id: '5',
    name: 'LISA MARTINEZ',
    role: 'Sales',
    avatar: 'LM',
    currentPeriod: { calls: 48, quotes: 18, premium: 52000, policies: 14, target: 45000 },
    history: [
      { week: 'W1', calls: 45, quotes: 15, premium: 48000, target: 45000 },
      { week: 'W2', calls: 50, quotes: 20, premium: 58000, target: 45000 },
      { week: 'W3', calls: 52, quotes: 19, premium: 55000, target: 45000 },
      { week: 'W4', calls: 48, quotes: 18, premium: 52000, target: 45000 },
    ],
    streak: 24,
    trend: 'up',
  },
];

const MOCK_PERIODS = ['WEEK 1', 'WEEK 2', 'WEEK 3', 'WEEK 4'];

type ViewMode = 'grid' | 'detail';
type MetricType = 'premium' | 'calls' | 'quotes' | 'policies';

export default function BrutalistScorecardsPage() {
  const { user } = useAuth();
  const [isLightMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedMember, setSelectedMember] = useState<typeof MOCK_TEAM[0] | null>(null);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(3); // Current week
  const [primaryMetric, setPrimaryMetric] = useState<MetricType>('premium');

  const { data: agencyProfile, isLoading: agencyLoading } = useAgencyProfile(user?.id, 'Manager');

  // Sort team by selected metric
  const sortedTeam = useMemo(() => {
    return [...MOCK_TEAM].sort((a, b) => {
      const aVal = a.currentPeriod[primaryMetric];
      const bVal = b.currentPeriod[primaryMetric];
      return (bVal as number) - (aVal as number);
    });
  }, [primaryMetric]);

  const handleMemberClick = (member: typeof MOCK_TEAM[0]) => {
    setSelectedMember(member);
    setViewMode('detail');
  };

  const handleBackToGrid = () => {
    setSelectedMember(null);
    setViewMode('grid');
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
            {viewMode === 'detail' && (
              <button
                onClick={handleBackToGrid}
                className="border-2 border-white/30 p-2 text-white/60 hover:border-white hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white uppercase tracking-wide flex items-center gap-3">
                <Target className="w-7 h-7 text-[var(--brutalist-yellow)]" />
                {viewMode === 'detail' && selectedMember ? selectedMember.name : 'SCORECARDS'}
              </h1>
              <p className="text-white/50 text-sm uppercase tracking-wider mt-1">
                {viewMode === 'detail' ? 'PERFORMANCE HISTORY' : 'TEAM PERFORMANCE OVERVIEW'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Metric Selector */}
            <select
              value={primaryMetric}
              onChange={e => setPrimaryMetric(e.target.value as MetricType)}
              className="bg-[#1A1A2E] border-2 border-white px-4 py-2 text-white text-sm uppercase font-bold tracking-wider cursor-pointer"
            >
              <option value="premium">PREMIUM</option>
              <option value="calls">CALLS</option>
              <option value="quotes">QUOTES</option>
              <option value="policies">POLICIES</option>
            </select>
            {/* Period Navigator */}
            <div className="flex items-center border-2 border-white">
              <button
                onClick={() => setSelectedPeriodIndex(Math.max(0, selectedPeriodIndex - 1))}
                disabled={selectedPeriodIndex === 0}
                className="p-2 text-white/60 hover:text-white disabled:text-white/20 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-4 py-2 text-white font-bold uppercase tracking-wider min-w-[100px] text-center">
                {MOCK_PERIODS[selectedPeriodIndex]}
              </span>
              <button
                onClick={() => setSelectedPeriodIndex(Math.min(MOCK_PERIODS.length - 1, selectedPeriodIndex + 1))}
                disabled={selectedPeriodIndex === MOCK_PERIODS.length - 1}
                className="p-2 text-white/60 hover:text-white disabled:text-white/20 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {viewMode === 'grid' ? (
            <>
              {/* Team Summary Stats */}
              <div className="grid grid-cols-4 gap-0 border-2 border-white">
                <SummaryCard
                  value={sortedTeam.reduce((sum, m) => sum + m.currentPeriod.premium, 0)}
                  label="TOTAL PREMIUM"
                  format="currency"
                  color="var(--brutalist-yellow)"
                  borderRight
                />
                <SummaryCard
                  value={sortedTeam.reduce((sum, m) => sum + m.currentPeriod.calls, 0)}
                  label="TOTAL CALLS"
                  color="#FFFFFF"
                  borderRight
                />
                <SummaryCard
                  value={sortedTeam.reduce((sum, m) => sum + m.currentPeriod.quotes, 0)}
                  label="TOTAL QUOTES"
                  color="var(--brutalist-cyan)"
                  borderRight
                />
                <SummaryCard
                  value={sortedTeam.reduce((sum, m) => sum + m.currentPeriod.policies, 0)}
                  label="TOTAL POLICIES"
                  color="#4CAF50"
                />
              </div>

              {/* Team Rings Grid */}
              <div className="border-2 border-white bg-[#1A1A2E]">
                <div className="p-4 border-b border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-[var(--brutalist-yellow)]" />
                    <span className="text-white font-bold uppercase tracking-wider">TEAM PERFORMANCE</span>
                  </div>
                  <span className="text-white/40 text-xs">{MOCK_TEAM.length} TEAM MEMBERS</span>
                </div>

                <div className="p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                  {sortedTeam.map((member, index) => (
                    <MemberRingCard
                      key={member.id}
                      member={member}
                      rank={index + 1}
                      metric={primaryMetric}
                      periodIndex={selectedPeriodIndex}
                      onClick={() => handleMemberClick(member)}
                    />
                  ))}
                </div>
              </div>

              {/* Leaderboard */}
              <div className="grid grid-cols-2 gap-6">
                {/* Top Performers */}
                <div className="border-2 border-[#4CAF50] bg-[#1A1A2E]">
                  <div className="p-4 border-b border-[#4CAF50]/30 flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#4CAF50]" />
                    <span className="text-[#4CAF50] font-bold uppercase tracking-wider">TOP PERFORMERS</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {sortedTeam.slice(0, 3).map((member, idx) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 border border-[#4CAF50]/30 cursor-pointer hover:bg-[#4CAF50]/10 transition-colors"
                        onClick={() => handleMemberClick(member)}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'w-8 h-8 flex items-center justify-center font-bold',
                              idx === 0 ? 'bg-[var(--brutalist-yellow)] text-[#0D0D0D]' :
                              idx === 1 ? 'bg-white/20 text-white' :
                              'bg-[var(--brutalist-amber)] text-white'
                            )}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-white font-bold uppercase text-sm">{member.name}</span>
                            {member.streak > 0 && (
                              <div className="flex items-center gap-1 text-orange-500">
                                <Flame className="w-3 h-3" />
                                <span className="text-xs font-bold">{member.streak} DAY STREAK</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[#4CAF50] font-bold">
                            {primaryMetric === 'premium'
                              ? `$${member.currentPeriod.premium.toLocaleString()}`
                              : member.currentPeriod[primaryMetric]
                            }
                          </div>
                          <div className="text-white/40 text-xs uppercase">
                            {Math.round((member.currentPeriod.premium / member.currentPeriod.target) * 100)}% TO TARGET
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Streak Leaders */}
                <div className="border-2 border-[var(--brutalist-amber)] bg-[#1A1A2E]">
                  <div className="p-4 border-b border-[var(--brutalist-amber)]/30 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-[var(--brutalist-amber)]" />
                    <span className="text-[var(--brutalist-amber)] font-bold uppercase tracking-wider">STREAK LEADERS</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {[...sortedTeam]
                      .sort((a, b) => b.streak - a.streak)
                      .filter(m => m.streak > 0)
                      .slice(0, 3)
                      .map((member, idx) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 border border-[var(--brutalist-amber)]/30 cursor-pointer hover:bg-[var(--brutalist-amber)]/10 transition-colors"
                          onClick={() => handleMemberClick(member)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 border-2 border-[var(--brutalist-amber)] flex items-center justify-center">
                              <span className="text-white font-bold text-sm">{member.avatar}</span>
                            </div>
                            <span className="text-white font-bold uppercase text-sm">{member.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Flame className="w-5 h-5 text-[var(--brutalist-amber)]" />
                            <span className="text-[var(--brutalist-amber)] font-bold text-xl">{member.streak}</span>
                            <span className="text-white/40 text-xs">DAYS</span>
                          </div>
                        </div>
                      ))}
                    {sortedTeam.every(m => m.streak === 0) && (
                      <div className="text-center py-4 text-white/40">NO ACTIVE STREAKS</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : selectedMember ? (
            <>
              {/* Detail View - Historical Rings */}
              <div className="border-2 border-white bg-[#1A1A2E]">
                <div className="p-4 border-b border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-[var(--brutalist-yellow)]" />
                    <span className="text-white font-bold uppercase tracking-wider">HISTORICAL PERFORMANCE</span>
                  </div>
                  {selectedMember.streak > 0 && (
                    <div className="flex items-center gap-2 border border-[var(--brutalist-amber)] px-3 py-1">
                      <Flame className="w-4 h-4 text-[var(--brutalist-amber)]" />
                      <span className="text-[var(--brutalist-amber)] font-bold">{selectedMember.streak} DAY STREAK</span>
                    </div>
                  )}
                </div>

                {/* Historical Rings Row */}
                <div className="p-6">
                  <div className="flex justify-center gap-8">
                    {selectedMember.history.map((period, idx) => (
                      <HistoricalRing
                        key={idx}
                        label={period.week}
                        value={period.premium}
                        target={period.target}
                        isSelected={idx === selectedPeriodIndex}
                        onClick={() => setSelectedPeriodIndex(idx)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Period Detail */}
              <div className="grid grid-cols-4 gap-0 border-2 border-white">
                <DetailMetricCard
                  value={selectedMember.history[selectedPeriodIndex].calls}
                  label="CALLS"
                  icon={<Phone className="w-5 h-5" />}
                  color="#FFFFFF"
                  borderRight
                />
                <DetailMetricCard
                  value={selectedMember.history[selectedPeriodIndex].quotes}
                  label="QUOTES"
                  icon={<FileText className="w-5 h-5" />}
                  color="var(--brutalist-cyan)"
                  borderRight
                />
                <DetailMetricCard
                  value={`$${selectedMember.history[selectedPeriodIndex].premium.toLocaleString()}`}
                  label="PREMIUM"
                  icon={<DollarSign className="w-5 h-5" />}
                  color="var(--brutalist-yellow)"
                  borderRight
                />
                <DetailMetricCard
                  value={`${Math.round((selectedMember.history[selectedPeriodIndex].premium / selectedMember.history[selectedPeriodIndex].target) * 100)}%`}
                  label="TO TARGET"
                  icon={<Target className="w-5 h-5" />}
                  color={
                    selectedMember.history[selectedPeriodIndex].premium >= selectedMember.history[selectedPeriodIndex].target
                      ? '#4CAF50'
                      : '#FF5252'
                  }
                />
              </div>

              {/* Trend Chart */}
              <div className="border-2 border-white bg-[#1A1A2E]">
                <div className="p-4 border-b border-white/20 flex items-center gap-2">
                  <div className="w-1 h-6 bg-[var(--brutalist-cyan)]" />
                  <span className="text-white font-bold uppercase tracking-wider">PERFORMANCE TREND</span>
                </div>
                <div className="p-6">
                  <TrendChart data={selectedMember.history} metric={primaryMetric} />
                </div>
              </div>

              {/* Member Stats */}
              <div className="grid grid-cols-3 gap-6">
                <div className="border-2 border-white bg-[#1A1A2E] p-6">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-2">AVG WEEKLY PREMIUM</div>
                  <div className="text-3xl font-bold text-[var(--brutalist-yellow)]">
                    ${Math.round(selectedMember.history.reduce((sum, p) => sum + p.premium, 0) / selectedMember.history.length).toLocaleString()}
                  </div>
                </div>
                <div className="border-2 border-white bg-[#1A1A2E] p-6">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-2">WEEKS AT TARGET</div>
                  <div className="text-3xl font-bold text-[#4CAF50]">
                    {selectedMember.history.filter(p => p.premium >= p.target).length} / {selectedMember.history.length}
                  </div>
                </div>
                <div className="border-2 border-white bg-[#1A1A2E] p-6">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-2">BEST WEEK</div>
                  <div className="text-3xl font-bold text-white">
                    ${Math.max(...selectedMember.history.map(p => p.premium)).toLocaleString()}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

// ===========================================================================
// SUPPORTING COMPONENTS
// ===========================================================================

function SummaryCard({
  value,
  label,
  format,
  color,
  borderRight = false,
}: {
  value: number;
  label: string;
  format?: 'currency';
  color: string;
  borderRight?: boolean;
}) {
  return (
    <div
      className={cn('p-6 bg-[#1A1A2E]', borderRight && 'border-r-2 border-white')}
      style={{ borderTop: `4px solid ${color}` }}
    >
      <div className="text-4xl lg:text-5xl font-black text-white leading-none">
        {format === 'currency' ? `$${value.toLocaleString()}` : value.toLocaleString()}
      </div>
      <div className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2">{label}</div>
    </div>
  );
}

function MemberRingCard({
  member,
  rank,
  metric,
  periodIndex,
  onClick,
}: {
  member: typeof MOCK_TEAM[0];
  rank: number;
  metric: MetricType;
  periodIndex: number;
  onClick: () => void;
}) {
  const periodData = member.history[periodIndex];
  const percentage = Math.min((periodData.premium / periodData.target) * 100, 100);
  const isAtTarget = periodData.premium >= periodData.target;

  return (
    <button
      onClick={onClick}
      className="border-2 border-white/30 bg-[#1A1A2E] p-4 hover:border-white transition-colors group"
    >
      {/* Rank Badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={cn(
            'w-6 h-6 flex items-center justify-center text-xs font-bold',
            rank === 1 ? 'bg-[var(--brutalist-yellow)] text-[#0D0D0D]' :
            rank === 2 ? 'bg-white/20 text-white' :
            rank === 3 ? 'bg-[var(--brutalist-amber)] text-white' :
            'bg-white/10 text-white/50'
          )}
        >
          {rank}
        </span>
        {member.streak > 0 && (
          <div className="flex items-center gap-1 text-orange-500">
            <Flame className="w-3 h-3" />
            <span className="text-xs font-bold">{member.streak}</span>
          </div>
        )}
      </div>

      {/* Progress Ring */}
      <div className="relative flex justify-center mb-3">
        <ProgressRing percentage={percentage} size={100} isAtTarget={isAtTarget} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{Math.round(percentage)}%</span>
        </div>
      </div>

      {/* Name */}
      <div className="text-center">
        <div className="text-white font-bold uppercase text-xs tracking-wider truncate">
          {member.name}
        </div>
        <div className="text-white/40 text-xs mt-1">
          ${periodData.premium.toLocaleString()}
        </div>
      </div>
    </button>
  );
}

function ProgressRing({
  percentage,
  size = 100,
  isAtTarget = false,
}: {
  percentage: number;
  size?: number;
  isAtTarget?: boolean;
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const color = isAtTarget ? '#4CAF50' : 'var(--brutalist-yellow)';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="square"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000"
      />
    </svg>
  );
}

function HistoricalRing({
  label,
  value,
  target,
  isSelected,
  onClick,
}: {
  label: string;
  value: number;
  target: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const percentage = Math.min((value / target) * 100, 100);
  const isAtTarget = value >= target;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 p-4 transition-all',
        isSelected ? 'border-2 border-[var(--brutalist-yellow)] bg-[var(--brutalist-yellow)]/10' : 'border-2 border-transparent hover:border-white/30'
      )}
    >
      <div className="relative">
        <ProgressRing percentage={percentage} size={80} isAtTarget={isAtTarget} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-lg font-bold', isAtTarget ? 'text-[#4CAF50]' : 'text-white')}>
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className={cn('text-sm font-bold uppercase', isSelected ? 'text-[var(--brutalist-yellow)]' : 'text-white')}>
          {label}
        </div>
        <div className="text-white/40 text-xs">${value.toLocaleString()}</div>
      </div>
    </button>
  );
}

function DetailMetricCard({
  value,
  label,
  icon,
  color,
  borderRight = false,
}: {
  value: string | number;
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
      <div className="text-4xl font-black text-white leading-none">{value}</div>
      <div className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2">{label}</div>
    </div>
  );
}

function TrendChart({
  data,
  metric,
}: {
  data: Array<{ week: string; calls: number; quotes: number; premium: number; target: number }>;
  metric: MetricType;
}) {
  const values = data.map(d => (metric === 'premium' ? d.premium : d[metric] || 0));
  const maxValue = Math.max(...values, ...data.map(d => d.target));
  const barHeight = 120;

  return (
    <div className="flex items-end justify-around gap-4 h-40">
      {data.map((period, idx) => {
        const value = metric === 'premium' ? period.premium : period[metric] || 0;
        const height = (value / maxValue) * barHeight;
        const targetHeight = (period.target / maxValue) * barHeight;
        const isAtTarget = period.premium >= period.target;

        return (
          <div key={idx} className="flex flex-col items-center gap-2">
            <div className="relative h-32 w-16 flex items-end">
              {/* Target Line */}
              {metric === 'premium' && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-dashed border-white/30"
                  style={{ bottom: targetHeight }}
                />
              )}
              {/* Bar */}
              <div
                className="w-full transition-all duration-500"
                style={{
                  height,
                  backgroundColor: isAtTarget ? '#4CAF50' : 'var(--brutalist-yellow)',
                }}
              />
            </div>
            <div className="text-white/50 text-xs uppercase">{period.week}</div>
            <div className="text-white font-bold text-sm">
              {metric === 'premium' ? `$${value.toLocaleString()}` : value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
