import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type MissionPulsePeriod = Tables<'periods'>;

export interface MissionPulseLeadSource {
  name: string;
  spend: number;
  soldPremium?: number;
  commissionRate?: number;
}

export interface MissionPulseTeamMember {
  name: string;
  role: string;
}

export interface MissionPulseFormData {
  sales: {
    premium: number;
    items: number;
    policies: number;
    achievedVC: boolean;
  };
  marketing: {
    totalSpend: number;
    policiesQuoted: number;
    leadSources: MissionPulseLeadSource[];
  };
  operations: {
    currentAlrTotal: number;
    currentAapProjection: string;
    currentBonusTrend: number;
    teamRoster: MissionPulseTeamMember[];
  };
  retention: {
    numberTerminated: number;
    currentRetentionPercent: number;
  };
  cashFlow: {
    compensation: number;
    expenses: number;
    netProfit: number;
  };
  qualitative: {
    biggestStress: string;
    gutAction: string;
    biggestPersonalWin: string;
    biggestBusinessWin: string;
    attackItems: {
      item1: string;
      item2: string;
      item3: string;
    };
  };
}

const EMPTY_FORM: MissionPulseFormData = {
  sales: {
    premium: 0,
    items: 0,
    policies: 0,
    achievedVC: false,
  },
  marketing: {
    totalSpend: 0,
    policiesQuoted: 0,
    leadSources: [],
  },
  operations: {
    currentAlrTotal: 0,
    currentAapProjection: 'Emerging',
    currentBonusTrend: 0,
    teamRoster: [],
  },
  retention: {
    numberTerminated: 0,
    currentRetentionPercent: 0,
  },
  cashFlow: {
    compensation: 0,
    expenses: 0,
    netProfit: 0,
  },
  qualitative: {
    biggestStress: '',
    gutAction: '',
    biggestPersonalWin: '',
    biggestBusinessWin: '',
    attackItems: {
      item1: '',
      item2: '',
      item3: '',
    },
  },
};

function previousMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    title: `${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Pulse`,
    label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeLeadSources(value: unknown): MissionPulseLeadSource[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const source = entry as Record<string, unknown>;
      const name = normalizeString(source.name);
      if (!name) return null;

      return {
        name,
        spend: normalizeNumber(source.spend),
        soldPremium: normalizeNumber(source.soldPremium),
        commissionRate: normalizeNumber(source.commissionRate),
      };
    })
    .filter((entry): entry is MissionPulseLeadSource => Boolean(entry));
}

function normalizeTeamRoster(value: unknown): MissionPulseTeamMember[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const member = entry as Record<string, unknown>;
      const name = normalizeString(member.name);
      if (!name) return null;

      return {
        name,
        role: normalizeString(member.role) || 'Team member',
      };
    })
    .filter((entry): entry is MissionPulseTeamMember => Boolean(entry));
}

export function normalizeMissionPulseFormData(value: unknown): MissionPulseFormData {
  const payload = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const sales = payload.sales && typeof payload.sales === 'object' ? (payload.sales as Record<string, unknown>) : {};
  const marketing = payload.marketing && typeof payload.marketing === 'object' ? (payload.marketing as Record<string, unknown>) : {};
  const operations = payload.operations && typeof payload.operations === 'object' ? (payload.operations as Record<string, unknown>) : {};
  const retention = payload.retention && typeof payload.retention === 'object' ? (payload.retention as Record<string, unknown>) : {};
  const cashFlow = payload.cashFlow && typeof payload.cashFlow === 'object' ? (payload.cashFlow as Record<string, unknown>) : {};
  const qualitative = payload.qualitative && typeof payload.qualitative === 'object' ? (payload.qualitative as Record<string, unknown>) : {};
  const attackItems =
    qualitative.attackItems && typeof qualitative.attackItems === 'object'
      ? (qualitative.attackItems as Record<string, unknown>)
      : {};

  return {
    sales: {
      premium: normalizeNumber(sales.premium),
      items: normalizeNumber(sales.items),
      policies: normalizeNumber(sales.policies),
      achievedVC: Boolean(sales.achievedVC),
    },
    marketing: {
      totalSpend: normalizeNumber(marketing.totalSpend),
      policiesQuoted: normalizeNumber(marketing.policiesQuoted),
      leadSources: normalizeLeadSources(marketing.leadSources),
    },
    operations: {
      currentAlrTotal: normalizeNumber(operations.currentAlrTotal),
      currentAapProjection: normalizeString(operations.currentAapProjection) || 'Emerging',
      currentBonusTrend: normalizeNumber(operations.currentBonusTrend),
      teamRoster: normalizeTeamRoster(operations.teamRoster),
    },
    retention: {
      numberTerminated: normalizeNumber(retention.numberTerminated),
      currentRetentionPercent: normalizeNumber(retention.currentRetentionPercent),
    },
    cashFlow: {
      compensation: normalizeNumber(cashFlow.compensation),
      expenses: normalizeNumber(cashFlow.expenses),
      netProfit: normalizeNumber(cashFlow.netProfit),
    },
    qualitative: {
      biggestStress: normalizeString(qualitative.biggestStress),
      gutAction: normalizeString(qualitative.gutAction),
      biggestPersonalWin: normalizeString(qualitative.biggestPersonalWin),
      biggestBusinessWin: normalizeString(qualitative.biggestBusinessWin),
      attackItems: {
        item1: normalizeString(attackItems.item1),
        item2: normalizeString(attackItems.item2),
        item3: normalizeString(attackItems.item3),
      },
    },
  };
}

