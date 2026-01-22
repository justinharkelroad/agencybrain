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
import { toast } from 'sonner';
import { Phone, Mail, MapPin, Calendar, Play, CheckCircle, RotateCcw, Trash2, Clock } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Household } from './WinbackHouseholdTable';
import * as winbackApi from '@/lib/winbackApi';
import { supabase } from '@/integrations/supabase/client';

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
  contactDaysBefore?: number;
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
  contactDaysBefore = 45,
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
      fetchHouseholdDetails(household.id);
    }
  }, [open, household]);

  const fetchHouseholdDetails = async (householdId: string) => {
    setLoading(true);
    setActivitiesLoading(true);
    try {
      const { policies: fetchedPolicies, activities: fetchedActivities } = 
        await winbackApi.getHouseholdDetails(householdId);
      setPolicies(fetchedPolicies as Policy[]);
      setActivities(fetchedActivities as Activity[]);
    } catch (err) {
      console.error('Error fetching household details:', err);
      toast.error('Failed to load household details');
    } finally {
      setLoading(false);
      setActivitiesLoading(false);
    }
  };

  // Helper to generate LQS household key (same format as ContactProfileModal)
  const generateHouseholdKey = (firstName: string, lastName: string, zipCode: string | null): string => {
    const fn = (firstName || '').toLowerCase().trim();
    const ln = (lastName || '').toLowerCase().trim();
    const zip = (zipCode || '').substring(0, 5);
    return `${fn}-${ln}-${zip}`;
  };

  const logActivity = async (type: string, notes: string) => {
    if (!household || !agencyId) return;

    try {
      // SPECIAL CASE: "quoted" triggers full LQS transition, not just activity log
      if (type === 'quoted') {
        if (winbackApi.isStaffUser()) {
          // Staff users: call edge function for full flow
          const result = await winbackApi.winbackToQuoted(
            household.id,
            agencyId,
            household.contact_id || null,
            household.first_name || '',
            household.last_name || '',
            household.zip_code || '',
            household.phone ? [household.phone] : [],
            household.email || null,
            currentUserTeamMemberId
          );

          if (!result.success) {
            toast.error('Failed to move to Quoted', { description: result.error });
            return;
          }
        } else {
          // Agency owners: replicate ContactProfileModal logic
          
          // Step 1: Find or create "Winback" lead source
          let winbackLeadSourceId: string | null = null;

          const { data: existingSource } = await supabase
            .from('lead_sources')
            .select('id')
            .eq('agency_id', agencyId)
            .ilike('name', 'winback')
            .limit(1)
            .single();

          if (existingSource) {
            winbackLeadSourceId = existingSource.id;
          } else {
            const { data: newSource, error: createError } = await supabase
              .from('lead_sources')
              .insert({
                agency_id: agencyId,
                name: 'Winback',
                is_active: true,
                is_self_generated: false,
                cost_type: 'per_lead',
                cost_per_lead_cents: 0,
              })
              .select('id')
              .single();

            if (!createError && newSource) {
              winbackLeadSourceId = newSource.id;
            }
          }

          // Step 2: Create/update LQS record
          const householdKey = generateHouseholdKey(
            household.first_name || '',
            household.last_name || '',
            household.zip_code
          );

          const today = new Date().toISOString().split('T')[0];

          const { error: lqsError } = await supabase
            .from('lqs_households')
            .upsert({
              agency_id: agencyId,
              household_key: householdKey,
              first_name: (household.first_name || '').toUpperCase(),
              last_name: (household.last_name || '').toUpperCase(),
              zip_code: household.zip_code || '',
              contact_id: household.contact_id || null,
              status: 'quoted',
              lead_source_id: winbackLeadSourceId,
              team_member_id: currentUserTeamMemberId || null,
              first_quote_date: today,
              lead_received_date: today,
              updated_at: new Date().toISOString(),
              phone: household.phone ? [household.phone] : [],
              email: household.email || null,
            }, {
              onConflict: 'agency_id,household_key',
            });

          if (lqsError) {
            console.error('LQS upsert error:', lqsError);
            // Continue anyway - LQS creation is not critical for status update
          }

          // Step 3: Update winback status to moved_to_quoted
          const winbackResult = await winbackApi.transitionToQuoted(
            household.id,
            agencyId,
            currentUserTeamMemberId,
            teamMembers
          );

          if (!winbackResult.success) {
            toast.error('Failed to move to Quoted', {
              description: 'Winback status could not be updated. The record may already be in a terminal state.'
            });
            return;
          }

          // Step 4: Log the activity
          await winbackApi.logActivity(
            household.id,
            agencyId,
            'quoted',
            notes || 'Moved to Quoted Household',
            currentUserTeamMemberId,
            teamMembers
          );
        }

        toast.success('Moved to Quoted!', { description: 'Contact is now a Quoted Household' });
        setLocalStatus('moved_to_quoted');
        onUpdate();
        return;
      }

      // Normal activity logging for other types (called, texted, emailed, etc.)
      await winbackApi.logActivity(
        household.id,
        agencyId,
        type,
        notes,
        currentUserTeamMemberId,
        teamMembers
      );
      
      // Refresh activities
      const { activities: refreshedActivities } = await winbackApi.getHouseholdDetails(household.id);
      setActivities(refreshedActivities as Activity[]);
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
      const result = await winbackApi.updateAssignment(
        household.id,
        newAssignedTo,
        localStatus
      );
      
      if (result.newStatus) {
        setLocalStatus(result.newStatus as Household['status']);
      }
      
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
      const result = await winbackApi.updateHouseholdStatus(
        household.id,
        agencyId,
        newStatus,
        oldStatus,
        currentUserTeamMemberId,
        teamMembers,
        assignedTo === 'unassigned' ? null : assignedTo
      );

      // Check if update actually succeeded
      if (!result.success) {
        toast.error('Failed to update status', { description: 'Status may have already been changed' });
        // Refresh to get actual state
        fetchHouseholdDetails(household.id);
        onUpdate();
        return;
      }

      if (result.assigned_to) {
        setAssignedTo(result.assigned_to);
      }

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
      await winbackApi.pushToNextCycle(
        household.id,
        agencyId,
        contactDaysBefore,
        currentUserTeamMemberId,
        teamMembers
      );

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
      await winbackApi.permanentDeleteHousehold(household.id);

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
