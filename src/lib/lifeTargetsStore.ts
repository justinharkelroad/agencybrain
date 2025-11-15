import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuarterlyTargets } from '@/hooks/useQuarterlyTargets';
import type { MeasurabilityAnalysis } from '@/hooks/useTargetMeasurability';
import type { MonthlyMissionsOutput } from '@/hooks/useMonthlyMissions';
import type { DailyActionsOutput } from '@/hooks/useDailyActions';

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
type FlowStep = 'targets' | 'missions' | 'primary' | 'actions' | 'complete';

interface LifeTargetsState {
  currentQuarter: Quarter;
  currentStep: FlowStep;
  targets: QuarterlyTargets | null;
  measurabilityResults: MeasurabilityAnalysis | null;
  monthlyMissions: MonthlyMissionsOutput | null;
  dailyActions: DailyActionsOutput | null;
  isLoading: boolean;

  // Actions
  setCurrentQuarter: (quarter: Quarter) => void;
  setCurrentStep: (step: FlowStep) => void;
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
      currentStep: 'targets',
      targets: null,
      measurabilityResults: null,
      monthlyMissions: null,
      dailyActions: null,
      isLoading: false,

      setCurrentQuarter: (quarter) => set({ currentQuarter: quarter }),
      setCurrentStep: (step) => set({ currentStep: step }),
      setTargets: (targets) => set({ targets }),
      setMeasurabilityResults: (results) => set({ measurabilityResults: results }),
      setMonthlyMissions: (missions) => set({ monthlyMissions: missions }),
      setDailyActions: (actions) => set({ dailyActions: actions }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      reset: () => set({
        currentStep: 'targets',
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
        currentStep: state.currentStep,
        targets: state.targets,
        measurabilityResults: state.measurabilityResults,
        monthlyMissions: state.monthlyMissions,
        dailyActions: state.dailyActions,
      }),
    }
  )
);
