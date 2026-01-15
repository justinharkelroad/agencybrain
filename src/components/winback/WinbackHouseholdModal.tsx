import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { WinbackStatusBadge } from './WinbackStatusBadge';
import { WinbackActivityLog } from './WinbackActivityLog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone, Mail, MapPin, Calendar, Play, CheckCircle, RotateCcw, Trash2, Clock } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Household } from './WinbackHouseholdTable';

interface Policy {
  id: string;
  policy_number: string;
  product_name: string | null;
  product_code: string | null;
  policy_term_months: number | null;
  termination_effective_date: string | null;
  termination_reason: string | null;
  premium_old_cents: number | null;
  premium_new_cents: number | null;
  calculated_winback_date: string | null;
  account_type: string | null;
}

interface Activity {
  id: string;
  activity_type: string;
  notes: string | null;
  created_by_name: string | null;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
}

interface WinbackHouseholdModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  household: Household | null;
  teamMembers: TeamMember[];
  currentUserTeamMemberId: string | null;
  agencyId: string | null;
  onUpdate: () => void;
}

function formatCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || isNaN(cents)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function WinbackHouseholdModal({
  open,
  onOpenChange,
  household,
  teamMembers,
  currentUserTeamMemberId,
  agencyId,
  onUpdate,
}: WinbackHouseholdModalProps) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>('unassigned');
  const [localStatus, setLocalStatus] = useState<Household['status']>('untouched');

  useEffect(() => {
    if (open && household) {
      setAssignedTo(household.assigned_to || 'unassigned');
      setLocalStatus(household.status);
      fetchPolicies(household.id);
      fetchActivities(household.id);
    }
  }, [open, household]);

  const fetchPolicies = async (householdId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('winback_policies')
        .select('*')
        .eq('household_id', householdId)
        .order('calculated_winback_date', { ascending: true });

      if (error) throw error;
      setPolicies(data || []);
    } catch (err) {
      console.error('Error fetching policies:', err);
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async (householdId: string) => {
    setActivitiesLoading(true);
    try {
      const { data, error } = await supabase
        .from('winback_activities')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const logActivity = async (type: string, notes: string) => {
    if (!household || !agencyId) return;

    try {
      // Get current user's name for attribution
      const userName = teamMembers.find(m => m.id === currentUserTeamMemberId)?.name || 'Unknown';

      const { error } = await supabase
        .from('winback_activities')
        .insert({
          household_id: household.id,
          agency_id: agencyId,
          activity_type: type,
          notes: notes || null,
          created_by_user_id: null,
          created_by_team_member_id: currentUserTeamMemberId || null,
          created_by_name: userName,
        });

      if (error) throw error;
      
      // Refresh activities
      fetchActivities(household.id);
      toast.success(`${type.replace('_', ' ')} logged`);
    } catch (err) {
      console.error('Error logging activity:', err);
      toast.error('Failed to log activity');
    }
  };

  const handleAssignmentChange = async (newAssignedTo: string) => {
    if (!household) return;
    setAssignedTo(newAssignedTo);
    
    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        assigned_to: newAssignedTo === 'unassigned' ? null : newAssignedTo,
        updated_at: new Date().toISOString(),
      };

      if (newAssignedTo && newAssignedTo !== 'unassigned' && household.status === 'untouched') {
        updateData.status = 'in_progress';
        setLocalStatus('in_progress');
      }

      const { error } = await supabase
        .from('winback_households')
        .update(updateData)
        .eq('id', household.id);

      if (error) throw error;
      toast.success('Assignment updated');
      onUpdate();
    } catch (err) {
      console.error('Error updating assignment:', err);
      toast.error('Failed to update assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: Household['status']) => {
    if (!household || !agencyId) return;

    const oldStatus = localStatus;
    setSaving(true);
    
    try {
      const updateData: Record<string, any> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'in_progress' && !household.assigned_to && assignedTo === 'unassigned') {
        if (currentUserTeamMemberId) {
          updateData.assigned_to = currentUserTeamMemberId;
          setAssignedTo(currentUserTeamMemberId);
        }
      }

      const { error } = await supabase
        .from('winback_households')
        .update(updateData)
        .eq('id', household.id);

      if (error) throw error;

      // Log the status change as an activity
      const userName = teamMembers.find(m => m.id === currentUserTeamMemberId)?.name || 'Unknown';
      await supabase.from('winback_activities').insert({
        household_id: household.id,
        agency_id: agencyId,
        activity_type: 'status_change',
        old_status: oldStatus,
        new_status: newStatus,
        created_by_team_member_id: currentUserTeamMemberId || null,
        created_by_name: userName,
      });

      setLocalStatus(newStatus);
      toast.success(`Status changed to ${newStatus.replace('_', ' ')}`);
      onUpdate();
      
      if (newStatus === 'dismissed') {
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleNotNow = async () => {
    if (!household || !agencyId) return;
    setSaving(true);

    try {
      const { data: householdPolicies, error: fetchError } = await supabase
        .from('winback_policies')
        .select('id, policy_term_months, termination_effective_date')
        .eq('household_id', household.id);

      if (fetchError) throw fetchError;

      if (!householdPolicies || householdPolicies.length === 0) {
        toast.error('No policies found');
        setSaving(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const contactDaysBefore = 45;

      for (const policy of householdPolicies) {
        const terminationDate = new Date(policy.termination_effective_date);
        const policyTermMonths = policy.policy_term_months || 12;
        
        let competitorRenewalDate = new Date(terminationDate);
        competitorRenewalDate.setMonth(competitorRenewalDate.getMonth() + policyTermMonths);
        
        while (competitorRenewalDate <= today) {
          competitorRenewalDate.setMonth(competitorRenewalDate.getMonth() + policyTermMonths);
        }
        
        competitorRenewalDate.setMonth(competitorRenewalDate.getMonth() + policyTermMonths);
        
        const newWinbackDate = new Date(competitorRenewalDate);
        newWinbackDate.setDate(newWinbackDate.getDate() - contactDaysBefore);

        await supabase
          .from('winback_policies')
          .update({ calculated_winback_date: newWinbackDate.toISOString().split('T')[0] })
          .eq('id', policy.id);
      }

      const { error: rpcError } = await supabase.rpc('recalculate_winback_household_aggregates', {
        p_household_id: household.id,
      });

      if (rpcError) {
        const { data: updatedPolicies } = await supabase
          .from('winback_policies')
          .select('calculated_winback_date')
          .eq('household_id', household.id)
          .order('calculated_winback_date', { ascending: true })
          .limit(1);

        if (updatedPolicies && updatedPolicies.length > 0) {
          await supabase
            .from('winback_households')
            .update({ earliest_winback_date: updatedPolicies[0].calculated_winback_date })
            .eq('id', household.id);
        }
      }

      await supabase
        .from('winback_households')
        .update({ 
          status: 'untouched',
          assigned_to: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', household.id);

      // Log the "not now" action
      const userName = teamMembers.find(m => m.id === currentUserTeamMemberId)?.name || 'Unknown';
    await supabase.from('winback_activities').insert({
      household_id: household.id,
      agency_id: agencyId,
      activity_type: 'note',
      old_status: null,
      new_status: null,
      notes: 'Pushed to next renewal cycle',
      created_by_team_member_id: currentUserTeamMemberId || null,
      created_by_name: userName,
    });

      toast.success('Pushed to next renewal cycle');
      onUpdate();
      onOpenChange(false);
    } catch (err) {
      console.error('Error pushing to next cycle:', err);
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!household || !agencyId) return;
    setSaving(true);

    try {
      // Delete all policies for this household
      const { error: policiesError } = await supabase
        .from('winback_policies')
        .delete()
        .eq('household_id', household.id);

      if (policiesError) throw policiesError;

      // Delete all activities for this household
      const { error: activitiesError } = await supabase
        .from('winback_activities')
        .delete()
        .eq('household_id', household.id);

      if (activitiesError) throw activitiesError;

      // Clear the winback_household_id reference on any renewal_records
      await supabase
        .from('renewal_records')
        .update({ winback_household_id: null, sent_to_winback_at: null })
        .eq('winback_household_id', household.id);

      // Delete the household itself
      const { error: householdError } = await supabase
        .from('winback_households')
        .delete()
        .eq('id', household.id);

      if (householdError) throw householdError;

      toast.success('Household permanently deleted');
      onUpdate();
      onOpenChange(false);
    } catch (err) {
      console.error('Error deleting household:', err);
      toast.error('Failed to delete household');
    } finally {
      setSaving(false);
    }
  };

  if (!household) return null;

  const today = startOfDay(new Date());
  const fullName = `${household.first_name || ''} ${household.last_name || ''}`.trim();
  const zipCode = household.zip_code?.substring(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-xl">{fullName || 'Unknown'}</span>
            <WinbackStatusBadge status={localStatus} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Info Card */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {household.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${household.phone}`} className="text-primary hover:underline">
                      {formatPhone(household.phone)}
                    </a>
                  </div>
                )}
                {household.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${household.email}`} className="text-primary hover:underline truncate">
                      {household.email}
                    </a>
                  </div>
                )}
                {zipCode && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>ZIP: {zipCode}</span>
                  </div>
                )}
                {household.earliest_winback_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className={cn(isBefore(new Date(household.earliest_winback_date), today) && 'text-red-500 font-medium')}>
                      Winback: {format(new Date(household.earliest_winback_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Assigned To</label>
            <Select value={assignedTo} onValueChange={handleAssignmentChange}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Activity Log */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Activity Log</h3>
            <WinbackActivityLog
              activities={activities}
              loading={activitiesLoading}
              onLogActivity={logActivity}
            />
          </div>

          {/* Policies Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Terminated Policies ({policies.length})</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Terminated</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Premium</TableHead>
                    <TableHead>Winback Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">Loading policies...</TableCell>
                    </TableRow>
                  ) : policies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No policies found</TableCell>
                    </TableRow>
                  ) : (
                    policies.map((policy) => {
                      const winbackDate = policy.calculated_winback_date ? new Date(policy.calculated_winback_date) : null;
                      const isOverdue = winbackDate && isBefore(winbackDate, today);
                      const premiumChange = policy.premium_old_cents && policy.premium_new_cents
                        ? ((policy.premium_new_cents - policy.premium_old_cents) / policy.premium_old_cents) * 100
                        : null;

                      return (
                        <TableRow key={policy.id}>
                          <TableCell className="font-mono text-sm">{policy.policy_number}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {policy.product_name || policy.product_code || '—'}
                              {policy.account_type === 'C/R' && (
                                <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">C/R</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {policy.termination_effective_date ? format(new Date(policy.termination_effective_date), 'MMM d, yyyy') : '—'}
                          </TableCell>
                          <TableCell>
                            <span className="truncate max-w-[150px] inline-block" title={policy.termination_reason || ''}>
                              {policy.termination_reason || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span>{formatCurrency(policy.premium_old_cents)}</span>
                              {premiumChange !== null && premiumChange !== 0 && (
                                <span className={cn('text-xs', premiumChange > 0 ? 'text-red-400' : 'text-green-400')}>
                                  {premiumChange > 0 ? '+' : ''}{premiumChange.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {winbackDate ? (
                              <span className={cn(isOverdue && 'text-red-500 font-medium')}>
                                {format(winbackDate, 'MMM d, yyyy')}
                              </span>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
            <div className="flex flex-wrap gap-2">
              {localStatus === 'untouched' && (
                <>
                  <Button onClick={() => handleStatusChange('in_progress')} disabled={saving}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Working
                  </Button>
                  <Button variant="outline" onClick={handleNotNow} disabled={saving} className="flex flex-col items-center py-3 h-auto">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Not Now
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">(pushes to next renewal)</span>
                  </Button>
                </>
              )}
              
              {localStatus === 'in_progress' && (
                <>
                  <Button onClick={() => handleStatusChange('won_back')} disabled={saving} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Won Back
                  </Button>
                  <Button variant="outline" onClick={handleNotNow} disabled={saving} className="flex flex-col items-center py-3 h-auto">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Not Now
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">(pushes to next renewal)</span>
                  </Button>
                </>
              )}
              
              {localStatus === 'won_back' && (
                <Button variant="outline" onClick={() => handleStatusChange('in_progress')} disabled={saving}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reopen
                </Button>
              )}

              {localStatus === 'dismissed' && (
                <Button variant="outline" onClick={() => handleStatusChange('untouched')} disabled={saving}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore
                </Button>
              )}
            </div>
            
            {localStatus !== 'won_back' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-red-500 hover:text-red-600" disabled={saving}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this household?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {household?.first_name} {household?.last_name} and all associated policies from Win-Back HQ. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePermanentDelete} className="bg-red-600 hover:bg-red-700">
                      Delete Permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
