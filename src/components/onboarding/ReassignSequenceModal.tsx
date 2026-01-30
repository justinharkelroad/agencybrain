import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { UserCog, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface StaffUser {
  id: string;
  display_name: string | null;
  username: string;
  is_active: boolean;
}

interface OnboardingInstance {
  id: string;
  customer_name: string;
  assigned_to_staff_user_id: string | null;
  sequence: {
    name: string;
  } | null;
}

interface ReassignSequenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: OnboardingInstance | null;
  agencyId: string;
  pendingTaskCount?: number;
  onSuccess?: () => void;
}

export function ReassignSequenceModal({
  open,
  onOpenChange,
  instance,
  agencyId,
  pendingTaskCount = 0,
  onSuccess,
}: ReassignSequenceModalProps) {
  const queryClient = useQueryClient();
  const [newAssigneeId, setNewAssigneeId] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [reassignedName, setReassignedName] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setNewAssigneeId('');
      setSuccess(false);
      setReassignedName('');
    }
  }, [open]);

  // Fetch staff users for this agency
  const { data: staffUsers = [], isLoading: staffLoading } = useQuery<StaffUser[]>({
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
    enabled: open && !!agencyId,
  });

  // Filter out the current assignee
  const availableStaff = staffUsers.filter(
    (user) => user.id !== instance?.assigned_to_staff_user_id
  );

  const currentAssignee = staffUsers.find(
    (user) => user.id === instance?.assigned_to_staff_user_id
  );
  const currentAssigneeName = currentAssignee?.display_name || currentAssignee?.username || 'Unknown';

  // Reassign mutation
  const reassignMutation = useMutation({
    mutationFn: async ({ instanceId, newAssigneeStaffUserId }: { instanceId: string; newAssigneeStaffUserId: string }) => {
      const { data, error } = await supabase.functions.invoke('reassign_onboarding_sequence', {
        body: {
          instance_id: instanceId,
          new_assignee_staff_user_id: newAssigneeStaffUserId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks-today'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-instances'] });
      // Also invalidate overdue counts for sidebar badges
      queryClient.invalidateQueries({ queryKey: ['overdue-task-count'] });
      queryClient.invalidateQueries({ queryKey: ['staff-overdue-task-count'] });

      setReassignedName(data.new_assignee_name);
      setSuccess(true);
      toast.success(`Sequence reassigned to ${data.new_assignee_name}`);

      // Delay closing to show success state
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
      }, 1500);
    },
    onError: (error: Error) => {
      console.error('Error reassigning sequence:', error);
      toast.error(error.message || 'Failed to reassign sequence');
    },
  });

  const handleReassign = async () => {
    if (!instance || !newAssigneeId) {
      toast.error('Please select a team member');
      return;
    }

    reassignMutation.mutate({
      instanceId: instance.id,
      newAssigneeStaffUserId: newAssigneeId,
    });
  };

  const isLoading = staffLoading;
  const canReassign = newAssigneeId && !reassignMutation.isPending;

  if (success) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[400px]" hideCloseButton>
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sequence Reassigned!</h3>
            <p className="text-sm text-muted-foreground text-center">
              {pendingTaskCount} task{pendingTaskCount !== 1 ? 's' : ''} now assigned to {reassignedName}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary" />
            Reassign Sequence
          </DialogTitle>
          <DialogDescription>
            Reassign all pending tasks for <strong>{instance?.customer_name}</strong> to a different team member.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : availableStaff.length === 0 ? (
          <div className="py-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground mb-2">
              No other team members available.
            </p>
            <p className="text-sm text-muted-foreground">
              Add more staff users to enable reassignment.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Current Info */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sequence:</span>
                <span className="font-medium">{instance?.sequence?.name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Assignee:</span>
                <span className="font-medium">{currentAssigneeName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Tasks:</span>
                <Badge variant="secondary">{pendingTaskCount}</Badge>
              </div>
            </div>

            {/* New Assignee Selection */}
            <div className="space-y-2">
              <Label>
                New Assignee <span className="text-red-500">*</span>
              </Label>
              <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStaff.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.display_name || user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                All pending, due, and overdue tasks will be moved to this person.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={reassignMutation.isPending}
          >
            Cancel
          </Button>
          {availableStaff.length > 0 && (
            <Button onClick={handleReassign} disabled={!canReassign}>
              {reassignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reassign Tasks
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
