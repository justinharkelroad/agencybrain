import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { 
  UniversalDataProtectionService, 
  type UniversalDataBackup,
  type UniversalBackupMetadata,
  type UniversalDataProtectionStatus, 
  type UniversalValidationResult 
} from '@/lib/universalDataProtection';

interface UseUniversalDataProtectionProps<T> {
  formData: T;
  formType: UniversalBackupMetadata['formType'];
  tableName?: string;
  autoBackupEnabled?: boolean;
  autoBackupInterval?: number; // seconds
  validationRules?: (data: T) => UniversalValidationResult;
  onDataRestored?: (data: T) => void;
}

export function useUniversalDataProtection<T>({
  formData,
  formType,
  tableName,
  autoBackupEnabled = true,
  autoBackupInterval = 30,
  validationRules,
  onDataRestored
}: UseUniversalDataProtectionProps<T>) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<UniversalDataProtectionStatus>(() => 
    UniversalDataProtectionService.getProtectionStatus(formType)
  );
  
  const autoBackupIntervalRef = useRef<NodeJS.Timeout>();
  const lastBackupDataRef = useRef<T>(formData);
  const validationIntervalRef = useRef<NodeJS.Timeout>();

  // Manual backup
  const createBackup = (showToast = true): void => {
    try {
      UniversalDataProtectionService.createPeriodicBackup(formData, formType, user?.id);
      
      const backups = UniversalDataProtectionService.getBackupsFromStorage(formType);
      setStatus(prev => ({
        ...prev,
        lastBackup: new Date().toISOString(),
        backupCount: backups.length,
        isHealthy: true
      }));

      if (showToast) {
        toast({
          title: "Backup Created",
          description: `${formType} data has been backed up successfully.`,
        });
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      setStatus(prev => ({ ...prev, isHealthy: false }));
      
      if (showToast) {
        toast({
          title: "Backup Failed",
          description: "Could not create backup. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Export data
  const exportData = (): void => {
    try {
      UniversalDataProtectionService.exportToFile(formData, formType);
      toast({
        title: "Data Exported",
        description: "Your data has been downloaded as a backup file.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Import data
  const importData = async (): Promise<T | null> => {
    try {
      const importedData = await UniversalDataProtectionService.importFromFile<T>(formType);
      if (importedData) {
        onDataRestored?.(importedData);
        toast({
          title: "Data Imported",
          description: "Your data has been successfully restored from backup.",
        });
        return importedData;
      } else {
        toast({
          title: "Import Failed",
          description: "Could not import data. Please check the file format.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import Error",
        description: "An error occurred while importing data.",
        variant: "destructive",
      });
    }
    return null;
  };

  // Get available backups
  const getBackups = (): UniversalDataBackup<T>[] => {
    return UniversalDataProtectionService.getBackupsFromStorage<T>(formType);
  };

  // Restore from specific backup
  const restoreBackup = (timestamp: string): T | null => {
    const backups = getBackups();
    const backup = backups.find(b => b.metadata.timestamp === timestamp);
    
    if (backup && UniversalDataProtectionService.validateBackup(backup)) {
      onDataRestored?.(backup.formData);
      toast({
        title: "Data Restored",
        description: `Data restored from backup created on ${new Date(timestamp).toLocaleString()}.`,
      });
      return backup.formData;
    } else {
      toast({
        title: "Restore Failed",
        description: "Could not restore from the selected backup.",
        variant: "destructive",
      });
      return null;
    }
  };

  // Save to database with protection
  const saveWithProtection = async (additionalFields: Record<string, any> = {}): Promise<boolean> => {
    if (!tableName || !user?.id) {
      console.warn('Cannot save to database: missing tableName or user');
      return false;
    }

    setStatus(prev => ({ ...prev, syncStatus: 'pending' }));

    try {
      const result = await UniversalDataProtectionService.saveToDatabase(
        formData,
        formType,
        tableName,
        user.id,
        additionalFields
      );

      if (result.success) {
        setStatus(prev => ({ 
          ...prev, 
          syncStatus: 'synced', 
          isHealthy: true 
        }));
        
        // Create backup after successful save
        createBackup(false);
        
        toast({
          title: "Data Saved",
          description: "Your data has been saved and backed up successfully.",
        });
        return true;
      } else {
        setStatus(prev => ({ 
          ...prev, 
          syncStatus: 'failed', 
          isHealthy: false 
        }));
        
        toast({
          title: "Save Failed",
          description: result.error || "Could not save data. Your work is still backed up locally.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      setStatus(prev => ({ 
        ...prev, 
        syncStatus: 'failed', 
        isHealthy: false 
      }));
      
      toast({
        title: "Save Error",
        description: "An error occurred while saving. Your work is still backed up locally.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Validate data
  const validateData = (): UniversalValidationResult => {
    const result = UniversalDataProtectionService.validateFormData(
      formData,
      formType,
      validationRules
    );

    setStatus(prev => ({
      ...prev,
      lastValidated: new Date().toISOString(),
      isHealthy: result.isValid && result.criticalIssues.length === 0
    }));

    return result;
  };

  // Toggle auto-backup
  const toggleAutoBackup = (): void => {
    const newEnabled = !status.autoBackupEnabled;
    setStatus(prev => ({ ...prev, autoBackupEnabled: newEnabled }));
    
    toast({
      title: newEnabled ? "Auto-backup Enabled" : "Auto-backup Disabled",
      description: newEnabled 
        ? `Your ${formType} data will be automatically backed up every ${autoBackupInterval} seconds.`
        : "Automatic backups have been disabled.",
    });
  };

  // Recover from latest backup
  const recoverFromLatestBackup = (): T | null => {
    const recoveredData = UniversalDataProtectionService.recoverLatestBackup<T>(formType);
    if (recoveredData) {
      onDataRestored?.(recoveredData);
      toast({
        title: "Data Recovered",
        description: "Your data has been recovered from the latest backup.",
      });
    } else {
      toast({
        title: "Recovery Failed",
        description: "No valid backup found for recovery.",
        variant: "destructive",
      });
    }
    return recoveredData;
  };

  // Set up auto-backup
  useEffect(() => {
    if (autoBackupEnabled && status.autoBackupEnabled) {
      autoBackupIntervalRef.current = setInterval(() => {
        if (UniversalDataProtectionService.hasDataChanged(lastBackupDataRef.current, formData)) {
          createBackup(false);
          lastBackupDataRef.current = formData;
        }
      }, autoBackupInterval * 1000);
    }

    return () => {
      if (autoBackupIntervalRef.current) {
        clearInterval(autoBackupIntervalRef.current);
      }
    };
  }, [formData, autoBackupEnabled, status.autoBackupEnabled, autoBackupInterval]);

  // Set up periodic validation
  useEffect(() => {
    validationIntervalRef.current = setInterval(() => {
      validateData();
    }, 120000); // Every 2 minutes

    return () => {
      if (validationIntervalRef.current) {
        clearInterval(validationIntervalRef.current);
      }
    };
  }, [formData]);

  // Update backup count on mount
  useEffect(() => {
    const backups = getBackups();
    setStatus(prev => ({ ...prev, backupCount: backups.length }));
  }, []);

  return {
    status,
    createBackup,
    exportData,
    importData,
    getBackups,
    restoreBackup,
    saveWithProtection,
    validateData,
    toggleAutoBackup,
    recoverFromLatestBackup
  };
}