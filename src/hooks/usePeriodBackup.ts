import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function usePeriodBackup() {
  const createBackup = useCallback(async (
    periodId: string,
    formData: any,
    backupType: 'auto' | 'pre_save' | 'manual' = 'auto'
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('period_backups')
        .insert({
          period_id: periodId,
          user_id: user.id,
          backup_type: backupType,
          form_data: formData,
          metadata: {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
          },
        })
        .select()
        .single();

      if (error) throw error;

      if (backupType === 'manual') {
        toast.success('Backup created successfully');
      }

      return data;
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('Failed to create backup');
      return null;
    }
  }, []);

  const getBackups = useCallback(async (periodId: string) => {
    try {
      const { data, error } = await supabase
        .from('period_backups')
        .select('*')
        .eq('period_id', periodId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching backups:', error);
      return [];
    }
  }, []);

  const restoreBackup = useCallback(async (backupId: string) => {
    try {
      const { data: backup, error: backupError } = await supabase
        .from('period_backups')
        .select('*')
        .eq('id', backupId)
        .single();

      if (backupError) throw backupError;

      const { error: updateError } = await supabase
        .from('periods')
        .update({ form_data: backup.form_data })
        .eq('id', backup.period_id);

      if (updateError) throw updateError;

      toast.success('Backup restored successfully');
      return true;
    } catch (error) {
      console.error('Error restoring backup:', error);
      toast.error('Failed to restore backup');
      return false;
    }
  }, []);

  return { createBackup, getBackups, restoreBackup };
}
