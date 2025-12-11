import React, { createContext, useContext, useState, useCallback } from 'react';

interface PeriodRefreshContextType {
  refreshKey: number;
  triggerRefresh: () => void;
}

const PeriodRefreshContext = createContext<PeriodRefreshContextType | undefined>(undefined);

export function PeriodRefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <PeriodRefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </PeriodRefreshContext.Provider>
  );
}

export function usePeriodRefresh() {
  const context = useContext(PeriodRefreshContext);
  if (!context) {
    throw new Error('usePeriodRefresh must be used within a PeriodRefreshProvider');
  }
  return context;
}
