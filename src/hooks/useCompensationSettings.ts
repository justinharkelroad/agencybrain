import { useState, useEffect } from 'react';

// States that don't allow variable compensation
export const NO_VC_STATES = ['NY', 'NJ', 'CA', 'CT', 'FL', 'MA'];

const STORAGE_KEY = 'compensation-analyzer-settings';

interface CompensationSettingsData {
  state: string;
  aapLevel: 'Elite' | 'Pro' | 'Emerging' | '';
  agencyTier: string;
  pifCount: number;
}

export function useCompensationSettings() {
  const [settings, setSettingsState] = useState<CompensationSettingsData>(() => {
    // Load from localStorage on init
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { state: '', aapLevel: '', agencyTier: '', pifCount: 0 };
      }
    }
    return { state: '', aapLevel: '', agencyTier: '', pifCount: 0 };
  });

  // Derived values
  const isNoVcState = NO_VC_STATES.includes(settings.state);
  const settingsConfigured = Boolean(settings.state && settings.aapLevel);

  // Save to localStorage whenever settings change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const setSettings = (newSettings: Partial<CompensationSettingsData>) => {
    setSettingsState(current => ({
      ...current,
      ...newSettings
    }));
  };

  return {
    ...settings,
    isNoVcState,
    settingsConfigured,
    setSettings
  };
}
