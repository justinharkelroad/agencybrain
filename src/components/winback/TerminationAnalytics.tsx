import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import * as winbackApi from '@/lib/winbackApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
} from 'recharts';
import {
  TrendingDown,
  Package,
  FileText,
  DollarSign,
  Search,
  CalendarIcon,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { DateRange } from 'react-day-picker';
import {
  calculateTerminationStats,
  detectPolicyType,
  calculatePointsLost,
  formatCurrency,
  formatCompactNumber,
  getActiveTypesWithStats,
  getPolicyTypeLabel,
  type TerminationStats,
} from '@/lib/terminationPointsCalculator';
import { cn } from '@/lib/utils';

// Types for drill-down modal
type DrillDownType = 'producer' | 'type' | 'reason';
interface DrillDownState {
  open: boolean;
  type: DrillDownType;
  title: string;
  filterValue: string;
}

interface TerminationAnalyticsProps {
  agencyId: string;
}

interface TerminationPolicy {
  id: string;
  policy_number: string;
  agent_number: string | null;
  product_name: string | null;
  line_code: string | null;
  items_count: number | null;
  premium_new_cents: number | null;
  termination_effective_date: string;
  termination_reason: string | null;
  is_cancel_rewrite: boolean | null;
  household_id: string;
  winback_households?: {
    first_name: string;
    last_name: string;
  };
}

interface ProducerStats {
  agentNumber: string;
  name: string;
  itemsLost: number;
  pointsLost: number;
  premiumLostCents: number;
  policiesLost: number;
}

type SortColumn = 'date' | 'policy' | 'customer' | 'type' | 'items' | 'points' | 'premium' | 'reason';
type SortDirection = 'asc' | 'desc';
type AnalyticsTab = 'all' | 'by-type' | 'by-reason' | 'by-source' | 'by-zipcode' | 'leaderboard' | 'by-origin';

const CHART_COLORS = ['#10b981', '#22d3ee', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

export function TerminationAnalytics({ agencyId }: TerminationAnalyticsProps) {
  // Data state
  const [policies, setPolicies] = useState<TerminationPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<Map<string, string>>(new Map());

  // Filter state
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    // Default to current month (1st to last day)
    const today = new Date();
    return {
      from: startOfMonth(today),
      to: endOfMonth(today),
    };
  });
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('leaderboard');
  const [teamMembersLoaded, setTeamMembersLoaded] = useState(false);

  // Table state
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Drill-down modal state
  const [drillDown, setDrillDown] = useState<DrillDownState>({
    open: false,
    type: 'producer',
    title: '',
    filterValue: '',
  });

  // Fetch team members first (only once)
  useEffect(() => {
    fetchTeamMembers();
  }, [agencyId]);

  // Fetch policies when date range changes
  useEffect(() => {
    if (teamMembersLoaded) {
      fetchPolicies();
    }
  }, [agencyId, dateRange, teamMembersLoaded]);

  // Auto-refresh when winback data is uploaded
  useEffect(() => {
    const handleWinbackUpload = () => {
      console.log('[TerminationAnalytics] Winback upload detected, refreshing data...');
      fetchPolicies();
    };

    window.addEventListener('winback-upload-complete', handleWinbackUpload);
    return () => window.removeEventListener('winback-upload-complete', handleWinbackUpload);
  }, [agencyId, dateRange, teamMembersLoaded]);

  const fetchTeamMembers = async () => {
    try {
      const data = await winbackApi.getTerminationTeamMembers(agencyId);

      if (data) {
        const map = new Map<string, string>();
        data.forEach((member) => {
          // Map both agent_number AND sub_producer_code to the name for maximum matching
          if (member.agent_number) {
            map.set(member.agent_number, member.name);
          }
          if (member.sub_producer_code) {
            map.set(member.sub_producer_code, member.name);
          }
        });
        setTeamMembers(map);
      }
    } catch (err) {
      console.error('Error fetching team members:', err);
    }
    setTeamMembersLoaded(true);
  };

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const dateFrom = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
      const dateTo = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined;

      const data = await winbackApi.getTerminationPolicies(agencyId, dateFrom, dateTo);
      setPolicies((data || []) as TerminationPolicy[]);
    } catch (err) {
      console.error('Error fetching termination policies:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    return calculateTerminationStats(
      policies.map((p) => ({
        product_name: p.product_name,
        line_code: p.line_code,
        items_count: p.items_count,
        premium_new_cents: p.premium_new_cents,
        is_cancel_rewrite: p.is_cancel_rewrite,
      }))
    );
  }, [policies]);

  // Filter policies based on search
  const filteredPolicies = useMemo(() => {
    if (!search) return policies;
    const searchLower = search.toLowerCase();
    return policies.filter((p) => {
      const customerName = `${p.winback_households?.first_name || ''} ${p.winback_households?.last_name || ''}`.toLowerCase();
      return (
        customerName.includes(searchLower) ||
        p.policy_number.toLowerCase().includes(searchLower)
      );
    });
  }, [policies, search]);

  // Sort policies
  const sortedPolicies = useMemo(() => {
    return [...filteredPolicies].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'date':
          comparison = new Date(a.termination_effective_date).getTime() - new Date(b.termination_effective_date).getTime();
          break;
        case 'policy':
          comparison = a.policy_number.localeCompare(b.policy_number);
          break;
        case 'customer':
          const nameA = `${a.winback_households?.last_name || ''} ${a.winback_households?.first_name || ''}`;
          const nameB = `${b.winback_households?.last_name || ''} ${b.winback_households?.first_name || ''}`;
          comparison = nameA.localeCompare(nameB);
          break;
        case 'type':
          comparison = (a.product_name || '').localeCompare(b.product_name || '');
          break;
        case 'items':
          comparison = (a.items_count || 1) - (b.items_count || 1);
          break;
        case 'points':
          const pointsA = calculatePointsLost(a.product_name, a.line_code, a.items_count || 1);
          const pointsB = calculatePointsLost(b.product_name, b.line_code, b.items_count || 1);
          comparison = pointsA - pointsB;
          break;
        case 'premium':
          comparison = (a.premium_new_cents || 0) - (b.premium_new_cents || 0);
          break;
        case 'reason':
          comparison = (a.termination_reason || '').localeCompare(b.termination_reason || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredPolicies, sortColumn, sortDirection]);

  // Producer leaderboard data
  const producerStats = useMemo(() => {
    const producerMap = new Map<string, ProducerStats>();

    for (const policy of policies) {
      const agentNumber = policy.agent_number || 'Unknown';
      const existing = producerMap.get(agentNumber) || {
        agentNumber,
        name: teamMembers.get(agentNumber) || agentNumber,
        itemsLost: 0,
        pointsLost: 0,
        premiumLostCents: 0,
        policiesLost: 0,
      };

      const itemsCount = policy.items_count || 1;
      const pointsLost = calculatePointsLost(policy.product_name, policy.line_code, itemsCount);

      existing.itemsLost += itemsCount;
      existing.pointsLost += pointsLost;
      existing.premiumLostCents += policy.premium_new_cents || 0;
      existing.policiesLost += 1;

      producerMap.set(agentNumber, existing);
    }

    return Array.from(producerMap.values()).sort((a, b) => b.itemsLost - a.itemsLost);
  }, [policies, teamMembers]);

  // Policy type breakdown - using granular types
  const policyTypeData = useMemo(() => {
    const typeMap = new Map<string, { name: string; value: number; items: number; premium: number }>();

    for (const policy of policies) {
      const type = detectPolicyType(policy.product_name, policy.line_code);
      const label = getPolicyTypeLabel(type);
      const existing = typeMap.get(label) || { name: label, value: 0, items: 0, premium: 0 };
      existing.value += 1;
      existing.items += policy.items_count || 1;
      existing.premium += policy.premium_new_cents || 0;
      typeMap.set(label, existing);
    }

    return Array.from(typeMap.values()).sort((a, b) => b.items - a.items);
  }, [policies]);

  // Reason breakdown (top 10)
  const reasonData = useMemo(() => {
    const reasonMap = new Map<string, number>();

    for (const policy of policies) {
      const reason = policy.termination_reason || 'Unknown';
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    }

    return Array.from(reasonMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));
  }, [policies]);

  // Drill-down filtered policies
  const drillDownPolicies = useMemo(() => {
    if (!drillDown.open) return [];
    
    switch (drillDown.type) {
      case 'producer':
        return policies.filter(p => {
          const agentNumber = p.agent_number || 'Unknown';
          const producerName = teamMembers.get(agentNumber) || agentNumber;
          return producerName === drillDown.filterValue || agentNumber === drillDown.filterValue;
        });
      case 'type':
        return policies.filter(p => {
          const type = detectPolicyType(p.product_name, p.line_code);
          const label = getPolicyTypeLabel(type);
          return label === drillDown.filterValue;
        });
      case 'reason':
        return policies.filter(p => (p.termination_reason || 'Unknown') === drillDown.filterValue);
      default:
        return [];
    }
  }, [drillDown, policies, teamMembers]);

  // Chart click handlers
  const handleProducerBarClick = (data: any) => {
    if (data?.name) {
      setDrillDown({
        open: true,
        type: 'producer',
        title: `Policies for ${data.name}`,
        filterValue: data.name,
      });
    }
  };

  const handleTypeBarClick = (data: any) => {
    if (data?.name) {
      setDrillDown({
        open: true,
        type: 'type',
        title: `${data.name} Policies`,
        filterValue: data.name,
      });
    }
  };

  const handleReasonBarClick = (data: any) => {
    if (data?.reason) {
      setDrillDown({
        open: true,
        type: 'reason',
        title: `Policies: ${data.reason.slice(0, 40)}${data.reason.length > 40 ? '...' : ''}`,
        filterValue: data.reason,
      });
    }
  };

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleQuickDate = (range: 'thisMonth' | 'lastMonth' | 'last90Days') => {
    const today = new Date();
    switch (range) {
      case 'thisMonth':
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        break;
      case 'last90Days':
        setDateRange({ from: subDays(today, 90), to: today });
        break;
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (column !== sortColumn) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    );
  };

  if (loading || !teamMembersLoaded) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Orbs - Reordered: Premium, Items, Policies, Points */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Premium Lost - Emerald */}
        <div className="flex flex-col items-center justify-center aspect-square rounded-full border-2 p-4 bg-transparent border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
          <DollarSign className="h-5 w-5 text-emerald-400 mb-1" />
          <span className="text-2xl font-bold text-white">-{formatCurrency(stats.totalPremiumLostCents)}</span>
          <span className="text-xs text-muted-foreground">Premium Lost</span>
        </div>

        {/* Items Lost - Amber */}
        <div className="flex flex-col items-center justify-center aspect-square rounded-full border-2 p-4 bg-transparent border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <Package className="h-5 w-5 text-amber-400 mb-1" />
          <span className="text-2xl font-bold text-white">-{stats.totalItemsLost}</span>
          <span className="text-xs text-muted-foreground">Items Lost</span>
        </div>

        {/* Policies Lost - Violet */}
        <div className="flex flex-col items-center justify-center aspect-square rounded-full border-2 p-4 bg-transparent border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
          <FileText className="h-5 w-5 text-violet-400 mb-1" />
          <span className="text-2xl font-bold text-white">-{stats.totalPoliciesLost}</span>
          <span className="text-xs text-muted-foreground">Policies Lost</span>
        </div>

        {/* Points Lost - Red */}
        <div className="flex flex-col items-center justify-center aspect-square rounded-full border-2 p-4 bg-transparent border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
          <TrendingDown className="h-5 w-5 text-red-400 mb-1" />
          <span className="text-2xl font-bold text-white">-{formatCompactNumber(stats.totalPointsLost)}</span>
          <span className="text-xs text-muted-foreground">Points Lost</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Date Range Picker */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickDate('thisMonth')}
            className={cn(
              dateRange?.from &&
                dateRange.from.getMonth() === new Date().getMonth() &&
                dateRange.from.getFullYear() === new Date().getFullYear() &&
                'bg-primary text-primary-foreground'
            )}
          >
            This Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleQuickDate('lastMonth')}>
            Last Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleQuickDate('last90Days')}>
            Last 90 Days
          </Button>
          {/* Start Date */}
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateRange?.from ? format(dateRange.from, 'MMM d, yyyy') : 'Start Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange?.from}
                onSelect={(date) => {
                  if (date) {
                    setDateRange(prev => ({
                      from: date,
                      to: prev?.to && prev.to >= date ? prev.to : date
                    }));
                    setStartDateOpen(false);
                  }
                }}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">→</span>

          {/* End Date */}
          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateRange?.to ? format(dateRange.to, 'MMM d, yyyy') : 'End Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange?.to}
                onSelect={(date) => {
                  if (date) {
                    setDateRange(prev => ({
                      from: prev?.from && prev.from <= date ? prev.from : date,
                      to: date
                    }));
                    setEndDateOpen(false);
                  }
                }}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or policy..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearch('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AnalyticsTab)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="by-origin">by Origin</TabsTrigger>
          <TabsTrigger value="all">Terminations by Date</TabsTrigger>
          <TabsTrigger value="by-type">by Policy Type</TabsTrigger>
          <TabsTrigger value="by-source">by Source</TabsTrigger>
          <TabsTrigger value="by-reason">by Reason</TabsTrigger>
        </TabsList>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Items Loss by User</CardTitle>
              <CardDescription>Negative bar chart showing items lost per producer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={producerStats.slice(0, 10).map((p, i) => ({
                      ...p,
                      negativeItems: -p.itemsLost,
                      fill: CHART_COLORS[i % CHART_COLORS.length],
                    }))}
                    layout="horizontal"
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis domain={['auto', 0]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-semibold text-foreground">{data.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Items Lost: <span className="font-medium text-foreground">{data.itemsLost}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Points Lost: <span className="font-medium text-foreground">{data.pointsLost}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Premium: <span className="font-medium text-foreground">{formatCurrency(data.premiumLostCents)}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={false}
                    />
                    <Bar 
                      dataKey="negativeItems" 
                      radius={[4, 4, 0, 0]} 
                      className="cursor-pointer"
                      onClick={(data) => handleProducerBarClick(data)}
                    >
                      {producerStats.slice(0, 10).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Summary table below chart */}
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Producer</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Premium</TableHead>
                    <TableHead className="text-right">Policies</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {producerStats.map((producer, index) => (
                    <TableRow key={producer.agentNumber}>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] + '20' }}
                        >
                          {index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{producer.name}</TableCell>
                      <TableCell className="text-right">-{producer.itemsLost}</TableCell>
                      <TableCell className="text-right">-{producer.pointsLost}</TableCell>
                      <TableCell className="text-right">{formatCurrency(producer.premiumLostCents)}</TableCell>
                      <TableCell className="text-right">{producer.policiesLost}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Terminations Tab */}
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Terminations</CardTitle>
              <CardDescription>{filteredPolicies.length} policies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('date')}
                      >
                        Date <SortIcon column="date" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('policy')}
                      >
                        Policy # <SortIcon column="policy" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('customer')}
                      >
                        Customer <SortIcon column="customer" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('type')}
                      >
                        Type <SortIcon column="type" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 text-right"
                        onClick={() => handleSort('items')}
                      >
                        Items <SortIcon column="items" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 text-right"
                        onClick={() => handleSort('points')}
                      >
                        Points <SortIcon column="points" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50 text-right"
                        onClick={() => handleSort('premium')}
                      >
                        Premium <SortIcon column="premium" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('reason')}
                      >
                        Reason <SortIcon column="reason" />
                      </TableHead>
                      <TableHead>Producer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPolicies.slice(0, 100).map((policy) => {
                      const itemsCount = policy.items_count || 1;
                      const points = calculatePointsLost(policy.product_name, policy.line_code, itemsCount);
                      const producerName = policy.agent_number
                        ? teamMembers.get(policy.agent_number) || policy.agent_number
                        : 'N/A';
                      const isCancelRewrite = policy.is_cancel_rewrite;

                      return (
                        <TableRow
                          key={policy.id}
                          className={cn(isCancelRewrite && 'bg-cyan-50 dark:bg-cyan-950/30')}
                        >
                          <TableCell>{format(new Date(policy.termination_effective_date), 'M/d/yyyy')}</TableCell>
                          <TableCell className="font-mono text-sm">{policy.policy_number}</TableCell>
                          <TableCell>
                            {policy.winback_households?.first_name} {policy.winback_households?.last_name}
                          </TableCell>
                          <TableCell>{policy.product_name || '-'}</TableCell>
                          <TableCell className="text-right">-{itemsCount}</TableCell>
                          <TableCell className="text-right">-{points}</TableCell>
                          <TableCell className="text-right">
                            ({formatCurrency(policy.premium_new_cents || 0)})
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {isCancelRewrite ? (
                              <Badge variant="outline" className="bg-cyan-100 dark:bg-cyan-900">
                                Cancel/Rewrite
                              </Badge>
                            ) : (
                              policy.termination_reason || '-'
                            )}
                          </TableCell>
                          <TableCell>{producerName}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {sortedPolicies.length > 100 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Showing first 100 of {sortedPolicies.length} policies
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Policy Type Tab */}
        <TabsContent value="by-type" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Policies by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={policyTypeData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {policyTypeData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                                <p className="font-semibold text-foreground">{data.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Policies: <span className="font-medium text-foreground">{data.value}</span>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Items: <span className="font-medium text-foreground">{data.items}</span>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Premium: <span className="font-medium text-foreground">{formatCurrency(data.premium)}</span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Items Lost by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={policyTypeData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-semibold text-foreground">{data.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Items: <span className="font-medium text-foreground">{data.items}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Policies: <span className="font-medium text-foreground">{data.value}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Premium: <span className="font-medium text-foreground">{formatCurrency(data.premium)}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={false}
                    />
                      <Bar 
                        dataKey="items" 
                        fill="#10b981" 
                        radius={[0, 4, 4, 0]} 
                        className="cursor-pointer"
                        onClick={(data) => handleTypeBarClick(data)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* By Reason Tab */}
        <TabsContent value="by-reason" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Termination Reasons</CardTitle>
              <CardDescription>Top 10 reasons for policy terminations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reasonData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="reason"
                      type="category"
                      width={200}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: string) => value.length > 35 ? value.slice(0, 35) + '...' : value}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-semibold text-foreground">{data.reason}</p>
                              <p className="text-sm text-muted-foreground">
                                Count: <span className="font-medium text-foreground">{data.count}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={false}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#8b5cf6" 
                      radius={[0, 4, 4, 0]} 
                      className="cursor-pointer"
                      onClick={(data) => handleReasonBarClick(data)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Source Tab - Placeholder */}
        <TabsContent value="by-source" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Terminations by Source</CardTitle>
              <CardDescription>Analysis by termination source</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
              Source data not available in current upload format
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Origin Tab - Placeholder */}
        <TabsContent value="by-origin" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Terminations by Origin</CardTitle>
              <CardDescription>Analysis by policy origin</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
              Origin data not available in current upload format
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drill-Down Modal */}
      <Dialog open={drillDown.open} onOpenChange={(open) => setDrillDown(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{drillDown.title}</DialogTitle>
            <DialogDescription>
              {drillDownPolicies.length} policies found
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Policy #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillDownPolicies.map((policy) => {
                  const itemsCount = policy.items_count || 1;
                  return (
                    <TableRow key={policy.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(policy.termination_effective_date), 'M/d/yyyy')}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{policy.policy_number}</TableCell>
                      <TableCell>
                        {policy.winback_households?.first_name} {policy.winback_households?.last_name}
                      </TableCell>
                      <TableCell>{policy.product_name || '-'}</TableCell>
                      <TableCell className="text-right">-{itemsCount}</TableCell>
                      <TableCell className="text-right">
                        ({formatCurrency(policy.premium_new_cents || 0)})
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {policy.is_cancel_rewrite ? (
                          <Badge variant="outline" className="bg-cyan-100 dark:bg-cyan-900">
                            Cancel/Rewrite
                          </Badge>
                        ) : (
                          policy.termination_reason || '-'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TerminationAnalytics;
