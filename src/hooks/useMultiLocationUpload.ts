import { useState, useCallback } from 'react';

export interface LocationUpload {
  id: number;
  agentNumber: string;
  file: File | null;
  fileName: string;
  status: 'empty' | 'uploading' | 'parsed' | 'error';
  error?: string;
  transactionCount?: number;
}

interface MultiLocationState {
  locationCount: number;
  priorPeriod: LocationUpload[];
  currentPeriod: LocationUpload[];
}

const createEmptyLocation = (id: number): LocationUpload => ({
  id,
  agentNumber: '',
  file: null,
  fileName: '',
  status: 'empty'
});

const createLocations = (count: number): LocationUpload[] => {
  return Array.from({ length: count }, (_, i) => createEmptyLocation(i + 1));
};

export function useMultiLocationUpload() {
  const [state, setState] = useState<MultiLocationState>({
    locationCount: 1,
    priorPeriod: [createEmptyLocation(1)],
    currentPeriod: [createEmptyLocation(1)]
  });

  const setLocationCount = useCallback((count: number) => {
    setState(current => {
      const newPrior = createLocations(count);
      const newCurrent = createLocations(count);
      
      // Preserve existing uploads where possible
      current.priorPeriod.forEach((loc, i) => {
        if (i < count && loc.file) {
          newPrior[i] = { ...loc };
        }
      });
      current.currentPeriod.forEach((loc, i) => {
        if (i < count && loc.file) {
          newCurrent[i] = { ...loc };
        }
      });
      
      return {
        locationCount: count,
        priorPeriod: newPrior,
        currentPeriod: newCurrent
      };
    });
  }, []);

  const setLocationFile = useCallback((
    period: 'prior' | 'current',
    locationId: number,
    file: File | null,
    agentNumber?: string
  ) => {
    setState(current => {
      const key = period === 'prior' ? 'priorPeriod' : 'currentPeriod';
      const updated = current[key].map(loc => {
        if (loc.id === locationId) {
          return {
            ...loc,
            file,
            fileName: file?.name || '',
            agentNumber: agentNumber || loc.agentNumber,
            status: file ? 'uploading' as const : 'empty' as const
          };
        }
        return loc;
      });
      return { ...current, [key]: updated };
    });
  }, []);

  const setLocationParsed = useCallback((
    period: 'prior' | 'current',
    locationId: number,
    agentNumber: string,
    transactionCount: number
  ) => {
    setState(current => {
      const key = period === 'prior' ? 'priorPeriod' : 'currentPeriod';
      const updated = current[key].map(loc => {
        if (loc.id === locationId) {
          return {
            ...loc,
            agentNumber,
            transactionCount,
            status: 'parsed' as const
          };
        }
        return loc;
      });
      return { ...current, [key]: updated };
    });
  }, []);

  const setLocationError = useCallback((
    period: 'prior' | 'current',
    locationId: number,
    error: string
  ) => {
    setState(current => {
      const key = period === 'prior' ? 'priorPeriod' : 'currentPeriod';
      const updated = current[key].map(loc => {
        if (loc.id === locationId) {
          return {
            ...loc,
            status: 'error' as const,
            error
          };
        }
        return loc;
      });
      return { ...current, [key]: updated };
    });
  }, []);

  const clearLocation = useCallback((
    period: 'prior' | 'current',
    locationId: number
  ) => {
    setState(current => {
      const key = period === 'prior' ? 'priorPeriod' : 'currentPeriod';
      const updated = current[key].map(loc => {
        if (loc.id === locationId) {
          return createEmptyLocation(locationId);
        }
        return loc;
      });
      return { ...current, [key]: updated };
    });
  }, []);

  const resetAll = useCallback(() => {
    setState({
      locationCount: 1,
      priorPeriod: [createEmptyLocation(1)],
      currentPeriod: [createEmptyLocation(1)]
    });
  }, []);

  // Computed values
  const hasAllCurrentUploads = state.currentPeriod.every(loc => loc.status === 'parsed');
  const hasAnyPriorUploads = state.priorPeriod.some(loc => loc.status === 'parsed');
  const canGenerate = hasAllCurrentUploads;

  return {
    ...state,
    setLocationCount,
    setLocationFile,
    setLocationParsed,
    setLocationError,
    clearLocation,
    resetAll,
    hasAllCurrentUploads,
    hasAnyPriorUploads,
    canGenerate
  };
}
