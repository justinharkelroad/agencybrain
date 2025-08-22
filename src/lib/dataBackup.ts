import { type CellAddr } from "../bonus_grid_web_spec/computeWithRounding";

export interface BackupMetadata {
  version: string;
  timestamp: string;
  source: 'manual' | 'auto' | 'recovery';
  dataSize: number;
  checksum: string;
}

export interface DataBackup {
  metadata: BackupMetadata;
  gridData: Record<CellAddr, any>;
}

export class DataBackupManager {
  private static readonly BACKUP_KEY_PREFIX = "bonusGrid:backup:";
  private static readonly MAX_BACKUPS = 10;
  private static readonly AUTO_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  static createChecksum(data: Record<CellAddr, any>): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  static createBackup(gridData: Record<CellAddr, any>, source: 'manual' | 'auto' | 'recovery' = 'manual'): DataBackup {
    const metadata: BackupMetadata = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      source,
      dataSize: Object.keys(gridData).length,
      checksum: this.createChecksum(gridData)
    };

    return {
      metadata,
      gridData: { ...gridData }
    };
  }

  static saveBackupToStorage(backup: DataBackup): void {
    const key = `${this.BACKUP_KEY_PREFIX}${backup.metadata.timestamp}`;
    try {
      localStorage.setItem(key, JSON.stringify(backup));
      this.cleanupOldBackups();
    } catch (error) {
      console.error('Failed to save backup to localStorage:', error);
    }
  }

  static getBackupsFromStorage(): DataBackup[] {
    const backups: DataBackup[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.BACKUP_KEY_PREFIX)) {
        try {
          const backup = JSON.parse(localStorage.getItem(key) || '');
          backups.push(backup);
        } catch (error) {
          console.error('Failed to parse backup:', key, error);
        }
      }
    }
    return backups.sort((a, b) => new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime());
  }

  static cleanupOldBackups(): void {
    const backups = this.getBackupsFromStorage();
    if (backups.length > this.MAX_BACKUPS) {
      const toDelete = backups.slice(this.MAX_BACKUPS);
      toDelete.forEach(backup => {
        const key = `${this.BACKUP_KEY_PREFIX}${backup.metadata.timestamp}`;
        localStorage.removeItem(key);
      });
    }
  }

  static validateBackup(backup: DataBackup): boolean {
    if (!backup.metadata || !backup.gridData) return false;
    
    const currentChecksum = this.createChecksum(backup.gridData);
    return currentChecksum === backup.metadata.checksum;
  }

  static exportToFile(gridData: Record<CellAddr, any>, filename?: string): void {
    const backup = this.createBackup(gridData, 'manual');
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = filename || `bonus-grid-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  static async importFromFile(): Promise<Record<CellAddr, any> | null> {
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
            const backup = JSON.parse(e.target?.result as string) as DataBackup;
            if (this.validateBackup(backup)) {
              resolve(backup.gridData);
            } else {
              console.error('Invalid backup file');
              resolve(null);
            }
          } catch (error) {
            console.error('Failed to parse backup file:', error);
            resolve(null);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }

  static createPeriodicBackup(gridData: Record<CellAddr, any>): void {
    if (Object.keys(gridData).length === 0) return;
    
    const backup = this.createBackup(gridData, 'auto');
    this.saveBackupToStorage(backup);
  }
}