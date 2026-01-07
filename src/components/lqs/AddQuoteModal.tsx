import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LqsLeadSource } from '@/hooks/useLqsData';
import { format } from 'date-fns';

interface AddQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  leadSources: LqsLeadSource[];
  teamMembers: { id: string; name: string }[];
  currentTeamMemberId?: string | null;
  onSuccess: () => void;
}

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

export function AddQuoteModal({
  open,
  onOpenChange,
  agencyId,
  leadSources,
  teamMembers,
  currentTeamMemberId,
  onSuccess,
}: AddQuoteModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [productType, setProductType] = useState('');
  const [premium, setPremium] = useState('');
  const [quoteDate, setQuoteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [teamMemberId, setTeamMemberId] = useState(currentTeamMemberId || '');
  const [leadSourceId, setLeadSourceId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setZipCode('');
    setProductType('');
    setPremium('');
    setQuoteDate(format(new Date(), 'yyyy-MM-dd'));
    setTeamMemberId(currentTeamMemberId || '');
    setLeadSourceId('');
    setPhone('');
    setEmail('');
  };

  const handleSubmit = async () => {
    // Validation
    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!lastName.trim()) {
      toast.error('Last name is required');
      return;
    }
    if (!zipCode.trim() || zipCode.length !== 5) {
      toast.error('Valid 5-digit ZIP code is required');
      return;
    }
    if (!productType) {
      toast.error('Product type is required');
      return;
    }
    if (!premium || isNaN(parseFloat(premium)) || parseFloat(premium) <= 0) {
      toast.error('Valid premium amount is required');
      return;
    }
    if (!quoteDate) {
      toast.error('Quote date is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate household key
      const householdKey = `${lastName.trim().toUpperCase()}_${firstName.trim().toUpperCase()}_${zipCode.trim()}`;
      const premiumCents = Math.round(parseFloat(premium) * 100);

      // Find or create household
      const { data: existingHousehold } = await supabase
        .from('lqs_households')
        .select('id, status')
        .eq('agency_id', agencyId)
        .eq('household_key', householdKey)
        .maybeSingle();

      let householdId: string;

      if (existingHousehold) {
        householdId = existingHousehold.id;
        
        // Update household - change status to quoted if was lead
        const updates: Record<string, unknown> = {};
        if (existingHousehold.status === 'lead') {
          updates.status = 'quoted';
        }
        if (phone) updates.phone = phone;
        if (email) updates.email = email;
        if (leadSourceId) {
          updates.lead_source_id = leadSourceId;
          updates.needs_attention = false;
        }
        if (teamMemberId) updates.team_member_id = teamMemberId;

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('lqs_households')
            .update(updates)
            .eq('id', householdId);
          
          if (updateError) throw updateError;
        }
      } else {
        // Create new household
        const { data: newHousehold, error: insertError } = await supabase
          .from('lqs_households')
          .insert({
            agency_id: agencyId,
            household_key: householdKey,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            zip_code: zipCode.trim(),
            phone: phone || null,
            email: email || null,
            status: 'quoted',
            lead_source_id: leadSourceId || null,
            team_member_id: teamMemberId || null,
            needs_attention: !leadSourceId,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        householdId = newHousehold.id;
      }

      // Create quote record
      const { error: quoteError } = await supabase
        .from('lqs_quotes')
        .insert({
          household_id: householdId,
          product_type: productType,
          premium_cents: premiumCents,
          quote_date: quoteDate,
          source: 'manual',
        });

      if (quoteError) throw quoteError;

      toast.success('Quote added successfully');
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding quote:', error);
      toast.error('Failed to add quote');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group lead sources by bucket
  const groupedSources = leadSources.reduce((acc, source) => {
    const bucketName = source.bucket?.name || 'Unassigned';
    if (!acc[bucketName]) {
      acc[bucketName] = [];
    }
    acc[bucketName].push(source);
    return acc;
  }, {} as Record<string, LqsLeadSource[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Quote</DialogTitle>
          <DialogDescription>
            Enter quote information. Name, ZIP, product, premium, and date are required.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
              />
            </div>
          </div>

          {/* ZIP Code */}
          <div className="space-y-2">
            <Label htmlFor="zipCode">
              ZIP Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="zipCode"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="12345"
              maxLength={5}
            />
          </div>

          {/* Product & Premium Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="productType">
                Product Type <span className="text-destructive">*</span>
              </Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product..." />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {PRODUCT_OPTIONS.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="premium">
                Premium <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="premium"
                  type="number"
                  step="0.01"
                  min="0"
                  value={premium}
                  onChange={(e) => setPremium(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              </div>
            </div>
          </div>

          {/* Quote Date */}
          <div className="space-y-2">
            <Label htmlFor="quoteDate">
              Quote Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quoteDate"
              type="date"
              value={quoteDate}
              onChange={(e) => setQuoteDate(e.target.value)}
            />
          </div>

          {/* Sub-Producer */}
          <div className="space-y-2">
            <Label htmlFor="teamMember">Sub-Producer</Label>
            <Select value={teamMemberId} onValueChange={setTeamMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select producer..." />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lead Source */}
          <div className="space-y-2">
            <Label htmlFor="leadSource">Lead Source</Label>
            <Select value={leadSourceId} onValueChange={setLeadSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select lead source..." />
              </SelectTrigger>
              <SelectContent side="bottom" position="popper" className="max-h-[200px] bg-background z-50">
                {Object.entries(groupedSources).map(([bucketName, sources]) => (
                  <div key={bucketName}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {bucketName}
                    </div>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact Info Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Quote'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
