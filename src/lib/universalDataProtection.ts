import { supabase } from '@/integrations/supabase/client';
import { type CellAddr } from '../bonus_grid_web_spec/computeWithRounding';

export interface UniversalBackupMetadata {
  version: string;
  timestamp: string;
  source: 'manual' | 'auto' | 'recovery';
  formType: 'submit' | 'marketing-calculator' | 'roi-forecasters' | 'vendor-verifier' | 'bonus-grid' | 'file-upload' | 'admin' | 'agency';
  dataSize: number;
  checksum: string;
  userId?: string;
}

export interface UniversalDataBackup<T = any> {
  metadata: UniversalBackupMetadata;
  formData: T;
}

export interface UniversalValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number; // 0-1 score
  criticalIssues: string[];
}

export interface UniversalDataProtectionStatus {
  isHealthy: boolean;
  lastBackup: string | null;
  backupCount: number;
  autoBackupEnabled: boolean;
  syncStatus: 'synced' | 'pending' | 'failed' | 'offline';
  lastValidated: string | null;
}

export class UniversalDataProtectionService {
  private static readonly MAX_BACKUPS = 50;
  private static readonly BACKUP_PREFIX = 'universal-backup-';
  private static readonly STATUS_KEY = 'universal-protection-status';

  // Create checksum for any data type
  static createChecksum<T>(data: T): string {
    const jsonStr = JSON.stringify(data, Object.keys(data as any).sort());
    let hash = 0;
    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // Create backup for any form type
  static createBackup<T>(
    formData: T, 
    formType: UniversalBackupMetadata['formType'],
    source: UniversalBackupMetadata['source'] = 'manual',
    userId?: string
  ): UniversalDataBackup<T> {
    return {
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        source,
        formType,
        dataSize: JSON.stringify(formData).length,
        checksum: this.createChecksum(formData),
        userId
      },
      formData
    };
  }

  // Save backup to localStorage with form type separation
  static saveBackupToStorage<T>(backup: UniversalDataBackup<T>): void {
    try {
      const storageKey = `${this.BACKUP_PREFIX}${backup.metadata.formType}-${backup.metadata.timestamp}`;
      localStorage.setItem(storageKey, JSON.stringify(backup));
      this.cleanupOldBackups(backup.metadata.formType);
      this.updateProtectionStatus(backup.metadata.formType, {
        lastBackup: backup.metadata.timestamp,
        isHealthy: true
      });
    } catch (error) {
      console.error('Failed to save backup to localStorage:', error);
    }
  }

