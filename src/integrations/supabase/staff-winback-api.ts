import { supabase } from './client';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';

interface SendStaffCancelToWinbackParams {
  recordId: string;
  contactDaysBefore?: number;
}

interface SendStaffCancelToWinbackResult {
  success: boolean;
  householdId?: string;
  error?: string;
}

export async function sendStaffCancelToWinback(
  params: SendStaffCancelToWinbackParams
): Promise<SendStaffCancelToWinbackResult> {
  const token = getStaffSessionToken();
  
  if (!token) {
    return { success: false, error: 'No staff session token found' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send_staff_cancel_to_winback', {
      body: {
        recordId: params.recordId,
        contactDaysBefore: params.contactDaysBefore ?? 45,
      },
      headers: {
        'x-staff-session-token': token,
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return {
      success: data?.success ?? false,
      householdId: data?.householdId,
      error: data?.error,
    };
  } catch (err) {
    console.error('Send staff cancel to winback error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
