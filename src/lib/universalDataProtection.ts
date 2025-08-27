import { supa } from '@/lib/supabase';

export interface DataProtectionSettings<T> {
  tableName: string;
  identifier: string;
  encryptionKey?: string;
  compressionEnabled?: boolean;
  backupEnabled?: boolean;
  retentionDays?: number;
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

      const { error } = await supa
        .from(this.settings.tableName)
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
      const { data, error } = await supa
        .from(this.settings.tableName)
        .select('form_data')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No data found
        }
        throw error;
      }

      return data?.form_data as T || null;
    } catch (error) {
      console.error(`Error loading data from ${this.settings.tableName}:`, error);
      return null;
    }
  }

  async delete(userId: string): Promise<void> {
    try {
      const { error } = await supa
        .from(this.settings.tableName)
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
      const { data, error } = await supa
        .from(this.settings.tableName)
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
      const { data, error } = await supa
        .from(this.settings.tableName)
        .select('form_data')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return data?.map(item => item.form_data as T) || [];
    } catch (error) {
      console.error(`Error listing data from ${this.settings.tableName}:`, error);
      return [];
    }
  }

  private async createBackup(userId: string, data: T): Promise<void> {
    try {
      const backupTableName = `${this.settings.tableName}_backups`;
      
      const { error } = await supa
        .from(backupTableName)
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
      
      const { error } = await supa
        .from(backupTableName)
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

      const { error } = await supa
        .from(this.settings.tableName)
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