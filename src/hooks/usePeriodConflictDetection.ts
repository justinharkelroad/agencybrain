import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ConflictInfo {
  hasConflict: boolean;
  otherDevices: Array<{
    id: string;
    deviceFingerprint: string;
    lastHeartbeat: string;
    userAgent: string | null;
  }>;
}

export function usePeriodConflictDetection(periodId: string | undefined, deviceFingerprint: string) {
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo>({
    hasConflict: false,
    otherDevices: [],
  });

  useEffect(() => {
    if (!periodId) return;

    const checkForConflicts = async () => {
      const { data, error } = await supabase
        .from('period_edit_sessions')
        .select('*')
        .eq('period_id', periodId)
        .is('ended_at', null)
        .neq('device_fingerprint', deviceFingerprint)
        .gt('last_heartbeat', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Active in last 5 minutes

      if (error) {
        console.error('Error checking for conflicts:', error);
        return;
      }

      const hasConflict = (data?.length ?? 0) > 0;
      
      if (hasConflict && !conflictInfo.hasConflict) {
        toast.warning('This period is being edited on another device', {
          description: 'Your changes may conflict with edits from another session',
        });
      }

      setConflictInfo({
        hasConflict,
        otherDevices: data?.map(session => ({
          id: session.id,
          deviceFingerprint: session.device_fingerprint,
          lastHeartbeat: session.last_heartbeat,
          userAgent: session.user_agent,
        })) ?? [],
      });
    };

    // Check immediately
    checkForConflicts();

    // Check every 30 seconds
    const interval = setInterval(checkForConflicts, 30000);

    return () => clearInterval(interval);
  }, [periodId, deviceFingerprint, conflictInfo.hasConflict]);

  return conflictInfo;
}
