import { type CellAddr } from "../bonus_grid_web_spec/computeWithRounding";
import { supabase } from '@/lib/supabaseClient';
import { DataValidator, type DataIntegrityReport } from "./dataValidation";
import { DataBackupManager } from "./dataBackup";

const STORAGE_KEY = "bonusGrid:inputs-v1";
const LEGACY_STORAGE_KEY = "bonusGrid:inputs-v1"; // For recovery

export interface GridValidation {
  isValid: boolean;
  isSaved: boolean;
  hasRequiredValues: boolean;
  integrityReport?: DataIntegrityReport;
}

export interface SaveResult {
  success: boolean;
  error?: string;
  dataIntegrityReport?: DataIntegrityReport;
}

let cachedState: Record<CellAddr, any> | null = null;
let lastSaveTime = 0;
let saveAttempts = 0;
const MAX_SAVE_ATTEMPTS = 3;

export async function getBonusGridState(): Promise<Record<CellAddr, any> | null> {
  // Try to get from database first
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('bonus_grid_saves')
        .select('grid_data')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!error && data && Object.keys(data.grid_data).length > 0) {
        const validatedData = DataValidator.sanitizeGridData(data.grid_data as Record<CellAddr, any>);
        cachedState = validatedData;
        return validatedData;
      }
    }
  } catch (error) {
    console.log('Database fetch failed, trying localStorage:', error);
  }

  // Try legacy localStorage recovery
  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyState = JSON.parse(legacyRaw);
      if (Object.keys(legacyState).length > 0) {
        console.log('Found legacy localStorage data, migrating...');
        const validatedData = DataValidator.sanitizeGridData(legacyState);
        
        // Create backup before migration
        DataBackupManager.createPeriodicBackup(validatedData);
        
        // Attempt to migrate to database
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from('bonus_grid_saves')
              .upsert({
                user_id: user.id,
                grid_data: validatedData,
                updated_at: new Date().toISOString()
              });
            console.log('Successfully migrated legacy data to database');
          }
        } catch (migrationError) {
          console.error('Failed to migrate legacy data:', migrationError);
        }
        
        cachedState = validatedData;
        return validatedData;
      }
    }
  } catch (error) {
    console.error('Failed to recover legacy data:', error);
  }

  // Fallback to current localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const localState = raw ? JSON.parse(raw) : null;
    if (localState && Object.keys(localState).length > 0) {
      const validatedData = DataValidator.sanitizeGridData(localState);
      cachedState = validatedData;
      return validatedData;
    }
  } catch (error) {
    console.error('Failed to read localStorage:', error);
  }

  return null;
}

export function getBonusGridStateSync(): Record<CellAddr, any> | null {
  // Return cached state for synchronous operations
  if (cachedState) return cachedState;
  
  // Fallback to localStorage for immediate sync access
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveBonusGridState(state: Record<CellAddr, any>): Promise<SaveResult> {
  saveAttempts++;
  
  // Pre-save validation
  const integrityReport = DataValidator.createIntegrityReport(state);
  if (!integrityReport.validation.isValid && integrityReport.criticalIssues.length > 0) {
    console.warn('Attempting to save data with critical issues:', integrityReport.criticalIssues);
  }

  // Sanitize data before saving
  const sanitizedState = DataValidator.sanitizeGridData(state);
  
  // Update cache
  cachedState = sanitizedState;
  
  // Create backup before saving
  try {
    DataBackupManager.createPeriodicBackup(sanitizedState);
  } catch (backupError) {
    console.warn('Failed to create backup:', backupError);
  }
  
  // Save to localStorage for immediate access (multiple fallbacks)
  const localSavePromises = [
    // Primary localStorage save
    new Promise<void>((resolve, reject) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedState));
        resolve();
      } catch (error) {
        reject(error);
      }
    }),
    // Secondary localStorage save with different key
    new Promise<void>((resolve, reject) => {
      try {
        localStorage.setItem(`${STORAGE_KEY}:backup`, JSON.stringify(sanitizedState));
        resolve();
      } catch (error) {
        reject(error);
      }
    })
  ];

  try {
    await Promise.allSettled(localSavePromises);
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }

  // Debounce database saves to avoid excessive requests
  const now = Date.now();
  if (now - lastSaveTime < 1000 && saveAttempts < MAX_SAVE_ATTEMPTS) {
    return { success: true, dataIntegrityReport: integrityReport };
  }
  lastSaveTime = now;

  // Save to database with retry logic
  let dbSaveSuccess = false;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_SAVE_ATTEMPTS; attempt++) {
    try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
          .from('bonus_grid_saves')
          .upsert({
            user_id: user.id,
            grid_data: sanitizedState,
            updated_at: new Date().toISOString()
          });

        if (error) {
          throw new Error(error.message);
        }

        // Verify the save was successful
        const { data: savedData, error: verifyError } = await supabase
          .from('bonus_grid_saves')  
          .select('grid_data')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!verifyError && savedData) {
          const savedChecksum = DataBackupManager.createChecksum(savedData.grid_data as Record<CellAddr, any>);
          const originalChecksum = DataBackupManager.createChecksum(sanitizedState);
          
          if (savedChecksum === originalChecksum) {
            dbSaveSuccess = true;
            break;
          } else {
            throw new Error('Data integrity verification failed after save');
          }
        }
      }
    } catch (error) {
      console.error(`Database save attempt ${attempt} failed:`, error);
      lastError = error instanceof Error ? error.message : 'Unknown error';
      
      if (attempt < MAX_SAVE_ATTEMPTS) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // Reset save attempts on successful save
  if (dbSaveSuccess) {
    saveAttempts = 0;
  }

  return {
    success: dbSaveSuccess,
    error: dbSaveSuccess ? undefined : lastError,
    dataIntegrityReport: integrityReport
  };
}

