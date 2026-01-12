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

  // Fetch current week records (for working list / at risk week-over-week)
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

  // Fetch prior week records
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

  // Fetch ALL records for total working list and at risk
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

  // Fetch current week SAVED based on payment_made activities
  const { data: currentWeekSaved, isLoading: loadingCurrentSaved } = useQuery({
    queryKey: ['cancel-audit-hero-saved-current', agencyId, format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!agencyId) return 0;

      // Get payment_made activities created this week, join to get premium
      const { data: activities, error } = await supabase
        .from('cancel_audit_activities')
        .select('id, record_id, created_at')
        .eq('agency_id', agencyId)
        .eq('activity_type', 'payment_made')
        .gte('created_at', currentWeekStart.toISOString())
        .lte('created_at', currentWeekEnd.toISOString());

      if (error) {
        console.error('Error fetching current week saved activities:', error);
        return 0;
      }

      if (!activities || activities.length === 0) return 0;

      // Get the record IDs to fetch their premiums
      const recordIds = [...new Set(activities.map(a => a.record_id))];
      
      const { data: records, error: recordsError } = await supabase
        .from('cancel_audit_records')
        .select('id, premium_cents')
        .in('id', recordIds);

      if (recordsError) {
        console.error('Error fetching records for saved:', recordsError);
        return 0;
      }

      // Sum up the premiums
      return records?.reduce((sum, r) => sum + (r.premium_cents || 0), 0) || 0;
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
  });

  // Fetch prior week SAVED based on payment_made activities
  const { data: priorWeekSaved, isLoading: loadingPriorSaved } = useQuery({
    queryKey: ['cancel-audit-hero-saved-prior', agencyId, format(priorWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!agencyId) return 0;

      const { data: activities, error } = await supabase
        .from('cancel_audit_activities')
        .select('id, record_id, created_at')
        .eq('agency_id', agencyId)
        .eq('activity_type', 'payment_made')
        .gte('created_at', priorWeekStart.toISOString())
        .lte('created_at', priorWeekEnd.toISOString());

      if (error) {
        console.error('Error fetching prior week saved activities:', error);
        return 0;
      }

      if (!activities || activities.length === 0) return 0;

      const recordIds = [...new Set(activities.map(a => a.record_id))];
      
      const { data: records, error: recordsError } = await supabase
        .from('cancel_audit_records')
        .select('id, premium_cents')
        .in('id', recordIds);

      if (recordsError) {
        console.error('Error fetching records for prior saved:', recordsError);
        return 0;
      }

      return records?.reduce((sum, r) => sum + (r.premium_cents || 0), 0) || 0;
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
  });

  // Calculate stats - Working list and At Risk are all-time, Saved is this week only
  const stats = useMemo(() => {
    if (!allRecords) {
      return {
        workingListCount: 0,
        atRiskPremium: 0,
        savedPremium: 0,
      };
    }

    const workingList = allRecords.filter(r => r.status !== 'resolved' && r.status !== 'lost');

    return {
      workingListCount: workingList.length,
      atRiskPremium: workingList.reduce((sum, r) => sum + (r.premium_cents || 0), 0),
      savedPremium: currentWeekSaved || 0, // This week's saved based on activities
    };
  }, [allRecords, currentWeekSaved]);

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

    const calcChange = (current: number, prior: number) => {
      if (prior === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prior) / prior) * 100);
    };

    return {
      workingListChange: calcChange(currentCount, priorCount),
      atRiskChange: calcChange(currentAtRisk, priorAtRisk),
      savedChange: calcChange(currentWeekSaved || 0, priorWeekSaved || 0), // Activity-based comparison
    };
  }, [currentWeekData, priorWeekData, currentWeekSaved, priorWeekSaved]);

  const isLoading = loadingCurrent || loadingPrior || loadingAll || loadingCurrentSaved || loadingPriorSaved;

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

      {/* Saved This Week */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Saved This Week</span>
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
