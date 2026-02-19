import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, ClipboardList, DollarSign, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { startOfWeek, subWeeks, endOfWeek, format } from 'date-fns';
import { formatCurrencyShort } from '@/lib/cancel-audit-utils';
import { callCancelAuditApi, getStaffSessionToken, isStaffContext } from '@/lib/cancel-audit-api';
import { SavedPaymentsDialog } from './SavedPaymentsDialog';

interface CancelAuditHeroStatsProps {
  agencyId: string | null;
}

// Edge function returns nested structure
interface HeroStatsResponse {
  stats: {
    workingListCount: number;
    atRiskPremium: number;
    savedPremium: number;
  };
  weekOverWeek: {
    workingList: { current: number; prior: number; change: number };
    atRisk: { current: number; prior: number; change: number };
    saved: { current: number; prior: number; change: number };
  };
}

export function CancelAuditHeroStats({ agencyId }: CancelAuditHeroStatsProps) {
  const [savedPaymentsOpen, setSavedPaymentsOpen] = useState(false);

  // Get current week boundaries (Monday to Sunday)
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const priorWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
  const priorWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });

  // Check if we're in staff context
  const staffToken = getStaffSessionToken();
  const inStaffContext = isStaffContext();

  // Unified query for staff users - uses edge function
  const { data: staffHeroData, isLoading: loadingStaffData } = useQuery({
    queryKey: ['cancel-audit-hero-stats-staff', agencyId],
    queryFn: async (): Promise<HeroStatsResponse> => {
      if (!agencyId || !staffToken) {
        throw new Error('Missing agencyId or staff token');
      }

      const result = await callCancelAuditApi({
        operation: 'get_hero_stats',
        params: {
          agency_id: agencyId,
          currentWeekStart: format(currentWeekStart, 'yyyy-MM-dd'),
          currentWeekEnd: format(currentWeekEnd, 'yyyy-MM-dd'),
          priorWeekStart: format(priorWeekStart, 'yyyy-MM-dd'),
          priorWeekEnd: format(priorWeekEnd, 'yyyy-MM-dd'),
        },
        sessionToken: staffToken,
      });

      return result as HeroStatsResponse;
    },
    enabled: !!agencyId && inStaffContext && !!staffToken,
    staleTime: 60 * 1000,
  });

  // Fetch current week records (for working list / at risk week-over-week) - regular users
  const { data: currentWeekData, isLoading: loadingCurrent } = useQuery({
    queryKey: ['cancel-audit-hero-current', agencyId, format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!agencyId) return null;

      const { data, error } = await supabase
        .from('cancel_audit_records')
        .select('id, status, premium_cents, created_at')
        .eq('agency_id', agencyId)
        .in('status', ['new', 'in_progress'])
        .gte('created_at', currentWeekStart.toISOString())
        .lte('created_at', currentWeekEnd.toISOString());

      if (error) {
        console.error('Error fetching current week stats:', error);
        return null;
      }

      return data || [];
    },
    enabled: !!agencyId && !inStaffContext,
    staleTime: 60 * 1000,
  });

  // Fetch prior week records - regular users
  const { data: priorWeekData, isLoading: loadingPrior } = useQuery({
    queryKey: ['cancel-audit-hero-prior', agencyId, format(priorWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!agencyId) return null;

      const { data, error } = await supabase
        .from('cancel_audit_records')
        .select('id, status, premium_cents, created_at')
        .eq('agency_id', agencyId)
        .in('status', ['new', 'in_progress'])
        .gte('created_at', priorWeekStart.toISOString())
        .lte('created_at', priorWeekEnd.toISOString());

      if (error) {
        console.error('Error fetching prior week stats:', error);
        return null;
      }

      return data || [];
    },
    enabled: !!agencyId && !inStaffContext,
    staleTime: 60 * 1000,
  });

  // Fetch ALL records for total working list and at risk - regular users
  const { data: allRecords, isLoading: loadingAll } = useQuery({
    queryKey: ['cancel-audit-hero-all', agencyId],
    queryFn: async () => {
      if (!agencyId) return null;

      const { data, error } = await supabase
        .from('cancel_audit_records')
        .select('id, status, premium_cents')
        .eq('agency_id', agencyId)
        .in('status', ['new', 'in_progress']);

      if (error) {
        console.error('Error fetching all records:', error);
        return null;
      }

      return data || [];
    },
    enabled: !!agencyId && !inStaffContext,
    staleTime: 60 * 1000,
  });

  // Fetch current week SAVED based on payment_made activities - regular users
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
    enabled: !!agencyId && !inStaffContext,
    staleTime: 60 * 1000,
  });

  // Fetch prior week SAVED based on payment_made activities - regular users
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
    enabled: !!agencyId && !inStaffContext,
    staleTime: 60 * 1000,
  });

  // Calculate stats - use staff data if available, otherwise use regular data
  const stats = useMemo(() => {
    // Staff context - use edge function data (nested structure)
    if (inStaffContext && staffHeroData?.stats) {
      return {
        workingListCount: staffHeroData.stats.workingListCount ?? 0,
        atRiskPremium: staffHeroData.stats.atRiskPremium ?? 0,
        savedPremium: staffHeroData.stats.savedPremium ?? 0,
      };
    }

    // Regular user context
    if (!allRecords) {
      return {
        workingListCount: 0,
        atRiskPremium: 0,
        savedPremium: 0,
      };
    }

    // allRecords already filtered to new/in_progress only
    return {
      workingListCount: allRecords.length,
      atRiskPremium: allRecords.reduce((sum, r) => sum + (r.premium_cents || 0), 0),
      savedPremium: currentWeekSaved || 0,
    };
  }, [inStaffContext, staffHeroData, allRecords, currentWeekSaved]);

  // Calculate week-over-week changes
  const weekOverWeek = useMemo(() => {
    // Staff context - use edge function data (nested structure)
    if (inStaffContext && staffHeroData?.weekOverWeek) {
      return {
        workingListChange: Math.round(staffHeroData.weekOverWeek.workingList?.change ?? 0),
        atRiskChange: Math.round(staffHeroData.weekOverWeek.atRisk?.change ?? 0),
        savedChange: Math.round(staffHeroData.weekOverWeek.saved?.change ?? 0),
      };
    }

    // Regular user context
    const currentCount = currentWeekData?.length || 0;
    const priorCount = priorWeekData?.length || 0;

    // Queries already filter to new/in_progress only
    const currentAtRisk = currentWeekData
      ?.reduce((sum, r) => sum + (r.premium_cents || 0), 0) || 0;
    const priorAtRisk = priorWeekData
      ?.reduce((sum, r) => sum + (r.premium_cents || 0), 0) || 0;

    const calcChange = (current: number, prior: number) => {
      if (prior === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prior) / prior) * 100);
    };

    return {
      workingListChange: calcChange(currentCount, priorCount),
      atRiskChange: calcChange(currentAtRisk, priorAtRisk),
      savedChange: calcChange(currentWeekSaved || 0, priorWeekSaved || 0),
    };
  }, [inStaffContext, staffHeroData, currentWeekData, priorWeekData, currentWeekSaved, priorWeekSaved]);

  // Determine loading state based on context
  const isLoading = inStaffContext
    ? loadingStaffData
    : (loadingCurrent || loadingPrior || loadingAll || loadingCurrentSaved || loadingPriorSaved);

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
      <Card
        className="border-border cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setSavedPaymentsOpen(true)}
      >
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

      {/* Saved Payments Dialog */}
      <SavedPaymentsDialog
        open={savedPaymentsOpen}
        onOpenChange={setSavedPaymentsOpen}
        agencyId={agencyId}
        weekStart={format(currentWeekStart, 'yyyy-MM-dd')}
        weekEnd={format(currentWeekEnd, 'yyyy-MM-dd')}
      />
    </div>
  );
}
