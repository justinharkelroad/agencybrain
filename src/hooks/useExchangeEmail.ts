import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

export type EmailAudience = 'all' | 'one_on_one' | 'boardroom' | 'call_scoring' | 'staff';

interface SendNotificationInput {
  post_id: string;
  subject: string;
  message: string;
  audience: EmailAudience;
  include_staff: boolean;
}

export function useSendExchangeNotification() {
  return useMutation({
    mutationFn: async (input: SendNotificationInput) => {
      const { data, error } = await supabase.functions.invoke('send-exchange-notification', {
        body: input,
      });
      
      if (error) throw error;
      return data as { success: boolean; sent: number };
    },
    onSuccess: (data) => {
      if (data.sent > 0) {
        toast.success(`Email sent to ${data.sent} recipients`);
      } else {
        toast.info('No recipients found for the selected audience');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send email notification');
    },
  });
}