export function buildMissionPulseDraft(
  editablePeriod?: Pick<MissionPulsePeriod, 'form_data'> | null,
  latestPeriod?: Pick<MissionPulsePeriod, 'form_data'> | null
): MissionPulseFormData {
  if (editablePeriod?.form_data) {
    return normalizeMissionPulseFormData(editablePeriod.form_data);
  }

  const latest = latestPeriod?.form_data ? normalizeMissionPulseFormData(latestPeriod.form_data) : EMPTY_FORM;

  return {
    sales: {
      premium: 0,
      items: 0,
      policies: 0,
      achievedVC: false,
    },
    marketing: {
      totalSpend: 0,
      policiesQuoted: 0,
      leadSources: latest.marketing.leadSources.map((source) => ({
        name: source.name,
        spend: 0,
        soldPremium: 0,
        commissionRate: source.commissionRate ?? 0,
      })),
    },
    operations: {
      currentAlrTotal: 0,
      currentAapProjection: latest.operations.currentAapProjection || 'Emerging',
      currentBonusTrend: 0,
      teamRoster: latest.operations.teamRoster,
    },
    retention: {
      numberTerminated: 0,
      currentRetentionPercent: 0,
    },
    cashFlow: {
      compensation: 0,
      expenses: 0,
      netProfit: 0,
    },
    qualitative: {
      biggestStress: '',
      gutAction: '',
      biggestPersonalWin: '',
      biggestBusinessWin: '',
      attackItems: {
        item1: '',
        item2: '',
        item3: '',
      },
    },
  };
}

export function useMissionControlBusinessPulse(userId: string | null, enabled = true) {
  const queryClient = useQueryClient();
  const targetPeriod = useMemo(() => previousMonthRange(), []);

  const query = useQuery({
    queryKey: ['mission-control-business-pulse', userId],
    enabled: Boolean(enabled && userId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periods')
        .select('*')
        .eq('user_id', userId!)
        .not('form_data', 'is', null)
        .order('start_date', { ascending: false })
        .limit(12);

      if (error) throw error;
      return (data ?? []) as MissionPulsePeriod[];
    },
  });

  const periods = query.data ?? [];
  const latestPeriod = periods[0] ?? null;
  const previousPeriod = periods[1] ?? null;
  const editablePeriod =
    periods.find((period) => period.start_date === targetPeriod.startDate && period.end_date === targetPeriod.endDate) ?? null;

  const savePulse = useMutation({
    mutationFn: async (formData: MissionPulseFormData) => {
      if (!userId) {
        throw new Error('Missing user for pulse save.');
      }

      const normalized = normalizeMissionPulseFormData(formData);
      const netProfit = normalized.cashFlow.compensation - normalized.cashFlow.expenses;
      const payload = {
        user_id: userId,
        title: targetPeriod.title,
        start_date: targetPeriod.startDate,
        end_date: targetPeriod.endDate,
        status: editablePeriod?.status ?? 'active',
        form_data: {
          ...normalized,
          cashFlow: {
            ...normalized.cashFlow,
            netProfit,
          },
        },
      };

      if (editablePeriod?.id) {
        const { data, error } = await supabase
          .from('periods')
          .update(payload)
          .eq('id', editablePeriod.id)
          .select()
          .single();

        if (error) throw error;
        return data as MissionPulsePeriod;
      }

      const { data, error } = await supabase
        .from('periods')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data as MissionPulsePeriod;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mission-control-business-pulse', userId] });
    },
  });

  return useMemo(
    () => ({
      periods,
      latestPeriod,
      previousPeriod,
      editablePeriod,
      targetPeriod,
      savePulse,
      isLoading: query.isLoading,
      error: query.error ?? null,
    }),
    [
      editablePeriod,
      latestPeriod,
      periods,
      previousPeriod,
      query.error,
      query.isLoading,
      savePulse,
      targetPeriod,
    ]
  );
}
