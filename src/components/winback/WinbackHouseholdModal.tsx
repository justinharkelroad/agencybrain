import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { WinbackStatusBadge } from './WinbackStatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Phone, Mail, MapPin, Calendar, Play, CheckCircle, RotateCcw, Save, Trash2, Clock } from 'lucide-react';
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
  onUpdate,
}: WinbackHouseholdModalProps) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('unassigned');
  const [localStatus, setLocalStatus] = useState<Household['status']>('untouched');

  useEffect(() => {
    if (open && household) {
      setNotes(household.notes || '');
      setAssignedTo(household.assigned_to || 'unassigned');
      setLocalStatus(household.status);
      fetchPolicies(household.id);
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

  const handleSave = async () => {
    if (!household) return;
    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        notes,
        assigned_to: assignedTo === 'unassigned' ? null : assignedTo,
        updated_at: new Date().toISOString(),
      };

      if (assignedTo && assignedTo !== 'unassigned' && household.status === 'untouched') {
        updateData.status = 'in_progress';
      }

      const { error } = await supabase
        .from('winback_households')
        .update(updateData)
        .eq('id', household.id);

      if (error) throw error;
      toast.success('Household updated');
      onUpdate();
    } catch (err) {
      console.error('Error saving household:', err);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: Household['status']) => {
    if (!household) return;
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
    if (!household) return;
    setSaving(true);

    try {
      const { data: householdPolicies, error: fetchError } = await supabase
        .from('winback_policies')
        .select('id, policy_term_months, calculated_winback_date')
        .eq('household_id', household.id);

      if (fetchError) throw fetchError;

      if (!householdPolicies || householdPolicies.length === 0) {
        toast.error('No policies found');
        setSaving(false);
        return;
      }

      for (const policy of householdPolicies) {
        const currentWinbackDate = new Date(policy.calculated_winback_date);
        const termMonths = policy.policy_term_months || 12;
        const nextWinbackDate = new Date(currentWinbackDate);
        nextWinbackDate.setMonth(nextWinbackDate.getMonth() + termMonths);

        await supabase
          .from('winback_policies')
          .update({ calculated_winback_date: nextWinbackDate.toISOString().split('T')[0] })
          .eq('id', policy.id);
      }

      // Try RPC, fallback to manual update
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

          {/* Assignment & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assigned To</label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this household..."
                rows={3}
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>

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
                <Button onClick={() => handleStatusChange('in_progress')} disabled={saving}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Working
                </Button>
              )}
              
              {localStatus === 'in_progress' && (
                <>
                  <Button onClick={() => handleStatusChange('won_back')} disabled={saving} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Won Back
                  </Button>
                  <Button variant="outline" onClick={handleNotNow} disabled={saving}>
                    <Clock className="h-4 w-4 mr-2" />
                    Not Now
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
            
            {localStatus !== 'dismissed' && localStatus !== 'won_back' && (
              <Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleStatusChange('dismissed')} disabled={saving}>
                <Trash2 className="h-4 w-4 mr-2" />
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}