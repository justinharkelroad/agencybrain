import { type CellAddr } from "../bonus_grid_web_spec/computeWithRounding";

const STORAGE_KEY = "bonusGrid:inputs-v1";

export interface GridValidation {
  isValid: boolean;
  isSaved: boolean;
  hasRequiredValues: boolean;
}

export function getBonusGridState(): Record<CellAddr, any> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getGridValidation(): GridValidation {
  const state = getBonusGridState();
  if (!state) {
    return { isValid: false, isSaved: false, hasRequiredValues: false };
  }
  
  // Check if required Growth Goal values (C38-C44) exist and are valid
  const requiredAddrs = [38, 39, 40, 41, 42, 43, 44].map(r => `Sheet1!C${r}` as CellAddr);
  const hasRequiredValues = requiredAddrs.every(addr => {
    const val = state[addr];
    return val !== undefined && val !== null && val !== "" && !isNaN(Number(val));
  });
  
  // For now, assume saved status based on the presence of data
  // In a full implementation, this would check against a saved signature
  const isSaved = hasRequiredValues;
  
  return {
    isValid: hasRequiredValues,
    isSaved,
    hasRequiredValues,
  };
}

export function getMonthlyItemsNeeded(): number[] {
  const state = getBonusGridState();
  if (!state) return [];
  
  // Extract J38-J44 values (Monthly Items Needed)
  const monthlyItems = [38, 39, 40, 41, 42, 43, 44].map(r => {
    const addr = `Sheet1!J${r}` as CellAddr;
    return state[addr] || 0;
  });
  
  return monthlyItems;
}

export function getPointsItemsMix(): number | undefined {
  const state = getBonusGridState();
  if (!state) return undefined;
  
  // Extract M25 value (Points/Items Mix)
  const m25 = state["Sheet1!M25" as CellAddr];
  return typeof m25 === 'number' ? m25 : undefined;
}