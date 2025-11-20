import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePeriodEditSession(periodId: string | undefined, deviceFingerprint: string) {
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!periodId) return;

    const startSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create session
      const { data, error } = await supabase
        .from('period_edit_sessions')
        .insert({
          period_id: periodId,
          user_id: user.id,
          device_fingerprint: deviceFingerprint,
          user_agent: navigator.userAgent,
        })
        .select()
        .single();

      if (error) {
        console.error('Error starting edit session:', error);
        return;
      }

      sessionIdRef.current = data.id;

      // Start heartbeat
      heartbeatIntervalRef.current = setInterval(async () => {
        if (!sessionIdRef.current) return;

        await supabase
          .from('period_edit_sessions')
          .update({ last_heartbeat: new Date().toISOString() })
          .eq('id', sessionIdRef.current);
      }, 30000); // Every 30 seconds
    };

    startSession();

    // Cleanup: End session
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      if (sessionIdRef.current) {
        supabase
          .from('period_edit_sessions')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', sessionIdRef.current)
          .then(() => {
            sessionIdRef.current = null;
          });
      }
    };
  }, [periodId, deviceFingerprint]);

  return { sessionId: sessionIdRef.current };
}
