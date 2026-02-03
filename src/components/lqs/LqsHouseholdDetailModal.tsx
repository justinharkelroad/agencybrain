import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  Pencil,
  X,
  Check,
  Mail,
  Phone,
  MapPin,
  User,
  Calendar,
  FileText,
  Tag,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { HouseholdWithRelations } from '@/hooks/useLqsData';
import { filterCountableQuotes } from '@/lib/lqs-constants';
import { formatPhoneNumber } from '@/lib/utils';

interface LqsHouseholdDetailModalProps {
  household: HouseholdWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignLeadSource?: (householdId: string) => void;
  teamMembers?: { id: string; name: string }[];
  staffSessionToken?: string | null;
}

export function LqsHouseholdDetailModal({
  household,
  open,
  onOpenChange,
  onAssignLeadSource,
  teamMembers,
  staffSessionToken,
}: LqsHouseholdDetailModalProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editPhones, setEditPhones] = useState<string[]>([]);
  const [editEmail, setEditEmail] = useState('');
  const [editZipCode, setEditZipCode] = useState('');
  const [editTeamMemberId, setEditTeamMemberId] = useState('');
  const [deletedQuoteIds, setDeletedQuoteIds] = useState<string[]>([]);
  const [conflictingSourceName, setConflictingSourceName] = useState<string | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [showAddQuoteForm, setShowAddQuoteForm] = useState(false);
  const [isAddingQuote, setIsAddingQuote] = useState(false);
  const [showAddSaleForm, setShowAddSaleForm] = useState(false);
  const [isAddingSale, setIsAddingSale] = useState(false);

  const PRODUCT_OPTIONS = [
    'Standard Auto',
    'Non-Standard Auto',
    'Homeowners',
    'Renters',
    'Condo',
    'Umbrella',
    'Life',
    'Motorcycle',
    'Boat',
    'RV',
    'Other',
  ];

  const [newQuote, setNewQuote] = useState({
    productType: '',
    premium: '',
    items: '1',
    quoteDate: format(new Date(), 'yyyy-MM-dd'),
    issuedPolicyNumber: '',
  });

  const [newSale, setNewSale] = useState({
    productType: '',
    premium: '',
    items: '1',
    policies: '1',
    saleDate: format(new Date(), 'yyyy-MM-dd'),
    policyNumber: '',
  });

  // Fetch conflicting lead source name if there's a conflict
  useEffect(() => {
    async function fetchConflictingSource() {
      if (household?.attention_reason === 'source_conflict' && household.conflicting_lead_source_id) {
        const { data } = await supabase
          .from('lead_sources')
          .select('name')
          .eq('id', household.conflicting_lead_source_id)
          .single();
        setConflictingSourceName(data?.name || 'Unknown Source');
      } else {
        setConflictingSourceName(null);
      }
    }
    fetchConflictingSource();
  }, [household?.attention_reason, household?.conflicting_lead_source_id]);

  // Handle conflict resolution
  const handleResolveConflict = async (action: 'keep_current' | 'use_new' | 'dismiss') => {
    if (!household) return;
    setIsResolvingConflict(true);

    try {
      const updates: Record<string, any> = {
        needs_attention: false,
        attention_reason: null,
        conflicting_lead_source_id: null,
      };

      if (action === 'use_new' && household.conflicting_lead_source_id) {
        // Switch to the conflicting source
        updates.lead_source_id = household.conflicting_lead_source_id;
      }
      // 'keep_current' and 'dismiss' just clear the conflict flag

      const { error } = await supabase
        .from('lqs_households')
        .update(updates)
        .eq('id', household.id);

      if (error) throw error;

      toast.success(
        action === 'use_new'
          ? `Lead source changed to ${conflictingSourceName}`
          : 'Conflict resolved'
      );

      queryClient.invalidateQueries({ queryKey: ['lqs-households'] });
      queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
    } catch (err: any) {
      toast.error('Failed to resolve conflict: ' + err.message);
    } finally {
      setIsResolvingConflict(false);
    }
  };

  // Reset edit state when household changes
  useEffect(() => {
    if (household) {
      // Handle both array and string formats for backwards compatibility
      const phones = Array.isArray(household.phone)
        ? household.phone
        : household.phone ? [household.phone] : [];
      setEditPhones(phones.length > 0 ? phones : ['']);
      setEditEmail(household.email || '');
      setEditZipCode(household.zip_code || '');
      setEditTeamMemberId(household.team_member_id || '');
      setDeletedQuoteIds([]);
      setIsEditing(false);
      setShowAddQuoteForm(false);
      setShowAddSaleForm(false);
      setNewQuote({
        productType: '',
        premium: '',
        items: '1',
        quoteDate: format(new Date(), 'yyyy-MM-dd'),
        issuedPolicyNumber: '',
      });
      setNewSale({
        productType: '',
        premium: '',
        items: '1',
        policies: '1',
        saleDate: format(new Date(), 'yyyy-MM-dd'),
        policyNumber: '',
      });
    }
  }, [household]);

  const handleAddPhone = () => {
    setEditPhones([...editPhones, '']);
  };

  const handleRemovePhone = (index: number) => {
    if (editPhones.length > 1) {
      setEditPhones(editPhones.filter((_, i) => i !== index));
    }
  };

  const handlePhoneChange = (index: number, value: string) => {
    const formatted = formatPhoneNumber(value);
    const newPhones = [...editPhones];
    newPhones[index] = formatted;
    setEditPhones(newPhones);
  };

  // Validate ZIP code format (5 digits or 5+4)
  const isValidZip = (zip: string): boolean => {
    if (!zip) return true; // Empty is valid
    return /^\d{5}(-\d{4})?$/.test(zip);
  };

  const handleSave = async () => {
    if (!household) return;

    // Validate ZIP if provided
    if (editZipCode && !isValidZip(editZipCode)) {
      toast.error('Invalid ZIP code format. Use 5 digits (12345) or 5+4 (12345-6789)');
      return;
    }

    setIsSaving(true);
    try {
      // Delete marked quotes first
      if (deletedQuoteIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('lqs_quotes')
          .delete()
          .in('id', deletedQuoteIds);
        if (deleteError) throw deleteError;
      }

      // Filter out empty phone values
      const cleanedPhones = editPhones.filter(p => p.trim() !== '');

      // Determine if we need to update status (when all quotes are deleted)
      const remainingQuotes = (household.quotes || []).filter(q => !deletedQuoteIds.includes(q.id));
      const shouldRevertToLead = household.status === 'quoted' && remainingQuotes.length === 0;

      const { error } = await supabase
        .from('lqs_households')
        .update({
          phone: cleanedPhones.length > 0 ? cleanedPhones : null,
          email: editEmail || null,
          zip_code: editZipCode || null,
          team_member_id: editTeamMemberId || null,
          ...(shouldRevertToLead && { status: 'lead', first_quote_date: null }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', household.id);

      if (error) throw error;

      toast.success('Saved');
      setIsEditing(false);
      setDeletedQuoteIds([]);
      // Invalidate and close modal so fresh data shows on next open
      queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (household) {
      const phones = Array.isArray(household.phone)
        ? household.phone
        : household.phone ? [household.phone] : [];
      setEditPhones(phones.length > 0 ? phones : ['']);
      setEditEmail(household.email || '');
      setEditZipCode(household.zip_code || '');
      setEditTeamMemberId(household.team_member_id || '');
      setDeletedQuoteIds([]);
    }
    setIsEditing(false);
    setShowDeleteConfirm(false);
  };

  const handleAddQuote = async () => {
    if (!household) return;
    if (!newQuote.productType) {
      toast.error('Product type is required');
      return;
    }
    const premiumNumber = parseFloat(newQuote.premium);
    if (isNaN(premiumNumber) || premiumNumber <= 0) {
      toast.error('Valid premium is required');
      return;
    }

    setIsAddingQuote(true);
    try {
      // Staff path - use edge function
      if (staffSessionToken) {
        const { data, error } = await supabase.functions.invoke('staff_add_quote', {
          headers: { 'x-staff-session': staffSessionToken },
          body: {
            first_name: household.first_name,
            last_name: household.last_name,
            zip_code: household.zip_code,
            phone: Array.isArray(household.phone) ? household.phone[0] : household.phone || undefined,
            email: household.email || undefined,
            lead_source_id: household.lead_source_id || undefined,
            quote_date: newQuote.quoteDate,
            products: [
              {
                productType: newQuote.productType,
                premium: newQuote.premium,
                items: newQuote.items,
                issued_policy_number: newQuote.issuedPolicyNumber || undefined,
              },
            ],
          },
        });

        if (error) throw new Error(error.message || 'Failed to add quote');
        if (data?.error) throw new Error(data.error);
      } else {
        const { error } = await supabase
          .from('lqs_quotes')
          .insert({
            household_id: household.id,
            agency_id: household.agency_id,
            team_member_id: editTeamMemberId || household.team_member_id || null,
            quote_date: newQuote.quoteDate,
            product_type: newQuote.productType,
            items_quoted: parseInt(newQuote.items, 10) || 1,
            premium_cents: Math.round(premiumNumber * 100),
            issued_policy_number: newQuote.issuedPolicyNumber || null,
            source: 'manual',
          });
        if (error) throw error;
      }

      toast.success('Quote added');
      setShowAddQuoteForm(false);
      setNewQuote({
        productType: '',
        premium: '',
        items: '1',
        quoteDate: format(new Date(), 'yyyy-MM-dd'),
        issuedPolicyNumber: '',
      });
      queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
      queryClient.invalidateQueries({ queryKey: ['staff-lqs-data'] });
    } catch (err: any) {
      toast.error(`Failed to add quote: ${err.message || err}`);
    } finally {
      setIsAddingQuote(false);
    }
  };

  const handleAddPolicy = async () => {
    if (!household) return;
    if (!newSale.productType) {
      toast.error('Product type is required');
      return;
    }
    const premiumNumber = parseFloat(newSale.premium);
    if (isNaN(premiumNumber) || premiumNumber <= 0) {
      toast.error('Valid premium is required');
      return;
    }

    setIsAddingSale(true);
    try {
      if (staffSessionToken) {
        const { data, error } = await supabase.functions.invoke('staff_add_policy', {
          headers: { 'x-staff-session': staffSessionToken },
          body: {
            household_id: household.id,
            sale_date: newSale.saleDate,
            product_type: newSale.productType,
            premium: newSale.premium,
            items_sold: parseInt(newSale.items, 10) || 1,
            policies_sold: parseInt(newSale.policies, 10) || 1,
            policy_number: newSale.policyNumber || undefined,
            team_member_id: editTeamMemberId || household.team_member_id || undefined,
          },
        });

        if (error) throw new Error(error.message || 'Failed to add policy');
        if (data?.error) throw new Error(data.error);
      } else {
        const { error } = await supabase
          .from('lqs_sales')
          .insert({
            household_id: household.id,
            agency_id: household.agency_id,
            team_member_id: editTeamMemberId || household.team_member_id || null,
            sale_date: newSale.saleDate,
            product_type: newSale.productType,
            items_sold: parseInt(newSale.items, 10) || 1,
            policies_sold: parseInt(newSale.policies, 10) || 1,
            premium_cents: Math.round(premiumNumber * 100),
            policy_number: newSale.policyNumber || null,
            source: 'manual',
          });
        if (error) throw error;
      }

      toast.success('Policy added');
      setShowAddSaleForm(false);
      setNewSale({
        productType: '',
        premium: '',
        items: '1',
        policies: '1',
        saleDate: format(new Date(), 'yyyy-MM-dd'),
        policyNumber: '',
      });
      queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
      queryClient.invalidateQueries({ queryKey: ['staff-lqs-data'] });
    } catch (err: any) {
      toast.error(`Failed to add policy: ${err.message || err}`);
    } finally {
      setIsAddingSale(false);
    }
  };

  const handleDeleteHousehold = async () => {
    if (!household) return;

    setIsDeleting(true);
    try {
      // Delete household (cascade will delete quotes and sales)
      const { error } = await supabase
        .from('lqs_households')
        .delete()
        .eq('id', household.id);

      if (error) throw error;

      toast.success('Household deleted');
      queryClient.invalidateQueries({ queryKey: ['lqs-data'] });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete household:', error);
      toast.error('Failed to delete household');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!household) return null;

  // Get phone numbers as array for display
  const phoneNumbers = Array.isArray(household.phone) 
    ? household.phone 
    : household.phone ? [household.phone] : [];

  // For SOLD households, use sales data; for others, use quotes
  const isSold = household.status === 'sold';
  const sales = household.sales || [];
  const countableQuotes = filterCountableQuotes(household.quotes || []);

  // Products: from sales if sold, from quotes otherwise
  const uniqueProducts = isSold && sales.length > 0
    ? [...new Set(sales.map(s => s.product_type))]
    : [...new Set(countableQuotes.map(q => q.product_type))];

  // Premium: from sales if sold, from quotes otherwise
  const totalPremium = isSold && sales.length > 0
    ? sales.reduce((sum, s) => sum + (s.premium_cents || 0), 0)
    : countableQuotes.reduce((sum, q) => sum + (q.premium_cents || 0), 0);

  // Count for the totals section
  const displayCount = isSold && sales.length > 0 ? sales.length : countableQuotes.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Household Details</span>
            {!isEditing ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            View and edit household contact information, quotes, and sales
          </DialogDescription>
        </DialogHeader>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Delete this household?</AlertTitle>
            <AlertDescription className="space-y-3">
              <p className="text-sm">
                This will permanently delete {household.first_name} {household.last_name} and all associated quotes and sales records.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteHousehold}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Customer Info Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {household.last_name.toUpperCase()}, {household.first_name}
              </h3>
              <div className="flex items-center gap-2">
                <Badge
                  variant={household.status === 'sold' ? 'default' : 'secondary'}
                >
                  {household.status.charAt(0).toUpperCase() + household.status.slice(1)}
                </Badge>
                {household.needs_attention && (
                  <Badge variant="destructive">Needs Attention</Badge>
                )}
              </div>
            </div>

            {/* Contact Info Grid */}
            <div className="grid grid-cols-1 gap-3 text-sm">
              {/* Phone(s) */}
              <div className="flex items-start gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 flex-shrink-0 mt-1" />
                {isEditing ? (
                  <div className="flex-1 space-y-2">
                    {editPhones.map((phone, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={phone}
                          onChange={(e) => handlePhoneChange(index, e.target.value)}
                          placeholder={`Phone ${index + 1}`}
                          className="h-8 flex-1"
                        />
                        {editPhones.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleRemovePhone(index)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleAddPhone}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Phone
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {phoneNumbers.length > 0 ? (
                      phoneNumbers.map((phone, index) => (
                        <a
                          key={index}
                          href={`tel:${phone}`}
                          className="hover:underline text-foreground"
                        >
                          {phone}
                        </a>
                      ))
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 flex-shrink-0" />
                {isEditing ? (
                  <Input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Email"
                    className="h-8"
                  />
                ) : (
                  <span>{household.email || '—'}</span>
                )}
              </div>

              {/* ZIP & Producer row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  {isEditing ? (
                    <Input
                      value={editZipCode}
                      onChange={(e) => setEditZipCode(e.target.value)}
                      placeholder="ZIP Code"
                      className="h-8"
                    />
                  ) : (
                    <span>{household.zip_code || '—'}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4 flex-shrink-0" />
                  {isEditing ? (
                    <Select
                      value={editTeamMemberId || '__unassigned__'}
                      onValueChange={(val) => setEditTeamMemberId(val === '__unassigned__' ? '' : val)}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="Select producer..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                        {(!teamMembers || teamMembers.length === 0) ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No team members found
                          </div>
                        ) : (
                          teamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span>{household.team_member?.name || '—'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Lead Source Section */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Lead Source
            </h4>

            {/* Source Conflict Alert */}
            {household.attention_reason === 'source_conflict' && conflictingSourceName && (
              <Alert variant="destructive" className="border-orange-500 bg-orange-500/10">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <AlertTitle className="text-orange-700 dark:text-orange-400">
                  Lead Source Conflict
                </AlertTitle>
                <AlertDescription className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">This household was claimed by two different lead sources:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Currently:</span>{' '}
                        <Badge variant="outline" className="ml-1">
                          {household.lead_source?.name || 'Unknown'}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Also claimed by:</span>{' '}
                        <Badge variant="secondary" className="ml-1">
                          {conflictingSourceName}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveConflict('keep_current')}
                      disabled={isResolvingConflict}
                    >
                      {isResolvingConflict && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Keep {household.lead_source?.name || 'Current'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveConflict('use_new')}
                      disabled={isResolvingConflict}
                    >
                      {isResolvingConflict && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Change to {conflictingSourceName}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResolveConflict('dismiss')}
                      disabled={isResolvingConflict}
                    >
                      Dismiss
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Normal Lead Source Display (when no conflict) */}
            {household.attention_reason !== 'source_conflict' && (
              <>
                {household.lead_source ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {household.lead_source.name}
                    </Badge>
                    {household.lead_source.bucket && (
                      <span className="text-sm text-muted-foreground">
                        ({household.lead_source.bucket.name})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm">Not assigned</span>
                    {onAssignLeadSource && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onAssignLeadSource(household.id);
                          onOpenChange(false);
                        }}
                      >
                        Assign Lead Source
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <Separator />

          {/* Quotes Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Quotes ({household.quotes?.length || 0})
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddQuoteForm((prev) => !prev)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {showAddQuoteForm ? 'Cancel' : 'Add Quote'}
              </Button>
            </div>

            {showAddQuoteForm && (
              <Card className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Product Type</label>
                    <Select
                      value={newQuote.productType}
                      onValueChange={(val) => setNewQuote((prev) => ({ ...prev, productType: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {PRODUCT_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Quote Date</label>
                    <Input
                      type="date"
                      value={newQuote.quoteDate}
                      onChange={(e) => setNewQuote((prev) => ({ ...prev, quoteDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">Premium</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newQuote.premium}
                      onChange={(e) => setNewQuote((prev) => ({ ...prev, premium: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Items</label>
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      value={newQuote.items}
                      onChange={(e) => setNewQuote((prev) => ({ ...prev, items: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Policy # (optional)</label>
                    <Input
                      value={newQuote.issuedPolicyNumber}
                      onChange={(e) => setNewQuote((prev) => ({ ...prev, issuedPolicyNumber: e.target.value }))}
                      placeholder="Policy number"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleAddQuote} disabled={isAddingQuote}>
                    {isAddingQuote ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save Quote
                  </Button>
                </div>
              </Card>
            )}

            {household.quotes?.length ? (
              <div className="space-y-3">
                {household.quotes.map((quote) => (
                  <Card
                    key={quote.id}
                    className={deletedQuoteIds.includes(quote.id) ? "opacity-50 bg-destructive/10" : ""}
                  >
                    <CardHeader className="py-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{quote.product_type}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold">
                            ${((quote.premium_cents || 0) / 100).toLocaleString()}
                          </div>
                          {isEditing && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={deletedQuoteIds.includes(quote.id) ? "text-muted-foreground" : "text-destructive hover:text-destructive"}
                              onClick={() => {
                                if (deletedQuoteIds.includes(quote.id)) {
                                  setDeletedQuoteIds(deletedQuoteIds.filter(id => id !== quote.id));
                                } else {
                                  setDeletedQuoteIds([...deletedQuoteIds, quote.id]);
                                }
                              }}
                            >
                              {deletedQuoteIds.includes(quote.id) ? 'Undo' : <Trash2 className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          Quote: {quote.quote_date
                            ? format(parseISO(quote.quote_date), 'MMM d, yyyy')
                            : '—'}
                        </div>
                        {quote.issued_policy_number && (
                          <div className="text-green-600 dark:text-green-400 font-medium">
                            Policy: {quote.issued_policy_number}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No quotes recorded.</p>
            )}
          </div>

          <Separator />

          {/* Sales Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Policies ({household.sales?.length || 0})
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddSaleForm((prev) => !prev)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {showAddSaleForm ? 'Cancel' : 'Add Policy'}
              </Button>
            </div>

            {showAddSaleForm && (
              <Card className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Product Type</label>
                    <Select
                      value={newSale.productType}
                      onValueChange={(val) => setNewSale((prev) => ({ ...prev, productType: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {PRODUCT_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Sale Date</label>
                    <Input
                      type="date"
                      value={newSale.saleDate}
                      onChange={(e) => setNewSale((prev) => ({ ...prev, saleDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">Premium</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newSale.premium}
                      onChange={(e) => setNewSale((prev) => ({ ...prev, premium: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Items Sold</label>
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      value={newSale.items}
                      onChange={(e) => setNewSale((prev) => ({ ...prev, items: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Policies</label>
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      value={newSale.policies}
                      onChange={(e) => setNewSale((prev) => ({ ...prev, policies: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Policy # (optional)</label>
                    <Input
                      value={newSale.policyNumber}
                      onChange={(e) => setNewSale((prev) => ({ ...prev, policyNumber: e.target.value }))}
                      placeholder="Policy number"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleAddPolicy} disabled={isAddingSale}>
                    {isAddingSale ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save Policy
                  </Button>
                </div>
              </Card>
            )}

            {household.sales?.length ? (
              <div className="space-y-3">
                {household.sales.map((sale) => (
                  <Card key={sale.id}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{sale.product_type}</Badge>
                        </div>
                        <div className="text-base font-semibold">
                          ${((sale.premium_cents || 0) / 100).toLocaleString()}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          Sale: {sale.sale_date
                            ? format(parseISO(sale.sale_date), 'MMM d, yyyy')
                            : '—'}
                        </div>
                        {sale.policy_number && (
                          <div className="text-green-600 dark:text-green-400 font-medium">
                            Policy: {sale.policy_number}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No policies recorded.</p>
            )}
          </div>

          {/* Totals Section */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold">{displayCount}</div>
              <div className="text-sm text-muted-foreground">{isSold && sales.length > 0 ? 'Policies' : 'Quotes'}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{uniqueProducts.length}</div>
              <div className="text-sm text-muted-foreground">Products</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                ${(totalPremium / 100).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Premium</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
