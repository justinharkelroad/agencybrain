import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuarterlyTargets } from '@/hooks/useQuarterlyTargets';
import type { MeasurabilityAnalysis } from '@/hooks/useTargetMeasurability';
import type { MonthlyMissionsOutput } from '@/hooks/useMonthlyMissions';
import type { DailyActionsOutput } from '@/hooks/useDailyActions';

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

interface LifeTargetsState {
  currentQuarter: Quarter;
  targets: QuarterlyTargets | null;
  measurabilityResults: MeasurabilityAnalysis | null;
  monthlyMissions: MonthlyMissionsOutput | null;
  dailyActions: DailyActionsOutput | null;
  isLoading: boolean;

  // Actions
  setCurrentQuarter: (quarter: Quarter) => void;
  setTargets: (targets: QuarterlyTargets | null) => void;
  setMeasurabilityResults: (results: MeasurabilityAnalysis | null) => void;
  setMonthlyMissions: (missions: MonthlyMissionsOutput | null) => void;
  setDailyActions: (actions: DailyActionsOutput | null) => void;
  setIsLoading: (loading: boolean) => void;
  reset: () => void;
}

const getCurrentQuarter = (): Quarter => {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
};

export const useLifeTargetsStore = create<LifeTargetsState>()(
  persist(
    (set) => ({
      currentQuarter: getCurrentQuarter(),
      targets: null,
      measurabilityResults: null,
      monthlyMissions: null,
      dailyActions: null,
      isLoading: false,

      setCurrentQuarter: (quarter) => set({ currentQuarter: quarter }),
      setTargets: (targets) => set({ targets }),
      setMeasurabilityResults: (results) => set({ measurabilityResults: results }),
      setMonthlyMissions: (missions) => set({ monthlyMissions: missions }),
      setDailyActions: (actions) => set({ dailyActions: actions }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      reset: () => set({
        targets: null,
        measurabilityResults: null,
        monthlyMissions: null,
        dailyActions: null,
        isLoading: false,
      }),
    }),
    {
      name: 'life-targets-storage',
      partialize: (state) => ({
        currentQuarter: state.currentQuarter,
        targets: state.targets,
        measurabilityResults: state.measurabilityResults,
        monthlyMissions: state.monthlyMissions,
        dailyActions: state.dailyActions,
      }),
    }
  )
);
