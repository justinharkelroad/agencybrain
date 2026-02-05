import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Upload,
  Trophy,
  HelpCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Package,
  FileText,
  Home,
  Dumbbell,
  Heart,
  Briefcase,
  Flame,
  Zap,
  RefreshCw,
  CheckCircle2,
  Users,
  Scale,
  Bot,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  getBusinessDaysRemaining
} from '@/utils/businessDays';
import { useSalesLeaderboard } from '@/hooks/useSalesLeaderboard';
import { useCore4Stats, Core4Domain } from '@/hooks/useCore4Stats';
import { useFlowStats } from '@/hooks/useFlowStats';
import { useTeamCore4Stats } from '@/hooks/useTeamCore4Stats';
import { useRenewalStats } from '@/hooks/useRenewalRecords';

interface BrutalistDashboardProps {
  agencyId: string | null;
  agencyName: string | null;
  isLightMode?: boolean;
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  accentColor = 'yellow',
  rightContent,
  isLightMode = false,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  accentColor?: 'yellow' | 'amber' | 'cyan' | 'green';
  rightContent?: React.ReactNode;
  isLightMode?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const accentClasses = {
    yellow: 'bg-[var(--brutalist-yellow)]',
    amber: 'bg-[var(--brutalist-amber)]',
    cyan: 'bg-[var(--brutalist-cyan)]',
    green: 'bg-[var(--brutalist-green)]',
  };

  const borderColor = isLightMode ? 'border-[var(--brutalist-border-solid)]/20' : 'border-white/20';
  const hoverBg = isLightMode ? 'hover:bg-[var(--brutalist-border-solid)]/5' : 'hover:bg-white/5';
  const textColor = isLightMode ? 'text-[var(--brutalist-text)]' : 'text-white';
  const textMuted = isLightMode ? 'text-[var(--brutalist-text-muted)]' : 'text-white/60';
  const borderInner = isLightMode ? 'border-[var(--brutalist-border-solid)]/10' : 'border-white/10';

