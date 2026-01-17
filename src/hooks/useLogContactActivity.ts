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

      const activityData = {
        contact_id: contactId,
        agency_id: agencyId,
        activity_type: activityType,
        source_module: sourceModule,
        source_record_id: sourceRecordId || null,
        activity_date: scheduledDate || new Date().toISOString(),
        outcome: outcome || null,
        subject: subject || null,
        notes: notes || null,
        call_direction: callDirection || null,
        phone_number: phoneNumber || null,
        created_by_user_id: createdByUserId || null,
        created_by_staff_id: createdByStaffId || null,
        created_by_display_name: createdByDisplayName,
      };

      // For now, use direct insert for both staff and regular users
      // The contact_activities table has RLS based on agency_id
      const { data, error } = await supabase
        .from('contact_activities')
        .insert(activityData)
        .select()
        .single();

      if (error) {
        console.error('[useLogContactActivity] Insert error:', error);
        throw error;
      }

      return data as ContactActivity;
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
