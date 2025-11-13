import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThetaTargets {
  body: string;
  being: string;
  balance: string;
  business: string;
}

interface ThetaTrackState {
  sessionId: string;
  currentStep: number;
  targets: ThetaTargets;
  affirmations: any[];
  selectedVoice: string | null;
  finalTrackId: string | null;
  
  // Actions
  setSessionId: (id: string) => void;
  setCurrentStep: (step: number) => void;
  setTargets: (targets: Partial<ThetaTargets>) => void;
  setAffirmations: (affirmations: any[]) => void;
  setSelectedVoice: (voice: string) => void;
  setFinalTrackId: (id: string) => void;
  resetSession: () => void;
}

export const useThetaStore = create<ThetaTrackState>()(
  persist(
    (set) => ({
      sessionId: '',
      currentStep: 1,
      targets: { body: '', being: '', balance: '', business: '' },
      affirmations: [],
      selectedVoice: null,
      finalTrackId: null,
      
      setSessionId: (id) => set({ sessionId: id }),
      setCurrentStep: (step) => set({ currentStep: step }),
      setTargets: (targets) => set((state) => ({ 
        targets: { ...state.targets, ...targets }
      })),
      setAffirmations: (affirmations) => set({ affirmations }),
      setSelectedVoice: (voice) => set({ selectedVoice: voice }),
      setFinalTrackId: (id) => set({ finalTrackId: id }),
      resetSession: () => set({
        sessionId: '',
        currentStep: 1,
        targets: { body: '', being: '', balance: '', business: '' },
        affirmations: [],
        selectedVoice: null,
        finalTrackId: null
      })
    }),
    {
      name: 'theta-track-session',
    }
  )
);