export async function recoverFromSnapshot(snapshotId: string): Promise<Record<CellAddr, any> | null> {
  try {
    const { data, error } = await supabase
      .from('snapshot_planner')
      .select('tiers')
      .eq('id', snapshotId)
      .single();
    
    if (error || !data?.tiers) return null;
    
    // Extract grid data from the snapshot tiers
    const gridData: Record<CellAddr, any> = {};
    const tiers = data.tiers as any[];
    
    // Map snapshot data back to grid format - use oldMonthlyItems as the growth goal
    tiers.forEach((tier, index) => {
      const row = 38 + index;
      gridData[`Sheet1!C${row}` as CellAddr] = tier.oldMonthlyItems || 0; // Growth Goal
      gridData[`Sheet1!J${row}` as CellAddr] = tier.oldMonthlyItems || 0; // Monthly Items Needed
    });
    
    return gridData;
  } catch (error) {
    console.error('Failed to recover from snapshot:', error);
    return null;
  }
}

export async function getLatestSnapshotForRecovery(): Promise<{id: string, snapshot_date: string} | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('snapshot_planner')
      .select('id, snapshot_date')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    return data || null;
  } catch (error) {
    console.error('Failed to get latest snapshot:', error);
    return null;
  }
}

export async function getGridValidation(): Promise<GridValidation> {
  const state = await getBonusGridState();
  if (!state) {
    return { 
      isValid: false, 
      isSaved: false, 
      hasRequiredValues: false,
      integrityReport: undefined
    };
  }
  
  // Create comprehensive integrity report
  const integrityReport = DataValidator.createIntegrityReport(state);
  
  // Check if state has any meaningful data at all
  const hasAnyData = Object.keys(state).length > 0;
  if (!hasAnyData) {
    return { 
      isValid: false, 
      isSaved: false, 
      hasRequiredValues: false,
      integrityReport
    };
  }
  
  // Check if required Growth Goal values (C38-C44) exist and are valid numbers > 0
  const requiredAddrs = [38, 39, 40, 41, 42, 43, 44].map(r => `Sheet1!C${r}` as CellAddr);
  const hasRequiredValues = requiredAddrs.every(addr => {
    const val = state[addr];
    const numVal = Number(val);
    return val !== undefined && val !== null && val !== "" && !isNaN(numVal) && numVal > 0;
  });
  
  // Check if data is saved to database
  let isSaved = false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('bonus_grid_saves')
        .select('id, updated_at, grid_data')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      if (data) {
        // Verify data integrity in database
        const dbChecksum = DataBackupManager.createChecksum(data.grid_data as Record<CellAddr, any>);
        const currentChecksum = DataBackupManager.createChecksum(state);
        isSaved = dbChecksum === currentChecksum;
      }
    }
  } catch (error) {
    console.error('Failed to check save status:', error);
    isSaved = false;
  }
  
  return {
    isValid: hasRequiredValues && integrityReport.validation.isValid,
    isSaved,
    hasRequiredValues,
    integrityReport
  };
}

export function getMonthlyItemsNeeded(): number[] {
  const state = getBonusGridStateSync();
  if (!state) return [];
  
  // Extract J38-J44 values (Monthly Items Needed)
  const monthlyItems = [38, 39, 40, 41, 42, 43, 44].map(r => {
    const addr = `Sheet1!J${r}` as CellAddr;
    return state[addr] || 0;
  });
  
  return monthlyItems;
}

export function getPointsItemsMix(): number | undefined {
  const state = getBonusGridStateSync();
  if (!state) return undefined;
  
  // Extract M25 value (Points/Items Mix)
  const m25 = state["Sheet1!M25" as CellAddr];
  return typeof m25 === 'number' ? m25 : undefined;
}

export function getBonusPercentages(): number[] {
  const state = getBonusGridStateSync();
  if (!state) return [];
  
  // Extract H38-H44 values (Bonus Percentages)
  const bonusPercentages = [38, 39, 40, 41, 42, 43, 44].map(r => {
    const addr = `Sheet1!H${r}` as CellAddr;
    return state[addr] || 0;
  });
  
  return bonusPercentages;
}