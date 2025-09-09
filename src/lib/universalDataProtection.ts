import { supabase } from '@/lib/supabaseClient';

export interface DataProtectionSettings<T> {
  tableName: string;
  identifier: string;
  encryptionKey?: string;
  compressionEnabled?: boolean;
  backupEnabled?: boolean;
  retentionDays?: number;
}

// Additional types for universal data protection hook
export interface UniversalDataBackup<T> {
  formData: T;
  metadata: UniversalBackupMetadata;
}

export interface UniversalBackupMetadata {
  formType: string;
  timestamp: string;
  userId?: string;
  version?: string;
}

export interface UniversalDataProtectionStatus {
  isHealthy: boolean;
  lastBackup?: string;
  backupCount: number;
  autoBackupEnabled: boolean;
  syncStatus?: 'synced' | 'pending' | 'failed';
  lastValidated?: string;
}

export interface UniversalValidationResult {
  isValid: boolean;
  warnings: string[];
  criticalIssues: string[];
  completeness?: number;
}

// Universal Data Protection Service
export class UniversalDataProtectionService {
  static getProtectionStatus(formType: string): UniversalDataProtectionStatus {
    return {
      isHealthy: true,
      backupCount: 0,
      autoBackupEnabled: true
    };
  }

  static createPeriodicBackup<T>(formData: T, formType: string, userId?: string): void {
    // Local storage backup implementation
    const backup: UniversalDataBackup<T> = {
      formData,
      metadata: {
        formType,
        timestamp: new Date().toISOString(),
        userId,
        version: '1.0'
      }
    };
    
    const storageKey = `backup_${formType}`;
    const existing = localStorage.getItem(storageKey);
    const backups: UniversalDataBackup<T>[] = existing ? JSON.parse(existing) : [];
    backups.unshift(backup);
    
    // Keep only last 10 backups
    if (backups.length > 10) {
      backups.splice(10);
    }
    
    localStorage.setItem(storageKey, JSON.stringify(backups));
  }

  static getBackupsFromStorage<T>(formType: string): UniversalDataBackup<T>[] {
    const storageKey = `backup_${formType}`;
    const existing = localStorage.getItem(storageKey);
    return existing ? JSON.parse(existing) : [];
  }

  static validateBackup<T>(backup: UniversalDataBackup<T>): boolean {
    return !!(backup.formData && backup.metadata && backup.metadata.timestamp);
  }