  return (
    <div className={cn('border-2 bg-[#1A1A2E]', borderColor)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn('w-full flex items-center justify-between p-4 transition-colors', hoverBg)}
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-1 h-6', accentClasses[accentColor])} />
          <span className={cn('font-bold uppercase tracking-wider text-sm', textColor)}>
            {title}
          </span>
          {rightContent && <div className="ml-2">{rightContent}</div>}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className={cn('w-5 h-5', textMuted)} />
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
            <div className={cn('p-4 pt-0 border-t', borderInner)}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Progress Ring Component
function ProgressRing({
  percentage,
  current,
  target,
  size = 180,
  isLightMode = false,
}: {
  percentage: number;
  current: number;
  target: number;
  size?: number;
  isLightMode?: boolean;
}) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  const trackStroke = isLightMode ? 'rgba(26,26,46,0.1)' : 'rgba(255,255,255,0.1)';
  const textColor = isLightMode ? 'text-[var(--brutalist-text)]' : 'text-white';
  const textMuted = isLightMode ? 'text-[var(--brutalist-text-muted)]' : 'text-white/50';

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackStroke}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--brutalist-yellow)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="square"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-4xl font-bold', textColor)}>{Math.round(percentage)}%</span>
        <div className="text-center mt-1">
          <div className={cn('text-sm font-bold', textColor)}>
            ${current.toLocaleString()}
          </div>
          <div className={cn('text-xs', textMuted)}>
            OF ${target.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

// Hero Metric Block Component
function HeroMetric({
  value,
  label,
  comparison,
  changePercent,
  icon: Icon,
  isLightMode = false,
}: {
  value: string | number;
  label: string;
  comparison?: string | number;
  changePercent?: number;
  icon: React.ElementType;
  isLightMode?: boolean;
}) {
  const displayChange = changePercent !== undefined && changePercent !== 0;
  const isDown = changePercent !== undefined && changePercent < 0;

  const borderColor = isLightMode ? 'border-[var(--brutalist-border-solid)]/20' : 'border-white/20';
  const borderMuted = isLightMode ? 'border-[var(--brutalist-border-solid)]/30' : 'border-white/30';
  const textMuted = isLightMode ? 'text-[var(--brutalist-text-muted)]' : 'text-white/60';
  const textDim = isLightMode ? 'text-[var(--brutalist-text-muted)]/70' : 'text-white/40';

  return (
    <div className={cn('border-2 bg-[#1A1A2E] p-4 flex-1 min-w-[140px]', borderColor)}>
      <div className="flex items-start justify-between mb-2">
        <div className={cn('w-10 h-10 border flex items-center justify-center', borderMuted)}>
          <Icon className={cn('w-5 h-5', textMuted)} />
        </div>
        {displayChange && (
          <div className={cn(
            'px-2 py-0.5 text-xs font-bold flex items-center gap-1',
            isDown ? 'bg-[var(--brutalist-red)] text-white' : 'bg-[var(--brutalist-green)] text-white'
          )}>
            {isDown ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
            {Math.abs(changePercent).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-4xl lg:text-5xl font-bold mb-1 text-[var(--brutalist-yellow)]">
        {value}
      </div>
      {comparison !== undefined && (
        <div className={cn('text-sm line-through mb-1', textDim)}>
          ~{comparison}
        </div>
      )}
      <div className={cn('text-xs uppercase tracking-wider font-medium', textMuted)}>
        {label}
      </div>
    </div>
  );
}

// Core 4 Domain Button
const DOMAIN_CONFIG: { key: Core4Domain; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'body', label: 'BODY', icon: Dumbbell, color: 'bg-emerald-500' },
  { key: 'being', label: 'BEING', icon: Heart, color: 'bg-purple-500' },
  { key: 'balance', label: 'BALANCE', icon: Scale, color: 'bg-blue-500' },
  { key: 'business', label: 'BUSINESS', icon: Briefcase, color: 'bg-amber-500' },
];

function Core4DomainButton({
  domain,
  completed,
  onToggle,
  isLightMode = false,
}: {
  domain: typeof DOMAIN_CONFIG[number];
  completed: boolean;
  onToggle: () => void;
  isLightMode?: boolean;
}) {
  const Icon = domain.icon;

  const borderColor = isLightMode ? 'border-[var(--brutalist-border-solid)]' : 'border-white';
  const borderMuted = isLightMode ? 'border-[var(--brutalist-border-solid)]/30' : 'border-white/30';
  const borderHover = isLightMode ? 'hover:border-[var(--brutalist-border-solid)]/60' : 'hover:border-white/60';
  const textMuted = isLightMode ? 'text-[var(--brutalist-text-muted)]' : 'text-white/60';

  return (
    <button
      onClick={onToggle}
      className={cn(
        'p-3 border-2 transition-all flex flex-col items-center gap-2',
        completed
          ? `${domain.color} ${borderColor} text-white`
          : `${borderMuted} bg-transparent ${textMuted} ${borderHover}`
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs font-bold uppercase">{domain.label}</span>
    </button>
  );
}

export function BrutalistDashboard({ agencyId, agencyName, isLightMode = false }: BrutalistDashboardProps) {
  const { isAgencyOwner, isKeyEmployee } = useAuth();
  const today = new Date();
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
  const monthLabel = format(today, 'MMMM yyyy').toUpperCase();
  const bizDaysRemaining = getBusinessDaysRemaining(today);

  const [businessFilter, setBusinessFilter] = useState<'all' | 'regular' | 'brokered'>('all');

  // Theme-aware color classes
  const textColor = isLightMode ? 'text-[var(--brutalist-text)]' : 'text-white';
  const textMuted = isLightMode ? 'text-[var(--brutalist-text-muted)]' : 'text-white/60';
  const textDim = isLightMode ? 'text-[var(--brutalist-text-muted)]/70' : 'text-white/40';
  const borderColor = isLightMode ? 'border-[var(--brutalist-border-solid)]' : 'border-white';
  const borderMuted = isLightMode ? 'border-[var(--brutalist-border-solid)]/20' : 'border-white/20';
  const borderInner = isLightMode ? 'border-[var(--brutalist-border-solid)]/10' : 'border-white/10';
  const hoverBg = isLightMode ? 'hover:bg-[var(--brutalist-border-solid)]/5' : 'hover:bg-white/5';
  const hoverTextInverse = isLightMode ? 'hover:text-[var(--brutalist-surface)]' : 'hover:text-[var(--brutalist-bg)]';
  const hoverBgInverse = isLightMode ? 'hover:bg-[var(--brutalist-border-solid)]' : 'hover:bg-white';

  // Core 4 + Flow hooks
  const {
    todayEntry,
    todayPoints,
    weeklyPoints,
    currentStreak,
    loading: core4Loading,
    toggleDomain
  } = useCore4Stats();

  const flowStats = useFlowStats();
  const combinedWeeklyPoints = weeklyPoints + flowStats.weeklyProgress;

  // Team Core 4 (for owners/key employees)
  const { members: teamMembers, teamTotal, teamGoal, loading: teamLoading } = useTeamCore4Stats();

  // Renewals data (next 7 days)
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const { data: renewalStats } = useRenewalStats(agencyId, {
    start: today.toISOString().slice(0, 10),
    end: nextWeek.toISOString().slice(0, 10),
  });

  // Fetch sales data for current month
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['brutalist-dashboard-sales', agencyId, monthStart, monthEnd, businessFilter],
    queryFn: async () => {
      if (!agencyId) return null;

      let query = supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          customer_name,
          total_premium,
          total_items,
          total_points,
          sale_policies(id)
        `)
        .eq('agency_id', agencyId)
        .gte('sale_date', monthStart)
        .lte('sale_date', monthEnd);

      if (businessFilter === 'regular') {
        query = query.is('brokered_carrier_id', null);
      } else if (businessFilter === 'brokered') {
        query = query.not('brokered_carrier_id', 'is', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalPremium = data?.reduce((sum, s) => sum + (s.total_premium || 0), 0) || 0;
      const totalItems = data?.reduce((sum, s) => sum + (s.total_items || 0), 0) || 0;
      const totalPoints = data?.reduce((sum, s) => sum + (s.total_points || 0), 0) || 0;
      const totalPolicies = data?.reduce((sum, s) => sum + (s.sale_policies?.length || 0), 0) || 0;

      const uniqueCustomers = new Set(data?.map(s => s.customer_name?.toLowerCase().trim()).filter(Boolean));
      const totalHouseholds = uniqueCustomers.size;

      return {
        totalPremium,
        totalItems,
        totalPoints,
        totalPolicies,
        totalHouseholds,
        salesCount: data?.length || 0,
      };
    },
    enabled: !!agencyId,
  });

  // Fetch agency goal
  const { data: goalData } = useQuery({
    queryKey: ['brutalist-dashboard-goal', agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      const { data } = await supabase
        .from('agency_goals')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!agencyId,
  });

  // Fetch leaderboard
  const { data: leaderboardData } = useSalesLeaderboard(agencyId || '');

  // Fetch roleplay sessions
  const { data: roleplaySessions } = useQuery({
    queryKey: ['brutalist-roleplay-sessions', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from('roleplay_sessions')
        .select('id, staff_name, completed_at, overall_score')
        .eq('agency_id', agencyId)
        .order('completed_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId,
  });

  // Fetch performance metrics (latest periods)
  const { data: periodsData } = useQuery({
    queryKey: ['brutalist-periods', agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      // Get the user's agency profile to find their periods
      const { data: periods, error } = await supabase
        .from('periods')
        .select('id, title, start_date, end_date, form_data')
        .not('form_data', 'is', null)
        .order('end_date', { ascending: false })
        .limit(2);
      if (error) throw error;
      return periods || [];
    },
    enabled: !!agencyId,
  });

  // Extract period metrics
  const currentPeriod = periodsData?.[0];
  const previousPeriod = periodsData?.[1];
  const periodMetrics = currentPeriod?.form_data ? {
    premium: currentPeriod.form_data.sales?.premium,
    policies: currentPeriod.form_data.sales?.policies,
    quoted: currentPeriod.form_data.marketing?.policiesQuoted,
    marketingSpend: currentPeriod.form_data.marketing?.totalSpend,
    compensation: currentPeriod.form_data.cashFlow?.compensation,
    expenses: currentPeriod.form_data.cashFlow?.expenses,
  } : null;

  const prevPeriodMetrics = previousPeriod?.form_data ? {
    premium: previousPeriod.form_data.sales?.premium,
    policies: previousPeriod.form_data.sales?.policies,
  } : null;

  // Calculate metrics
  const premium = salesData?.totalPremium || 0;
  const points = salesData?.totalPoints || 0;
  const households = salesData?.totalHouseholds || 0;
  const items = salesData?.totalItems || 0;
  const policies = salesData?.totalPolicies || 0;

  const target = goalData?.target_premium || 200000;
  const percentage = target > 0 ? (premium / target) * 100 : 0;

  const remaining = target - premium;
  const dailyPaceNeeded = bizDaysRemaining > 0 ? remaining / bizDaysRemaining : 0;
  const isBehind = remaining > 0;

  // Comparison values (mock for now - would come from previous month)
  const compPremium = 23300;
  const compPoints = 533;
  const compHouseholds = 20;
  const compItems = 33;

  const isDomainCompleted = (domain: Core4Domain): boolean => {
    if (!todayEntry) return false;
    return todayEntry[`${domain}_completed`] as boolean;
  };

  if (isLoading) {
    return (
      <div className="brutalist-app-bg min-h-screen p-6 font-brutalist flex items-center justify-center">
        <div className={cn('text-xl animate-pulse', textColor)}>LOADING...</div>
      </div>
    );
  }

  return (
    <div className="brutalist-app-bg min-h-full p-4 lg:p-6 font-brutalist space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: AGENCY SALES PERFORMANCE (Hero - Always Visible)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className={cn('border-2 bg-[#1A1A2E]', borderColor)}>
        <div className={cn('flex flex-col lg:flex-row lg:items-center lg:justify-between p-4 border-b', borderMuted)}>
          <div>
            <h1 className={cn('text-xl lg:text-2xl font-bold uppercase tracking-wide', textColor)}>
              Agency Sales Performance
            </h1>
            <p className={cn('text-sm uppercase tracking-wider mt-1', textDim)}>
              {monthLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-4 lg:mt-0">
            <select
              value={businessFilter}
              onChange={(e) => setBusinessFilter(e.target.value as 'all' | 'regular' | 'brokered')}
              className={cn('bg-[#1A1A2E] border-2 px-3 py-1.5 text-sm uppercase font-bold cursor-pointer', borderColor, textColor)}
            >
              <option value="all">ALL BUSINESS</option>
              <option value="regular">REGULAR</option>
              <option value="brokered">BROKERED</option>
            </select>
            <button className={cn('border-2 px-3 py-1.5 text-sm uppercase font-bold transition-colors flex items-center gap-2', borderColor, textColor, hoverBgInverse, hoverTextInverse)}>
              <Upload className="w-4 h-4" />
              UPLOAD
            </button>
            <button className={cn('border-2 px-3 py-1.5 text-sm uppercase font-bold transition-colors flex items-center gap-2', borderColor, textColor, hoverBgInverse, hoverTextInverse)}>
              <Trophy className="w-4 h-4" />
              BOARD
            </button>
            <button className={cn('border-2 w-9 h-9 flex items-center justify-center transition-colors', borderColor, textColor, hoverBgInverse, hoverTextInverse)}>
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="flex flex-wrap gap-4">
            <HeroMetric
              value={`$${Math.round(premium / 1000)}K`}
              label="PREMIUM"
              comparison={`$${(compPremium / 1000).toFixed(1)}K`}
              changePercent={compPremium > 0 ? ((premium - compPremium) / compPremium) * 100 : 0}
              icon={DollarSign}
              isLightMode={isLightMode}
            />
            <HeroMetric
              value={points}
              label="POINTS"
              comparison={compPoints}
              changePercent={compPoints > 0 ? ((points - compPoints) / compPoints) * 100 : 0}
              icon={Target}
              isLightMode={isLightMode}
            />
            <HeroMetric
              value={households}
              label="HOUSEHOLDS"
              comparison={compHouseholds}
              changePercent={compHouseholds > 0 ? ((households - compHouseholds) / compHouseholds) * 100 : 0}
              icon={Home}
              isLightMode={isLightMode}
            />
            <HeroMetric
              value={items}
              label="ITEMS"
              comparison={compItems}
              changePercent={compItems > 0 ? ((items - compItems) / compItems) * 100 : 0}
              icon={Package}
              isLightMode={isLightMode}
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: TWO COLUMN LAYOUT - Progress + Collapsible Sections
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Progress Ring & Core 4 */}
        <div className="lg:col-span-1 space-y-4">
          {/* Progress Block */}
          <div className={cn('border-2 bg-[#1A1A2E] p-4', borderColor)}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-[var(--brutalist-yellow)]" />
                <span className={cn('text-xs uppercase tracking-wider font-bold', textMuted)}>
                  PROGRESS
                </span>
              </div>
              <div className="border-2 border-[var(--brutalist-yellow)] bg-[var(--brutalist-yellow)]/10 px-2 py-1 flex items-center gap-1">
                <Flame className="w-3 h-3 text-[var(--brutalist-yellow)]" />
                <span className="text-[var(--brutalist-yellow)] text-xs font-bold">1-DAY</span>
              </div>
            </div>
            <div className="flex justify-center">
              <ProgressRing
                percentage={percentage}
                current={premium}
                target={target}
                isLightMode={isLightMode}
              />
            </div>
          </div>

          {/* Core 4 + Flow Section */}
          <div className={cn('border-2 bg-[#1A1A2E] p-4', borderColor)}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-purple-500" />
                <span className={cn('text-xs uppercase tracking-wider font-bold', textMuted)}>
                  CORE 4 + FLOW
                </span>
                {currentStreak > 0 && (
                  <div className="flex items-center gap-1 text-orange-500">
                    <Flame className="w-3 h-3" />
                    <span className="text-xs font-bold">{currentStreak}</span>
                  </div>
                )}
              </div>
              <Link
                to="/core4"
                className={cn('transition-colors flex items-center gap-1 text-xs', textDim, isLightMode ? 'hover:text-[var(--brutalist-text)]' : 'hover:text-white')}
              >
                VIEW <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm mb-4">
              <span className={textMuted}>Today: <span className={cn('font-bold', textColor)}>{todayPoints}/4</span></span>
              <span className={textDim}>|</span>
              <span className={textMuted}>Week: <span className={cn('font-bold', textColor)}>{combinedWeeklyPoints}/35</span></span>
              {flowStats.todayCompleted && (
                <>
                  <span className={textDim}>|</span>
                  <span className="text-purple-500 flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Flow
                  </span>
                </>
              )}
            </div>

            {/* Domain Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {DOMAIN_CONFIG.map((domain) => (
                <Core4DomainButton
                  key={domain.key}
                  domain={domain}
                  completed={isDomainCompleted(domain.key)}
                  onToggle={() => toggleDomain(domain.key)}
                  isLightMode={isLightMode}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Collapsible Sections */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pace Block - Always Visible Alert */}
          <div className={cn(
            'border-2 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4',
            isBehind
              ? 'border-[var(--brutalist-yellow)] bg-[var(--brutalist-yellow)]/10'
              : 'border-[var(--brutalist-green)] bg-[var(--brutalist-green)]/10'
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-10 h-10 flex items-center justify-center',
                isBehind ? 'bg-[var(--brutalist-yellow)]' : 'bg-[var(--brutalist-green)]'
              )}>
                {isBehind ? (
                  <AlertTriangle className="w-5 h-5 text-[var(--brutalist-bg)]" />
                ) : (
                  <TrendingUp className="w-5 h-5 text-[var(--brutalist-bg)]" />
                )}
              </div>
              <div>
                <div className={cn('text-lg lg:text-xl font-bold', textColor)}>
                  DAILY PACE: ${dailyPaceNeeded.toLocaleString(undefined, { maximumFractionDigits: 0 })}/DAY
                </div>
                <div className={cn(
                  'text-sm font-bold uppercase',
                  isBehind ? 'text-[var(--brutalist-yellow)]' : 'text-[var(--brutalist-green)]'
                )}>
                  {isBehind ? 'BEHIND PACE' : 'ON PACE'}
                </div>
              </div>
            </div>
            <div className={cn('flex items-center gap-2 text-sm', textMuted)}>
              <Clock className="w-4 h-4" />
              <span className="uppercase font-bold">{bizDaysRemaining} DAYS LEFT</span>
            </div>
          </div>

          {/* Team Core 4 (for owners/key employees) */}
          {(isAgencyOwner || isKeyEmployee) && teamMembers.length > 0 && (
            <CollapsibleSection
              title="TEAM CORE 4 + FLOW"
              defaultOpen={false}
              accentColor="cyan"
              isLightMode={isLightMode}
              rightContent={
                <span className={cn('text-xs', textDim)}>{teamTotal}/{teamGoal} PTS</span>
              }
            >
              <div className="space-y-2">
                {/* Team Progress Bar */}
                <div className="mb-4">
                  <div className={cn('flex justify-between text-xs mb-1', textMuted)}>
                    <span>TEAM WEEKLY POINTS</span>
                    <span className={cn('font-bold', textColor)}>{teamTotal} / {teamGoal}</span>
                  </div>
                  <div className={cn('h-2 border', isLightMode ? 'bg-[var(--brutalist-border-solid)]/10 border-[var(--brutalist-border-solid)]/20' : 'bg-white/10 border-white/20')}>
                    <div
                      className="h-full bg-[var(--brutalist-cyan)] transition-all"
                      style={{ width: `${Math.min((teamTotal / teamGoal) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Top Performers */}
                {teamMembers.slice(0, 5).map((member, index) => (
                  <div
                    key={member.staffUserId}
                    className={cn('flex items-center justify-between p-2 border', borderInner)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn('text-xs font-bold w-4', textDim)}>{index + 1}</span>
                      <span className={cn('text-sm truncate max-w-[140px]', textColor)}>{member.displayName}</span>
                      {member.currentStreak > 0 && (
                        <div className="flex items-center gap-0.5 text-orange-500">
                          <Flame className="w-3 h-3" />
                          <span className="text-xs font-bold">{member.currentStreak}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[var(--brutalist-cyan)] font-bold text-sm">
                      {member.combinedWeeklyPoints}/35
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Renewals Summary */}
          <CollapsibleSection
            title="RENEWALS (NEXT 7 DAYS)"
            defaultOpen={false}
            accentColor="amber"
            isLightMode={isLightMode}
            rightContent={
              renewalStats?.total ? (
                <span className="text-[var(--brutalist-amber)] text-xs font-bold">{renewalStats.total}</span>
              ) : null
            }
          >
            {renewalStats?.total ? (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <span className={cn('text-4xl font-bold', textColor)}>{renewalStats.total}</span>
                  <p className={cn('text-sm uppercase', textDim)}>RENEWALS UPCOMING</p>
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {(renewalStats.uncontacted || 0) > 0 && (
                    <div className="border border-[var(--brutalist-yellow)] px-2 py-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-[var(--brutalist-yellow)]" />
                      <span className={cn('text-xs font-bold', textColor)}>{renewalStats.uncontacted} UNCONTACTED</span>
                    </div>
                  )}
                  {(renewalStats.pending || 0) > 0 && (
                    <div className={cn('border px-2 py-1 flex items-center gap-1', isLightMode ? 'border-[var(--brutalist-border-solid)]/30' : 'border-white/30')}>
                      <Clock className={cn('w-3 h-3', textMuted)} />
                      <span className={cn('text-xs font-bold', textColor)}>{renewalStats.pending} PENDING</span>
                    </div>
                  )}
                  {renewalStats.total > 0 && (
                    <div className="border border-[var(--brutalist-green)] px-2 py-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-[var(--brutalist-green)]" />
                      <span className={cn('text-xs font-bold', textColor)}>
                        {Math.round(((renewalStats.success || 0) / renewalStats.total) * 100)}% RETAINED
                      </span>
                    </div>
                  )}
                </div>

                <Link
                  to="/renewals"
                  className={cn('block border-2 text-center py-2 text-sm uppercase font-bold transition-colors', borderColor, textColor, hoverBgInverse, hoverTextInverse)}
                >
                  VIEW ALL RENEWALS
                </Link>
              </div>
            ) : (
              <div className={cn('text-center py-6 uppercase text-sm', textDim)}>
                No upcoming renewals
              </div>
            )}
          </CollapsibleSection>

          {/* Additional Metrics */}
          <CollapsibleSection title="ADDITIONAL METRICS" defaultOpen={true} accentColor="cyan" isLightMode={isLightMode}>
            <div className="grid grid-cols-2 gap-4">
              <div className={cn('border p-4', borderMuted)}>
                <div className="flex items-center gap-3 mb-2">
                  <Package className={cn('w-5 h-5', textDim)} />
                  <span className={cn('text-3xl font-bold', textColor)}>{items}</span>
                </div>
                <div className={cn('text-xs uppercase', textDim)}>
                  ~{compItems} (strike)
                </div>
                <div className={cn('text-xs uppercase mt-1', textMuted)}>ITEMS</div>
              </div>
              <div className={cn('border p-4', borderMuted)}>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className={cn('w-5 h-5', textDim)} />
                  <span className={cn('text-3xl font-bold', textColor)}>{policies}</span>
                </div>
                <div className={cn('text-xs uppercase', textDim)}>
                  vs 27 (strike)
                </div>
                <div className={cn('text-xs uppercase mt-1', textMuted)}>POLICIES</div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Top Producers */}
          <CollapsibleSection title="TOP PRODUCERS" defaultOpen={true} accentColor="yellow" isLightMode={isLightMode}>
            {leaderboardData && leaderboardData.length > 0 ? (
              <div className="space-y-2">
                {leaderboardData.slice(0, 5).map((producer, index) => (
                  <div
                    key={producer.team_member_id}
                    className={cn('flex items-center justify-between p-3 border transition-colors', borderInner, isLightMode ? 'hover:border-[var(--brutalist-border-solid)]/30' : 'hover:border-white/30')}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-8 h-8 flex items-center justify-center font-bold text-sm',
                        index === 0 ? 'bg-[var(--brutalist-yellow)] text-[var(--brutalist-bg)]' :
                        index === 1 ? (isLightMode ? 'bg-[var(--brutalist-border-solid)]/20 text-[var(--brutalist-text)]' : 'bg-white/20 text-white') :
                        index === 2 ? 'bg-[var(--brutalist-amber)] text-white' :
                        (isLightMode ? 'bg-[var(--brutalist-border-solid)]/10 text-[var(--brutalist-text-muted)]' : 'bg-white/10 text-white/60')
                      )}>
                        {(index + 1).toString().padStart(2, '0')}
                      </div>
                      <span className={cn('font-medium uppercase text-sm', textColor)}>
                        {producer.team_member_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-[var(--brutalist-yellow)] font-bold">
                          ${(producer.total_premium || 0).toLocaleString()}
                        </div>
                        <div className={cn('text-xs uppercase', textDim)}>PREMIUM</div>
                      </div>
                      <div className="text-right">
                        <div className={cn('font-bold', textColor)}>
                          {producer.total_points || 0}
                        </div>
                        <div className={cn('text-xs uppercase', textDim)}>POINTS</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn('text-center py-8 uppercase text-sm', textDim)}>
                No sales data yet this month
              </div>
            )}
          </CollapsibleSection>

          {/* Roleplay Sessions */}
          <CollapsibleSection
            title="ROLEPLAY SESSIONS"
            defaultOpen={false}
            accentColor="cyan"
            isLightMode={isLightMode}
            rightContent={
              roleplaySessions && roleplaySessions.length > 0 ? (
                <span className="text-[var(--brutalist-cyan)] text-xs font-bold">{roleplaySessions.length}</span>
              ) : null
            }
          >
            {roleplaySessions && roleplaySessions.length > 0 ? (
              <div className="space-y-2">
                {roleplaySessions.map((session) => {
                  const score = session.overall_score;
                  const isGood = score === 'Excellent' || score === 'Good';
                  const isAverage = score === 'Average';
                  return (
                    <div
                      key={session.id}
                      className={cn('flex items-center justify-between p-3 border', borderInner)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 border flex items-center justify-center', isLightMode ? 'border-[var(--brutalist-border-solid)]/30' : 'border-white/30')}>
                          <Bot className={cn('w-4 h-4', textDim)} />
                        </div>
                        <div>
                          <span className={cn('text-sm font-medium uppercase', textColor)}>
                            {session.staff_name}
                          </span>
                          <p className={cn('text-xs', textDim)}>
                            {format(new Date(session.completed_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        'px-2 py-1 text-xs font-bold uppercase flex items-center gap-1',
                        isGood ? 'bg-[var(--brutalist-green)] text-white' :
                        isAverage ? 'bg-[var(--brutalist-yellow)] text-[var(--brutalist-bg)]' :
                        'bg-[var(--brutalist-red)] text-white'
                      )}>
                        <Award className="w-3 h-3" />
                        {score}
                      </div>
                    </div>
                  );
                })}
                <Link
                  to="/ai-roleplay"
                  className={cn('block border-2 text-center py-2 text-sm uppercase font-bold transition-colors mt-4', borderColor, textColor, hoverBgInverse, hoverTextInverse)}
                >
                  START ROLEPLAY SESSION
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <Bot className={cn('w-12 h-12 mx-auto mb-3', isLightMode ? 'text-[var(--brutalist-border-solid)]/20' : 'text-white/20')} />
                <p className={cn('uppercase text-sm mb-4', textDim)}>No roleplay sessions yet</p>
                <Link
                  to="/ai-roleplay"
                  className="inline-block border-2 border-[var(--brutalist-cyan)] bg-[var(--brutalist-cyan)]/10 px-4 py-2 text-[var(--brutalist-cyan)] text-sm uppercase font-bold hover:bg-[var(--brutalist-cyan)] hover:text-[var(--brutalist-bg)] transition-colors"
                >
                  START YOUR FIRST SESSION
                </Link>
              </div>
            )}
          </CollapsibleSection>

          {/* Performance Metrics (from period submissions) */}
          <CollapsibleSection
            title="PERFORMANCE METRICS"
            defaultOpen={false}
            accentColor="amber"
            isLightMode={isLightMode}
            rightContent={
              currentPeriod ? (
                <span className={cn('text-xs', textDim)}>{currentPeriod.title}</span>
              ) : null
            }
          >
            {periodMetrics ? (
              <div className="space-y-4">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {periodMetrics.premium !== undefined && (
                    <div className={cn('border p-3', borderMuted)}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn('text-xs uppercase', textMuted)}>PREMIUM</span>
                        {prevPeriodMetrics?.premium !== undefined && (
                          <TrendIndicator
                            current={periodMetrics.premium}
                            previous={prevPeriodMetrics.premium}
                          />
                        )}
                      </div>
                      <div className="text-xl font-bold text-[var(--brutalist-yellow)]">
                        ${periodMetrics.premium.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {periodMetrics.policies !== undefined && (
                    <div className={cn('border p-3', borderMuted)}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn('text-xs uppercase', textMuted)}>POLICIES</span>
                        {prevPeriodMetrics?.policies !== undefined && (
                          <TrendIndicator
                            current={periodMetrics.policies}
                            previous={prevPeriodMetrics.policies}
                          />
                        )}
                      </div>
                      <div className={cn('text-xl font-bold', textColor)}>
                        {periodMetrics.policies}
                      </div>
                    </div>
                  )}
                  {periodMetrics.quoted !== undefined && (
                    <div className={cn('border p-3', borderMuted)}>
                      <span className={cn('text-xs uppercase block mb-1', textMuted)}>QUOTED</span>
                      <div className={cn('text-xl font-bold', textColor)}>
                        {periodMetrics.quoted}
                      </div>
                    </div>
                  )}
                  {periodMetrics.marketingSpend !== undefined && (
                    <div className={cn('border p-3', borderMuted)}>
                      <span className={cn('text-xs uppercase block mb-1', textMuted)}>MARKETING SPEND</span>
                      <div className={cn('text-xl font-bold', textColor)}>
                        ${periodMetrics.marketingSpend.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {periodMetrics.compensation !== undefined && (
                    <div className={cn('border p-3', borderMuted)}>
                      <span className={cn('text-xs uppercase block mb-1', textMuted)}>COMPENSATION</span>
                      <div className="text-xl font-bold text-[var(--brutalist-green)]">
                        ${periodMetrics.compensation.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {periodMetrics.expenses !== undefined && (
                    <div className={cn('border p-3', borderMuted)}>
                      <span className={cn('text-xs uppercase block mb-1', textMuted)}>EXPENSES</span>
                      <div className="text-xl font-bold text-[var(--brutalist-red)]">
                        ${periodMetrics.expenses.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  to="/submit"
                  className={cn('block border-2 text-center py-2 text-sm uppercase font-bold transition-colors', borderColor, textColor, hoverBgInverse, hoverTextInverse)}
                >
                  VIEW ALL SUBMISSIONS
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <BarChart3 className={cn('w-12 h-12 mx-auto mb-3', isLightMode ? 'text-[var(--brutalist-border-solid)]/20' : 'text-white/20')} />
                <p className={cn('uppercase text-sm mb-4', textDim)}>No period data submitted yet</p>
                <Link
                  to="/submit?mode=new"
                  className="inline-block border-2 border-[var(--brutalist-amber)] bg-[var(--brutalist-amber)]/10 px-4 py-2 text-[var(--brutalist-amber)] text-sm uppercase font-bold hover:bg-[var(--brutalist-amber)] hover:text-[var(--brutalist-bg)] transition-colors"
                >
                  SUBMIT METRICS
                </Link>
              </div>
            )}
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}

// Trend Indicator Component
function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (current === previous) {
    return <Minus className="w-3 h-3 text-white/40" />;
  }
  const isUp = current > previous;
  const pctChange = previous > 0 ? Math.abs(((current - previous) / previous) * 100) : 0;

  return (
    <div className={cn(
      'flex items-center gap-0.5 text-xs font-bold',
      isUp ? 'text-[var(--brutalist-green)]' : 'text-[var(--brutalist-red)]'
    )}>
      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {pctChange.toFixed(0)}%
    </div>
  );
}