  // Get all backups for a specific form type
  static getBackupsFromStorage<T>(formType: UniversalBackupMetadata['formType']): UniversalDataBackup<T>[] {
    const backups: UniversalDataBackup<T>[] = [];
    const prefix = `${this.BACKUP_PREFIX}${formType}-`;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        try {
          const backup = JSON.parse(localStorage.getItem(key) || '');
          if (this.validateBackup(backup)) {
            backups.push(backup);
          }
        } catch (error) {
          console.error(`Failed to parse backup ${key}:`, error);
        }
      }
    }
    
    return backups.sort((a, b) => new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime());
  }

  // Clean up old backups for specific form type
  static cleanupOldBackups(formType: UniversalBackupMetadata['formType']): void {
    const backups = this.getBackupsFromStorage(formType);
    if (backups.length > this.MAX_BACKUPS) {
      const toDelete = backups.slice(this.MAX_BACKUPS);
      toDelete.forEach(backup => {
        const key = `${this.BACKUP_PREFIX}${formType}-${backup.metadata.timestamp}`;
        localStorage.removeItem(key);
      });
    }
  }

  // Validate backup integrity
  static validateBackup<T>(backup: UniversalDataBackup<T>): boolean {
    try {
      if (!backup.metadata || !backup.formData) return false;
      const expectedChecksum = this.createChecksum(backup.formData);
      return expectedChecksum === backup.metadata.checksum;
    } catch (error) {
      return false;
    }
  }

  // Export data to file
  static exportToFile<T>(
    formData: T, 
    formType: UniversalBackupMetadata['formType'], 
    filename?: string
  ): void {
    try {
      const backup = this.createBackup(formData, formType, 'manual');
      const dataStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `${formType}-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  // Import data from file with validation
  static async importFromFile<T>(formType: UniversalBackupMetadata['formType']): Promise<T | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          const text = await file.text();
          const backup: UniversalDataBackup<T> = JSON.parse(text);
          
          // Validate backup
          if (!this.validateBackup(backup)) {
            console.error('Invalid backup file');
            resolve(null);
            return;
          }

          // Check if form type matches (optional - could allow cross-form imports)
          if (backup.metadata.formType !== formType) {
            console.warn(`Importing ${backup.metadata.formType} data into ${formType} form`);
          }

          resolve(backup.formData);
        } catch (error) {
          console.error('Failed to import backup:', error);
          resolve(null);
        }
      };
      
      input.click();
    });
  }

  // Save to database with retry logic
  static async saveToDatabase<T>(
    formData: T,
    formType: UniversalBackupMetadata['formType'],
    tableName: string,
    userId: string,
    additionalFields: Record<string, any> = {}
  ): Promise<{ success: boolean; error?: string }> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Create backup before saving
        const backup = this.createBackup(formData, formType, 'auto', userId);
        this.saveBackupToStorage(backup);

        const saveData = {
          user_id: userId,
          form_data: formData,
          updated_at: new Date().toISOString(),
          ...additionalFields
        };

        const { error } = await supabase
          .from(tableName)
          .upsert(saveData);

        if (error) {
          throw error;
        }

        this.updateProtectionStatus(formType, {
          syncStatus: 'synced',
          isHealthy: true
        });

        return { success: true };
      } catch (error) {
        attempt++;
        console.error(`Database save attempt ${attempt} failed:`, error);
        
        if (attempt >= maxRetries) {
          this.updateProtectionStatus(formType, {
            syncStatus: 'failed',
            isHealthy: false
          });
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  // Universal validation for any form data
  static validateFormData<T>(
    formData: T,
    formType: UniversalBackupMetadata['formType'],
    customValidation?: (data: T) => UniversalValidationResult
  ): UniversalValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let completeness = 0;

    try {
      // Basic validation
      if (!formData) {
        errors.push('Form data is empty');
        return { isValid: false, errors, warnings, completeness: 0, criticalIssues: errors };
      }

      // Calculate completeness based on populated fields
      const dataStr = JSON.stringify(formData);
      const totalFields = (dataStr.match(/:/g) || []).length;
      const emptyFields = (dataStr.match(/:""|:null|:0/g) || []).length;
      completeness = totalFields > 0 ? Math.max(0, (totalFields - emptyFields) / totalFields) : 0;

      // Form-specific validation
      if (customValidation) {
        const customResult = customValidation(formData);
        errors.push(...customResult.errors);
        warnings.push(...customResult.warnings);
        completeness = Math.min(completeness, customResult.completeness);
      }

      // Size check
      if (dataStr.length > 1024 * 1024) { // 1MB limit
        warnings.push('Form data is unusually large');
      }

      const criticalIssues = errors.filter(error => 
        error.includes('required') || error.includes('critical') || error.includes('empty')
      );

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        completeness,
        criticalIssues
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Validation failed: ' + (error instanceof Error ? error.message : 'Unknown error')],
        warnings,
        completeness: 0,
        criticalIssues: ['Validation failed']
      };
    }
  }

  // Update protection status
  static updateProtectionStatus(
    formType: UniversalBackupMetadata['formType'],
    updates: Partial<UniversalDataProtectionStatus>
  ): void {
    try {
      const statusKey = `${this.STATUS_KEY}-${formType}`;
      const currentStatus = this.getProtectionStatus(formType);
      const newStatus = { ...currentStatus, ...updates };
      localStorage.setItem(statusKey, JSON.stringify(newStatus));
    } catch (error) {
      console.error('Failed to update protection status:', error);
    }
  }

  // Get protection status
  static getProtectionStatus(formType: UniversalBackupMetadata['formType']): UniversalDataProtectionStatus {
    try {
      const statusKey = `${this.STATUS_KEY}-${formType}`;
      const status = localStorage.getItem(statusKey);
      if (status) {
        return JSON.parse(status);
      }
    } catch (error) {
      console.error('Failed to get protection status:', error);
    }

    return {
      isHealthy: true,
      lastBackup: null,
      backupCount: 0,
      autoBackupEnabled: true,
      syncStatus: 'offline',
      lastValidated: null
    };
  }

  // Create periodic auto-backup
  static createPeriodicBackup<T>(
    formData: T,
    formType: UniversalBackupMetadata['formType'],
    userId?: string
  ): void {
    try {
      const backup = this.createBackup(formData, formType, 'auto', userId);
      this.saveBackupToStorage(backup);
    } catch (error) {
      console.error('Failed to create periodic backup:', error);
    }
  }

  // Recovery method - get most recent valid backup
  static recoverLatestBackup<T>(formType: UniversalBackupMetadata['formType']): T | null {
    const backups = this.getBackupsFromStorage<T>(formType);
    for (const backup of backups) {
      if (this.validateBackup(backup)) {
        return backup.formData;
      }
    }
    return null;
  }

  // Data comparison for detecting changes
  static hasDataChanged<T>(oldData: T, newData: T): boolean {
    return this.createChecksum(oldData) !== this.createChecksum(newData);
  }
}