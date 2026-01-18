import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getStaffSessionToken } from '@/lib/cancel-audit-api';
import type {
  ContactActivity,
  ContactActivityType,
  SourceModule,
  CallDirection,
  ActivityLogFormData,
} from '@/types/contact';

interface LogActivityParams {
  contactId: string;
  agencyId: string;
  activityType: ContactActivityType;
  sourceModule: SourceModule;
  sourceRecordId?: string;
  outcome?: string;
  subject?: string;
  notes?: string;
  callDirection?: CallDirection;
  phoneNumber?: string;
  scheduledDate?: string;
  createdByUserId?: string | null;
  createdByStaffId?: string | null;
  createdByDisplayName: string;
}

export function useLogContactActivity() {
  const queryClient = useQueryClient();
  const staffSessionToken = getStaffSessionToken();

  return useMutation({
    mutationFn: async (params: LogActivityParams): Promise<ContactActivity> => {
      const {
        contactId,
        agencyId,
        activityType,
        sourceModule,
        sourceRecordId,
        outcome,
        subject,
        notes,
        callDirection,
        phoneNumber,
        scheduledDate,
        createdByUserId,
        createdByStaffId,
        createdByDisplayName,
      } = params;

      // Use RPC function with SECURITY DEFINER to bypass RLS issues
      const { data: activityId, error: insertError } = await supabase.rpc(
        'insert_contact_activity',
        {
          p_agency_id: agencyId,
          p_contact_id: contactId,
          p_source_module: sourceModule,
          p_activity_type: activityType,
          p_source_record_id: sourceRecordId || null,
          p_subject: subject || null,
          p_notes: notes || null,
          p_outcome: outcome || null,
          p_call_direction: callDirection || null,
          p_phone_number: phoneNumber || null,
          p_activity_date: scheduledDate || new Date().toISOString(),
          p_created_by_user_id: createdByUserId || null,
          p_created_by_staff_id: createdByStaffId || null,
          p_created_by_display_name: createdByDisplayName,
        }
      );

      if (insertError) {
        console.error('[useLogContactActivity] Insert error:', insertError);
        throw insertError;
      }

      // Fetch the created activity to return the full object
      const { data: activity, error: fetchError } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('id', activityId)
        .single();

      if (fetchError) {
        console.error('[useLogContactActivity] Fetch error:', fetchError);
        // Activity was created, just can't fetch it - still return something
        return { id: activityId } as ContactActivity;
      }

      return activity as ContactActivity;
    },
    onSuccess: (_, params) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['contact-profile', params.contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-journey', params.contactId] });

      toast.success('Activity logged');
    },
    onError: (error) => {
      console.error('[useLogContactActivity] Error:', error);
      toast.error('Failed to log activity');
    },
  });
}

// Quick action hooks for common activity types
export function useLogCall() {
  const logActivity = useLogContactActivity();

  return useMutation({
    mutationFn: async (params: {
      contactId: string;
      agencyId: string;
      sourceModule: SourceModule;
      sourceRecordId?: string;
      direction: CallDirection;
      outcome: string;
      notes?: string;
      phoneNumber?: string;
      createdByUserId?: string | null;
      createdByStaffId?: string | null;
      createdByDisplayName: string;
    }) => {
      return logActivity.mutateAsync({
        contactId: params.contactId,
        agencyId: params.agencyId,
        activityType: 'call',
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
        callDirection: params.direction,
        outcome: params.outcome,
        notes: params.notes,
        phoneNumber: params.phoneNumber,
        createdByUserId: params.createdByUserId,
        createdByStaffId: params.createdByStaffId,
        createdByDisplayName: params.createdByDisplayName,
      });
    },
  });
}

export function useLogNote() {
  const logActivity = useLogContactActivity();

  return useMutation({
    mutationFn: async (params: {
      contactId: string;
      agencyId: string;
      sourceModule: SourceModule;
      sourceRecordId?: string;
      subject?: string;
      notes: string;
      createdByUserId?: string | null;
      createdByStaffId?: string | null;
      createdByDisplayName: string;
    }) => {
      return logActivity.mutateAsync({
        contactId: params.contactId,
        agencyId: params.agencyId,
        activityType: 'note',
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
        subject: params.subject,
        notes: params.notes,
        createdByUserId: params.createdByUserId,
        createdByStaffId: params.createdByStaffId,
        createdByDisplayName: params.createdByDisplayName,
      });
    },
  });
}

export function useLogAppointment() {
  const logActivity = useLogContactActivity();

  return useMutation({
    mutationFn: async (params: {
      contactId: string;
      agencyId: string;
      sourceModule: SourceModule;
      sourceRecordId?: string;
      subject: string;
      notes?: string;
      scheduledDate: string;
      createdByUserId?: string | null;
      createdByStaffId?: string | null;
      createdByDisplayName: string;
    }) => {
      return logActivity.mutateAsync({
        contactId: params.contactId,
        agencyId: params.agencyId,
        activityType: 'appointment',
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
        subject: params.subject,
        notes: params.notes,
        scheduledDate: params.scheduledDate,
        createdByUserId: params.createdByUserId,
        createdByStaffId: params.createdByStaffId,
        createdByDisplayName: params.createdByDisplayName,
      });
    },
  });
}

export function useLogEmail() {
  const logActivity = useLogContactActivity();

  return useMutation({
    mutationFn: async (params: {
      contactId: string;
      agencyId: string;
      sourceModule: SourceModule;
      sourceRecordId?: string;
      subject: string;
      notes?: string;
      createdByUserId?: string | null;
      createdByStaffId?: string | null;
      createdByDisplayName: string;
    }) => {
      return logActivity.mutateAsync({
        contactId: params.contactId,
        agencyId: params.agencyId,
        activityType: 'email',
        sourceModule: params.sourceModule,
        sourceRecordId: params.sourceRecordId,
        subject: params.subject,
        notes: params.notes,
        createdByUserId: params.createdByUserId,
        createdByStaffId: params.createdByStaffId,
        createdByDisplayName: params.createdByDisplayName,
      });
    },
  });
}
