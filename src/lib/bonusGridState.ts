import { type CellAddr } from "../bonus_grid_web_spec/computeWithRounding";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "bonusGrid:inputs-v1";

export interface GridValidation {
  isValid: boolean;
  isSaved: boolean;
  hasRequiredValues: boolean;
}

let cachedState: Record<CellAddr, any> | null = null;
let lastSaveTime = 0;

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
      
      if (!error && data) {
        cachedState = data.grid_data;
        return data.grid_data;
      }
    }
  } catch (error) {
    console.log('Database fetch failed, trying localStorage:', error);
  }

  // Fallback to localStorage if database fails or user not authenticated
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const localState = raw ? JSON.parse(raw) : null;
    cachedState = localState;
    return localState;
  } catch {
    return null;
  }
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

export async function saveBonusGridState(state: Record<CellAddr, any>): Promise<void> {
  // Update cache
  cachedState = state;
  
  // Save to localStorage for immediate access
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }

  // Debounce database saves to avoid excessive requests
  const now = Date.now();
  if (now - lastSaveTime < 1000) {
    return;
  }
  lastSaveTime = now;

  // Save to database
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('bonus_grid_saves')
        .upsert({
          user_id: user.id,
          grid_data: state,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to save to database:', error);
      }
    }
  } catch (error) {
    console.error('Database save failed:', error);
  }
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
    return { isValid: false, isSaved: false, hasRequiredValues: false };
  }
  
  // Check if state has any meaningful data at all
  const hasAnyData = Object.keys(state).length > 0;
  if (!hasAnyData) {
    return { isValid: false, isSaved: false, hasRequiredValues: false };
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
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      isSaved = !!data;
    }
  } catch {
    isSaved = false;
  }
  
  return {
    isValid: hasRequiredValues,
    isSaved,
    hasRequiredValues,
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