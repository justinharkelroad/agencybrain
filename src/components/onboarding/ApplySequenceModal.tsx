import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Workflow, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn, todayLocal, toLocalDate } from "@/lib/utils";
import { toast } from "sonner";
import type { OnboardingSequence } from "@/hooks/useOnboardingSequences";

interface StaffUser {
  id: string;
  display_name: string | null;
  username: string;
  is_active: boolean;
}

interface ProfileUser {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
}

// Composite assignee option for the dropdown
interface AssigneeOption {
  value: string; // "staff:<uuid>" or "user:<uuid>"
  type: 'staff' | 'user';
  id: string;
  label: string;
  badge?: string;
}

interface ApplySequenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string;       // For contact-based sequences
  saleId?: string;          // For sale-based sequences (now optional)
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  agencyId: string;
  onSuccess?: () => void;
  staffSessionToken?: string | null; // For staff portal context
}

export function ApplySequenceModal({
  open,
  onOpenChange,
  contactId,
  saleId,
  customerName,
  customerPhone,
  customerEmail,
  agencyId,
  onSuccess,
  staffSessionToken,
}: ApplySequenceModalProps) {
  const isStaffContext = !!staffSessionToken;
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>('');
  const [assigneeValue, setAssigneeValue] = useState<string>(''); // "staff:<uuid>" or "user:<uuid>"
  const [startDate, setStartDate] = useState<Date>(todayLocal());
  const [applying, setApplying] = useState(false);
  const [success, setSuccess] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedSequenceId('');
      setAssigneeValue('');
      setStartDate(todayLocal());
      setApplying(false);
      setSuccess(false);
    }
  }, [open]);

  // Fetch data via edge function for staff, or direct queries for regular users
  const { data: staffData, isLoading: staffDataLoading } = useQuery({
    queryKey: ['staff-sequences-data', agencyId, staffSessionToken],
    queryFn: async () => {
      const response = await supabase.functions.invoke('get_staff_sequences', {
        headers: { 'x-staff-session': staffSessionToken! },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      return response.data as {
        sequences: OnboardingSequence[];
        staff_users: StaffUser[];
        profile_users: ProfileUser[];
      };
    },
    enabled: open && !!agencyId && isStaffContext,
  });

  // Fetch active sequences for this agency (non-staff)
  const { data: directSequences = [], isLoading: sequencesLoading } = useQuery({
    queryKey: ['onboarding-sequences-active', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_sequences')
        .select(`
          id,
          name,
          description,
          target_type,
          is_active,
          steps:onboarding_sequence_steps(id, day_number, action_type, title)
        `)
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as OnboardingSequence[];
    },
    enabled: open && !!agencyId && !isStaffContext,
  });

  // Fetch staff users for this agency (non-staff)
  const { data: directStaffUsers = [], isLoading: staffLoading } = useQuery<StaffUser[]>({
    queryKey: ['staff-users-active', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_users')
        .select('id, display_name, username, is_active')
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('display_name');

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!agencyId && !isStaffContext,
  });

  // Fetch profile users (owners/managers) for this agency (non-staff)
  const { data: directProfileUsers = [], isLoading: profilesLoading } = useQuery<ProfileUser[]>({
    queryKey: ['profile-users-active', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('agency_id', agencyId)
        .order('full_name');

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!agencyId && !isStaffContext,
  });

  // Use edge function data for staff, direct queries for non-staff
  const sequences = isStaffContext ? (staffData?.sequences || []) : directSequences;
  const staffUsers = isStaffContext ? (staffData?.staff_users || []) : directStaffUsers;
  const profileUsers = isStaffContext ? (staffData?.profile_users || []) : directProfileUsers;

  // Build combined assignee options
  const assigneeOptions = useMemo((): AssigneeOption[] => {
    const options: AssigneeOption[] = [];

    // Add profile users (owners/managers) first
    for (const profile of profileUsers) {
      const label = profile.full_name || profile.email || 'Unnamed User';
      const badge = profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : undefined;
      options.push({
        value: `user:${profile.id}`,
        type: 'user',
        id: profile.id,
        label,
        badge,
      });
    }

    // Add staff users
    for (const staff of staffUsers) {
      const label = staff.display_name || staff.username;
      options.push({
        value: `staff:${staff.id}`,
        type: 'staff',
        id: staff.id,
        label,
        badge: 'Staff',
      });
    }

    return options;
  }, [staffUsers, profileUsers]);

  const selectedSequence = sequences.find(s => s.id === selectedSequenceId);
  const totalSteps = selectedSequence?.steps?.length || 0;
  const totalDays = selectedSequence?.steps?.length
    ? Math.max(...selectedSequence.steps.map(s => s.day_number))
    : 0;

  const handleApply = async () => {
    if (!selectedSequenceId || !assigneeValue || !startDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Parse the composite assignee value
    const [assigneeType, assigneeId] = assigneeValue.split(':') as ['staff' | 'user', string];

    setApplying(true);
    try {
      const body: Record<string, unknown> = {
        contact_id: contactId || null,
        sale_id: saleId || null,
        sequence_id: selectedSequenceId,
        start_date: format(startDate, 'yyyy-MM-dd'),
        customer_name: customerName,
        customer_phone: customerPhone || null,
        customer_email: customerEmail || null,
      };

      // Set the appropriate assignee field based on type
      if (assigneeType === 'staff') {
        body.assigned_to_staff_user_id = assigneeId;
      } else {
        body.assigned_to_user_id = assigneeId;
      }

      const { data, error } = await supabase.functions.invoke('assign_onboarding_sequence', {
        body,
      });

      // Check for network/auth errors
      if (error) throw error;
      // Check for application-level errors returned by the edge function
      if (data?.error) throw new Error(data.error);

      setSuccess(true);
      toast.success('Sequence applied successfully!');

      // Delay closing to show success state
      // Only call onSuccess (not onOpenChange) to avoid double callback execution
      // onSuccess will handle closing the modal via setApplySequenceModalOpen(false)
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (error: any) {
      console.error('Error applying sequence:', error);
      toast.error(error.message || 'Failed to apply sequence');
      setApplying(false);
    }
  };

  const handleSkip = () => {
    // Only call onSuccess (not onOpenChange) to avoid double callback execution
    onSuccess?.();
  };

  const isLoading = isStaffContext
    ? staffDataLoading
    : (sequencesLoading || staffLoading || profilesLoading);
  const canApply = selectedSequenceId && assigneeValue && startDate && !applying;

  if (success) {
    return (
      // Prevent closing during success animation to avoid race conditions
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[400px]" hideCloseButton>
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sequence Applied!</h3>
            <p className="text-sm text-muted-foreground text-center">
              {totalSteps} tasks have been created for {customerName}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-primary" />
            Apply Onboarding Sequence
          </DialogTitle>
          <DialogDescription>
            Optionally assign a follow-up sequence for <strong>{customerName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : sequences.length === 0 ? (
          <div className="py-6 text-center">
            <Workflow className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground mb-4">
              No active sequences available.
            </p>
            <p className="text-sm text-muted-foreground">
              Create sequences in the Sequence Builder first.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Sequence Selection */}
            <div className="space-y-2">
              <Label>
                Select Sequence <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedSequenceId} onValueChange={setSelectedSequenceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a sequence..." />
                </SelectTrigger>
                <SelectContent>
                  {sequences.map((seq) => (
                    <SelectItem key={seq.id} value={seq.id}>
                      <div className="flex items-center gap-2">
                        <span>{seq.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {seq.steps?.length || 0} steps
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSequence?.description && (
                <p className="text-xs text-muted-foreground">
                  {selectedSequence.description}
                </p>
              )}
              {selectedSequence && (
                <p className="text-xs text-muted-foreground">
                  {totalSteps} step{totalSteps !== 1 ? 's' : ''} over {totalDays} day{totalDays !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Assignee Selection */}
            <div className="space-y-2">
              <Label>
                Assign To <span className="text-red-500">*</span>
              </Label>
              <Select value={assigneeValue} onValueChange={setAssigneeValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  {assigneeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span>{option.label}</span>
                        {option.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {option.badge}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>
                Start Date <span className="text-red-500">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(toLocalDate(d))}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Day 0 tasks will be due on this date.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkip} disabled={applying}>
            Skip
          </Button>
          {sequences.length > 0 && (
            <Button onClick={handleApply} disabled={!canApply}>
              {applying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Apply Sequence
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