  static exportToFile<T>(formData: T, formType: string): void {
    const backup: UniversalDataBackup<T> = {
      formData,
      metadata: {
        formType,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formType}_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static async importFromFile<T>(formType: string): Promise<T | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const backup = JSON.parse(e.target?.result as string) as UniversalDataBackup<T>;
            if (backup.metadata?.formType === formType && backup.formData) {
              resolve(backup.formData);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }

  static async saveToDatabase<T>(
    formData: T,
    formType: string,
    tableName: string,
    userId: string,
    additionalFields: Record<string, any> = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = {
        user_id: userId,
        form_data: formData,
        updated_at: new Date().toISOString(),
        ...additionalFields
      };

      const { error } = await supabase
        .from(tableName as any) // Type assertion for dynamic table names
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  static validateFormData<T>(
    formData: T,
    formType: string,
    validationRules?: (data: T) => UniversalValidationResult
  ): UniversalValidationResult {
    if (validationRules) {
      return validationRules(formData);
    }
    
    return {
      isValid: true,
      warnings: [],
      criticalIssues: []
    };
  }

  static hasDataChanged<T>(oldData: T, newData: T): boolean {
    return JSON.stringify(oldData) !== JSON.stringify(newData);
  }

  static recoverLatestBackup<T>(formType: string): T | null {
    const backups = this.getBackupsFromStorage<T>(formType);
    if (backups.length > 0 && this.validateBackup(backups[0])) {
      return backups[0].formData;
    }
    return null;
  }
}

export class UniversalDataProtection<T = any> {
  private settings: DataProtectionSettings<T>;

  constructor(settings: DataProtectionSettings<T>) {
    this.settings = {
      compressionEnabled: true,
      backupEnabled: true,
      retentionDays: 365,
      ...settings
    };
  }

  async save(userId: string, data: T): Promise<void> {
    try {
      const payload = {
        user_id: userId,
        form_data: data,
        updated_at: new Date().toISOString()
      };

      // Create backup if enabled
      if (this.settings.backupEnabled) {
        await this.createBackup(userId, data);
      }

      // Clean compression if needed
      if (this.settings.compressionEnabled) {
        // Add compression logic here if needed
      }

      const { error } = await supabase
        .from(this.settings.tableName as any) // Type assertion for dynamic table names
        .upsert(payload, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      // Clean old data based on retention policy
      if (this.settings.retentionDays) {
        await this.cleanOldData();
      }

    } catch (error) {
      console.error(`Error saving data to ${this.settings.tableName}:`, error);
      throw error;
    }
  }

  async load(userId: string): Promise<T | null> {
    try {
      const { data, error } = await supabase
        .from(this.settings.tableName as any) // Type assertion for dynamic table names
        .select('form_data')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No data found
        }
        throw error;
      }

      return data && 'form_data' in data ? (data.form_data as T) : null;
    } catch (error) {
      console.error(`Error loading data from ${this.settings.tableName}:`, error);
      return null;
    }
  }

  async delete(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.settings.tableName as any) // Type assertion for dynamic table names
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      // Also delete backups
      await this.deleteBackups(userId);
    } catch (error) {
      console.error(`Error deleting data from ${this.settings.tableName}:`, error);
      throw error;
    }
  }

  async exists(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from(this.settings.tableName as any) // Type assertion for dynamic table names
        .select('id')
        .eq('user_id', userId)
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  async list(userId: string): Promise<T[]> {
    try {
      const { data, error } = await supabase
        .from(this.settings.tableName as any) // Type assertion for dynamic table names
        .select('form_data')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return data?.map(item => item && 'form_data' in item ? (item.form_data as T) : null).filter(Boolean) as T[] || [];
    } catch (error) {
      console.error(`Error listing data from ${this.settings.tableName}:`, error);
      return [];
    }
  }

  private async createBackup(userId: string, data: T): Promise<void> {
    try {
      const backupTableName = `${this.settings.tableName}_backups`;
      
      const { error } = await supabase
        .from(backupTableName as any) // Type assertion for dynamic table names
        .insert({
          user_id: userId,
          form_data: data,
          backup_date: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
        console.warn(`Backup failed for ${backupTableName}:`, error);
      }
    } catch (error) {
      console.warn('Backup creation failed:', error);
    }
  }

  private async deleteBackups(userId: string): Promise<void> {
    try {
      const backupTableName = `${this.settings.tableName}_backups`;
      
      const { error } = await supabase
        .from(backupTableName as any) // Type assertion for dynamic table names
        .delete()
        .eq('user_id', userId);

      if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
        console.warn(`Backup deletion failed for ${backupTableName}:`, error);
      }
    } catch (error) {
      console.warn('Backup deletion failed:', error);
    }
  }

  private async cleanOldData(): Promise<void> {
    if (!this.settings.retentionDays) return;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.settings.retentionDays);

      const { error } = await supabase
        .from(this.settings.tableName as any) // Type assertion for dynamic table names
        .delete()
        .lt('updated_at', cutoffDate.toISOString());

      if (error) {
        console.warn(`Data cleanup failed for ${this.settings.tableName}:`, error);
      }
    } catch (error) {
      console.warn('Data cleanup failed:', error);
    }
  }
}

// Export singleton instances for common use cases
export const userPreferences = new UniversalDataProtection({
  tableName: 'user_preferences',  
  identifier: 'preferences'
});

export const formDrafts = new UniversalDataProtection({
  tableName: 'form_drafts',
  identifier: 'draft_data'
});

export const userSettings = new UniversalDataProtection({
  tableName: 'user_settings',
  identifier: 'settings_data'
});