import { type CellAddr } from "../bonus_grid_web_spec/computeWithRounding";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number; // 0-1 score
}

export interface DataIntegrityReport {
  validation: ValidationResult;
  hasRequiredFields: boolean;
  dataSize: number;
  lastValidated: string;
  criticalIssues: string[];
}

export class DataValidator {
  private static readonly REQUIRED_GROWTH_GOALS = [38, 39, 40, 41, 42, 43, 44].map(r => `Sheet1!C${r}` as CellAddr);
  private static readonly REQUIRED_BONUS_PERCENTAGES = [38, 39, 40, 41, 42, 43, 44].map(r => `Sheet1!H${r}` as CellAddr);
  private static readonly CRITICAL_FIELDS = [
    "Sheet1!M25", // Points/Items Mix
    ...DataValidator.REQUIRED_GROWTH_GOALS,
  ];

  static validateGridData(gridData: Record<CellAddr, any>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if grid is essentially empty (reset state) - don't flag as critical
    const totalValues = Object.values(gridData).filter(val => 
      val !== undefined && val !== null && val !== "" && val !== 0
    ).length;
    
    const isEmptyGrid = totalValues === 0;

    // Check for required Growth Goals only if grid has substantial data
    if (!isEmptyGrid) {
      const missingGrowthGoals = this.REQUIRED_GROWTH_GOALS.filter(addr => {
        const val = gridData[addr];
        const numVal = Number(val);
        return val === undefined || val === null || val === "" || isNaN(numVal) || numVal <= 0;
      });

      if (missingGrowthGoals.length > 0) {
        warnings.push(`Missing or invalid Growth Goals in cells: ${missingGrowthGoals.join(', ')}`);
      }
    }

    // Check for Points/Items Mix
    const pointsItemsMix = gridData["Sheet1!M25" as CellAddr];
    if (pointsItemsMix === undefined || pointsItemsMix === null || pointsItemsMix === "") {
      warnings.push("Points/Items Mix (M25) is not set");
    }

    // Check for negative values in critical fields
    const negativeValues = Object.entries(gridData).filter(([addr, val]) => {
      const numVal = Number(val);
      return !isNaN(numVal) && numVal < 0 && this.CRITICAL_FIELDS.includes(addr as CellAddr);
    });

    if (negativeValues.length > 0) {
      warnings.push(`Negative values found in: ${negativeValues.map(([addr]) => addr).join(', ')}`);
    }

    // Calculate completeness score
    const totalExpectedFields = 100; // Rough estimate of expected fields
    const populatedFields = Object.keys(gridData).filter(addr => {
      const val = gridData[addr as CellAddr];
      return val !== undefined && val !== null && val !== "";
    }).length;
    
    const completeness = Math.min(populatedFields / totalExpectedFields, 1);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness
    };
  }

  static createIntegrityReport(gridData: Record<CellAddr, any>): DataIntegrityReport {
    const validation = this.validateGridData(gridData);
    
    const hasRequiredFields = this.REQUIRED_GROWTH_GOALS.every(addr => {
      const val = gridData[addr];
      const numVal = Number(val);
      return val !== undefined && val !== null && val !== "" && !isNaN(numVal) && numVal > 0;
    });

    const criticalIssues = validation.errors;

    return {
      validation,
      hasRequiredFields,
      dataSize: Object.keys(gridData).length,
      lastValidated: new Date().toISOString(),
      criticalIssues
    };
  }

  static compareDataIntegrity(oldData: Record<CellAddr, any>, newData: Record<CellAddr, any>): {
    hasDataLoss: boolean;
    lostFields: string[];
    newFields: string[];
    modifiedFields: string[];
  } {
    const oldKeys = new Set(Object.keys(oldData));
    const newKeys = new Set(Object.keys(newData));

    const lostFields = Array.from(oldKeys).filter(key => !newKeys.has(key));
    const newFields = Array.from(newKeys).filter(key => !oldKeys.has(key));
    
    const modifiedFields = Array.from(newKeys).filter(key => 
      oldKeys.has(key) && oldData[key as CellAddr] !== newData[key as CellAddr]
    );

    return {
      hasDataLoss: lostFields.length > 0,
      lostFields,
      newFields,
      modifiedFields
    };
  }

  static sanitizeGridData(gridData: Record<CellAddr, any>): Record<CellAddr, any> {
    const sanitized: Record<CellAddr, any> = {};
    
    Object.entries(gridData).forEach(([addr, val]) => {
      // Keep non-empty values
      if (val !== undefined && val !== null && val !== "") {
        // Convert string numbers to numbers where appropriate
        if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') {
          sanitized[addr as CellAddr] = Number(val);
        } else {
          sanitized[addr as CellAddr] = val;
        }
      }
    });

    return sanitized;
  }
}
