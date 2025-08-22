import { useState, useEffect, useCallback, useRef } from 'react';
import { type CellAddr } from "../bonus_grid_web_spec/computeWithRounding";
import { DataBackupManager } from '@/lib/dataBackup';
import { DataValidator, type DataIntegrityReport } from '@/lib/dataValidation';
import { useToast } from '@/hooks/use-toast';

export interface DataProtectionStatus {
  isHealthy: boolean;
  lastBackup: string | null;
  integrityReport: DataIntegrityReport | null;
  backupCount: number;
  autoBackupEnabled: boolean;
}

export function useDataProtection(gridData: Record<CellAddr, any>) {
  const { toast } = useToast();
  const [status, setStatus] = useState<DataProtectionStatus>({
    isHealthy: true,
    lastBackup: null,
    integrityReport: null,
    backupCount: 0,
    autoBackupEnabled: true
  });

  const lastDataRef = useRef<Record<CellAddr, any>>({});
  const autoBackupIntervalRef = useRef<NodeJS.Timeout>();
  const integrityCheckIntervalRef = useRef<NodeJS.Timeout>();

  // Create manual backup
  const createBackup = useCallback((showToast = true) => {
    try {
      const backup = DataBackupManager.createBackup(gridData, 'manual');
      DataBackupManager.saveBackupToStorage(backup);
      
      setStatus(prev => ({
        ...prev,
        lastBackup: backup.metadata.timestamp,
        backupCount: prev.backupCount + 1
      }));

      if (showToast) {
        toast({
          title: "Backup created",
          description: "Your data has been safely backed up to local storage.",
        });
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      toast({
        title: "Backup failed",
        description: "Unable to create backup. Please try again.",
        variant: "destructive",
      });
    }
  }, [gridData, toast]);

  // Export data to file
  const exportData = useCallback(() => {
    try {
      DataBackupManager.exportToFile(gridData);
      toast({
        title: "Data exported",
        description: "Your bonus grid data has been downloaded as a backup file.",
      });
    } catch (error) {
      console.error('Failed to export data:', error);
      toast({
        title: "Export failed",
        description: "Unable to export data. Please try again.",
        variant: "destructive",
      });
    }
  }, [gridData, toast]);

  // Import data from file
  const importData = useCallback(async (): Promise<Record<CellAddr, any> | null> => {
    try {
      const importedData = await DataBackupManager.importFromFile();
      if (importedData) {
        toast({
          title: "Data imported",
          description: "Your bonus grid data has been successfully imported.",
        });
        return importedData;
      } else {
        toast({
          title: "Import failed",
          description: "Unable to import data. Please check the file and try again.",
          variant: "destructive",
        });
        return null;
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      toast({
        title: "Import failed",
        description: "An error occurred while importing data.",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Get available backups
  const getBackups = useCallback(() => {
    return DataBackupManager.getBackupsFromStorage();
  }, []);

  // Restore from backup
  const restoreBackup = useCallback((timestamp: string): Record<CellAddr, any> | null => {
    const backups = getBackups();
    const backup = backups.find(b => b.metadata.timestamp === timestamp);
    
    if (backup && DataBackupManager.validateBackup(backup)) {
      toast({
        title: "Data restored",
        description: `Data restored from backup created on ${new Date(timestamp).toLocaleString()}.`,
      });
      return backup.gridData;
    } else {
      toast({
        title: "Restore failed",
        description: "Unable to restore from the selected backup.",
        variant: "destructive",
      });
      return null;
    }
  }, [getBackups, toast]);

  // Check data integrity
  const checkIntegrity = useCallback(() => {
    const report = DataValidator.createIntegrityReport(gridData);
    setStatus(prev => ({
      ...prev,
      integrityReport: report,
      isHealthy: report.validation.isValid && report.criticalIssues.length === 0
    }));

    // Show warnings for critical issues
    if (report.criticalIssues.length > 0) {
      toast({
        title: "Data integrity warning",
        description: `${report.criticalIssues.length} critical issue(s) detected in your data.`,
        variant: "destructive",
      });
    }

    return report;
  }, [gridData, toast]);

  // Auto-backup functionality
  useEffect(() => {
    if (!status.autoBackupEnabled) return;

    const currentDataStr = JSON.stringify(gridData);
    const lastDataStr = JSON.stringify(lastDataRef.current);

    // Only backup if data has changed and is not empty
    if (currentDataStr !== lastDataStr && Object.keys(gridData).length > 0) {
      // Debounce auto-backup
      if (autoBackupIntervalRef.current) {
        clearTimeout(autoBackupIntervalRef.current);
      }

      autoBackupIntervalRef.current = setTimeout(() => {
        DataBackupManager.createPeriodicBackup(gridData);
        setStatus(prev => ({
          ...prev,
          lastBackup: new Date().toISOString()
        }));
      }, 30000); // 30 second delay for auto-backup

      lastDataRef.current = { ...gridData };
    }

    return () => {
      if (autoBackupIntervalRef.current) {
        clearTimeout(autoBackupIntervalRef.current);
      }
    };
  }, [gridData, status.autoBackupEnabled]);

  // Periodic integrity checks
  useEffect(() => {
    // Initial integrity check
    checkIntegrity();

    // Set up periodic checks
    integrityCheckIntervalRef.current = setInterval(() => {
      checkIntegrity();
    }, 2 * 60 * 1000); // Every 2 minutes

    return () => {
      if (integrityCheckIntervalRef.current) {
        clearInterval(integrityCheckIntervalRef.current);
      }
    };
  }, [checkIntegrity]);

  // Update backup count
  useEffect(() => {
    const backups = getBackups();
    setStatus(prev => ({
      ...prev,
      backupCount: backups.length
    }));
  }, [getBackups]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoBackupIntervalRef.current) {
        clearTimeout(autoBackupIntervalRef.current);
      }
      if (integrityCheckIntervalRef.current) {
        clearInterval(integrityCheckIntervalRef.current);
      }
    };
  }, []);

  return {
    status,
    createBackup,
    exportData,
    importData,
    getBackups,
    restoreBackup,
    checkIntegrity,
    toggleAutoBackup: (enabled: boolean) => setStatus(prev => ({ ...prev, autoBackupEnabled: enabled }))
  };
}