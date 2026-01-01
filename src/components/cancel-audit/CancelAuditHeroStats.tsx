import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, ClipboardList, DollarSign, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { startOfWeek, subWeeks, endOfWeek, format } from 'date-fns';
import { formatCurrencyShort } from '@/lib/cancel-audit-utils';

interface CancelAuditHeroStatsProps {
  agencyId: string | null;
}

export function CancelAuditHeroStats({ agencyId }: CancelAuditHeroStatsProps) {
  // Get current week boundaries (Monday to Sunday)
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const priorWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  const priorWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });

  // Fetch current week stats
  const { data: currentWeekData, isLoading: loadingCurrent } = useQuery({
    queryKey: ['cancel-audit-hero-current', agencyId, format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!agencyId) return null;

      const { data, error } = await supabase
        .from('cancel_audit_records')
        .select('id, status, premium_cents, created_at')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .gte('created_at', currentWeekStart.toISOString())
        .lte('created_at', currentWeekEnd.toISOString());

      if (error) {
        console.error('Error fetching current week stats:', error);
        return null;
      }

      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
  });

  // Fetch prior week stats
  const { data: priorWeekData, isLoading: loadingPrior } = useQuery({
    queryKey: ['cancel-audit-hero-prior', agencyId, format(priorWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!agencyId) return null;

      const { data, error } = await supabase
        .from('cancel_audit_records')
        .select('id, status, premium_cents, created_at')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .gte('created_at', priorWeekStart.toISOString())
        .lte('created_at', priorWeekEnd.toISOString());

      if (error) {
        console.error('Error fetching prior week stats:', error);
        return null;
      }

      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
  });

  // Fetch ALL records for total working list and saved
  const { data: allRecords, isLoading: loadingAll } = useQuery({
    queryKey: ['cancel-audit-hero-all', agencyId],
    queryFn: async () => {
      if (!agencyId) return null;

      const { data, error } = await supabase
        .from('cancel_audit_records')
        .select('id, status, premium_cents')
        .eq('agency_id', agencyId)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching all records:', error);
        return null;
      }

      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
  });

  // Calculate stats
  const stats = useMemo(() => {
    if (!allRecords) {
      return {
        workingListCount: 0,
        atRiskPremium: 0,
        savedPremium: 0,
      };
    }

    const workingList = allRecords.filter(r => r.status !== 'resolved' && r.status !== 'lost');
    const saved = allRecords.filter(r => r.status === 'resolved');

    return {
      workingListCount: workingList.length,
      atRiskPremium: workingList.reduce((sum, r) => sum + (r.premium_cents || 0), 0),
      savedPremium: saved.reduce((sum, r) => sum + (r.premium_cents || 0), 0),
    };
  }, [allRecords]);

  // Calculate week-over-week changes
  const weekOverWeek = useMemo(() => {
    const currentCount = currentWeekData?.length || 0;
    const priorCount = priorWeekData?.length || 0;

    const currentAtRisk = currentWeekData
      ?.filter(r => r.status !== 'resolved' && r.status !== 'lost')
      .reduce((sum, r) => sum + (r.premium_cents || 0), 0) || 0;
    const priorAtRisk = priorWeekData
      ?.filter(r => r.status !== 'resolved' && r.status !== 'lost')
      .reduce((sum, r) => sum + (r.premium_cents || 0), 0) || 0;

    const currentSaved = currentWeekData
      ?.filter(r => r.status === 'resolved')
      .reduce((sum, r) => sum + (r.premium_cents || 0), 0) || 0;
    const priorSaved = priorWeekData
      ?.filter(r => r.status === 'resolved')
      .reduce((sum, r) => sum + (r.premium_cents || 0), 0) || 0;

    const calcChange = (current: number, prior: number) => {
      if (prior === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prior) / prior) * 100);
    };

    return {
      workingListChange: calcChange(currentCount, priorCount),
      atRiskChange: calcChange(currentAtRisk, priorAtRisk),
      savedChange: calcChange(currentSaved, priorSaved),
    };
  }, [currentWeekData, priorWeekData]);

  const isLoading = loadingCurrent || loadingPrior || loadingAll;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const TrendIndicator = ({ change, invertColor = false }: { change: number; invertColor?: boolean }) => {
    if (change === 0) {
      return (
        <div className="flex items-center gap-1 text-muted-foreground text-sm">
          <Minus className="h-3 w-3" />
          <span>No change</span>
        </div>
      );
    }

    const isPositive = change > 0;
    // For "At Risk" and "Working List", positive is bad. For "Saved", positive is good.
    const isGood = invertColor ? isPositive : !isPositive;

    return (
      <div className={`flex items-center gap-1 text-sm ${isGood ? 'text-emerald-600' : 'text-red-500'}`}>
        {isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        <span>{isPositive ? '+' : ''}{change}% vs last week</span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Working List */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ClipboardList className="h-4 w-4" />
            <span className="text-sm font-medium">Working List</span>
          </div>
          <div className="text-3xl font-bold text-foreground mb-1">
            {stats.workingListCount}
          </div>
          <TrendIndicator change={weekOverWeek.workingListChange} />
        </CardContent>
      </Card>

      {/* At Risk */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm font-medium">At Risk</span>
          </div>
          <div className="text-3xl font-bold text-foreground mb-1">
            {formatCurrencyShort(stats.atRiskPremium)}
          </div>
          <TrendIndicator change={weekOverWeek.atRiskChange} />
        </CardContent>
      </Card>

      {/* Saved */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Saved</span>
          </div>
          <div className="text-3xl font-bold text-emerald-600 mb-1">
            {formatCurrencyShort(stats.savedPremium)}
          </div>
          <TrendIndicator change={weekOverWeek.savedChange} invertColor />
        </CardContent>
      </Card>
    </div>
  );
}
