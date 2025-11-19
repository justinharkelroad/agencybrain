import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuarterlyTargets } from '@/hooks/useQuarterlyTargets';
import type { MeasurabilityAnalysis } from '@/hooks/useTargetMeasurability';
import type { MonthlyMissionsOutput } from '@/hooks/useMonthlyMissions';
import type { DailyActionsOutput } from '@/hooks/useDailyActions';
import { getCurrentQuarter as getQuarterFromUtils, migrateOldFormat } from './quarterUtils';
import { isValidUUID } from '@/lib/utils';


type Quarter = string; // YYYY-QX format (e.g., "2026-Q1")
type FlowStep = 'brainstorm' | 'selection' | 'targets' | 'missions' | 'primary' | 'actions' | 'complete';

interface LifeTargetsState {
  currentQuarter: Quarter;
  currentStep: FlowStep;
  currentSessionId: string | null;
  targets: QuarterlyTargets | null;
  measurabilityResults: MeasurabilityAnalysis | null;
  monthlyMissions: MonthlyMissionsOutput | null;
  dailyActions: DailyActionsOutput | null;
  selectedDailyActions: Record<string, string[]>; // GATE 3: Temporary multi-select storage
  isLoading: boolean;

  // Actions
  setCurrentQuarter: (quarter: Quarter) => void;
  changeQuarter: (quarter: Quarter) => void;
  setCurrentStep: (step: FlowStep) => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  setTargets: (targets: QuarterlyTargets | null) => void;
  setMeasurabilityResults: (results: MeasurabilityAnalysis | null) => void;
  setMonthlyMissions: (missions: MonthlyMissionsOutput | null) => void;
  setDailyActions: (actions: DailyActionsOutput | null) => void;
  setSelectedDailyActions: (selected: Record<string, string[]>) => void;
  setIsLoading: (loading: boolean) => void;
  clearTransientData: () => void;
  reset: () => void;
}

// No longer needed - using quarterUtils.getCurrentQuarter()

export const useLifeTargetsStore = create<LifeTargetsState>()(
  persist(
    (set, get) => ({
      currentQuarter: getQuarterFromUtils(),
      currentStep: 'targets',
      currentSessionId: null,
      targets: null,
      measurabilityResults: null,
      monthlyMissions: null,
      dailyActions: null,
      selectedDailyActions: { body: [], being: [], balance: [], business: [] }, // GATE 3
      isLoading: false,

  setCurrentQuarter: (quarter) => set({ currentQuarter: quarter }),
  changeQuarter: (quarter) => set({ currentQuarter: quarter }), // Relabel only, keep all data
  setCurrentStep: (step) => set({ currentStep: step }),
      setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),
      setTargets: (targets) => set({ targets }),
      setMeasurabilityResults: (results) => set({ measurabilityResults: results }),
      setMonthlyMissions: (missions) => set({ monthlyMissions: missions }),
      setDailyActions: (actions) => set({ dailyActions: actions }),
  setSelectedDailyActions: (selected) => set({ selectedDailyActions: selected }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  clearTransientData: () => set({
    measurabilityResults: null,
  }),
  reset: () => set({
        currentStep: 'targets',
        currentSessionId: null,
        targets: null,
        measurabilityResults: null,
        monthlyMissions: null,
        dailyActions: null,
        selectedDailyActions: { body: [], being: [], balance: [], business: [] },
        isLoading: false,
      }),
    }),
    {
      name: 'life-targets-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        // v1 -> v2: ensure valid session id and migrate quarter format
        if (!persistedState) return persistedState;
        if (version < 1 && persistedState?.currentQuarter) {
          persistedState.currentQuarter = migrateOldFormat(persistedState.currentQuarter);
        }
        const sid = persistedState?.currentSessionId as string | null | undefined;
        if (sid && !isValidUUID(sid)) {
          persistedState.currentSessionId = null;
        }
        return persistedState;
      },
      partialize: (state) => ({
        currentQuarter: state.currentQuarter,
        currentStep: state.currentStep,
        currentSessionId: state.currentSessionId,
        targets: state.targets,
        measurabilityResults: state.measurabilityResults,
        monthlyMissions: state.monthlyMissions,
        dailyActions: state.dailyActions,
        selectedDailyActions: state.selectedDailyActions, // GATE 3
      }),
    }
  )
);
